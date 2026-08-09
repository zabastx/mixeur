<!--
	The frame the Poly Haven browsers share: categories, search, the licence
	notice, the grid of thumbnails, and the detail column beside it.

	One library seen through three filters, so one layout — someone who has picked
	a texture should not have to learn the models browser from scratch. What the
	three do not share is the *choosing*: a model needs a resolution, a texture a
	map type, a resolution and a format, an HDRI a resolution alone. Those
	controls, and the Import that acts on them, are the caller's to supply through
	the `controls` and `import` slots.

	Two events drive the caller's controls:

	- `select` — a row was clicked. Whatever the previous asset's controls were
	  showing is now wrong; drop it.
	- `files`  — that row's files arrived, and it is still the row in play.

	Which asset those files belong to is the `import` slot's `asset` prop. It is
	not emitted alongside the files, because then every caller that imports by
	name would have to keep its own copy of a thing the shell already knows.
-->
<template>
	<MxDialog
		v-model="isOpen"
		title="Asset Browser"
		class="w-7xl h-[75dvh] text-ui-text-text block-border bg-window-bg flex flex-col"
		resize
		icon="ui/asset-browser"
	>
		<div class="flex grow overflow-hidden gap-2 p-2" :data-testid="`modal-asset-browser-${type}`">
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
				<InputText v-model="search" :placeholder="SEARCH_PLACEHOLDER[type]" icon="ui/search" />
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

			<div
				v-if="selectedAsset && chosen"
				class="bg-header-background flex flex-col basis-[25%] shrink-0"
			>
				<ScrollContainer>
					<div class="flex flex-col gap-1 p-2 text-sm">
						<LibraryAssetDescription :asset="selectedAsset" :authors="selectedAssetAuthors" />
						<slot name="controls" />
					</div>
				</ScrollContainer>
				<slot name="import" :asset="chosen" />
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import type { AssetFiles, AssetType, AssetWithId } from './types/polyhaven'
import { CheckboxGroupRoot } from 'reka-ui'
import { shallowRef, watch } from 'vue'
import { usePolyHaven } from './polyhaven'

const props = defineProps<{
	/** Which slice of the library to list, and which testid the shell answers to. */
	type: AssetType
}>()

const isOpen = defineModel<boolean>({ default: false })

const emit = defineEmits<{
	select: []
	files: [files: AssetFiles]
}>()

defineSlots<{
	/** The per-type choosing controls, under the asset's description. */
	controls?: () => unknown
	/** The Import button, pinned to the bottom of the detail column. */
	import?: (props: { asset: AssetWithId }) => unknown
}>()

/** "HDRIs", not "hdris" — the placeholder is prose, so it is written out. */
const SEARCH_PLACEHOLDER: Record<AssetType, string> = {
	hdris: 'Search HDRIs',
	textures: 'Search textures',
	models: 'Search models'
}

const {
	assets,
	search,
	categories,
	fetchAssets,
	fetchCategories,
	filteredAssets,
	categoriesFilter,
	selectedAsset,
	selectedAssetAuthors,
	selectAsset
} = usePolyHaven()

watch(isOpen, (val) => {
	if (!val || assets.value.length > 0) return
	fetchCategories(props.type)
	fetchAssets(props.type)
})

/**
 * The row that was clicked, held here rather than read back from
 * `selectedAsset`.
 *
 * `selectAsset` fires the info and files requests independently, so two quick
 * clicks can leave the composable's asset and the arriving files describing
 * different assets — and an import taken from both would write one asset's name
 * beside another's URL. The clicked row is the answer to "which one did the user
 * pick"; nothing asynchronous can change it, so it is what the highlight follows
 * and what the `import` slot is handed.
 */
const chosen = shallowRef<AssetWithId>()

function choose(asset: AssetWithId) {
	chosen.value = asset
	emit('select')
	selectAsset(asset, (files) => {
		// A slower request for an earlier row, arriving after the user moved on.
		if (asset.id !== chosen.value?.id) return
		emit('files', files)
	})
}
</script>
