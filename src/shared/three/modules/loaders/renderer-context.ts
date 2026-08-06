import type THREE from '@/shared/three'

let current: THREE.WebGLRenderer | null = null

/**
 * Hands the active renderer to the loaders that need one.
 *
 * `KTX2Loader` cannot decide which compressed texture formats it may transcode
 * to without querying the GPU, and it refuses to load until it has. Kept in its
 * own file so that reading the renderer does not drag the Three.js addon
 * bundle into whichever chunk sets it.
 */
export function attachRenderer(renderer: THREE.WebGLRenderer) {
	current = renderer
}

export function activeRenderer() {
	return current
}
