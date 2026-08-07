<template>
	<MxDialog
		v-model="isOpen"
		title="File Browser"
		class="w-6xl h-2/3 text-ui-text-text block-border bg-window-bg flex flex-col"
		resize
		:root="{
			modal: false
		}"
		outside-interaction
		icon="file/bin"
	>
		<div
			class="h-full p-2 grid grid-rows-[1fr_min-content] gap-1 overflow-hidden"
			data-testid="import-scene"
		>
			<div class="grid grid-cols-[minmax(275px,1fr)_3fr_auto] gap-1 overflow-hidden">
				<ScrollContainer>
					<ImportSceneFiles
						ref="sceneFilesRef"
						:selected-file="selectedFile"
						@file-select="onFileSelect"
					/>
				</ScrollContainer>
				<div class="flex flex-col gap-2 overflow-hidden">
					<div
						class="text-sm text-ui-text-disabled space-y-1 rounded border border-ui-box-outline px-2
							py-1 bg-ui-box-inner"
					>
						<p class="font-medium text-ui-text-text">How to import models:</p>
						<ol class="list-decimal list-inside">
							<li>Upload model file (.obj, .gltf, .glb, .fbx)</li>
							<li>Upload assets (.mtl, textures, .bin)</li>
							<li>Select model in left panel</li>
							<li>Map required assets below</li>
							<li>Click Import</li>
						</ol>
					</div>
					<template v-if="selectedFile">
						<p>{{ selectedFile.file.name }}</p>
						<template v-if="requiredAssets.length > 0">
							<h2 class="flex justify-between text-sm">
								Required Assets:
								<button type="button" class="btn px-2 text-sm" @click="autoFillAssets">
									Auto Fill
								</button>
							</h2>
							<div class="space-y-0.5 overflow-hidden">
								<ScrollContainer class="text-xs rounded grow h-full max-h-full pr-3">
									<div
										v-for="item in requiredAssets"
										:key="item"
										class="border-b border-ui-text-outline pb-0.5 last:border-b-0 grid
											grid-cols-[1fr_200px]"
									>
										<span class="truncate">{{ item }}</span>
										<InputSelect
											:items="assetOptions"
											:model-value="assetsMap[selectedFile.id].get(item)"
											@update:model-value="onAssetSelect(selectedFile.id, item, $event)"
										/>
									</div>
								</ScrollContainer>
							</div>
						</template>
						<p v-else>No additional assets required</p>
					</template>
				</div>
				<ImportSceneSettings ref="settingsRef" class="w-[275px]" :selected-file="selectedFile" />
			</div>

			<div class="flex gap-1 justify-end">
				<MxButton highlighted @click="importScene">Import</MxButton>
				<MxButton @click="isOpen = false">Cancel</MxButton>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import { computed, reactive, shallowRef, useTemplateRef, watch } from 'vue'
import ImportSceneFiles from './ImportSceneFiles.vue'
import type { ModelFileItem } from './types'
import type ImportSceneSettings from './ImportSceneSettings.vue'
import { lookupUri, type AssetResolver } from '@/shared/lib/asset-source'
import { useSceneStore } from '@/app/model/scene'

const isOpen = defineModel<boolean>()

const sceneFilesRef = useTemplateRef<InstanceType<typeof ImportSceneFiles> | null>('sceneFilesRef')

const selectedFile = shallowRef<ModelFileItem | null>(null)

watch(isOpen, (val) => {
	if (!val) selectedFile.value = null
})

function onFileSelect(file: ModelFileItem) {
	selectedFile.value = file

	if (!assetsMap[file.id]) {
		assetsMap[file.id] = new Map()
		autoFillAssets()
	}
}

function autoFillAssets() {
	if (!selectedFile.value) return

	const getFilename = (str: string) => str.split('/').pop()

	requiredAssets.value.forEach((asset) => {
		const filename = getFilename(asset)
		const assetFile = sceneFilesRef.value?.assetFiles.find(
			(item) => getFilename(item.file.name) === filename
		)
		if (!filename || !assetFile || !selectedFile.value) return

		assetsMap[selectedFile.value.id].set(asset, assetFile.id)
	})
}

const requiredAssets = computed(() => {
	if (!selectedFile.value) return []
	const pickedAssetsIDs = Array.from(assetsMap[selectedFile.value.id].values())
	const additionalAssets = pickedAssetsIDs.flatMap(
		(id) => sceneFilesRef.value?.assetFiles.find((item) => item.id === id)?.assets || []
	)
	return selectedFile.value.assets.concat(additionalAssets)
})

const assetOptions = computed(() => {
	if (!sceneFilesRef.value) return []
	return sceneFilesRef.value.assetFiles.map(({ id, file }) => ({
		value: id,
		label: file.name
	}))
})

const assetsMap = reactive<Record<string, Map<string, string>>>({})

function onAssetSelect(sceneFileId: string, key: string, val?: string) {
	if (val) {
		assetsMap[sceneFileId].set(key, val)
	}
}

const settingsRef = useTemplateRef<InstanceType<typeof ImportSceneSettings> | null>('settingsRef')
const sceneStore = useSceneStore()

/** Turns the user's asset mapping into the answer a loader needs for a URI. */
function createResolver(sceneFileId: string): AssetResolver {
	const map = assetsMap[sceneFileId]

	return (uri) => {
		const assetId = lookupUri(map, uri)
		if (!assetId) return null
		return sceneFilesRef.value?.assetFiles.find((f) => f.id === assetId)?.file
	}
}

async function importScene() {
	const sceneFile = selectedFile.value
	if (!sceneFile) return

	const { loadModel } = await import('@/shared/three/modules/loaders')

	const result = await loadModel(sceneFile.file, {
		format: sceneFile.type,
		resolve: createResolver(sceneFile.id),
		materialOptions: settingsRef.value?.settings.mtl
	})

	isOpen.value = false
	if (result.ok) sceneStore.addObjectToScene(result.value)
}
</script>
