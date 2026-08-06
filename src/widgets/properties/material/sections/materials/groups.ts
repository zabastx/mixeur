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
 * mention, so the descriptors below are fully type-checked. Each group's `T`
 * constraint is what proves the *caller's* material owns those properties;
 * TypeScript cannot relate a literal to the deferred `ObjectProp<T>`, which is
 * what `forMaterial` bridges.
 */
type Reference = THREE.MeshPhysicalMaterial

function forMaterial<T>(fields: FieldDescriptor<Reference>[]): FieldDescriptor<T>[] {
	return fields as unknown as FieldDescriptor<T>[]
}

type AlphaMaterial = Pick<Reference, 'transparent' | 'opacity' | 'alphaTest' | 'alphaToCoverage'>

/**
 * @param alphaMap Pass `false` for materials without an `alphaMap` — the
 * constraint cannot express an optional property, so this is on the caller.
 */
export function alphaGroup<T extends AlphaMaterial>({ alphaMap = true } = {}): FieldGroup<T> {
	const fields: FieldDescriptor<Reference>[] = [
		{ type: 'checkbox', label: 'Transparent', prop: 'transparent' },
		{
			type: 'number',
			label: 'Opacity',
			prop: 'opacity',
			min: 0,
			max: 1,
			step: 0.01,
			showIf: 'transparent'
		},
		{ type: 'number', label: 'Alpha Test', prop: 'alphaTest', min: 0, max: 1, step: 0.01 },
		{ type: 'checkbox', label: 'Alpha to coverage', prop: 'alphaToCoverage' }
	]

	if (alphaMap) {
		fields.splice(2, 0, { type: 'map', label: 'Alpha Map', prop: 'alphaMap' })
	}

	return { label: 'Alpha', value: 'alpha', fields: forMaterial(fields) }
}

type EnvironmentMaterial = Pick<Reference, 'envMap' | 'envMapRotation'>

/**
 * @param intensity Pass `false` for materials without an `envMapIntensity`
 * (`MeshBasicMaterial` scales its environment through `combine` instead).
 */
export function environmentGroup<T extends EnvironmentMaterial>({
	intensity = true
} = {}): FieldGroup<T> {
	const fields: FieldDescriptor<Reference>[] = [
		{ type: 'envMap', label: 'Map', prop: 'envMap' },
		{ type: 'euler', label: 'Map Rotation', prop: 'envMapRotation' }
	]

	if (intensity) {
		fields.splice(1, 0, {
			type: 'number',
			label: 'Map Intensity',
			prop: 'envMapIntensity',
			min: 0,
			max: 1,
			step: 0.01
		})
	}

	return { label: 'Environment', value: 'environment', fields: forMaterial(fields) }
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
				showIf: 'aoMap'
			}
		])
	}
}
