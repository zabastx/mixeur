import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useModals, openModals, dialogCallbacks } from './modals'

describe('useModals', () => {
	beforeEach(() => {
		// Reset shared reactive state between tests.
		for (const key of Object.keys(openModals) as (keyof typeof openModals)[]) {
			openModals[key] = false
			dialogCallbacks[key] = null
		}
	})

	it('reports closed modals by default', () => {
		const { isOpen } = useModals()
		expect(isOpen('about')).toBe(false)
	})

	it('opens a modal and reflects it in isOpen and openModals', () => {
		const { open, isOpen } = useModals()

		open('preferences')

		expect(isOpen('preferences')).toBe(true)
		expect(openModals.preferences).toBe(true)
	})

	it('stores an optional callback when opening', () => {
		const { open } = useModals()
		const cb = vi.fn()

		open('renderImage', cb)

		expect(dialogCallbacks.renderImage).toBe(cb)
	})

	it('defaults the callback to null when none is passed', () => {
		const { open } = useModals()

		open('about')

		expect(dialogCallbacks.about).toBeNull()
	})

	it('closes an open modal', () => {
		const { open, close, isOpen } = useModals()

		open('importScene')
		close('importScene')

		expect(isOpen('importScene')).toBe(false)
	})

	it('tracks modals independently', () => {
		const { open, isOpen } = useModals()

		open('modelsLibrary')

		expect(isOpen('modelsLibrary')).toBe(true)
		expect(isOpen('textureLibrary')).toBe(false)
	})
})
