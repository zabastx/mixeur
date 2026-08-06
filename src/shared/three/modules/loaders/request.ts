import THREE from '@/shared/three'

/** Shape every format adapter in this directory is called with. */
export interface LoadRequest {
	url: string
	onProgress: (event: ProgressEvent) => void
	urlModifier?: (url: string) => string
}

/**
 * Routes a loader's sub-requests through `urlModifier`.
 *
 * A `LoadingManager` is the only hook Three.js offers for this, and it has to
 * be installed before the load starts.
 */
export function applyUrlModifier(loader: THREE.Loader, urlModifier?: (url: string) => string) {
	if (!urlModifier) return

	const manager = new THREE.LoadingManager()
	manager.setURLModifier(urlModifier)
	loader.manager = manager
}
