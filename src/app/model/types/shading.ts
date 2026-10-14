import type THREE from '@/shared/three'

/**
 * Represents the different shading modes available, replicating Blender's viewport shading options.
 */
export type ShadingMode = 'wireframe' | 'solid' | 'preview' | 'rendered'

/**
 * Internal cache for storing original and current materials for each mesh.
 */
export interface MaterialCache {
	original: THREE.Material | THREE.Material[]
	solid: THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[]
	wireframe: THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[]
}
