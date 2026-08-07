<template>
	<MaterialInputFields :fields-list="fields" />
</template>

<script lang="ts" setup>
import type THREE from '@/shared/three'
import type { MeshMaterials } from '../utils/types'
import type { FieldDescriptor } from '@/shared/lib/field-descriptor'

const fields: FieldDescriptor<Exclude<MeshMaterials, THREE.MeshBasicMaterial>>[] = [
	{ type: 'map', label: 'Map', prop: 'displacementMap' },
	{
		type: 'number',
		label: 'Scale',
		prop: 'displacementScale',
		step: 0.01
	},
	{
		type: 'number',
		label: 'Bias',
		prop: 'displacementBias',
		step: 0.01
	}
]
</script>
