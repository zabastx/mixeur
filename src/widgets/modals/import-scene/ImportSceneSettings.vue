<template>
	<MxAccordionRoot type="multiple" :default-value="['material']">
		<MxAccordionItem
			v-if="selectedFile?.type === 'obj'"
			label="Material"
			:item="{ value: 'material' }"
		>
			<MTLSettings v-model="settings.mtl" @reset="onReset('mtl')" />
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import type { MaterialCreatorOptions } from 'three/examples/jsm/loaders/MTLLoader.js'
import type { FileListItem } from './types'
import THREE from '@/shared/three'
import { reactive } from 'vue'

defineProps<{
	selectedFile: FileListItem | null
}>()

interface SceneSettings {
	mtl: MaterialCreatorOptions
}

const DEFAULT_SETTINGS: SceneSettings = {
	mtl: {
		side: THREE.FrontSide,
		normalizeRGB: false,
		ignoreZeroRGBs: false,
		wrap: THREE.RepeatWrapping,
		invertTrProperty: false
	}
}

const settings = reactive<SceneSettings>(structuredClone(DEFAULT_SETTINGS))

function onReset(key: keyof SceneSettings) {
	settings[key] = structuredClone(DEFAULT_SETTINGS[key])
}

defineExpose({
	settings
})
</script>
