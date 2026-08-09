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

/**
 * Whether `node` is somewhere in the subtree rooted at `root` — `root` itself
 * counts.
 *
 * Walks `parent` links upward rather than traversing down, so the cost is the
 * node's depth and not the size of the subtree. Callers removing a subtree use
 * this to decide whether a reference they hold goes with it.
 */
export function isWithin(node: THREE.Object3D | null, root: THREE.Object3D) {
	let current = node
	while (current) {
		if (current.uuid === root.uuid) return true
		current = current.parent
	}
	return false
}

export function getUserData(obj: THREE.Object3D): MxObjectUserData {
	if (!obj.userData.mixeur) obj.userData.mixeur = {}
	return obj.userData.mixeur
}

/**
 * PMREM-filters an equirectangular image into a map suitable for
 * `scene.environment`.
 *
 * Consumes `texture` unless `keepSource` is set. Keep it when the same image is
 * also going to be *seen* — the filtered map is built for lighting, its mip
 * chain is a roughness ladder, and anything that reads it as a picture gets a
 * blurred one.
 */
export function textureToEnvMap(texture: THREE.Texture, { keepSource = false } = {}) {
	texture.mapping = THREE.EquirectangularReflectionMapping
	const envMap = pmremGenerator?.fromEquirectangular(texture).texture
	if (!keepSource) texture.dispose()
	if (!envMap) return null
	envMap.name = texture.name
	return envMap
}
