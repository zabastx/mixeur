import type THREE from '@/shared/three'

/**
 * Represents the different shading modes available, replicating Blender's viewport shading options.
 */
export type ShadingMode = 'wireframe' | 'solid' | 'preview' | 'rendered'

/**
 * What the shading store keeps for each mesh it shades: the mesh's Material and
 * the stand-ins the viewport shows in its place.
 */
export interface MaterialCache {
	material: THREE.Material | THREE.Material[]
	solid: THREE.MeshLambertMaterial | THREE.MeshLambertMaterial[]
	wireframe: THREE.MeshBasicMaterial | THREE.MeshBasicMaterial[]
	/** The stand-in shown in Preview and Rendered while the mesh wears UV Grid. */
	uvGridStandIn?: { texture: THREE.Texture; material: THREE.Material }
}
