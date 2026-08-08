import { describe, expect, it } from 'vitest'
import THREE from '@/shared/three'
import { packIslands, transformUvs, uvStats, weldUvs } from '.'
import { cube, read, select, sphere } from './test-fixtures'

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
