import THREE from '@/shared/three'
import type { FieldType, FieldValueMap } from './types'

const DEGREE_FORMAT: Intl.NumberFormatOptions = {
	style: 'unit',
	unitDisplay: 'narrow',
	unit: 'degree'
}

/**
 * Turns a value read off a Three.js object into what the input for `type` expects.
 * Total: every type has an answer for every input, including `undefined`.
 */
export function decode<K extends FieldType>(type: K, raw: unknown): FieldValueMap[K] {
	switch (type) {
		case 'color':
			return `#${raw instanceof THREE.Color ? raw.getHexString() : '000000'}` as FieldValueMap[K]
		case 'angle':
			return THREE.MathUtils.radToDeg((raw as number | undefined) ?? 0) as FieldValueMap[K]
		case 'range':
			if (raw instanceof THREE.Vector2) return raw.toArray() as unknown as FieldValueMap[K]
			return (Array.isArray(raw) ? raw : []) as FieldValueMap[K]
		default:
			return raw as FieldValueMap[K]
	}
}

/** Inverse of {@link decode}: turns an input's value into what the object stores. */
export function encode<K extends FieldType>(type: K, value: FieldValueMap[K]): unknown {
	switch (type) {
		case 'color':
			return new THREE.Color((value as string | undefined) ?? '#000000')
		case 'angle':
			return THREE.MathUtils.degToRad((value as number | undefined) ?? 0)
		case 'range':
			return new THREE.Vector2().fromArray((value as number[] | undefined) ?? [])
		default:
			return value
	}
}

/**
 * Number formatting for a field. An explicit `formatOptions` always wins; angles
 * fall back to degrees so every angle field reads the same without saying so.
 */
export function fieldFormatOptions(
	type: FieldType,
	formatOptions?: Intl.NumberFormatOptions
): Intl.NumberFormatOptions | undefined {
	if (formatOptions) return formatOptions
	return type === 'angle' ? DEGREE_FORMAT : undefined
}
