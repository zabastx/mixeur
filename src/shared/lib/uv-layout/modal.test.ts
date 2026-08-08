import { describe, expect, it } from 'vitest'
import { modalTransform, packIslands, transformOrigin } from '.'
import { cube, select } from './test-fixtures'

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
