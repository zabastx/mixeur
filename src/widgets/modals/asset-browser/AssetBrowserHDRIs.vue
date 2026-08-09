<!--
	Browses Poly Haven's HDRIs and hands one back as a World Surface.

	Everything but the choosing comes from AssetBrowserShell — the layout is the
	textures browser's twin because it is the same library seen through a
	different filter, and a second layout would only make users learn one library
	twice. The choosing is a resolution and nothing else; the rules behind that
	single control live in `hdri.ts`.
-->
<template>
	<AssetBrowserShell v-model="isOpen" type="hdris" @select="reset" @files="setFilesData">
		<template #controls>
			<InputSelect
				v-model="selectedResolution"
				class="z-10 mt-2"
				:items="resolutionOptions"
				placeholder="Resolution"
			/>
			<div v-if="selectedFile"><b>Size: </b>{{ bytesToSize(selectedFile.size) }}</div>
		</template>
		<template #import="{ asset }">
			<button
				type="button"
				class="btn mt-auto btn--highlight"
				:disabled="!selectedFile"
				@click="importHDRI(asset)"
			>
				Import
			</button>
		</template>
	</AssetBrowserShell>
</template>

<script lang="ts" setup>
import type { AssetFiles, AssetWithId, HDRIFiles } from './types/polyhaven'
import { bytesToSize } from '@/shared/lib/format'
import { computed, ref, shallowRef } from 'vue'
import {
	DEFAULT_HDRI_RESOLUTION,
	hdriOptions,
	type HDRIOption,
	type HDRIResolution,
	type HDRISelection
} from './hdri'

const isOpen = defineModel<boolean>({ default: false })

const props = defineProps<{
	callback?: ((args: unknown) => unknown) | null
}>()

const options = shallowRef<HDRIOption[]>([])
const selectedResolution = ref<HDRIResolution>()

const resolutionOptions = computed(() =>
	options.value.map((option) => ({ label: option.resolution, value: option.resolution }))
)

const selectedFile = computed(() =>
	options.value.find((option) => option.resolution === selectedResolution.value)
)

/**
 * Cleared, not left showing the last asset's sizes: Import stays disabled until
 * this asset's own files arrive.
 */
function reset() {
	options.value = []
	selectedResolution.value = undefined
}

function setFilesData(files: AssetFiles) {
	options.value = hdriOptions(files as HDRIFiles)
	// Preselected rather than left blank: every HDRI offers the same handful of
	// sizes, and one of them is the right answer nearly every time. Falls back to
	// the smallest on offer for the rare asset published without it.
	const preferred = options.value.find((item) => item.resolution === DEFAULT_HDRI_RESOLUTION)
	selectedResolution.value = (preferred ?? options.value[0])?.resolution
}

function importHDRI(asset: AssetWithId) {
	const file = selectedFile.value
	if (!file) return

	props.callback?.({
		id: asset.id,
		name: asset.name,
		resolution: file.resolution,
		url: file.url,
		size: file.size
	} satisfies HDRISelection)
	isOpen.value = false
}
</script>
