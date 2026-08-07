import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { useInputStore } from './input'
import { useRaycastStore } from './raycast'

/**
 * What `mount` does with the parts of the viewport that need no GL context.
 *
 * The renderer, composer and controls cannot be exercised here: the headless
 * `gl` context the test setup installs is WebGL 1.0, and Three.js needs WebGL 2
 * (it calls `texImage3D` while initialising, which WebGL 1 has no such method
 * for). So `useViewportStore().mount` itself is out of reach, and this covers
 * the property it delegates to the effect scope — that pointer, wheel, keyboard
 * and picking listeners are all released together — for the two stores that
 * bind them. The rest is covered end-to-end by the Playwright suite.
 */

interface Registration {
	type: string
	listener: unknown
}

/** Wraps a target so listeners registered on it can be counted, then unwraps. */
function trackListeners(target: EventTarget) {
	const active: Registration[] = []
	const add = target.addEventListener.bind(target)
	const remove = target.removeEventListener.bind(target)

	// Captured so `restore` puts back whatever was there — on `window` these are
	// own properties, and deleting them would take the real ones with it.
	const descriptors = {
		add: Object.getOwnPropertyDescriptor(target, 'addEventListener'),
		remove: Object.getOwnPropertyDescriptor(target, 'removeEventListener')
	}

	target.addEventListener = (type, listener, options?) => {
		active.push({ type, listener })
		add(type, listener, options)
	}
	target.removeEventListener = (type, listener, options?) => {
		const index = active.findIndex((item) => item.type === type && item.listener === listener)
		if (index >= 0) active.splice(index, 1)
		remove(type, listener, options)
	}

	return {
		active,
		restore() {
			restoreProperty('addEventListener', descriptors.add)
			restoreProperty('removeEventListener', descriptors.remove)
		}
	}

	function restoreProperty(key: string, descriptor: PropertyDescriptor | undefined) {
		if (descriptor) Object.defineProperty(target, key, descriptor)
		else Reflect.deleteProperty(target, key)
	}
}

let canvas: HTMLCanvasElement

beforeEach(() => {
	setActivePinia(createPinia())
	canvas = document.createElement('canvas')
	document.body.appendChild(canvas)
})

afterEach(() => {
	document.body.innerHTML = ''
})

describe('viewport input bindings', () => {
	it('releases every listener the input store bound when the scope stops', () => {
		// Instantiated before tracking starts: the store body registers its own
		// modifier-key listeners, which belong to the store and not to a viewport.
		const inputStore = useInputStore()

		const onCanvas = trackListeners(canvas)
		const onWindow = trackListeners(window)
		const windowBefore = onWindow.active.length

		const scope = effectScope(true)
		scope.run(() => inputStore.init(canvas))

		expect(onCanvas.active.length).toBeGreaterThan(0)
		expect(onWindow.active.length).toBeGreaterThan(windowBefore)

		scope.stop()

		expect(onCanvas.active).toEqual([])
		expect(onWindow.active).toHaveLength(windowBefore)

		onCanvas.restore()
		onWindow.restore()
	})

	it('releases every listener the raycast store bound when the scope stops', () => {
		const raycastStore = useRaycastStore()

		const onCanvas = trackListeners(canvas)

		const scope = effectScope(true)
		scope.run(() => raycastStore.init(canvas))

		expect(onCanvas.active.length).toBeGreaterThan(0)

		scope.stop()

		expect(onCanvas.active).toEqual([])

		onCanvas.restore()
	})

	it('leaves nothing behind after repeated bind/release cycles', () => {
		const inputStore = useInputStore()
		const raycastStore = useRaycastStore()

		const onCanvas = trackListeners(canvas)

		for (let i = 0; i < 3; i++) {
			const scope = effectScope(true)
			scope.run(() => {
				raycastStore.init(canvas)
				inputStore.init(canvas)
			})
			scope.stop()
			expect(onCanvas.active).toEqual([])
		}

		onCanvas.restore()
	})
})
