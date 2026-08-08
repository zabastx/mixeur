<template>
	<div class="p-1 space-y-1">
		<InputField
			label="Side"
			label-width="auto"
			input-width="125px"
			:tooltip="{ text: 'Which side to apply the material' }"
		>
			<InputSelect v-model="settings.side" :items="sideOptions" />
		</InputField>
		<InputField
			label="Wrapping"
			label-width="auto"
			input-width="125px"
			:tooltip="{ text: 'What type of wrapping to apply for textures' }"
		>
			<InputSelect v-model="settings.wrap" :items="wrapOptions" />
		</InputField>
		<InputField
			label="Normalize RGB"
			label-width="1fr"
			:tooltip="{ text: 'Whether RGB colors should be normalized to 0-1 from 0-255' }"
		>
			<InputCheckbox v-model="settings.normalizeRGB" />
		</InputField>
		<InputField
			label="Ignore Zero RGBs"
			label-width="1fr"
			:tooltip="{ text: 'Ignore values of RGBs (Ka,Kd,Ks) that are all 0\'s' }"
		>
			<InputCheckbox v-model="settings.ignoreZeroRGBs" />
		</InputField>
		<InputField
			label="Invert Transparency"
			label-width="1fr"
			:tooltip="{
				text: 'When true transparency value of 1 becomes fully opaque, and 0 becomes fully transparent'
			}"
		>
			<InputCheckbox v-model="settings.invertTrProperty" />
		</InputField>

		<div class="text-right mt-2">
			<button type="button" class="btn px-2" @click="$emit('reset')">Reset</button>
		</div>
	</div>
</template>

<script lang="ts" setup>
import THREE from '@/shared/three'
import type { MaterialCreatorOptions } from 'three/examples/jsm/loaders/MTLLoader.js'

const settings = defineModel<MaterialCreatorOptions>({ required: true })

defineEmits<{
	reset: []
}>()

const sideOptions = [
	{
		value: THREE.FrontSide,
		label: 'Front Side'
	},
	{
		value: THREE.BackSide,
		label: 'Back Side'
	},
	{
		value: THREE.DoubleSide,
		label: 'Double Side'
	}
]

const wrapOptions = [
	{
		value: THREE.RepeatWrapping,
		label: 'Repeat'
	},
	{
		value: THREE.ClampToEdgeWrapping,
		label: 'Clamp to edge'
	},
	{
		value: THREE.MirroredRepeatWrapping,
		label: 'Mirrored repeat'
	}
]
</script>
