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

type Mat = THREE.MeshStandardMaterial

const surfaceFields: FieldDescriptor<Mat>[] = [
	{ type: 'color', label: 'Base Color', prop: 'color' },
	{ type: 'map', label: 'Color Map', prop: 'map' },
	{ type: 'number', label: 'Metalness', prop: 'metalness', min: 0, max: 1, step: 0.01 },
	{ type: 'map', label: 'Metalness Map', prop: 'metalnessMap' },
	{ type: 'number', label: 'Roughness', prop: 'roughness', min: 0, max: 1, step: 0.01 },
	{ type: 'map', label: 'Roughness Map', prop: 'roughnessMap' }
]

const fieldGroups: FieldGroup<Mat>[] = [
	alphaGroup(),
	environmentGroup(),
	emissionGroup(),
	normalBumpGroup(),
	lightGroup(),
	ambientOcclusionGroup()
]
</script>
