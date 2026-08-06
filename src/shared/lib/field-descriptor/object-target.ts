import { shallowRef, toValue, triggerRef, type MaybeRefOrGetter } from 'vue'
import type { FieldTarget, ObjectProp } from './types'

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
	source: MaybeRefOrGetter<T | null | undefined>
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
		invalidate(object, prop)
		triggerRef(version)
	}

	return { read, write }
}

/**
 * Resizing a shadow's `mapSize` leaves the already-allocated render target at the
 * old resolution, so it has to be dropped for Three.js to reallocate it.
 */
function invalidate<T extends object>(object: T, prop: ObjectProp<T>) {
	if (prop !== 'mapSize' || !('map' in object)) return

	const shadow = object as { map: { dispose(): void } | null }
	shadow.map?.dispose()
	shadow.map = null
}
