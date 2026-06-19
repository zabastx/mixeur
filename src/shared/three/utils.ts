import THREE from '.'
import { pmremGenerator } from './modules/extras/pmremGenerator'
import type { MxObjectUserData } from './three'

/**
 * Recursively enables BVH for all meshes in the object
 */
export function enableBVH(object: THREE.Object3D) {
	object.traverse((child) => {
		if (hasGeometry(child)) {
			child.geometry.computeBoundsTree()
		}

		if (child instanceof THREE.BatchedMesh) {
			child.computeBoundsTree()
		}
	})
}

/**
 * Recursively disposes BVH for all meshes in the object
 */
export function disposeBVH(object: THREE.Object3D) {
	object.traverse((child) => {
		if (hasGeometry(child)) {
			child.geometry.disposeBoundsTree()
		}

		if (child instanceof THREE.BatchedMesh) {
			child.disposeBoundsTree()
		}
	})
}

function hasGeometry(obj: THREE.Object3D) {
	return (
		obj instanceof THREE.Mesh ||
		obj instanceof THREE.Line ||
		obj instanceof THREE.Points ||
		obj instanceof THREE.Sprite
	)
}

export function getUserData(obj: THREE.Object3D): MxObjectUserData {
	if (!obj.userData.mixeur) obj.userData.mixeur = {}
	return obj.userData.mixeur
}

export function textureToEnvMap(texture: THREE.Texture) {
	texture.mapping = THREE.EquirectangularReflectionMapping
	const envMap = pmremGenerator?.fromEquirectangular(texture).texture
	texture.dispose()
	if (!envMap) return null
	envMap.name = texture.name
	return envMap
}
