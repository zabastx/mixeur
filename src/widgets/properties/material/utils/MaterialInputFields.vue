<template>
	<FieldList :fields="fieldsList" :target :tooltips="materialTooltipMap" />
</template>

<script lang="ts" setup generic="Mat extends THREE.Material">
import type THREE from '@/shared/three'
import type { FieldDescriptor } from '@/shared/lib/field-descriptor'
import { useMeshMaterial } from '../material'
import { materialTooltipMap } from './tooltips'

defineProps<{
	fieldsList: FieldDescriptor<Mat>[]
}>()

const { createMaterialTarget } = useMeshMaterial<Mat>()

const target = createMaterialTarget()
</script>
