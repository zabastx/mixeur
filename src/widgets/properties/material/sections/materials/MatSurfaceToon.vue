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
	lightGroup,
	normalBumpGroup
} from './groups'

type Mat = THREE.MeshToonMaterial

const surfaceFields: FieldDescriptor<Mat>[] = [
	{ type: 'color', label: 'Base Color', prop: 'color' },
	{ type: 'map', label: 'Color Map', prop: 'map' },
	{ type: 'map', label: 'Gradient Map', prop: 'gradientMap' }
]

const fieldGroups: FieldGroup<Mat>[] = [
	alphaGroup(),
	emissionGroup(),
	normalBumpGroup(),
	lightGroup(),
	ambientOcclusionGroup()
]
</script>
