import type THREE from '@/shared/three'
import type { InputSelectOption, MxTooltipContent, NonMethodKeys } from '../types'

export type ObjectProp<T> = NonNullable<NonMethodKeys<T>>

/**
 * The value each field type exchanges with its input. This is the *editor-facing*
 * representation, not the Three.js one: a colour is a hex string here and a
 * `THREE.Color` on the object, an angle is degrees here and radians on the object.
 * Translating between the two is `decode`/`encode`'s job.
 */
export type FieldValueMap = {
	color: string
	number: number | undefined
	angle: number | undefined
	checkbox: boolean | 'indeterminate' | undefined
	select: string | number | null | undefined
	euler: THREE.Euler
	vector2: THREE.Vector2
	map: THREE.Texture | undefined | null
	envMap: THREE.Texture | undefined | null
	range: number[]
}

export type FieldType = keyof FieldValueMap

interface GenericInput {
	type: 'color' | 'checkbox' | 'euler' | 'map' | 'envMap'
}

interface NumberInput {
	type: 'number' | 'angle' | 'vector2' | 'range'
	min?: number
	max?: number
	step?: number
}

interface SelectInput {
	type: 'select'
	options: InputSelectOption<string | number | null>[]
}

/**
 * One editable property of `T`, described rather than rendered. Every panel that
 * edits a Three.js object speaks this vocabulary; `FieldList` is the only thing
 * that turns it into inputs.
 */
export type FieldDescriptor<T> = {
	prop: ObjectProp<T>
	label: string
	/** Disable this field while the named sibling property is falsy. */
	showIf?: ObjectProp<T>
	/** Overrides the type's default number formatting (degrees for `angle`). */
	formatOptions?: Intl.NumberFormatOptions
	/** Takes precedence over the tooltip map passed to the renderer. */
	tooltip?: MxTooltipContent
} & (GenericInput | NumberInput | SelectInput)

export interface FieldGroup<T> {
	label: string
	/** Accordion item id — must be unique within the surface. */
	value: string
	fields: FieldDescriptor<T>[]
}

/**
 * Where field values are read from and written to. The seam that lets one
 * renderer serve properties reached by in-place mutation (lights, shadows) and
 * properties reached through a store action (materials).
 *
 * Implementations own two things the renderer must not know about: making a
 * read after an in-place mutation observable to Vue, and any invalidation the
 * write implies.
 */
export interface FieldTarget<T> {
	read(prop: ObjectProp<T>): unknown
	write(prop: ObjectProp<T>, value: unknown): void
}
