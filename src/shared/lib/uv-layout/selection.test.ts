import { describe, expect, it } from 'vitest'
import { movingVerts, packIslands, pickedVerts, resolvePick, selectedFaces } from '.'
import { cube, select } from './test-fixtures'

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
