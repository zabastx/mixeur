import THREE from '@/shared/three'

export let pmremGenerator: THREE.PMREMGenerator | null = null

export function initPMREMGenerator(renderer: THREE.WebGLRenderer) {
	pmremGenerator = new THREE.PMREMGenerator(renderer)
	pmremGenerator.compileEquirectangularShader()
}

/**
 * Released with the renderer it was built from — a generator outliving its
 * renderer holds GPU resources belonging to a context that is already gone.
 */
export function disposePMREMGenerator() {
	pmremGenerator?.dispose()
	pmremGenerator = null
}
