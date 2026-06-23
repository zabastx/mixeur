import { describe, it, expect, vi, afterEach } from 'vitest'
import THREE from '@/shared/three'
import { emitCustomEvent, listenCustomEvent } from './events'

describe('custom events', () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it('emits a CustomEvent on document with the given detail', () => {
		const handler = vi.fn()
		document.addEventListener('scene:objectAdded', handler)

		const object = new THREE.Object3D()
		emitCustomEvent('scene:objectAdded', object)

		expect(handler).toHaveBeenCalledOnce()
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event).toBeInstanceOf(CustomEvent)
		expect(event.detail).toBe(object)

		document.removeEventListener('scene:objectAdded', handler)
	})

	it('emits with null detail when none is provided', () => {
		const handler = vi.fn()
		document.addEventListener('three:renderRequested', handler)

		emitCustomEvent('three:renderRequested')

		// The CustomEvent constructor normalises a missing detail to null.
		const event = handler.mock.calls[0][0] as CustomEvent
		expect(event.detail).toBeNull()

		document.removeEventListener('three:renderRequested', handler)
	})

	it('listenCustomEvent subscribes and returns a working unsubscribe', () => {
		const handler = vi.fn()
		const unsubscribe = listenCustomEvent('scene:objectDeleted', handler)

		emitCustomEvent('scene:objectDeleted', 'first')
		expect(handler).toHaveBeenCalledTimes(1)

		unsubscribe()
		emitCustomEvent('scene:objectDeleted', 'second')
		expect(handler).toHaveBeenCalledTimes(1)
	})
})
