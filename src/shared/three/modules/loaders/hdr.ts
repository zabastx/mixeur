import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { LoadRequest } from './request'

/**
 * Internal adapter — use `loadTexture` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 *
 * `HDRLoader`, not `RGBELoader`: the latter is a deprecated shim over this same
 * class since r180 and warns on every construction.
 */
export async function loadHDR({ url, onProgress }: LoadRequest) {
	const loader = new HDRLoader()
	return await loader.loadAsync(url, onProgress)
}
