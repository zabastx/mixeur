/**
 * Loading an asset — a model, a texture or a typeface — from a file the user
 * picked or from a URL.
 *
 * Everything a load needs is decided in here: which format the bytes are, which
 * Three.js loader handles it, how long a `File`'s temporary URL lives, what the
 * progress indicator shows, and what happens when it fails. Callers pick a
 * source and read a result.
 *
 * Failure is uniform: nothing here throws and nothing returns a bare `null`.
 * Every entry resolves to a `LoadResult`, and reports the failure to the user
 * exactly once on its way out.
 */

import { useProgressStore } from '@/app/model/progress'
import { useToast } from '@/shared/lib/toast'
import {
	analyzeModelFile,
	createUrlModifier,
	detectMTL,
	failed,
	isEXRFile,
	isEXRUrl,
	loaded,
	modelFormatFromUrl,
	sourceName,
	TempUrls,
	uriFilename,
	type AssetResolver,
	type AssetSource,
	type LoadResult,
	type ModelFormat
} from '@/shared/lib/asset-source'
import { textureToEnvMap } from '@/shared/three/utils'
import type THREE from '@/shared/three'
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js'
import type { MaterialCreatorOptions, MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { defaultFontUrls, type StdFontName } from './font-presets'

export interface LoadModelOptions {
	/** Resolves the textures, buffers and material libraries the model references. */
	resolve?: AssetResolver
	/** Applied to materials loaded from an accompanying `.mtl`. */
	materialOptions?: MaterialCreatorOptions
	/** Overrides format detection. */
	format?: ModelFormat
}

/**
 * Loads a glTF, GLB, OBJ or FBX model as a single object, ready to add to a
 * scene. An OBJ's material library is found through `resolve` and applied
 * without the caller arranging it.
 */
export async function loadModel(
	source: AssetSource,
	options: LoadModelOptions = {}
): Promise<LoadResult<THREE.Object3D>> {
	const filename = sourceName(source)

	return attempt('Error loading model', filename, async () => {
		const temp = new TempUrls()
		try {
			const object = await loadModelFrom(source, options, temp)
			object.name = filename
			return object
		} finally {
			temp.revokeAll()
		}
	})
}

export interface LoadTextureOptions {
	/**
	 * Return the PMREM-filtered environment map built from the image rather than
	 * the image itself. The source texture is consumed and disposed on the way;
	 * either way the caller owns exactly the texture it gets back.
	 */
	isEnvMap?: boolean
}

/** Loads an EXR or a regular image as a texture, whichever the source turns out to be. */
export async function loadTexture(
	source: AssetSource,
	options: LoadTextureOptions = {}
): Promise<LoadResult<THREE.Texture>> {
	const filename = sourceName(source)

	return attempt('Error loading texture', filename, async () => {
		const temp = new TempUrls()
		try {
			const texture = await loadTextureFrom(source, filename, temp)
			texture.name = filename
			if (!options.isEnvMap) return texture

			const envMap = textureToEnvMap(texture)
			if (!envMap) throw new Error('Environment maps are unavailable until the viewport starts')
			return envMap
		} finally {
			temp.revokeAll()
		}
	})
}

/** Loads a typeface, either one of the bundled defaults or a URL to a typeface JSON. */
export async function loadFont(font: StdFontName | (string & {})): Promise<LoadResult<Font>> {
	return attempt('Error loading font', font, async () => {
		const url = defaultFontUrls.get(font) || font
		const { loadTypeface } = await import('./font')

		return await reportProgress(font, undefined, (onProgress) => loadTypeface({ url, onProgress }))
	})
}

export type { AssetResolver, AssetSource, LoadResult } from '@/shared/lib/asset-source'
export { defaultFontsList, type FontsListOption, type StdFontName } from './font-presets'

// ── Models ────────────────────────────────────────────────────────────────────

interface ModelPlan {
	format: ModelFormat
	url: string
	filename: string
	size?: number
	/** URIs the model references, when its bytes were available to scan. */
	uris: string[]
}

/**
 * A file's format comes from its bytes; a URL's can only come from its
 * extension, since there are no bytes to look at until the transfer starts.
 */
async function planModelLoad(
	source: AssetSource,
	format: ModelFormat | undefined,
	temp: TempUrls
): Promise<ModelPlan> {
	const filename = sourceName(source)
	const size = source.size

	if (source instanceof File) {
		// Scanned even when the format is given: the same pass lists the URIs the
		// model references, which is how an OBJ finds its material library.
		const analysis = await analyzeModelFile(source)
		const detected = format ?? (analysis?.format === 'asset' ? undefined : analysis?.format)
		if (!detected) throw new Error(`"${filename}" is not a glTF, GLB, OBJ or FBX model`)

		return {
			format: detected,
			url: temp.create(source),
			filename,
			size,
			uris: analysis?.uris ?? []
		}
	}

	const detected = format ?? modelFormatFromUrl(source.url)
	if (!detected) throw new Error(`"${filename}" is not a glTF, GLB, OBJ or FBX model`)

	return { format: detected, url: source.url, filename, size, uris: [] }
}

async function loadModelFrom(
	source: AssetSource,
	options: LoadModelOptions,
	temp: TempUrls
): Promise<THREE.Object3D> {
	const plan = await planModelLoad(source, options.format, temp)
	const { resolve } = options

	const urlModifier = resolve ? createUrlModifier({ baseUrl: plan.url, resolve, temp }) : undefined

	switch (plan.format) {
		case 'glb':
		case 'gltf': {
			const { loadGLTF } = await import('./gltf')
			const gltf = await reportProgress(plan.filename, plan.size, (onProgress) =>
				loadGLTF({ url: plan.url, onProgress, urlModifier })
			)
			return gltf.scene
		}
		case 'fbx': {
			const { loadFBX } = await import('./fbx')
			return await reportProgress(plan.filename, plan.size, (onProgress) =>
				loadFBX({ url: plan.url, onProgress, urlModifier })
			)
		}
		case 'obj': {
			const materials = await loadObjMaterials(plan, options, temp)
			const { loadOBJ } = await import('./obj')
			return await reportProgress(plan.filename, plan.size, (onProgress) =>
				loadOBJ({ url: plan.url, onProgress, urlModifier, materials })
			)
		}
	}
}

/**
 * Follows an OBJ's `mtllib` reference to its material library.
 *
 * A missing or unreadable library is reported but does not sink the model — an
 * untextured OBJ is more useful than none. The library gets its own progress
 * entry because it transfers alongside the OBJ, not before it.
 */
async function loadObjMaterials(
	plan: ModelPlan,
	options: LoadModelOptions,
	temp: TempUrls
): Promise<MTLLoader.MaterialCreator | undefined> {
	const { resolve } = options
	if (!resolve) return undefined

	for (const uri of plan.uris) {
		const candidate = resolve(uri)
		if (!candidate) continue

		let url: string
		if (typeof candidate === 'string') {
			url = candidate
		} else {
			// Any file can be mapped to an `mtllib` slot by hand, so check that
			// this one really is a material library before handing it to MTLLoader.
			if (!detectMTL({ text: await candidate.text() })) continue
			url = temp.create(candidate)
		}

		const result = await attempt('Error loading materials', uriFilename(uri), async () => {
			const { loadMTL } = await import('./mtl')
			return await reportProgress(uriFilename(uri), undefined, (onProgress) =>
				loadMTL({
					url,
					onProgress,
					materialOptions: options.materialOptions,
					urlModifier: createUrlModifier({ baseUrl: url, resolve, temp })
				})
			)
		})

		return result.ok ? result.value : undefined
	}

	return undefined
}

// ── Textures ──────────────────────────────────────────────────────────────────

async function loadTextureFrom(
	source: AssetSource,
	filename: string,
	temp: TempUrls
): Promise<THREE.Texture> {
	const isEXR = source instanceof File ? await isEXRFile(source) : isEXRUrl(source.url)
	const url = source instanceof File ? temp.create(source) : source.url

	if (isEXR) {
		const { loadEXR } = await import('./exr')
		return await reportProgress(filename, source.size, (onProgress) => loadEXR({ url, onProgress }))
	}

	const { loadImageTexture } = await import('./texture')
	// No size: an `<img>` decode reports no byte counts, and a determinate bar
	// frozen at 0% reads as a stall. The indeterminate one tells the truth.
	return await reportProgress(filename, undefined, () => loadImageTexture({ url }))
}

// ── Progress, toasts and the failure contract ─────────────────────────────────

/**
 * Turns a throwing load into a `LoadResult`, telling the user once on the way
 * out. This is the only place asset loading raises a toast.
 */
async function attempt<T>(
	title: string,
	filename: string,
	load: () => Promise<T>
): Promise<LoadResult<T>> {
	try {
		return loaded(await load())
	} catch (cause) {
		const result = failed(cause)
		useToast().add({ type: 'error', title, message: `${filename}: ${result.error.message}` })
		if (import.meta.env.DEV) console.error(`${title} (${filename})`, result.error)
		return result
	}
}

/**
 * Shows one progress entry for the duration of one transfer.
 *
 * The entry appears immediately so that a slow load is never silent. Pass
 * `total` only when the bytes are known up front; otherwise the entry stays
 * indeterminate until `onProgress` reports a length, which is what the loaders
 * that fetch over XHR do on their first event.
 */
async function reportProgress<T>(
	filename: string,
	total: number | undefined,
	load: (onProgress: (event: ProgressEvent) => void) => Promise<T>
): Promise<T> {
	const item = useProgressStore().initProgress(filename)
	item.start(total)

	try {
		return await load(item.onProgress)
	} finally {
		item.stop()
	}
}
