<template>
	<div class="space-y-1">
		<h2>Viewport Shading</h2>
		<h3 class="text-xs mt-2">Studio Light</h3>
		<MxPopover>
			<template #trigger>
				<button
					type="button"
					class="flex justify-center rounded border bg-ui-menu-inner border-ui-menu-outline
						hover:brightness-125 cursor-pointer w-full p-1"
				>
					<img
						:src="`/textures/studio/${currentLightName}.png`"
						alt="current studio light"
						width="64"
						height="64"
					/>
				</button>
			</template>
			<template #content>
				<div class="flex gap-0.5">
					<MxTooltip
						v-for="light in DEFAULT_STUDIO_LIGHTS"
						:key="light"
						:tooltip="{
							text: light.slice(0, 1).toUpperCase() + light.slice(1),
							footer: 'Studio lighting setup'
						}"
					>
						<button
							type="button"
							class="btn bg-ui-menu-inner border-ui-menu-outline"
							:class="{
								'bg-ui-menu-item-inner-selected': currentLightName === light
							}"
							@click="changeStudioLight(light)"
						>
							<img width="64" height="64" :src="`/textures/studio/${light}.png`" :alt="light" />
						</button>
					</MxTooltip>
				</div>
			</template>
		</MxPopover>
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
import { DEFAULT_STUDIO_LIGHTS, loadStudioLight } from '@/shared/three/modules/loaders/studio-light'
import { useShadingStore } from '@/app/model/shading'

const shadingStore = useShadingStore()

const currentLightName = computed(() => shadingStore.studioLight?.name)
const isUpdating = ref(false)

async function changeStudioLight(light: (typeof DEFAULT_STUDIO_LIGHTS)[number]) {
	if (isUpdating.value || currentLightName.value === light) return
	isUpdating.value = true
	const result = await loadStudioLight(light)
	if (result.ok) shadingStore.setStudioLight(result.value)
	isUpdating.value = false
}
</script>
