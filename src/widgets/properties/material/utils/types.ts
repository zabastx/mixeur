import type { ObjectProp } from '@/shared/lib/field-descriptor'
import type THREE from '@/shared/three'

export type MaterialProp<T extends THREE.Material> = ObjectProp<T>

export type MeshMaterials =
	| THREE.MeshPhysicalMaterial
	| THREE.MeshToonMaterial
	| THREE.MeshStandardMaterial
	| THREE.MeshPhongMaterial
	| THREE.MeshNormalMaterial
	| THREE.MeshDepthMaterial
	| THREE.MeshLambertMaterial
	| THREE.MeshMatcapMaterial
	| THREE.MeshBasicMaterial
