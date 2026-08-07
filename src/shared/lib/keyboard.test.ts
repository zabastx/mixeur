import { describe, it, expect, vi, afterEach } from 'vitest'
import { effectScope } from 'vue'
import { onKeyDown } from './keyboard'

const releases: (() => void)[] = []

/** Registers a handler and makes sure it is released when the test ends. */
function register(...args: Parameters<typeof onKeyDown>) {
	const release = onKeyDown(...args)
	releases.push(release)
	return release
}

afterEach(() => {
	releases.splice(0).forEach((release) => release())
	document.body.innerHTML = ''
})

function pressOn(target: HTMLElement | Window, code: string) {
	const event = new KeyboardEvent('keydown', { code, bubbles: true })
	target.dispatchEvent(event)
	return event
}

function appendEditable(tag: string) {
	const element = document.createElement(tag)
	document.body.appendChild(element)
	return element
}

describe('keydown dispatch', () => {
	it('runs handlers of both phases for an ordinary keypress', () => {
		const app = vi.fn()
		const editor = vi.fn()
		register('app', app)
		register('editor', editor)

		pressOn(window, 'KeyG')

		expect(app).toHaveBeenCalledOnce()
		expect(editor).toHaveBeenCalledOnce()
	})

	it.each(['input', 'textarea', 'select'])(
		'skips editor handlers while the user is typing into a <%s>',
		(tag) => {
			const app = vi.fn()
			const editor = vi.fn()
			register('app', app)
			register('editor', editor)

			pressOn(appendEditable(tag), 'KeyS')

			// Save must still fire from a focused field; switching the transform
			// tool to scale must not.
			expect(app).toHaveBeenCalledOnce()
			expect(editor).not.toHaveBeenCalled()
		}
	)

	it('runs editor handlers for a keypress on a non-editable element', () => {
		const editor = vi.fn()
		register('editor', editor)

		pressOn(appendEditable('canvas'), 'KeyG')

		expect(editor).toHaveBeenCalledOnce()
	})

	it('runs app handlers before editor handlers regardless of registration order', () => {
		const order: string[] = []
		register('editor', () => order.push('editor'))
		register('app', () => order.push('app'))

		pressOn(window, 'KeyG')

		expect(order).toEqual(['app', 'editor'])
	})

	it('stops calling a handler once it is released', () => {
		const handler = vi.fn()
		const release = register('editor', handler)

		release()
		pressOn(window, 'KeyG')

		expect(handler).not.toHaveBeenCalled()
	})

	it('releases a handler registered inside an effect scope when the scope stops', () => {
		const handler = vi.fn()
		const scope = effectScope(true)
		scope.run(() => onKeyDown('editor', handler))

		scope.stop()
		pressOn(window, 'KeyG')

		expect(handler).not.toHaveBeenCalled()
	})

	it('attaches one window listener for any number of handlers, and detaches it with the last', () => {
		const add = vi.spyOn(window, 'addEventListener')
		const remove = vi.spyOn(window, 'removeEventListener')

		const first = register('app', vi.fn())
		const second = register('editor', vi.fn())
		expect(add).toHaveBeenCalledOnce()

		first()
		expect(remove).not.toHaveBeenCalled()

		second()
		expect(remove).toHaveBeenCalledOnce()

		add.mockRestore()
		remove.mockRestore()
	})

	it('survives a handler registering another one mid-dispatch', () => {
		const late = vi.fn()
		register('editor', () => releases.push(onKeyDown('editor', late)))

		expect(() => pressOn(window, 'KeyG')).not.toThrow()
		// Registered during the dispatch, so it only sees the next keypress.
		expect(late).not.toHaveBeenCalled()

		pressOn(window, 'KeyG')
		expect(late).toHaveBeenCalled()
	})

	it('survives a handler releasing itself mid-dispatch', () => {
		const handler = vi.fn(() => release())
		const release = register('editor', handler)

		expect(() => pressOn(window, 'KeyG')).not.toThrow()
		pressOn(window, 'KeyG')

		expect(handler).toHaveBeenCalledOnce()
	})
})
