<!--
	Browses Poly Haven's textures and hands one file back to whoever opened the
	dialog.

	The layout comes from AssetBrowserShell; what is here is the choosing, which
	for a texture is three narrowing steps — map type, then the resolutions that
	map type was published at, then the formats that resolution was published in.
-->
<template>
	<AssetBrowserShell v-model="isOpen" type="textures" @select="reset" @files="setFilesData">
		<template #controls>
			<InputSelect
				v-model="selectedMapType"
				class="z-10 mt-2"
				:items="textureTypes"
				placeholder="Map type"
			/>
			<InputSelect
				v-if="selectedMapType"
				v-model="selectedResOption"
				class="z-10"
				:items="fileResOptions"
				placeholder="Resolution"
			/>
			<InputSelect
				v-if="selectedResOption"
				v-model="selectedFormatOption"
				class="z-10"
				:items="formatOptions"
				placeholder="Format"
			/>
			<div v-if="selectedTexture"><b>Size: </b>{{ bytesToSize(selectedTexture.size) }}</div>
		</template>
		<template #import>
			<button type="button" class="btn mt-auto btn--highlight" @click="importTexture">
				Import
			</button>
		</template>
	</AssetBrowserShell>
</template>

<script lang="ts" setup>
import type { AssetFiles, TextureFiles } from '@/widgets/modals/asset-browser/types/polyhaven'
import { bytesToSize } from '@/shared/lib/format'
import { computed, ref, shallowRef } from 'vue'

const isOpen = defineModel<boolean>({ default: false })

const props = defineProps<{
	callback?: ((args: unknown) => unknown) | null
}>()

function importTexture() {
	if (!selectedTexture.value) return
	props.callback?.(selectedTexture.value)
	isOpen.value = false
}

const mapTypesMap = new Map([
	['AO', 'AO'],
	['rough_ao', 'Rough AO'],
	['arm', 'AO/Rough/Metal'],
	['Diffuse', 'Diffuse'],
	['Displacement', 'Displacement'],
	['nor_dx', 'Normal (DX)'],
	['nor_gl', 'Normal (GL)'],
	['rough', 'Rough'],
	['bump', 'Bump'],
	['spec', 'Spec'],
	['spec_ior', 'Spec Ior'],
	['anisotropy_rotation', 'Anisotropy Rotation'],
	['anisotropy_strength', 'Anisotropy Strength']
])

const textureFilesData = ref<TextureFiles>()

const selectedMapType = ref<string>()
const textureTypes = shallowRef<{ label: string; value: string }[]>([])

const selectedResOption = ref<string>()
const fileResOptions = computed(() => {
	if (!selectedMapType.value || !textureFilesData.value) return []
	return Object.keys(textureFilesData.value[selectedMapType.value] ?? {}).map((item) => ({
		label: item,
		value: item
	}))
})

const selectedFormatOption = ref<string>()
const formatOptions = computed(() => {
	if (
		!selectedMapType.value ||
		!selectedResOption.value ||
		!textureFilesData.value ||
		!textureFilesData.value[selectedMapType.value]?.[selectedResOption.value]
	)
		return []
	return Object.keys(
		textureFilesData.value?.[selectedMapType.value]?.[selectedResOption.value] ?? {}
	).map((item) => ({
		label: item,
		value: item
	}))
})

const selectedTexture = computed(() => {
	if (
		!selectedMapType.value ||
		!selectedResOption.value ||
		!selectedFormatOption.value ||
		!textureFilesData.value
	)
		return

	const mapType = selectedMapType.value
	const res = selectedResOption.value
	const format = selectedFormatOption.value

	return textureFilesData.value[mapType]?.[res]?.[format]
})

/**
 * Cleared, not left showing the last texture's maps: the three selects narrow
 * each other, so a map type held over from another asset would offer
 * resolutions this one has never been published at.
 */
function reset() {
	textureFilesData.value = undefined
	textureTypes.value = []
	selectedMapType.value = undefined
	selectedResOption.value = undefined
	selectedFormatOption.value = undefined
}

function setFilesData(files: AssetFiles) {
	textureFilesData.value = files as TextureFiles
	textureTypes.value = Object.keys(files)
		.map((item) => {
			const skipArr = ['blend', 'gltf', 'mtlx']
			if (skipArr.includes(item))
				return {
					value: '',
					label: ''
				}
			return {
				value: item,
				label: mapTypesMap.get(item) || item
			}
		})
		.filter((item) => !!item.value)
}
</script>
