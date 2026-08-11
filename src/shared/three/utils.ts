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
 * Filtered with the viewport's generator, so the map is the viewport renderer's
 * to light with. That is every renderer there is: renders draw with the same
 * renderer, so there is no second context a map would have to cross (ADR-0002).
 */
export function textureToEnvMap(texture: THREE.Texture, { keepSource = false } = {}) {
	texture.mapping = THREE.EquirectangularReflectionMapping
	const target = pmremGenerator?.fromEquirectangular(texture)
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

/** sRGB transfer function, and its inverse. */
function srgbToLinear(value: number) {
	return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

function linearToSrgb(value: number) {
	return value <= 0.0031308 ? value * 12.92 : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
}

/**
 * Decodes a half-float RGBA read of a render target into `ImageData`.
 *
 * Three things have to happen on the way, and the order of the last two is the
 * whole difficulty:
 *
 * 1. **Flip.** GL numbers rows from the bottom, `ImageData` from the top.
 * 2. **Un-premultiply.** `SSAARenderPass` accumulates premultiplied samples, so a
 *    partly covered edge holds `colour × alpha` while `ImageData` wants straight
 *    (unassociated) alpha.
 * 3. **Decode to 8 bits.** `OutputPass` has already tone mapped and sRGB-encoded,
 *    so the values are display-ready `[0,1]`.
 *
 * The division belongs in *linear* light, not where the buffer leaves it.
 * `sRGBTransferOETF` encodes RGB and passes alpha through untouched, so the
 * buffer holds `srgb(colour × alpha)` beside a straight alpha — dividing the
 * encoded value overshoots badly (colour 0.5 at alpha 0.5 gives
 * `srgb(0.25) / 0.5 ≈ 1.07`, clipped to white) and rims every transparent
 * render in bright fringes. Hence decode, divide, re-encode.
 *
 * Fully opaque pixels skip all of it, which is almost every pixel of a typical
 * render and keeps the two `pow` calls to the edges that need them.
 */
export function imageDataFromHalfFloat(
	buffer: Uint16Array,
	width: number,
	height: number
): ImageData {
	const image = new ImageData(width, height)
	const out = image.data
	const rowBytes = width * 4
	const toByte = (value: number) => Math.max(0, Math.min(255, Math.round(value * 255)))

	for (let y = 0; y < height; y++) {
		const srcRow = (height - 1 - y) * rowBytes
		const dstRow = y * rowBytes
		for (let x = 0; x < rowBytes; x += 4) {
			const s = srcRow + x
			const d = dstRow + x

			const alpha = THREE.DataUtils.fromHalfFloat(buffer[s + 3]!)
			out[d + 3] = toByte(alpha)
			if (alpha <= 0) continue

			const red = THREE.DataUtils.fromHalfFloat(buffer[s]!)
			const green = THREE.DataUtils.fromHalfFloat(buffer[s + 1]!)
			const blue = THREE.DataUtils.fromHalfFloat(buffer[s + 2]!)

			if (alpha >= 1) {
				out[d] = toByte(red)
				out[d + 1] = toByte(green)
				out[d + 2] = toByte(blue)
				continue
			}

			out[d] = toByte(linearToSrgb(srgbToLinear(red) / alpha))
			out[d + 1] = toByte(linearToSrgb(srgbToLinear(green) / alpha))
			out[d + 2] = toByte(linearToSrgb(srgbToLinear(blue) / alpha))
		}
	}
	return image
}
