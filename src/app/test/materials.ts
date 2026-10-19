import type THREE from '@/shared/three'

/**
 * Material helpers shared by the shading, UV Grid and Material tab tests. Kept
 * out of a `.test.ts` so that the type guards stay out of test bodies
 * (CODING_STANDARDS.md, "Keep a type-narrowing guard out of the test body").
 */

/** The map the viewport is showing on a mesh, whatever stand-in it wears. */
export function displayedMap(mesh: THREE.Mesh) {
	if (Array.isArray(mesh.material)) throw new Error('expected a single material')
	return (mesh.material as THREE.MeshStandardMaterial).map
}

/** Records the material each time it is released. */
export function onDispose(material: THREE.Material | THREE.Material[]) {
	if (Array.isArray(material)) throw new Error('expected a single material')
	const released: THREE.Material[] = []
	material.addEventListener('dispose', () => released.push(material))
	return released
}
