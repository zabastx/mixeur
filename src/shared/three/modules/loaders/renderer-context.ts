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

/**
 * Paired with `attachRenderer`, so a disposed renderer is not handed to a
 * loader that would then query a dead GL context.
 */
export function detachRenderer() {
	current = null
}

export function activeRenderer() {
	return current
}
