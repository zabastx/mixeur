import { beforeEach, describe, expect, it } from 'vitest'
import { useToast } from './toast'

describe('useToast', () => {
	beforeEach(() => {
		useToast().clear()
	})

	describe('add', () => {
		it('should add an open info toast that lasts 5 seconds when given only a message', () => {
			const { add, toasts } = useToast()

			const id = add({ message: 'Simple message' })

			expect(toasts.value).toEqual([
				{
					id,
					message: 'Simple message',
					type: 'info',
					duration: 5000,
					open: true
				}
			])
		})

		it('should keep the title, type and duration it is given', () => {
			const { add, toasts } = useToast()

			const id = add({
				message: 'Full toast message',
				title: 'Title',
				type: 'success',
				duration: 10000
			})

			expect(toasts.value).toEqual([
				{
					id,
					title: 'Title',
					message: 'Full toast message',
					type: 'success',
					duration: 10000,
					open: true
				}
			])
		})

		it('should keep a duration of 0 for a persistent toast', () => {
			const { add, toasts } = useToast()

			add({ message: 'Persistent toast', duration: 0 })

			expect(toasts.value[0]?.duration).toBe(0)
		})

		it('should give each toast its own id', () => {
			const { add, toasts } = useToast()

			const ids = [add({ message: 'First' }), add({ message: 'Second' }), add({ message: 'Third' })]

			expect(new Set(ids).size).toBe(3)
			expect(toasts.value.map((t) => t.id)).toEqual(ids)
		})
	})

	describe('remove', () => {
		it('should remove only the toast with the given id', () => {
			const { add, remove, toasts } = useToast()
			const first = add({ message: 'First toast' })
			const second = add({ message: 'Second toast' })
			const third = add({ message: 'Third toast' })

			remove(second)

			expect(toasts.value.map((t) => t.id)).toEqual([first, third])
		})

		it('should leave the toasts alone for an id none of them has', () => {
			const { add, remove, toasts } = useToast()
			const id = add({ message: 'Only toast' })

			remove(`${id}-gone`)

			expect(toasts.value.map((t) => t.id)).toEqual([id])
		})
	})

	describe('clear', () => {
		it('should remove every toast', () => {
			const { add, clear, toasts } = useToast()
			add({ message: 'First toast' })
			add({ message: 'Second toast' })

			clear()

			expect(toasts.value).toEqual([])
		})

		it('should not hand out an id from before the clear again', () => {
			const { add, clear, remove, toasts } = useToast()
			const stale = add({ message: 'Before clear' })
			clear()
			const fresh = add({ message: 'After clear' })

			remove(stale)

			expect(toasts.value.map((t) => t.id)).toEqual([fresh])
		})
	})

	it('should share one list across useToast calls', () => {
		const caller = useToast()
		const viewer = useToast()

		const id = caller.add({ message: 'Shared state test' })
		expect(viewer.toasts.value.map((t) => t.id)).toEqual([id])

		viewer.remove(id)
		expect(caller.toasts.value).toEqual([])
	})
})
