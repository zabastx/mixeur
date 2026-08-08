import type { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { applyUrlModifier, type LoadRequest } from './request'

/**
 * Internal adapter — use `loadModel` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 */
export async function loadOBJ({ url, onProgress, urlModifier, materials }: LoadOBJRequest) {
	const loader = new OBJLoader()
	if (materials) loader.setMaterials(materials)
	applyUrlModifier(loader, urlModifier)

	return await loader.loadAsync(url, onProgress)
}

export interface LoadOBJRequest extends LoadRequest {
	materials?: MTLLoader.MaterialCreator
}
