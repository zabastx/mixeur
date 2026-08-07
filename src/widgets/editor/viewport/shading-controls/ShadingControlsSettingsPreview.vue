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
						:src="`/textures/world/${currentMapName}.png`"
						alt="current environment map"
						width="64"
						height="64"
					/>
				</button>
			</template>
			<template #content>
				<div class="flex gap-0.5">
					<MxTooltip
						v-for="map in DEFAULT_WORLD_MAPS"
						:key="map"
						:tooltip="{
							text: map.slice(0, 1).toUpperCase() + map.slice(1),
							footer: 'Studio lighting setup'
						}"
					>
						<button
							type="button"
							class="btn bg-ui-menu-inner border-ui-menu-outline"
							:class="{
								'bg-ui-menu-item-inner-selected': currentMapName === map
							}"
							@click="changeEnvMap(map)"
						>
							<img width="64" height="64" :src="`/textures/world/${map}.png`" :alt="map" />
						</button>
					</MxTooltip>
				</div>
			</template>
		</MxPopover>
		<div class="text-xs space-y-0.5">
			<InputField label="Intensity" input-width="175px">
				<InputNumber v-model="sceneStore.scene.environmentIntensity" :min="0" :step="0.01" />
			</InputField>
			<InputField label="Rotation" input-width="175px">
				<InputEuler v-model="rotation" :min="-180" :max="180" />
			</InputField>
		</div>
	</div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { DEFAULT_WORLD_MAPS, loadWorldTexture } from '@/shared/three/modules/loaders/environment'
import { useShadingStore } from '@/app/model/shading'
import type THREE from '@/shared/three'
import { useSceneStore } from '@/app/model/scene'

const shadingStore = useShadingStore()

const currentMapName = computed(() => shadingStore.environmentMap?.name)
const isUpdating = ref(false)

async function changeEnvMap(map: (typeof DEFAULT_WORLD_MAPS)[number]) {
	if (isUpdating.value || currentMapName.value === map) return
	isUpdating.value = true
	const result = await loadWorldTexture(map)
	if (result.ok) shadingStore.setEnvironmentMap(result.value)
	isUpdating.value = false
}

const sceneStore = useSceneStore()

const rotation = computed<THREE.Euler>(() => sceneStore.scene.environmentRotation)
</script>
