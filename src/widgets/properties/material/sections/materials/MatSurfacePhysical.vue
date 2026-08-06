<template>
	<MatSurfaceSections :surface-fields="surfaceFields" :field-groups="fieldGroups" />
</template>

<script lang="ts" setup>
import type THREE from '@/shared/three'
import type { FieldDescriptor, FieldGroup } from '@/shared/lib/field-descriptor'
import {
	alphaGroup,
	ambientOcclusionGroup,
	emissionGroup,
	environmentGroup,
	lightGroup,
	normalBumpGroup
} from './groups'

type Mat = THREE.MeshPhysicalMaterial

const surfaceFields: FieldDescriptor<Mat>[] = [
	{ type: 'color', label: 'Base Color', prop: 'color' },
	{ type: 'map', label: 'Color Map', prop: 'map' },
	{ type: 'number', label: 'Metalness', prop: 'metalness', min: 0, max: 1, step: 0.01 },
	{ type: 'map', label: 'Metalness Map', prop: 'metalnessMap' },
	{ type: 'number', label: 'Roughness', prop: 'roughness', min: 0, max: 1, step: 0.01 },
	{ type: 'map', label: 'Roughness Map', prop: 'roughnessMap' },
	{ type: 'number', label: 'IOR', prop: 'ior', min: 1, max: 2.333, step: 0.01 }
]

const fieldGroups: FieldGroup<Mat>[] = [
	alphaGroup(),
	environmentGroup(),
	{
		label: 'Specular',
		value: 'specular',
		fields: [
			{ type: 'color', label: 'Color', prop: 'specularColor' },
			{ type: 'map', label: 'Color Map', prop: 'specularColorMap' },
			{ type: 'number', label: 'Intensity', prop: 'specularIntensity', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Intensity Map', prop: 'specularIntensityMap' }
		]
	},
	{
		label: 'Anisotropy',
		value: 'anisotropy',
		fields: [
			{ type: 'number', label: 'Strength', prop: 'anisotropy', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Anisotropy Map', prop: 'anisotropyMap', showIf: 'anisotropy' },
			{ type: 'angle', label: 'Rotation', prop: 'anisotropyRotation', showIf: 'anisotropy' }
		]
	},
	{
		label: 'Sheen',
		value: 'sheen',
		fields: [
			{ type: 'number', label: 'Intensity', prop: 'sheen', min: 0, max: 1, step: 0.01 },
			{ type: 'color', label: 'Color', prop: 'sheenColor' },
			{ type: 'map', label: 'Color Map', prop: 'sheenColorMap' },
			{ type: 'number', label: 'Roughness', prop: 'sheenRoughness', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Roughness Map', prop: 'sheenRoughnessMap' }
		]
	},
	{
		label: 'Coat',
		value: 'coat',
		fields: [
			{ type: 'number', label: 'Intensity', prop: 'clearcoat', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Coat Map', prop: 'clearcoatMap' },
			{ type: 'map', label: 'Coat Normal Map', prop: 'clearcoatNormalMap' },
			{
				type: 'vector2',
				label: 'Coat Normal Scale',
				prop: 'clearcoatNormalScale',
				showIf: 'clearcoatNormalMap',
				min: 0,
				max: 1,
				step: 0.01
			},
			{
				type: 'number',
				label: 'Roughness',
				prop: 'clearcoatRoughness',
				min: 0,
				max: 1,
				step: 0.01
			},
			{ type: 'map', label: 'Roughness Map', prop: 'clearcoatRoughnessMap' }
		]
	},
	{
		label: 'Iridescence',
		value: 'iridescence',
		fields: [
			{ type: 'number', label: 'Intensity', prop: 'iridescence', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Map', prop: 'iridescenceMap', showIf: 'iridescence' },
			{ type: 'number', label: 'IOR', prop: 'iridescenceIOR', min: 1, max: 2.333, step: 0.01 }
			// {
			// 	type: 'map',
			// 	label: 'Thickness Map',
			// 	prop: 'iridescenceThicknessMap'
			// }
			// {
			// 	type: 'range',
			// 	label: 'Thickness Range',
			// 	prop: 'iridescenceThicknessRange',
			// 	min: 0,
			// 	max: 1000,
			// 	step: 1
			// }
		]
	},
	{
		label: 'Transmission',
		value: 'transmission',
		fields: [
			{ type: 'number', label: 'Transmission', prop: 'transmission', min: 0, max: 1, step: 0.01 },
			{ type: 'map', label: 'Map', prop: 'transmissionMap' }
			// {
			// 	type: 'number',
			// 	label: 'Thickness',
			// 	prop: 'thickness',
			// 	min: 0
			// },
			// { type: 'map', label: 'Thickness Map', prop: 'thicknessMap' }
		]
	},
	emissionGroup(),
	normalBumpGroup(),
	lightGroup(),
	ambientOcclusionGroup()
]
</script>
