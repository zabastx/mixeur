import THREE from '@/shared/three'
import {
	cloneForSerialization,
	meshesMissingBones,
	sceneForSerialization
} from '@/shared/three/utils'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { useShadingStore } from './shading'
import { useUvGridStore } from './uv-grid'

/** Copy the objects the scene is made of, independently of viewport shading. */
export function duplicateObject(source: THREE.Object3D): THREE.Object3D {
	const { object, cloneOf, missingBones } = copyObjectTree(source)
	if (missingBones.length) {
		throw new Error(
			`${missingBones[0].name || 'This mesh'} is posed by bones outside the selected object. Duplicate the object holding the mesh and its bones instead.`
		)
	}
	prepareCopies(cloneOf, 'duplicate')
	return object
}

export function snapshotObject(source: THREE.Object3D) {
	const { object, cloneOf, missingBones } = copyObjectTree(source)
	prepareCopies(cloneOf, 'snapshot')
	return { object, missingBones }
}

function copyObjectTree(source: THREE.Object3D) {
	const { clone: object, cloneOf } = cloneForSerialization(
		source,
		(node) => !node.userData.mixeur?.isHelper
	)
	return { object, cloneOf, missingBones: meshesMissingBones(object) }
}

/** File snapshots borrow vertex buffers; callers must not edit or dispose them. */
export function snapshotScene(
	source: THREE.Scene,
	{
		renderCamera,
		keep = () => true
	}: {
		renderCamera?: THREE.Object3D | null
		keep?: (object: THREE.Object3D) => boolean
	} = {}
) {
	const { scene, cloneOf, missingBones } = sceneForSerialization(
		source,
		(node) => !node.userData.mixeur?.isHelper && keep(node)
	)
	prepareCopies(cloneOf, 'snapshot')
	let renderCameraUUID: string | null = null
	for (const [original, copy] of cloneOf) {
		if (original.uuid === renderCamera?.uuid) renderCameraUUID = copy.uuid
	}
	return { scene, missingBones, renderCameraUUID }
}

function prepareCopies(
	cloneOf: Map<THREE.Object3D, THREE.Object3D>,
	policy: 'duplicate' | 'snapshot'
) {
	const shading = useShadingStore()
	const geometries = new Map<THREE.BufferGeometry, THREE.BufferGeometry>()
	const textures = new Map<THREE.Texture, THREE.Texture>()
	for (const [original, copy] of cloneOf) {
		copy.visible = original.userData.mixeur?.userVisible ?? original.visible
		if (copy.userData.mixeur) delete copy.userData.mixeur.helperUUID
		if ('geometry' in original && original.geometry instanceof THREE.BufferGeometry) {
			let geometry = geometries.get(original.geometry)
			if (!geometry) {
				geometry =
					policy === 'duplicate' ? original.geometry.clone() : snapshotGeometry(original.geometry)
				geometry.userData = structuredClone(original.geometry.userData)
				geometries.set(original.geometry, geometry)
			}
			;(copy as THREE.Mesh).geometry = geometry
			if (geometry instanceof TextGeometry) {
				geometry.userData = structuredClone(original.userData.mixeur?.text ?? {})
			}
		}
		if (!hasMaterial(original) || !hasMaterial(copy)) continue
		const materials =
			(original instanceof THREE.Mesh ? shading.getMaterialCache(original)?.original : undefined) ??
			original.material
		copy.material = Array.isArray(materials)
			? materials.map((material) => material.clone())
			: materials.clone()
		if (!Array.isArray(copy.material) && 'map' in copy.material) {
			const material = copy.material as THREE.MeshStandardMaterial
			material.map = useUvGridStore().mapWithoutGrid(original.uuid, material.map)
		}
		if (policy === 'snapshot') continue
		for (const material of Array.isArray(copy.material) ? copy.material : [copy.material]) {
			for (const [key, value] of Object.entries(material)) {
				if (!(value instanceof THREE.Texture)) continue
				let texture = textures.get(value)
				if (!texture) {
					texture = value.clone()
					textures.set(value, texture)
				}
				Reflect.set(material, key, texture)
			}
		}
	}
}

function snapshotGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
	// GLTFExporter temporarily replaces normals and indices, even across awaits.
	// Own those slots while borrowing the read-only buffers and geometry parameters.
	const geometry = Object.create(source) as THREE.BufferGeometry
	geometry.attributes = { ...source.attributes }
	return geometry
}

function hasMaterial(
	object: THREE.Object3D
): object is THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite {
	return (
		object instanceof THREE.Mesh ||
		object instanceof THREE.Line ||
		object instanceof THREE.Points ||
		object instanceof THREE.Sprite
	)
}
