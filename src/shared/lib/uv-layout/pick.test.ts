import { describe, expect, it } from 'vitest'
import {
	allIds,
	centroid,
	faceAt,
	idsInRect,
	nearestVert,
	packIslands,
	transformUvs,
	uvStats
} from '.'
import { cube, select } from './test-fixtures'

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
