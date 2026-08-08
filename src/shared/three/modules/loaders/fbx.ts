import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { applyUrlModifier, type LoadRequest } from './request'

/**
 * Internal adapter — use `loadModel` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 */
export async function loadFBX({ url, onProgress, urlModifier }: LoadRequest) {
	const loader = new FBXLoader()
	applyUrlModifier(loader, urlModifier)

	return await loader.loadAsync(url, onProgress)
}
