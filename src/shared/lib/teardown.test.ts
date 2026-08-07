import { describe, it, expect, vi } from 'vitest'
import { createTeardown } from './teardown'

describe('createTeardown', () => {
	it('runs releases in reverse acquisition order', () => {
		const order: string[] = []
		const teardown = createTeardown()

		teardown.add(() => order.push('renderer'))
		teardown.add(() => order.push('controls'))
		teardown.add(() => order.push('loop'))

		teardown.run()

		expect(order).toEqual(['loop', 'controls', 'renderer'])
	})

	it('forgets the releases it ran, so a second run does nothing', () => {
		const release = vi.fn()
		const teardown = createTeardown()
		teardown.add(release)

		teardown.run()
		teardown.run()

		expect(release).toHaveBeenCalledOnce()
	})

	it('runs the remaining releases when one throws', () => {
		const before = vi.fn()
		const after = vi.fn()
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
		const teardown = createTeardown()

		teardown.add(after)
		teardown.add(() => {
			throw new Error('renderer already gone')
		})
		teardown.add(before)

		expect(() => teardown.run()).not.toThrow()

		expect(before).toHaveBeenCalledOnce()
		expect(after).toHaveBeenCalledOnce()
		expect(consoleError).toHaveBeenCalled()

		consoleError.mockRestore()
	})

	it('runs a release added while it is running', () => {
		const late = vi.fn()
		const teardown = createTeardown()
		teardown.add(() => teardown.add(late))

		teardown.run()
		expect(late).not.toHaveBeenCalled()

		// The late release is still recorded, so the next run picks it up rather
		// than dropping it on the floor.
		teardown.run()
		expect(late).toHaveBeenCalledOnce()
	})
})
