<!--
	Browses Poly Haven's HDRIs and hands one back as a World Surface.

	Deliberately the textures browser's twin — same three columns, same search,
	same licence notice — because it is the same library seen through a different
	filter, and a second layout would only make users learn one library twice.

	What it does not share is the choosing: a texture needs a map type, a
	resolution and a format, an HDRI needs a resolution alone. The rules behind
	that single control live in `hdri.ts`.
-->
<template>
	<MxDialog
		v-model="isOpen"
		title="Asset Browser"
		class="w-7xl h-[75dvh] text-ui-text-text block-border bg-window-bg flex flex-col"
		resize
		icon="ui/asset-browser"
	>
		<div class="flex grow overflow-hidden gap-2 p-2" data-testid="modal-asset-browser-hdris">
			<div class="bg-header-background flex flex-col gap-2 basis-[20%] shrink-0">
				<div
					class="h-[300px] bg-ui-box-inner border border-ui-box-outline rounded-ui-box p-2 pr-0
						text-sm flex flex-col gap-1"
				>
					<h2>Categories</h2>
					<ScrollContainer>
						<CheckboxGroupRoot v-model="categoriesFilter">
							<div
								v-for="item in categories"
								:key="'category_' + item.title"
								class="flex flex-col gap-1"
							>
								<InputField :label="item.title" reverse class="items-center">
									<InputCheckbox :value="item.title" />
								</InputField>
							</div>
						</CheckboxGroupRoot>
					</ScrollContainer>
				</div>
				<InputText v-model="search" placeholder="Search HDRIs" icon="ui/search" />
				<PolyhavenLicense class="mt-auto" />
			</div>
			<div class="overflow-hidden bg-ui-box-inner rounded grow">
				<ScrollContainer>
					<div class="flex gap-1 flex-wrap p-1">
						<div
							v-for="item in filteredAssets"
							:key="'asset_' + item.id"
							class="w-32 rounded p-1 cursor-pointer hover:bg-gray-500"
							:class="{ 'bg-browser-selected': chosen?.id === item.id }"
							@click="choose(item)"
						>
							<div class="w-full h-28 p-1">
								<img
									:src="item.thumbnail_url"
									:alt="item.name"
									class="object-contain object-center size-full"
									loading="lazy"
								/>
							</div>
							<div
								class="text-xs text-center h-10 flex items-center justify-center overflow-hidden
									text-ellipsis"
							>
								{{ item.name }}
							</div>
						</div>
					</div>
				</ScrollContainer>
			</div>

			<div v-if="selectedAsset" class="bg-header-background flex flex-col basis-[25%] shrink-0">
				<ScrollContainer>
					<div class="flex flex-col gap-1 p-2 text-sm">
						<LibraryAssetDescription :asset="selectedAsset" :authors="selectedAssetAuthors" />
						<InputSelect
							v-model="selectedResolution"
							class="z-10 mt-2"
							:items="resolutionOptions"
							placeholder="Resolution"
						/>
						<div v-if="selectedFile"><b>Size: </b>{{ bytesToSize(selectedFile.size) }}</div>
					</div>
				</ScrollContainer>
				<button
					type="button"
					class="btn mt-auto btn--highlight"
					:disabled="!selectedFile"
					@click="importHDRI"
				>
					Import
				</button>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import type { AssetFiles, AssetWithId, HDRIAsset, HDRIFiles } from './types/polyhaven'
import { bytesToSize } from '@/shared/lib/format'
import { CheckboxGroupRoot } from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import { usePolyHaven } from './polyhaven'
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

const {
	assets,
	search,
	categories,
	fetchAssets,
	fetchCategories,
	filteredAssets,
	categoriesFilter,
	selectedAsset,
	selectAsset,
	selectedAssetAuthors
} = usePolyHaven()

watch(isOpen, (val) => {
	if (!val || assets.value.length > 0) return
	fetchCategories('hdris')
	fetchAssets('hdris')
})

/**
 * The row that was clicked, held here rather than read back from
 * `selectedAsset`.
 *
 * `selectAsset` fires the info and files requests independently, so two quick
 * clicks can leave the composable's asset and this component's files describing
 * different HDRIs — and an import taken from both would write one HDRI's name
 * beside another's URL into the project file. The clicked row is the answer to
 * "which one did the user pick"; nothing asynchronous can change it.
 */
const chosen = shallowRef<AssetWithId>()
const options = shallowRef<HDRIOption[]>([])
const selectedResolution = ref<HDRIResolution>()

const resolutionOptions = computed(() =>
	options.value.map((option) => ({ label: option.resolution, value: option.resolution }))
)

const selectedFile = computed(() =>
	options.value.find((option) => option.resolution === selectedResolution.value)
)

function choose(asset: AssetWithId) {
	chosen.value = asset
	// Cleared, not left showing the last asset's sizes: Import stays disabled
	// until this asset's own files arrive.
	options.value = []
	selectedResolution.value = undefined
	selectAsset<HDRIAsset>(asset, (files) => setFilesData(asset.id, files))
}

function setFilesData(id: string, files: AssetFiles) {
	// A slower request for an earlier row, arriving after the user moved on.
	if (id !== chosen.value?.id) return

	options.value = hdriOptions(files as HDRIFiles)
	// Preselected rather than left blank: every HDRI offers the same handful of
	// sizes, and one of them is the right answer nearly every time. Falls back to
	// the smallest on offer for the rare asset published without it.
	const preferred = options.value.find((item) => item.resolution === DEFAULT_HDRI_RESOLUTION)
	selectedResolution.value = (preferred ?? options.value[0])?.resolution
}

function importHDRI() {
	const file = selectedFile.value
	const asset = chosen.value
	if (!file || !asset) return

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
