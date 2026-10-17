import { setActivePinia, createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProgressStore } from './progress'

describe('useProgressStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('should start progress with correct initial state', () => {
		vi.useFakeTimers({ now: 1_000_000 })
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start(1024)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]).toMatchObject({
			id: progress.id,
			title: 'model.glb',
			percentage: 0,
			loaded: 0,
			total: 1024,
			startTime: 1_000_000
		})
	})

	it('should calculate percentage correctly on update', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start(1000)
		progress.update(progress.id, 500)

		expect(store.progressItems[0]?.percentage).toBe(50)
	})

	it('should calculate ETA based on transfer rate', () => {
		vi.useFakeTimers({ now: 1_000_000 })
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start(1000)

		// Half the bytes in one second leaves the other half one more second.
		vi.setSystemTime(1_001_000)
		progress.update(progress.id, 500)

		expect(store.progressItems[0]?.estimatedTimeRemaining).toBe(1000)
	})

	it('should remove item on stop', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start(1000)
		progress.stop()

		expect(store.progressItems).toHaveLength(0)
	})

	it('should handle onProgress event correctly', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')

		// First call - no item exists yet, so onProgress calls start with the event's total
		const mockEvent = {
			lengthComputable: true,
			loaded: 0,
			total: 1000
		} as ProgressEvent

		progress.onProgress(mockEvent)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]?.total).toBe(1000)
		expect(store.progressItems[0]?.loaded).toBe(0)
		expect(store.progressItems[0]?.percentage).toBe(0)

		// Second call - item exists, so onProgress updates it
		const mockEventWithProgress = {
			lengthComputable: true,
			loaded: 500,
			total: 1000
		} as ProgressEvent

		progress.onProgress(mockEventWithProgress)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]?.loaded).toBe(500)
		expect(store.progressItems[0]?.percentage).toBe(50)
	})

	it('should handle onProgress without total initially', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')

		// First call without total
		const mockEventNoTotal = {
			lengthComputable: true,
			loaded: 0,
			total: 1000
		} as ProgressEvent

		progress.onProgress(mockEventNoTotal)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]?.total).toBe(1000)
		expect(store.progressItems[0]?.percentage).toBe(0)

		// Second call with total - should update
		const mockEventWithProgress = {
			lengthComputable: true,
			loaded: 500,
			total: 1000
		} as ProgressEvent

		progress.onProgress(mockEventWithProgress)

		expect(store.progressItems[0]?.loaded).toBe(500)
		expect(store.progressItems[0]?.percentage).toBe(50)
	})

	it('should ignore onProgress when length is not computable', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')

		const mockEvent = {
			lengthComputable: false,
			loaded: 500,
			total: 1000
		} as ProgressEvent

		progress.onProgress(mockEvent)

		// Should not create a progress item
		expect(store.progressItems).toHaveLength(0)
	})

	describe('concurrent loads', () => {
		it('should remove only its own item when another load is in flight', () => {
			const store = useProgressStore()
			const model = store.initProgress('female02.obj')
			const materials = store.initProgress('female02.mtl')
			model.start(1000)
			materials.start(200)

			model.stop()

			expect(store.progressItems).toHaveLength(1)
			expect(store.progressItems[0]).toMatchObject({ id: materials.id, title: 'female02.mtl' })
		})

		it('should not evict a sibling when the list shifted under it', () => {
			const store = useProgressStore()
			const first = store.initProgress('a.obj')
			const second = store.initProgress('b.mtl')
			const third = store.initProgress('c.png')
			first.start()
			second.start()
			third.start()

			// Removing the head shifts everything after it down one place.
			first.stop()
			second.stop()

			expect(store.progressItems).toHaveLength(1)
			expect(store.progressItems[0]).toMatchObject({ id: third.id, title: 'c.png' })
		})

		it('should still remove its own item after the list shifted under it', () => {
			const store = useProgressStore()
			const first = store.initProgress('a.obj')
			const second = store.initProgress('b.mtl')
			const third = store.initProgress('c.png')
			first.start()
			second.start()
			third.start()

			first.stop()
			third.stop()

			expect(store.progressItems).toHaveLength(1)
			expect(store.progressItems[0]?.title).toBe('b.mtl')
		})

		it('should keep sibling items untouched when a load starts after another stops', () => {
			const store = useProgressStore()
			const first = store.initProgress('a.obj')
			first.start(100)
			first.stop()

			const second = store.initProgress('b.mtl')
			second.start(200)
			second.stop()

			expect(store.progressItems).toHaveLength(0)
		})

		it('should ignore a stop for a load that never started', () => {
			const store = useProgressStore()
			const started = store.initProgress('a.obj')
			const neverStarted = store.initProgress('b.mtl')
			started.start(100)

			neverStarted.stop()

			expect(store.progressItems).toHaveLength(1)
			expect(store.progressItems[0]?.title).toBe('a.obj')
		})
	})

	it('should not add a second item when start is called twice', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start(1000)
		progress.start(2000)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]?.total).toBe(1000)
	})

	it('should adopt the total from the first computable event after an untotalled start', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		progress.start()

		expect(store.progressItems[0]?.total).toBeUndefined()

		progress.onProgress({ lengthComputable: true, loaded: 250, total: 1000 } as ProgressEvent)

		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]?.total).toBe(1000)
		expect(store.progressItems[0]?.percentage).toBe(25)
	})

	it('should handle update without total gracefully', () => {
		const store = useProgressStore()
		const progress = store.initProgress('model.glb')
		// Start without total
		progress.start()

		// Update should be ignored when no total
		progress.update(progress.id, 500)

		// Item should still exist but percentage should not be calculated
		expect(store.progressItems).toHaveLength(1)
		expect(store.progressItems[0]).toMatchObject({ loaded: 0, percentage: 0 })
	})
})
