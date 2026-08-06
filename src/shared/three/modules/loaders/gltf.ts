import type THREE from '@/shared/three'
import { DRACOLoader, GLTFLoader, KTX2Loader } from 'three/examples/jsm/Addons.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { applyUrlModifier, type LoadRequest } from './request'
import { activeRenderer } from './renderer-context'

/**
 * Internal adapter — use `loadModel` from this directory's index instead.
 *
 * Loads a glTF or GLB, with Draco compression, KTX2 textures and Meshopt
 * decoding configured. Rejects on failure; progress, toasts and URL lifetime
 * belong to the caller.
 */
export async function loadGLTF({ url, onProgress, urlModifier }: LoadRequest) {
	const loader = new GLTFLoader()
	loader.setMeshoptDecoder(MeshoptDecoder)
	loader.setDRACOLoader(dracoLoader())
	loader.setKTX2Loader(ktx2Loader())

	applyUrlModifier(loader, urlModifier)

	return await loader.loadAsync(url, onProgress)
}

// Both decoders own worker pools and WASM modules. Building them per load — as
// this file used to — leaked one pool per imported model, so they are created
// once and shared.

let draco: DRACOLoader | null = null

function dracoLoader() {
	if (!draco) {
		draco = new DRACOLoader()
		draco.setDecoderPath('/draco/')
	}
	return draco
}

let ktx2: KTX2Loader | null = null
let detectedAgainst: THREE.WebGLRenderer | null = null

function ktx2Loader() {
	if (!ktx2) ktx2 = new KTX2Loader()

	// `detectSupport` needs a renderer, which does not exist until the viewport
	// mounts, so it cannot happen at construction time.
	const renderer = activeRenderer()
	if (renderer && renderer !== detectedAgainst) {
		ktx2.detectSupport(renderer)
		detectedAgainst = renderer
	}

	return ktx2
}
