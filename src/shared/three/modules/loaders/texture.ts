import THREE from '@/shared/three'
import type { LoadRequest } from './request'

/**
 * Internal adapter — use `loadTexture` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 * `onProgress` is accepted for symmetry with the other adapters but never
 * fires: `TextureLoader` decodes through an `<img>` element, which reports no
 * byte counts.
 */
export async function loadImageTexture({ url }: Pick<LoadRequest, 'url'>) {
	const loader = new THREE.TextureLoader()
	return await loader.loadAsync(url)
}
