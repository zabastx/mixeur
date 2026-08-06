<template>
	<MaterialInputFields :fields-list="settingsFields" />
</template>

<script lang="ts" setup>
import THREE from '@/shared/three'
import type { FieldDescriptor } from '@/shared/lib/field-descriptor'

type SupportedMaterials =
	| THREE.MeshPhysicalMaterial
	| THREE.MeshStandardMaterial
	| THREE.MeshPhongMaterial
	| THREE.MeshToonMaterial
	| THREE.MeshLambertMaterial
	| THREE.MeshNormalMaterial

const settingsFields: FieldDescriptor<SupportedMaterials>[] = [
	{
		type: 'select',
		label: 'Side',
		prop: 'side',
		options: [
			{ label: 'Front Side', value: THREE.FrontSide },
			{ label: 'Back Side', value: THREE.BackSide },
			{ label: 'Double Side', value: THREE.DoubleSide }
		]
	},
	{
		type: 'select',
		label: 'Shadow Side',
		prop: 'shadowSide',
		options: [
			{ label: 'Default', value: null },
			{ label: 'Front Side', value: THREE.FrontSide },
			{ label: 'Back Side', value: THREE.BackSide },
			{ label: 'Double Side', value: THREE.DoubleSide }
		]
	},
	{
		type: 'select',
		label: 'Blending',
		prop: 'blending',
		options: [
			{ label: 'No Blending', value: THREE.NoBlending },
			{ label: 'Normal', value: THREE.NormalBlending },
			{ label: 'Additive', value: THREE.AdditiveBlending }
			// TODO: material.premultipliedAlpha = true
			// { label: 'Subtractive', value: THREE.SubtractiveBlending },
			// { label: 'Multiply', value: THREE.MultiplyBlending }
			// { label: 'Custom', value: THREE.CustomBlending }
		]
	},
	{
		type: 'select',
		label: 'Depth Function',
		prop: 'depthFunc',
		options: [
			{ label: 'Never', value: THREE.NeverDepth },
			{ label: 'Always', value: THREE.AlwaysDepth },
			{ label: 'Less', value: THREE.LessDepth },
			{ label: 'Less Equal', value: THREE.LessEqualDepth },
			{ label: 'Equal', value: THREE.EqualDepth },
			{ label: 'Greater Equal', value: THREE.GreaterEqualDepth },
			{ label: 'Greater', value: THREE.GreaterDepth },
			{ label: 'Not Equal', value: THREE.NotEqualDepth }
		]
	},
	{
		type: 'checkbox',
		label: 'Fog',
		prop: 'fog'
	},
	{
		type: 'checkbox',
		label: 'Dithering',
		prop: 'dithering'
	},
	{
		type: 'checkbox',
		label: 'Vertex Colors',
		prop: 'vertexColors'
	},
	{
		type: 'select',
		label: 'Precision',
		prop: 'precision',
		options: [
			{ label: 'Default', value: null },
			{ label: 'High', value: 'highp' },
			{ label: 'Medium', value: 'mediump' },
			{ label: 'Low', value: 'lowp' }
		]
	}
	// { type: 'checkbox', label: 'Alpha To Coverage', prop: 'alphaToCoverage' }
]
</script>
