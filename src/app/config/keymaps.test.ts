import { describe, it, expect } from 'vitest'
import {
	defaultKeymaps,
	keyCodeToTransformMode,
	keyCodeToTransformAxis,
	keyCodeToViewDirection
} from './keymaps'

describe('keymaps derived maps', () => {
	// Derive expectations from defaultKeymaps (the source of truth) rather than
	// restating literals, so the tests verify the inversion logic itself.
	it('inverts every transform mode code back to its mode name', () => {
		for (const [mode, code] of Object.entries(defaultKeymaps.transform.mode)) {
			expect(keyCodeToTransformMode[code]).toBe(mode)
		}
		expect(Object.keys(keyCodeToTransformMode)).toHaveLength(
			Object.keys(defaultKeymaps.transform.mode).length
		)
	})

	it('inverts every transform axis code back to its axis name', () => {
		for (const [axis, code] of Object.entries(defaultKeymaps.transform.axis)) {
			expect(keyCodeToTransformAxis[code]).toBe(axis)
		}
		expect(Object.keys(keyCodeToTransformAxis)).toHaveLength(
			Object.keys(defaultKeymaps.transform.axis).length
		)
	})

	it('maps every view code to its direction', () => {
		for (const [direction, code] of Object.entries(defaultKeymaps.view)) {
			expect(keyCodeToViewDirection[code]).toBe(direction)
		}
		expect(Object.keys(keyCodeToViewDirection)).toHaveLength(
			Object.keys(defaultKeymaps.view).length
		)
	})
})
