import { describe, expect, it } from 'vitest'
import THREE from '@/shared/three'
import {
	allIds,
	centroid,
	createUvLayout,
	createUvSelection,
	faceAt,
	idsInRect,
	movingVerts,
	nearestVert,
	packIslands,
	pickedVerts,
	selectedFaces,
	transformUvs,
	uvStats,
	weldUvs,
	type UvSelection
} from '.'

/**
 * Tests run against the real primitives the editor creates, not hand-written
 * fixtures — the whole point of this module is coping with the vertex splitting
 * those geometries produce.
 */
function read(geometry: THREE.BufferGeometry) {
	const layout = createUvLayout({
		position: geometry.attributes.position.array,
		index: geometry.index?.array ?? null
	})
	return { layout, uv: Float32Array.from(geometry.attributes.uv.array) }
}

const cube = () => read(new THREE.BoxGeometry())
const sphere = () => read(new THREE.SphereGeometry(1, 16, 12))

function select(overrides: Partial<UvSelection> = {}): UvSelection {
	return { ...createUvSelection(), ...overrides }
}

describe('createUvLayout', () => {
	it('splits a cube into six islands over eight mesh vertices', () => {
		const { layout } = cube()

		expect(layout.vertCount).toBe(24)
		expect(layout.uvVertsOfMeshVert).toHaveLength(8)
		expect(layout.faceCount).toBe(12)
		expect(layout.islandCount).toBe(6)
	})

	it('reports every cube corner as three UV vertices', () => {
		const { layout } = cube()

		const group = layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[0]]

		expect(group).toHaveLength(3)
	})

	it('marks a torn mesh edge as a seam and an open border as not one', () => {
		const { layout } = cube()

		// Every cube edge is shared by two faces that were mapped separately,
		// so every UV border is a seam.
		expect(layout.edges.filter((edge) => edge.border && !edge.seam)).toHaveLength(0)
		expect(layout.seamCount).toBe(24)

		const plane = read(new THREE.PlaneGeometry())

		// A plane's outline is a real boundary, not a cut.
		expect(plane.layout.seamCount).toBe(0)
		expect(plane.layout.edges.filter((edge) => edge.border)).toHaveLength(4)
	})

	it('keeps a sphere as one island cut by a seam column', () => {
		const { layout } = sphere()

		expect(layout.islandCount).toBe(1)
		expect(layout.seamCount).toBeGreaterThan(0)
	})

	it('reads non-indexed geometry, one island per triangle', () => {
		const { layout } = read(new THREE.BoxGeometry().toNonIndexed())

		expect(layout.faceCount).toBe(12)
		// Islands are connected runs of faces over *shared UV vertices*, and a
		// non-indexed geometry shares none — so every triangle stands alone.
		// Documented rather than worked around; see `createUvLayout`.
		expect(layout.islandCount).toBe(12)
	})
})

describe('movingVerts', () => {
	// The decision the whole editor turns on: one click, three answers.
	it('moves only what was picked when sticky is off', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'off' })

		expect(movingVerts(layout, uv, selection).size).toBe(1)
	})

	it('drags every UV copy of a mesh vertex along when sticky is shared-vertex', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-vertex' })

		expect(movingVerts(layout, uv, selection).size).toBe(3)
	})

	it('leaves a deliberate seam alone when sticky is shared-location', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-location' })

		// Packed apart, the corner's twins are nowhere near it, so nothing joins
		// — where shared-vertex would have dragged all three and closed the seam.
		expect(movingVerts(layout, packed, selection).size).toBe(1)
		expect(movingVerts(layout, packed, { ...selection, sticky: 'shared-vertex' }).size).toBe(3)
	})

	it('still joins UV vertices that genuinely coincide', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-location' })

		// Fresh cube UVs stack all six faces on the tile, so the corner really
		// does share its spot with one vertex per face.
		expect(movingVerts(layout, uv, selection).size).toBe(6)
	})

	it('is empty when nothing is picked', () => {
		const { layout, uv } = cube()

		expect(movingVerts(layout, uv, select({ sticky: 'shared-vertex' })).size).toBe(0)
	})
})

describe('pickedVerts and selectedFaces', () => {
	it('resolves each mode to the same island when it names the same shape', () => {
		const { layout } = cube()
		const island = layout.islandOfVert[0]

		const byIsland = pickedVerts(layout, select({ mode: 'island', ids: new Set([island]) }))
		const byFaces = pickedVerts(
			layout,
			select({ mode: 'face', ids: new Set(layout.facesOfIsland[island]) })
		)

		expect([...byIsland].sort()).toEqual([...byFaces].sort())
	})

	it('highlights a face only when all three corners are picked', () => {
		const { layout } = cube()
		const [a, b] = [layout.faces[0], layout.faces[1]]

		expect(selectedFaces(layout, select({ mode: 'vertex', ids: new Set([a, b]) })).has(0)).toBe(
			false
		)

		const all = new Set([a, b, layout.faces[2]])
		expect(selectedFaces(layout, select({ mode: 'vertex', ids: all })).has(0)).toBe(true)
	})

	it('ignores ids that no longer exist', () => {
		const { layout } = cube()

		expect(pickedVerts(layout, select({ mode: 'face', ids: new Set([999]) })).size).toBe(0)
		expect(pickedVerts(layout, select({ mode: 'island', ids: new Set([999]) })).size).toBe(0)
	})
})

describe('transformUvs', () => {
	it('translates only the moving vertices', () => {
		const { layout, uv } = cube()
		// Packed first: on a stacked layout the default `shared-location` sticky
		// would legitimately drag the other islands' coincident corners along.
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'island', ids: new Set([0]) })

		const { uv: next, moved } = transformUvs(layout, packed, selection, { translate: [0.25, 0] })

		expect(moved).toBe(layout.vertsOfIsland[0].length)
		for (const vert of layout.vertsOfIsland[0]) {
			expect(next[vert * 2]).toBeCloseTo(packed[vert * 2] + 0.25)
		}
		for (const vert of layout.vertsOfIsland[1]) {
			expect(next[vert * 2]).toBeCloseTo(packed[vert * 2])
		}
	})

	it('returns the original buffer untouched when nothing is selected', () => {
		const { layout, uv } = cube()

		const result = transformUvs(layout, uv, select(), { translate: [1, 1] })

		expect(result.moved).toBe(0)
		expect(result.uv).toBe(uv)
	})

	// Two islands, one rotation, two right answers — hence a pivot mode.
	it('keeps each island in place when the pivot is individual origins', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'island', ids: new Set([0, 1]), pivot: 'individual' })

		const { uv: next } = transformUvs(layout, packed, selection, { rotate: Math.PI / 4 })

		for (const island of [0, 1]) {
			const before = centreOf(packed, layout.vertsOfIsland[island])
			const after = centreOf(next, layout.vertsOfIsland[island])
			expect(after[0]).toBeCloseTo(before[0])
			expect(after[1]).toBeCloseTo(before[1])
		}
	})

	it('swings islands around each other when the pivot is the median', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'island', ids: new Set([0, 1]), pivot: 'median' })

		const { uv: next } = transformUvs(layout, packed, selection, { rotate: Math.PI / 4 })

		const before = centreOf(packed, layout.vertsOfIsland[0])
		const after = centreOf(next, layout.vertsOfIsland[0])
		expect(Math.hypot(after[0] - before[0], after[1] - before[1])).toBeGreaterThan(0.05)
	})

	it('rotates around the 2D cursor when asked', () => {
		const { layout, uv } = cube()
		const selection = select({
			mode: 'island',
			ids: new Set([0]),
			pivot: 'cursor',
			cursor: [0, 0]
		})

		const { uv: next } = transformUvs(layout, uv, selection, { rotate: Math.PI })

		for (const vert of layout.vertsOfIsland[0]) {
			expect(next[vert * 2]).toBeCloseTo(-uv[vert * 2])
			expect(next[vert * 2 + 1]).toBeCloseTo(-uv[vert * 2 + 1])
		}
	})

	function centreOf(uv: Float32Array, verts: number[]) {
		let u = 0
		let v = 0
		for (const vert of verts) {
			u += uv[vert * 2]
			v += uv[vert * 2 + 1]
		}
		return [u / verts.length, v / verts.length]
	}
})

describe('packIslands', () => {
	// Three.js maps every primitive face to the whole tile, so without this
	// there is nothing legible to edit.
	it('separates the islands a fresh primitive stacks on top of each other', () => {
		const { layout, uv } = cube()
		const selection = select()

		expect(uvStats(layout, uv, selection).overlappingPairs).toBe(15)
		expect(uvStats(layout, packIslands(layout, uv), selection).overlappingPairs).toBe(0)
	})

	it('keeps every island inside the tile', () => {
		const { layout, uv } = cube()

		const packed = packIslands(layout, uv)

		expect(uvStats(layout, packed, select()).offTileCount).toBe(0)
	})

	it('leaves a single-island mesh alone apart from fitting it to the tile', () => {
		const { layout, uv } = sphere()

		const packed = packIslands(layout, uv)

		expect(uvStats(layout, packed, select()).overlappingPairs).toBe(0)
		expect(packed).toHaveLength(uv.length)
	})
})

describe('weldUvs', () => {
	it('collapses coincident selected vertices onto one point', () => {
		const { layout, uv } = cube()
		const group = layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[0]]
		const packed = packIslands(layout, uv)

		// Drag the twins together first, then weld what is now nearly coincident.
		const gathered = Float32Array.from(packed)
		for (const vert of group) {
			gathered[vert * 2] = 0.5
			gathered[vert * 2 + 1] = 0.5
		}
		const selection = select({ mode: 'vertex', ids: new Set(group), sticky: 'off' })

		const { uv: next, welded } = weldUvs(layout, gathered, selection)

		expect(welded).toBe(group.length)
		for (const vert of group) {
			expect(next[vert * 2]).toBeCloseTo(0.5)
		}
	})

	it('does nothing when the selection has no coincident vertices', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'island', ids: new Set([0]) })

		expect(weldUvs(layout, packed, selection).welded).toBe(0)
	})
})

describe('picking', () => {
	it('finds the vertex under a point within the radius', () => {
		const { layout, uv } = cube()

		expect(nearestVert(layout, uv, [uv[0], uv[1]], 0.05)).toBe(0)
		expect(nearestVert(layout, uv, [5, 5], 0.05)).toBe(-1)
	})

	it('finds a face containing a point and nothing outside the layout', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const inside = centroid(packed, layout.vertsOfIsland[0])

		expect(layout.facesOfIsland[0]).toContain(faceAt(layout, packed, inside))
		expect(faceAt(layout, packed, [5, 5])).toBe(-1)
	})

	it('box-selects whole faces rather than stray corners', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const wholeTile = { u0: -1, v0: -1, u1: 2, v1: 2 }

		const islands = idsInRect(layout, packed, select({ mode: 'island' }), wholeTile)
		expect(islands).toEqual(allIds(layout, 'island'))

		// A box clipping a corner catches no face, because not all three
		// corners are inside it.
		const sliver = { u0: -1, v0: -1, u1: -0.5, v1: -0.5 }
		expect(idsInRect(layout, packed, select({ mode: 'island' }), sliver).size).toBe(0)
	})
})

describe('uvStats', () => {
	it('separates what was picked from what the sticky rule added', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-vertex' })

		const stats = uvStats(layout, packed, selection)

		expect(stats.pickedCount).toBe(1)
		expect(stats.movingCount).toBe(3)
		expect(stats.stickyCount).toBe(2)
	})

	it('counts vertices pushed outside the tile', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'island', ids: new Set([0]) })

		const { uv: next } = transformUvs(layout, uv, selection, { translate: [2, 0] })

		expect(uvStats(layout, next, selection).offTileCount).toBeGreaterThan(0)
	})
})
