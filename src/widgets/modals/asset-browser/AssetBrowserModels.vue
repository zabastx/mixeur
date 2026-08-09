<!--
	Browses Poly Haven's models and drops one into the scene.

	The layout comes from AssetBrowserShell; what is here is the choosing, which
	for a model is a resolution — the format is always glTF, because that is what
	the viewport's loader reads.
-->
<template>
	<AssetBrowserShell v-model="isOpen" type="models" @select="reset" @files="setFilesData">
		<template #controls>
			<InputField label="Resolution" class="z-10 mt-2">
				<InputSelect v-model="selectedResOption" class="z-10" :items="fileResOptions" />
			</InputField>
			<div><b>Size: </b>{{ selectedOptionData?.size }}</div>
		</template>
		<template #import="{ asset }">
			<button type="button" class="btn mt-auto btn--highlight" @click="importModel(asset)">
				Import
			</button>
		</template>
	</AssetBrowserShell>
</template>

<script lang="ts" setup>
import { bytesToSize } from '@/shared/lib/format'
import { computed, ref, shallowRef } from 'vue'
import { getModelData } from './polyhaven'
import { useSceneStore } from '@/app/model/scene'
import { lookupUri } from '@/shared/lib/asset-source'
import type { AssetFiles, AssetWithId, ModelFiles } from './types/polyhaven'

const isOpen = defineModel<boolean>({ default: false })

const modelFilesData = ref<ModelFiles['gltf']>()
const fileResOptions = shallowRef<{ value: string; label: string }[]>([])
const selectedResOption = ref<string>()

const selectedOptionData = computed(() => {
	if (!selectedResOption.value || !modelFilesData.value) return null
	const data = modelFilesData.value[selectedResOption.value]?.['gltf']
	if (!data) return null
	const includedFiles = data.include ? Object.values(data.include) : []
	const sizeInBytes = data.size + includedFiles.reduce((prev, cur) => cur.size + prev, 0)
	return {
		size: bytesToSize(sizeInBytes)
	}
})

/** Cleared, not left showing the last model's resolutions. */
function reset() {
	modelFilesData.value = undefined
	fileResOptions.value = []
	selectedResOption.value = undefined
}

function setFilesData(files: AssetFiles) {
	if (!('gltf' in files)) return

	const gtlfData = files['gltf']
	if (!gtlfData) return

	modelFilesData.value = gtlfData
	fileResOptions.value = Object.keys(gtlfData).map((value) => ({ value, label: value }))
	selectedResOption.value = fileResOptions.value[0]?.value
}

const sceneStore = useSceneStore()
const IS_DEV = import.meta.env.DEV

async function importModel(asset: AssetWithId) {
	if (!selectedResOption.value || !modelFilesData.value) return

	const data = getModelData({
		format: 'gltf',
		resolution: selectedResOption.value,
		files: modelFilesData.value
	})

	if (!data) {
		if (IS_DEV) console.warn('getModelData is undefined')
		return
	}

	const { loadModel } = await import('@/shared/three/modules/loaders')

	// Keyed by both the full path and the bare filename, so a glTF referencing
	// either form finds its texture.
	const textures = new Map(Object.entries(data.textureUrlMap))

	const result = await loadModel(
		{ url: data.url, filename: asset.name },
		// PolyHaven serves this entry as glTF by construction, so say so rather
		// than leaving it to whatever extension the download URL happens to carry.
		{ format: 'gltf', resolve: (uri) => lookupUri(textures, uri) }
	)

	if (!result.ok) return

	sceneStore.addObjectToScene(result.value)
}
</script>
