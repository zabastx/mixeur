import { createFetch } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'
import type {
	Asset,
	AssetAuthorInfo,
	AssetCategory,
	AssetFiles,
	AssetsResponse,
	AssetType,
	AssetWithId,
	CategoryResponse,
	FileInfo,
	FileWithIncludes,
	HDRIAsset,
	ModelAsset,
	ModelFiles,
	TextureAsset
} from './types/polyhaven'
import { useToast } from '@/shared/lib/toast'

const toast = useToast()

const usePolyHavenFetch = createFetch({
	baseUrl: 'https://api.polyhaven.com',
	options: {
		async beforeFetch({ options }) {
			options.headers = {
				...options.headers,
				Accept: 'application/json'
			}
			return { options }
		}
	},
	fetchOptions: {
		mode: 'cors'
	}
})

/**
 * Where one model's download lives, and where the textures it names live.
 *
 * Outside the composable because it reads nothing but its arguments: the models
 * browser gets its listing from the shell and needs this and nothing else.
 */
export function getModelData({
	files,
	format,
	resolution
}: {
	files: ModelFiles[keyof ModelFiles]
	format: 'gltf' | 'blend' | 'fbx' | 'usd'
	resolution: string
}) {
	if (!files || typeof files !== 'object') return null

	// Access the resolution
	const resolutionFiles = files[resolution]
	if (!resolutionFiles || typeof resolutionFiles !== 'object') return null

	// Get the file info
	const fileInfo = resolutionFiles[format] as FileWithIncludes
	if (!fileInfo || typeof fileInfo !== 'object') return null

	// Build texture URL map from the include property
	const textureUrlMap: Record<string, string> = {}
	if (fileInfo.include) {
		for (const [texturePath, textureInfo] of Object.entries<FileInfo>(fileInfo.include)) {
			// Extract just the filename from the path (e.g., "textures/Camera_01_body_diff_1k.jpg" -> "Camera_01_body_diff_1k.jpg")
			const filename = texturePath.split('/').pop()
			if (filename && textureInfo.url) {
				textureUrlMap[filename] = textureInfo.url
				// Also map the full path
				textureUrlMap[texturePath] = textureInfo.url
			}
		}
	}

	return {
		url: fileInfo.url,
		textureUrlMap
	}
}

export function usePolyHaven() {
	const assets = ref<AssetWithId[]>([])
	const categories = shallowRef<AssetCategory[]>([])

	const search = ref('')
	const categoriesFilter = ref<string[]>([])

	const isLoadingAssets = ref(false)
	const isLoadingInfo = ref(false)
	const isLoadingFiles = ref(false)
	const isLoadingCategories = ref(false)

	const selectedAsset = shallowRef<AssetWithId>()
	const selectedAssetAuthors = ref<(AssetAuthorInfo & { responsibility: string })[]>([])

	const assetsTags = computed(() => {
		const tagsSet = new Set(assets.value.flatMap((asset) => asset.tags))
		return Array.from(tagsSet)
			.map((item) => item.trim())
			.sort()
	})

	const filteredAssets = computed(() => {
		return assets.value.filter((asset) => {
			const name = asset.name.toLowerCase().includes(search.value.toLowerCase())
			const tag = asset.tags.join(' ').toLowerCase().includes(search.value.toLowerCase())
			const cat =
				categoriesFilter.value.length > 0
					? categoriesFilter.value.some((item) => asset.categories.includes(item))
					: true
			return (name || tag) && cat
		})
	})

	async function fetchAssets(type: AssetType | 'all') {
		isLoadingAssets.value = true

		const params = new URLSearchParams({ type })

		const { data, error } = await usePolyHavenFetch(
			`/assets?${params.toString()}`
		).json<AssetsResponse>()

		if (data.value) {
			assets.value = Object.entries<Asset>(data.value).map(([id, asset]) => ({
				...asset,
				id
			}))
		}

		if (error.value) {
			toast.add({
				type: 'error',
				title: 'API Error',
				message: 'Failed to load assets'
			})
		}

		isLoadingAssets.value = false
	}

	async function fetchAssetInfo<T extends Asset = Asset>(id: string): Promise<T | null> {
		isLoadingInfo.value = true

		const { data, error } = await usePolyHavenFetch(`/info/${id}`).get().json<T>()

		if (error.value) {
			toast.add({
				type: 'error',
				title: 'API Error',
				message: 'Failed to load asset details'
			})
		}

		isLoadingInfo.value = false
		return data.value
	}

	async function fetchAssetAuthor(authorId: string) {
		const { data, error } = await usePolyHavenFetch(`/author/${authorId}`)
			.get()
			.json<AssetAuthorInfo>()

		if (error.value) {
			toast.add({
				type: 'error',
				title: 'API Error',
				message: 'Failed to load author info'
			})
		}

		return data.value
	}

	async function fetchCategories(type: AssetType) {
		isLoadingCategories.value = true

		const { data, error } = await usePolyHavenFetch(`/categories/${type}`)
			.get()
			.json<CategoryResponse>()

		if (data.value) {
			categories.value = Object.entries<number>(data.value)
				.map(([key, value]) => ({
					title: key,
					count: value
				}))
				.filter((item) => item.title !== 'all')
				.sort((a, b) => a.title.localeCompare(b.title))
		}

		if (error.value) {
			toast.add({
				type: 'error',
				title: 'API Error',
				message: 'Failed to fetch categories'
			})
		}
		isLoadingCategories.value = false
	}

	async function fetchAssetFiles(id: string) {
		isLoadingFiles.value = true

		const { data, error } = await usePolyHavenFetch(`/files/${id}`).get().json<AssetFiles>()

		if (error.value) {
			toast.add({
				type: 'error',
				title: 'API Error',
				message: 'Failed to load asset files'
			})
		}

		isLoadingFiles.value = false

		return data.value
	}

	function selectAsset<T extends Asset>(asset: AssetWithId, cb: (files: AssetFiles) => void) {
		const authors = Object.keys(asset.authors).map((id) => ({
			id,
			responsibility: asset.authors[id]
		}))

		selectedAssetAuthors.value = []

		authors.forEach((item) => {
			fetchAssetAuthor(item.id)
				.then((author) => {
					if (author) {
						selectedAssetAuthors.value.push({
							...author,
							responsibility: item.responsibility || ''
						})
					}
				})
				.catch(() => {})
		})

		fetchAssetInfo<T>(asset.id)
			.then((item) => {
				if (!item) return
				selectedAsset.value = { ...item, id: asset.id }
			})
			.catch(() => {})

		fetchAssetFiles(asset.id)
			.then((item) => {
				if (!item) return
				cb(item)
			})
			.catch(() => {})
	}

	/**
	 * Get asset type name from type number
	 */
	const getAssetTypeName = (typeNum: 0 | 1 | 2): AssetType => {
		const typeMap: Record<0 | 1 | 2, AssetType> = {
			0: 'hdris',
			1: 'textures',
			2: 'models'
		}
		return typeMap[typeNum]
	}

	const isHDRI = (asset: Asset): asset is HDRIAsset => {
		return asset.type === 0
	}

	const isTexture = (asset: Asset): asset is TextureAsset => {
		return asset.type === 1
	}

	const isModel = (asset: Asset): asset is ModelAsset => {
		return asset.type === 2
	}

	return {
		assets,
		search,
		categories,
		assetsTags,
		fetchAssets,
		fetchCategories,
		fetchAssetInfo,
		fetchAssetAuthor,
		fetchAssetFiles,
		filteredAssets,
		categoriesFilter,
		isLoadingAssets,
		isLoadingCategories,
		isLoadingFiles,
		isLoadingInfo,
		isHDRI,
		isTexture,
		isModel,
		getAssetTypeName,
		selectedAsset,
		selectedAssetAuthors,
		selectAsset
	}
}
