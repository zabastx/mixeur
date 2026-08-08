import { describe, expect, it } from 'vitest'
import THREE from '@/shared/three'
import {
	allIds,
	centroid,
	createUvLayout,
	createUvSelection,
	faceAt,
	idsInRect,
	modalTransform,
	movingVerts,
	nearestVert,
	packIslands,
	pickedVerts,
	resolvePick,
	selectedFaces,
	transformOrigin,
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
		uv: geometry.attributes.uv.array,
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

	// Non-indexed geometry shares no vertex indices at all, so islands have to
	// come from mesh-edge adjacency or every triangle stands alone.
	it.each([
		['cube', () => new THREE.BoxGeometry(), 6],
		['sphere', () => new THREE.SphereGeometry(1, 16, 12), 1],
		['plane', () => new THREE.PlaneGeometry(), 1],
		['cylinder', () => new THREE.CylinderGeometry(1, 1, 2, 16, 1), 3],
		['torus', () => new THREE.TorusGeometry(1, 0.4, 12, 24), 1]
	])('finds the same islands in %s whether indexed or not', (_name, build, expected) => {
		const indexed = read(build())
		const nonIndexed = read(build().toNonIndexed())

		expect(indexed.layout.islandCount).toBe(expected)
		expect(nonIndexed.layout.islandCount).toBe(expected)
	})

	it('reports the same seams whether indexed or not', () => {
		expect(cube().layout.seamCount).toBe(24)
		expect(read(new THREE.BoxGeometry().toNonIndexed()).layout.seamCount).toBe(24)
	})

	it('welds mesh vertices that differ only by the sign of zero', () => {
		// Geometry generators emit `-0` freely, and `-0 === 0`, so two triangles
		// meeting on an axis must still count as meeting. Two triangles sharing
		// the edge (1,0,0)–(0,1,0), where one writes that 0 as `-0`.
		const geometry = new THREE.BufferGeometry()
		// prettier-ignore
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([
			0, 0, 0,   1, 0, 0,   -0, 1, 0,
			0, 1, 0,   1, 0, 0,    1, 1, 0
		], 3))
		// prettier-ignore
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
			0, 0,   1, 0,   0, 1,
			0, 1,   1, 0,   1, 1
		], 2))

		const { layout } = read(geometry)

		expect(layout.uvVertsOfMeshVert).toHaveLength(4)
		expect(layout.islandCount).toBe(1)
	})

	it('does not fuse faces that merely overlap in the tile', () => {
		// Every face of a fresh primitive is mapped to the whole 0–1 tile, so
		// coincident UV points are everywhere. Only agreement along a shared
		// mesh edge may join two faces — welding by position would collapse
		// the cube to a single island.
		const { layout, uv } = cube()

		expect(uvStats(layout, uv, select()).overlappingPairs).toBe(15)
		expect(layout.islandCount).toBe(6)
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

	it('joins the copies of a mesh vertex once they sit on the same spot', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-location' })
		// Close the seam by hand: put the corner's other two UV copies on top of
		// it, which is the state `weld` produces and the one this mode protects.
		const welded = Float32Array.from(uv)
		for (const twin of layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[0]]) {
			welded[twin * 2] = uv[0]
			welded[twin * 2 + 1] = uv[1]
		}

		expect(movingVerts(layout, welded, selection).size).toBe(3)
	})

	it('ignores UV vertices that merely overlap', () => {
		const { layout, uv } = cube()
		const selection = select({ mode: 'vertex', ids: new Set([0]), sticky: 'shared-location' })

		// A fresh cube stacks all six faces on the tile, so this corner shares its
		// spot with one vertex per face — but they belong to five *other* mesh
		// corners, and dragging them would tear the cube apart. Sharing a location
		// is only half the rule; sharing a mesh vertex is the other half.
		expect(movingVerts(layout, uv, selection).size).toBe(1)
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

describe('resolvePick', () => {
	it('replaces the selection when clicking something new', () => {
		expect(resolvePick(new Set([1, 2]), 7, false)).toEqual({
			ids: new Set([7]),
			startsDrag: true
		})
	})

	it('extends the selection when shift-clicking something new', () => {
		expect(resolvePick(new Set([1, 2]), 7, true)).toEqual({
			ids: new Set([1, 2, 7]),
			startsDrag: true
		})
	})

	it('keeps the whole selection when clicking one of its members', () => {
		// Otherwise dragging a multi-selection would collapse it to whatever
		// happened to be under the pointer.
		expect(resolvePick(new Set([1, 2, 3]), 2, false)).toEqual({
			ids: new Set([1, 2, 3]),
			startsDrag: true
		})
	})

	it('does not arm a drag when shift-clicking removes something', () => {
		// The bug this guards: deselecting also began a drag, so a pixel of
		// pointer travel slid the rest of the selection away.
		expect(resolvePick(new Set([1, 2, 3]), 2, true)).toEqual({
			ids: new Set([1, 3]),
			startsDrag: false
		})
	})

	it('clears on empty space, and keeps the selection when shift is held', () => {
		expect(resolvePick(new Set([1, 2]), -1, false)).toEqual({
			ids: new Set(),
			startsDrag: false
		})
		expect(resolvePick(new Set([1, 2]), -1, true)).toEqual({
			ids: new Set([1, 2]),
			startsDrag: false
		})
	})

	it('never hands back the caller’s set', () => {
		const current = new Set([1, 2])

		for (const result of [
			resolvePick(current, 7, false),
			resolvePick(current, 1, false),
			resolvePick(current, 1, true),
			resolvePick(current, -1, true)
		]) {
			expect(result.ids).not.toBe(current)
		}
		expect(current).toEqual(new Set([1, 2]))
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

	// A right triangle is the cheapest shape where the two disagree: its
	// vertices average to (1/3, 2/3) while its extents centre on (0.5, 0.5).
	it.each([
		['bounding-box' as const, [0.5, 0.5]],
		['median' as const, [1 / 3, 2 / 3]]
	])('rotates a lopsided selection around its %s', (pivot, expected) => {
		const { layout, uv } = read(new THREE.PlaneGeometry())
		const selection = select({ mode: 'vertex', ids: new Set([0, 1, 2]), sticky: 'off', pivot })

		// Half a turn maps every point to `2 * pivot - point`, so the pivot is
		// readable straight off the result.
		const { uv: next } = transformUvs(layout, uv, selection, { rotate: Math.PI })

		for (const vert of [0, 1, 2]) {
			expect(next[vert * 2]).toBeCloseTo(2 * expected[0] - uv[vert * 2])
			expect(next[vert * 2 + 1]).toBeCloseTo(2 * expected[1] - uv[vert * 2 + 1])
		}
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

	it('counts every pair of islands sharing texture space', () => {
		const { layout, uv } = cube()

		// Three.js maps all six faces to the whole tile, so every pair of the
		// six islands overlaps: C(6,2).
		expect(uvStats(layout, uv, select()).overlappingPairs).toBe(15)
		// Packed into a grid with margins, none of them do.
		expect(uvStats(layout, packIslands(layout, uv), select()).overlappingPairs).toBe(0)
	})

	it('counts only the pairs that really meet, not everything to the left', () => {
		// The sweep visits islands left to right and prunes on u. This is the
		// case that catches it pruning too little or too much: one island moved
		// exactly one cell right lands on its neighbour and on nothing else.
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const columns = Math.ceil(Math.sqrt(layout.islandCount))
		const selection = select({ mode: 'island', ids: new Set([0]) })

		const { uv: moved } = transformUvs(layout, packed, selection, {
			translate: [1 / columns, 0]
		})

		expect(uvStats(layout, moved, selection).overlappingPairs).toBe(1)
	})
})

describe('modal transforms', () => {
	const origin: [number, number] = [0.5, 0.5]

	it('measures a move from where the modal started, not from the pivot', () => {
		const { transform } = modalTransform('move', [0.2, 0.2], [0.3, 0.25], origin)

		expect(transform.translate?.[0]).toBeCloseTo(0.1)
		expect(transform.translate?.[1]).toBeCloseTo(0.05)
	})

	it('drops the other component when an axis is locked', () => {
		const { transform, label } = modalTransform('move', [0.2, 0.2], [0.3, 0.25], origin, 'u')

		expect(transform.translate?.[0]).toBeCloseTo(0.1)
		expect(transform.translate?.[1]).toBe(0)
		expect(label).toContain('along U')
	})

	it('turns pointer travel around the origin into an angle', () => {
		// A quarter turn counter-clockwise: due east of the origin to due north.
		const { transform } = modalTransform('rotate', [0.9, 0.5], [0.5, 0.9], origin)

		expect(transform.rotate).toBeCloseTo(Math.PI / 2)
	})

	it('scales by the ratio of the distances to the origin', () => {
		const { transform } = modalTransform('scale', [0.6, 0.5], [0.8, 0.5], origin)

		expect(transform.scale?.[0]).toBeCloseTo(3)
		expect(transform.scale?.[1]).toBeCloseTo(3)
	})

	it('holds still when the modal began on top of the origin', () => {
		// Otherwise the ratio divides by zero and the selection vanishes. Callers
		// re-seed the reference rather than relying on this.
		const { transform } = modalTransform('scale', origin, [0.8, 0.5], origin)

		expect(transform.scale).toEqual([1, 1])
	})

	it('wraps a rotation to the short way round', () => {
		// Due south of the origin to due west: the raw difference of the two
		// `atan2` readings is +270°, which is the same pointer position as -90°
		// and has to read as the quarter turn a user just made.
		const { transform, label } = modalTransform('rotate', [0.5, 0.4], [0.4, 0.5], origin)

		expect(transform.rotate).toBeCloseTo(-Math.PI / 2)
		expect(label).toBe('Rotate -90.0°')
	})

	it('reads the origin off the pivot mode', () => {
		const { layout, uv } = cube()
		const packed = packIslands(layout, uv)
		const selection = select({ mode: 'island', ids: new Set([0]) })

		const box = transformOrigin(layout, packed, selection)
		const cursor = transformOrigin(layout, packed, { ...selection, pivot: 'cursor' })

		expect(cursor).toEqual(selection.cursor)
		// The bounding-box centre of one island is inside that island, not the
		// tile centre the cursor defaults to.
		expect(box).not.toEqual(cursor)
	})
})
