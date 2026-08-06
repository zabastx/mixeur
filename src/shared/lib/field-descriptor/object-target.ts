import { shallowRef, toValue, triggerRef, type MaybeRefOrGetter } from 'vue'
import type { FieldTarget, ObjectProp } from './types'

export interface ObjectTargetOptions<T> {
	/**
	 * Runs after a write lands, for invalidation the assignment implies —
	 * a Three.js resource the new value has just made stale, say.
	 */
	afterWrite?: (object: T, prop: ObjectProp<T>) => void
}

/**
 * A {@link FieldTarget} that edits a Three.js object in place.
 *
 * Two things the renderer would otherwise have to know are handled here:
 *
 * - **Read-back.** Assigning `object.intensity` is invisible to Vue, so every
 *   read is registered against a private version ref that every write bumps.
 * - **Selection changes.** `source` is resolved on each access rather than
 *   captured once, so pointing it at a getter is enough to follow the current
 *   selection — panels do not need to remount themselves to stay in sync.
 */
export function createObjectTarget<T extends object>(
	source: MaybeRefOrGetter<T | null | undefined>,
	{ afterWrite }: ObjectTargetOptions<T> = {}
): FieldTarget<T> {
	const version = shallowRef(0)

	function liveObject(): T | null {
		// Subscribes the calling effect to in-place mutations; see `write`.
		void version.value
		return toValue(source) ?? null
	}

	function read(prop: ObjectProp<T>): unknown {
		const object = liveObject()
		return object ? object[prop as keyof T] : undefined
	}

	function write(prop: ObjectProp<T>, value: unknown) {
		const object = toValue(source)
		if (!object) return

		object[prop as keyof T] = value as T[keyof T]
		afterWrite?.(object, prop)
		triggerRef(version)
	}

	return { read, write }
}
