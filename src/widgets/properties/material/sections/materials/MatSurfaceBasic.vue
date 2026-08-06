<template>
	<MatSurfaceSections :surface-fields="surfaceFields" :field-groups="fieldGroups" />
</template>

<script lang="ts" setup>
import type THREE from '@/shared/three'
import type { FieldDescriptor, FieldGroup } from '@/shared/lib/field-descriptor'
import { alphaGroup, ambientOcclusionGroup, environmentGroup, lightGroup } from './groups'

type Mat = THREE.MeshBasicMaterial

const surfaceFields: FieldDescriptor<Mat>[] = [
	{ type: 'color', label: 'Base Color', prop: 'color' },
	{ type: 'map', label: 'Color Map', prop: 'map' }
]

const fieldGroups: FieldGroup<Mat>[] = [
	alphaGroup(),
	environmentGroup({ intensity: false }),
	lightGroup(),
	ambientOcclusionGroup()
]
</script>
