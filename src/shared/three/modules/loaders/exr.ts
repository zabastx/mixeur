import { EXRLoader } from 'three/examples/jsm/Addons.js'
import type { LoadRequest } from './request'

/**
 * Internal adapter — use `loadTexture` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 */
export async function loadEXR({ url, onProgress }: LoadRequest) {
	const loader = new EXRLoader()
	return await loader.loadAsync(url, onProgress)
}
