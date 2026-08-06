import { FontLoader } from 'three/examples/jsm/Addons.js'
import type { LoadRequest } from './internal'

/**
 * Internal adapter — use `loadFont` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 */
export async function loadTypeface({ url, onProgress }: Pick<LoadRequest, 'url' | 'onProgress'>) {
	const loader = new FontLoader()
	return await loader.loadAsync(url, onProgress)
}
