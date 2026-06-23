<template>
	<MxDialog
		v-model="isOpen"
		title="Asset Browser"
		class="w-7xl h-[75dvh] text-ui-text-text block-border bg-window-bg flex flex-col"
		resize
		icon="ui/asset-browser"
	>
		<div class="flex grow overflow-hidden gap-2 p-2" data-testid="modal-asset-browser-textures">
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
				<InputText v-model="search" placeholder="Search textures" icon="ui/search" />
				<PolyhavenLicense class="mt-auto" />
			</div>
			<div class="overflow-hidden bg-ui-box-inner rounded grow">
				<ScrollContainer>
					<div class="flex gap-1 flex-wrap p-1">
						<div
							v-for="item in filteredAssets"
							:key="'asset_' + item.id"
							class="w-32 rounded p-1 cursor-pointer hover:bg-gray-500"
							:class="{ 'bg-browser-selected': selectedAsset?.name === item.name }"
							@click="selectAsset<TextureAsset>(item, setFilesData)"
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
					</div>
				</ScrollContainer>
				<button type="button" class="btn mt-auto btn--highlight" @click="importTexture">
					Import
				</button>
			</div>
		</div>
	</MxDialog>
</template>

<script lang="ts" setup>
import type {
	AssetFiles,
	TextureAsset,
	TextureFiles
} from '@/widgets/modals/asset-browser/types/polyhaven'
import { bytesToSize } from '@/shared/lib/format'
import { CheckboxGroupRoot } from 'reka-ui'
import { computed, ref, shallowRef, watch } from 'vue'
import { usePolyHaven } from './polyhaven'

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
	fetchCategories('textures')
	fetchAssets('textures')
})

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
