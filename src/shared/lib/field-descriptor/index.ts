import { toValue, type MaybeRefOrGetter } from 'vue'
import { decode, encode } from './marshal'
import type { FieldDescriptor, FieldTarget, FieldType, FieldValueMap, ObjectProp } from './types'

export { createObjectTarget } from './object-target'
export { decode, encode, fieldFormatOptions } from './marshal'
export type * from './types'

/**
 * Reads and writes field values through `target`, translating between the
 * editor-facing representation the inputs use and what the object stores.
 *
 * `target` is accepted as a getter so a panel can swap targets without the
 * caller re-running.
 */
export function useFields<T>(target: MaybeRefOrGetter<FieldTarget<T>>) {
	function getValue<K extends FieldType>(type: K, prop: ObjectProp<T>): FieldValueMap[K] {
		return decode(type, toValue(target).read(prop))
	}

	function setValue<K extends FieldType>(type: K, prop: ObjectProp<T>, value: FieldValueMap[K]) {
		toValue(target).write(prop, encode(type, value))
	}

	/** `enabledIf` names a sibling property that has to be truthy for editing to make sense. */
	function isEnabled(field: FieldDescriptor<T>): boolean {
		if (!field.enabledIf) return true
		return Boolean(toValue(target).read(field.enabledIf))
	}

	return { getValue, setValue, isEnabled }
}
