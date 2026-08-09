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
 *
 * `generator` defaults to the viewport's, which makes the result usable by the
 * viewport's renderer and no other: what comes back is a render target's
 * texture, and it has no pixels outside the GL context that filtered it. Pass a
 * generator built from another renderer to get a map that one can light with.
 */
export function textureToEnvMap(
	texture: THREE.Texture,
	{ keepSource = false, generator = pmremGenerator } = {}
) {
	texture.mapping = THREE.EquirectangularReflectionMapping
	const target = generator?.fromEquirectangular(texture)
	if (!keepSource) texture.dispose()
	if (!target) return null

	const envMap = target.texture
	envMap.name = texture.name
	envMapTargets.set(envMap, target)
	return envMap
}

/**
 * The render target each filtered map came out of.
 *
 * `PMREMGenerator` hands back a `WebGLRenderTarget` and callers only ever want
 * the texture on it, but disposing that texture leaves the target's framebuffer
 * and depth attachment allocated — invisible to `renderer.info`, and freed only
 * by losing the context. Remembered here so {@link disposeEnvMap} can release
 * the whole thing without every caller having to carry a second reference.
 *
 * Weak, so a map that is simply dropped still becomes collectable.
 */
const envMapTargets = new WeakMap<THREE.Texture, THREE.WebGLRenderTarget>()

/**
 * Releases a map built by {@link textureToEnvMap}, framebuffer included.
 *
 * Use this rather than `envMap.dispose()` anywhere an environment map is
 * replaced — a World swapping Surfaces, a cache being emptied. Falls back to
 * disposing the texture alone for anything that did not come from here.
 */
export function disposeEnvMap(envMap: THREE.Texture) {
	const target = envMapTargets.get(envMap)
	if (!target) {
		envMap.dispose()
		return
	}

	// Disposes the texture with it; the target owns it.
	target.dispose()
	envMapTargets.delete(envMap)
}
