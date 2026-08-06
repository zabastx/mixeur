import THREE from '@/shared/three'
import type { FieldDescriptor, FieldGroup } from '@/shared/lib/field-descriptor'

/**
 * Field groups shared by the mesh surfaces.
 *
 * Three.js spreads the same handful of features across most mesh materials, so
 * most surfaces differ only in which of these groups they offer and in the few
 * fields unique to them. Each group is defined once here and named by the
 * material capability it edits.
 *
 * Groups are written against `Reference`, which owns every property they
 * mention, so the descriptors below are checked against a concrete material.
 * Each group's `T` constraint is what proves the *caller's* material owns those
 * properties; TypeScript cannot relate a literal to the deferred `ObjectProp<T>`,
 * which is what `forMaterial` bridges. Where a group has an optional field, the
 * overloads make the constraint follow the option.
 */
type Reference = THREE.MeshPhysicalMaterial

function forMaterial<T>(fields: FieldDescriptor<Reference>[]): FieldDescriptor<T>[] {
	return fields as unknown as FieldDescriptor<T>[]
}

type AlphaMaterial = Pick<Reference, 'transparent' | 'opacity' | 'alphaTest' | 'alphaToCoverage'>

const ALPHA_MAP: FieldDescriptor<Reference> = { type: 'map', label: 'Alpha Map', prop: 'alphaMap' }

/** Materials that have an `alphaMap`, which is most of them. */
export function alphaGroup<T extends AlphaMaterial & Pick<Reference, 'alphaMap'>>(): FieldGroup<T>
/** `MeshNormalMaterial` has no `alphaMap`. */
export function alphaGroup<T extends AlphaMaterial>(options: { alphaMap: false }): FieldGroup<T>
export function alphaGroup<T extends AlphaMaterial>({ alphaMap = true } = {}): FieldGroup<T> {
	return {
		label: 'Alpha',
		value: 'alpha',
		fields: forMaterial([
			{ type: 'checkbox', label: 'Transparent', prop: 'transparent' },
			{
				type: 'number',
				label: 'Opacity',
				prop: 'opacity',
				min: 0,
				max: 1,
				step: 0.01,
				enabledIf: 'transparent'
			},
			...(alphaMap ? [ALPHA_MAP] : []),
			{ type: 'number', label: 'Alpha Test', prop: 'alphaTest', min: 0, max: 1, step: 0.01 },
			{ type: 'checkbox', label: 'Alpha to coverage', prop: 'alphaToCoverage' }
		])
	}
}

type EnvironmentMaterial = Pick<Reference, 'envMap' | 'envMapRotation'>

const ENV_MAP_INTENSITY: FieldDescriptor<Reference> = {
	type: 'number',
	label: 'Map Intensity',
	prop: 'envMapIntensity',
	min: 0,
	max: 1,
	step: 0.01
}

/** Materials that scale their environment through `envMapIntensity`. */
export function environmentGroup<
	T extends EnvironmentMaterial & Pick<Reference, 'envMapIntensity'>
>(): FieldGroup<T>
/** `MeshBasicMaterial` has no `envMapIntensity`; it scales through `combine` instead. */
export function environmentGroup<T extends EnvironmentMaterial>(options: {
	intensity: false
}): FieldGroup<T>
export function environmentGroup<T extends EnvironmentMaterial>({
	intensity = true
} = {}): FieldGroup<T> {
	return {
		label: 'Environment',
		value: 'environment',
		fields: forMaterial([
			{ type: 'envMap', label: 'Map', prop: 'envMap' },
			...(intensity ? [ENV_MAP_INTENSITY] : []),
			{ type: 'euler', label: 'Map Rotation', prop: 'envMapRotation' }
		])
	}
}

type EmissiveMaterial = Pick<Reference, 'emissive' | 'emissiveMap' | 'emissiveIntensity'>

export function emissionGroup<T extends EmissiveMaterial>(): FieldGroup<T> {
	return {
		label: 'Emission',
		value: 'emission',
		fields: forMaterial([
			{ type: 'color', label: 'Color', prop: 'emissive' },
			{ type: 'map', label: 'Map', prop: 'emissiveMap' },
			{ type: 'number', label: 'Intensity', prop: 'emissiveIntensity' }
		])
	}
}

type NormalMaterial = Pick<
	Reference,
	'normalMap' | 'normalMapType' | 'normalScale' | 'bumpMap' | 'bumpScale'
>

export function normalBumpGroup<T extends NormalMaterial>(): FieldGroup<T> {
	return {
		label: 'Normal & Bump',
		value: 'normal',
		fields: forMaterial([
			{ type: 'map', label: 'Normal Map', prop: 'normalMap' },
			{
				type: 'select',
				label: 'Normal Map Type',
				prop: 'normalMapType',
				options: [
					{ label: 'Tangent Space', value: THREE.TangentSpaceNormalMap },
					{ label: 'Object Space', value: THREE.ObjectSpaceNormalMap }
				]
			},
			{ type: 'vector2', label: 'Normal Scale', prop: 'normalScale', step: 0.01 },
			{ type: 'map', label: 'Bump Map', prop: 'bumpMap' },
			{ type: 'number', label: 'Bump Scale', prop: 'bumpScale', min: 0, max: 1, step: 0.01 }
		])
	}
}

type LightMapMaterial = Pick<Reference, 'lightMap' | 'lightMapIntensity'>

export function lightGroup<T extends LightMapMaterial>(): FieldGroup<T> {
	return {
		label: 'Light',
		value: 'light',
		fields: forMaterial([
			{ type: 'map', label: 'Map', prop: 'lightMap' },
			{
				type: 'number',
				label: 'Intensity',
				prop: 'lightMapIntensity',
				min: 0,
				max: 1,
				step: 0.01
			}
		])
	}
}

type OcclusionMaterial = Pick<Reference, 'aoMap' | 'aoMapIntensity'>

export function ambientOcclusionGroup<T extends OcclusionMaterial>(): FieldGroup<T> {
	return {
		label: 'Ambient Occlusion',
		value: 'ao',
		fields: forMaterial([
			{ type: 'map', label: 'Map', prop: 'aoMap' },
			{
				type: 'number',
				label: 'Intensity',
				prop: 'aoMapIntensity',
				min: 0,
				max: 1,
				step: 0.01,
				enabledIf: 'aoMap'
			}
		])
	}
}
