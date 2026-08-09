<template>
	<div class="space-y-1">
		<h2>Viewport Shading</h2>
		<h3 class="text-xs mt-2">Studio Light</h3>
		<StudioImagePicker
			:name="currentLightName"
			alt="current studio light"
			tooltip-footer="Studio lighting setup"
			@select="changeStudioLight"
		/>
		<div class="text-xs space-y-0.5">
			<InputField label="Intensity" input-width="175px">
				<InputNumber v-model="shadingStore.studioLightIntensity" :min="0" :step="0.01" />
			</InputField>
			<InputField label="Rotation" input-width="175px">
				<InputEuler v-model="shadingStore.studioLightRotation" :min="-180" :max="180" />
			</InputField>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { loadStudioLight, type StudioLightName } from '@/shared/three/modules/loaders/studio-light'
import { useShadingStore } from '@/app/model/shading'

const shadingStore = useShadingStore()

const currentLightName = computed(
	() => shadingStore.studioLight?.name as StudioLightName | undefined
)
const isUpdating = ref(false)

async function changeStudioLight(light: StudioLightName) {
	if (isUpdating.value || currentLightName.value === light) return
	isUpdating.value = true
	const result = await loadStudioLight(light)
	if (result.ok) shadingStore.setStudioLight(result.value)
	isUpdating.value = false
}
</script>
