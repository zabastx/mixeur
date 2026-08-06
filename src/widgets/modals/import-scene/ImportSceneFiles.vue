<template>
	<div class="pr-3 pb-2">
		<div class="grid grid-cols-2 gap-0.5 mb-2 text-sm">
			<MxButton icon="file/new" @click="openFilePicker()">Upload files</MxButton>
			<MxButton icon="file/folder" @click="openDirPicker()">Upload a folder</MxButton>
		</div>
		<MxAccordionRoot type="multiple" :default-value="['models', 'assets']" class="space-y-1">
			<MxAccordionItem
				v-model:search="modelSearch"
				label="Models"
				:item="{ value: 'models' }"
				show-search
			>
				<div
					class="flex flex-col gap-1 bg-ui-box-inner border border-ui-box-outline rounded-ui-box
						text-sm grow text-ui-list-text overflow-hidden h-40 resize-y p-1 pb-2"
				>
					<ScrollContainer class="pr-3">
						<div
							v-for="item in filteredSceneFilesList"
							:key="item.id"
							class="px-1 rounded cursor-default truncate"
							data-testid="model-file"
							:class="[
								selectedFile?.id === item.id
									? 'bg-ui-list-inner-selected'
									: 'hover:bg-active-editor-outline'
							]"
							@click="$emit('fileSelect', item)"
						>
							<div class="truncate flex items-center gap-1">
								<MxIcon name="file/model" /> {{ item.file.name }}
							</div>
						</div>
						<div v-if="sceneFiles.length === 0" class="text-ui-text-disabled text-xs p-1">
							.glb, .gltf, .obj, .fbx
						</div>
					</ScrollContainer>
				</div>
			</MxAccordionItem>
			<MxAccordionItem
				v-model:search="assetSearch"
				label="Assets"
				:item="{ value: 'assets' }"
				show-search
			>
				<div
					class="flex flex-col gap-1 bg-ui-box-inner border border-ui-box-outline rounded-ui-box
						text-sm grow text-ui-list-text overflow-hidden h-40 resize-y p-1 pb-2"
				>
					<ScrollContainer class="pr-3 space-y-2">
						<div
							v-for="item in filteredAssetFilesList"
							:key="item.id"
							data-testid="asset-file"
							class="px-1 rounded cursor-default"
							:class="{ 'hover:hover:bg-active-editor-outline': item.isImage }"
							@pointerenter="onImageAssetHover(item)"
						>
							<MxTooltip
								v-if="item.isImage"
								:options="{
									content: {
										sideOffset: 10
									}
								}"
							>
								<template #default>
									<div class="grid grid-cols-[min-content_1fr] items-center gap-1">
										<MxIcon name="file/image" /> <span class="truncate">{{ item.file.name }}</span>
									</div>
								</template>
								<template #content>
									<div class="w-[250px] h-[250px]">
										<img
											class="block w-full h-full object-contain"
											:src="previewImage?.url"
											alt=""
										/>
									</div>
									<div class="text-center">
										{{ previewImage?.width }}x{{ previewImage?.height }}, {{ previewImage?.type }}
									</div>
								</template>
							</MxTooltip>
							<div v-else class="grid grid-cols-[min-content_1fr] items-center gap-1">
								<MxIcon name="file/bin" /> <span class="truncate">{{ item.file.name }}</span>
							</div>
						</div>
						<div v-if="assetFiles.length === 0" class="text-ui-text-disabled text-xs p-1">
							.bin, .png, .jpg, .mtl, etc.
						</div>
					</ScrollContainer>
				</div>
			</MxAccordionItem>
		</MxAccordionRoot>
	</div>
</template>

<script lang="ts" setup>
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { analyzeModelFile } from '@/shared/lib/asset-source'
import { useFileDialog } from '@vueuse/core'
import type { ModelFileItem, FileListItem, AssetFileItem } from './types'

const { selectedFile } = defineProps<{
	selectedFile: ModelFileItem | null
}>()

defineEmits<{
	fileSelect: [file: ModelFileItem]
}>()

const fileList = reactive<FileListItem[]>([])
const sceneFiles = computed<ModelFileItem[]>(() =>
	fileList
		.filter((item) => item.type !== 'asset')
		.toSorted((a, b) => a.file.name.localeCompare(b.file.name))
)
const assetFiles = computed<AssetFileItem[]>(() =>
	fileList
		.filter((item) => item.type === 'asset')
		.toSorted((a, b) => a.file.name.localeCompare(b.file.name))
)

const modelSearch = ref('')
const assetSearch = ref('')

const filteredSceneFilesList = computed(() =>
	sceneFiles.value.filter((item) =>
		item.file.name.toLowerCase().includes(modelSearch.value.toLowerCase())
	)
)

const filteredAssetFilesList = computed(() =>
	assetFiles.value.filter((item) =>
		item.file.name.toLowerCase().includes(assetSearch.value.toLowerCase())
	)
)

defineExpose({
	sceneFiles,
	assetFiles
})

const { files: pickedFiles, open: openFilePicker } = useFileDialog()

const { files: pickedDir, open: openDirPicker } = useFileDialog({
	directory: true
})

watch(pickedDir, (val) => {
	if (!val) return
	const files = Array.from(val)
	addFilesToList(files)
})

watch(pickedFiles, (val) => {
	if (!val) return
	const files = Array.from(val)
	addFilesToList(files)
})

function addFilesToList(list: File[]) {
	list.forEach(async (file) => {
		const result = await analyzeModelFile(file)
		if (!result) return

		const id = crypto.randomUUID()

		fileList.push({
			id,
			type: result.format,
			file,
			assets: result.uris,
			isImage: file.type.startsWith('image/')
		})
	})
}

const previewImage = shallowRef<{
	url: string
	width: number
	height: number
	type: string
}>()

watch(previewImage, (_, oldVal) => {
	if (oldVal) URL.revokeObjectURL(oldVal.url)
})

interface PreviewImage {
	url: string
	type: string
	width: number
	height: number
}

async function loadImage(file: File) {
	return await new Promise<PreviewImage>((resolve, reject) => {
		const url = URL.createObjectURL(file)
		const img = new Image()
		img.onload = () => resolve({ width: img.width, height: img.height, url, type: file.type })
		img.onerror = reject
		img.src = url
	})
}

async function onImageAssetHover(item: AssetFileItem) {
	if (!item.isImage) return
	previewImage.value = await loadImage(item.file)
}
</script>
