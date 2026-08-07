import { tryOnScopeDispose } from '@vueuse/core'

/**
 * Which pass of the keydown dispatch a handler runs in.
 *
 * - `app` runs for every keydown, including while the user types into a form
 *   field — for shortcuts that must never be swallowed, such as save and open.
 * - `editor` is skipped entirely while a form field has focus, so typing an "s"
 *   into a text input cannot also switch the transform tool to scale.
 *
 * Both passes are driven from a single `keydown` listener. Which phase a
 * handler registers in decides whether it sees an event — not the order the
 * handler's module happened to be imported or initialised in.
 */
export type KeyPhase = 'app' | 'editor'

export type KeyHandler = (event: KeyboardEvent) => void

const handlers: Record<KeyPhase, Set<KeyHandler>> = {
	app: new Set(),
	editor: new Set()
}

/** Focus inside one of these means the user is typing, not driving the editor. */
const editableTags = ['input', 'textarea', 'select']

let detach: (() => void) | null = null

function isEditing(target: EventTarget | null) {
	return target instanceof HTMLElement && editableTags.includes(target.tagName.toLowerCase())
}

function dispatch(event: KeyboardEvent) {
	// Iterated over copies: a handler is allowed to register or release another
	// one while the dispatch is still running.
	for (const handle of [...handlers.app]) handle(event)

	if (isEditing(event.target)) return

	for (const handle of [...handlers.editor]) handle(event)
}

/**
 * Register `handler` for `phase` and return its release.
 *
 * The window listener is attached on the first registration and detached again
 * once the last handler is released, so no caller has to own it. Inside an
 * effect scope — a component `setup`, a Pinia store body, an explicit
 * `effectScope` — the release also runs when that scope stops.
 */
export function onKeyDown(phase: KeyPhase, handler: KeyHandler) {
	handlers[phase].add(handler)

	if (!detach) {
		window.addEventListener('keydown', dispatch)
		detach = () => window.removeEventListener('keydown', dispatch)
	}

	const release = () => {
		if (!handlers[phase].delete(handler)) return
		if (handlers.app.size || handlers.editor.size) return
		detach?.()
		detach = null
	}

	tryOnScopeDispose(release)

	return release
}
