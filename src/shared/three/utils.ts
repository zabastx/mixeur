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

/**
 * Clones a subtree for writing out, keeping a way back to every node it came
 * from.
 *
 * `Object3D.clone()` gives the copy fresh uuids, which severs it from everything
 * the editor remembers against the source's uuid — cached original materials,
 * the render camera's identity. Serialization has to look each of those up per
 * node, and a call site left to walk the two trees itself tends to reach the
 * root and stop, which costs every nested mesh its material.
 *
 * The returned `cloneOf` maps each source node to its twin, so callers can
 * iterate the whole subtree once and patch the clone by lookup.
 *
 * The pairing is built rather than inferred. Matching the two trees up
 * afterwards means guessing a correspondence — by child index, since a clone
 * carries none of the source's uuids — and that guess is only as good as
 * `clone()` copying children one for one in order. Several classes do not:
 * `DirectionalLight`, `RectAreaLight`, `LightProbe`, `BatchedMesh` and `LOD` all
 * declare `copy( source )` and drop the `recursive` flag, and `LOD` re-adds its
 * levels in distance order. A guess that silently slips by one costs a mesh its
 * material with nothing to show for it, so the children are cloned here, one at
 * a time, and each pair recorded as it is made.
 *
 * The same pairing is what makes a rig survive the trip. A `SkinnedMesh` is
 * posed by a `Skeleton` holding bones that live beside it in the tree rather
 * than inside it, and `SkinnedMesh.copy` shares the source's skeleton outright —
 * so a clone is posed by the *source's* bones while its own copies of them carry
 * fresh uuids. `toJSON` then writes a skeleton naming bones the file does not
 * contain, `ObjectLoader` resolves none of them and substitutes loose `Bone`s
 * left at identity, and every skinned mesh loads collapsed onto its bones'
 * origins; `GLTFExporter` writes `"joints": [null, …]` from the same cause. So
 * each cloned mesh is re-bound to the cloned bones before the clone is handed
 * back.
 */
export function cloneForSerialization(source: THREE.Object3D) {
	const cloneOf = new Map<THREE.Object3D, THREE.Object3D>()
	const clone = cloneInto(source, cloneOf)
	rebindSkeletons(cloneOf)
	return { clone, cloneOf }
}

/** Clones `node` and everything under it, recording each pair in `cloneOf`. */
function cloneInto(node: THREE.Object3D, cloneOf: Map<THREE.Object3D, THREE.Object3D>) {
	// Emptied because `clone( false )` is a request, not a guarantee — the
	// classes above deep-copy regardless, and those copies are the ones with no
	// entry in the map. The children that count are added back below.
	const clone = node.clone(false)
	clone.clear()

	cloneOf.set(node, clone)
	node.children.forEach((child) => clone.add(cloneInto(child, cloneOf)))

	return clone
}

/**
 * Points every cloned skinned mesh at cloned bones, given the whole of what was
 * cloned. A bone that was not is kept as it is: a hole in the bone list would
 * make `Skeleton.toJSON` throw, and {@link meshesMissingBones} reports the mesh
 * anyway.
 */
function rebindSkeletons(cloneOf: Map<THREE.Object3D, THREE.Object3D>) {
	// One skeleton usually poses every mesh of a character — a glTF body, its
	// eyes, its teeth and its clothes all share one. Rebuilding it per mesh would
	// write that bone list into the file once per mesh and hand the renderer a
	// bone texture per mesh, so each is rebuilt once and shared as it was.
	const rebuilt = new Map<THREE.Skeleton, THREE.Skeleton>()

	for (const [source, copy] of cloneOf) {
		if (!(source instanceof THREE.SkinnedMesh) || !(copy instanceof THREE.SkinnedMesh)) continue

		const skeleton = source.skeleton
		let rebuiltSkeleton = rebuilt.get(skeleton)

		if (!rebuiltSkeleton) {
			const bones = skeleton.bones.map((bone) => {
				const cloned = cloneOf.get(bone)
				return cloned instanceof THREE.Bone ? cloned : bone
			})

			rebuiltSkeleton = new THREE.Skeleton(
				bones,
				skeleton.boneInverses.map((matrix) => matrix.clone())
			)
			rebuilt.set(skeleton, rebuiltSkeleton)
		}

		copy.bind(rebuiltSkeleton, source.bindMatrix)
	}
}

/**
 * The skinned meshes in `root` that some of their bones did not come with.
 *
 * Serializing one writes a skeleton naming bones the output does not contain,
 * and whatever reads it back finds none of them and loads the mesh collapsed
 * onto their origins. Ask this of the tree that is actually about to be written
 * — a mesh and its bones can be together in a scene and still be separated by
 * whatever picks out the part of it to write.
 */
export function meshesMissingBones(root: THREE.Object3D): THREE.SkinnedMesh[] {
	const present = new Set<THREE.Object3D>()
	root.traverse((node) => {
		if (node instanceof THREE.Bone) present.add(node)
	})

	const missing: THREE.SkinnedMesh[] = []
	root.traverse((node) => {
		if (node instanceof THREE.SkinnedMesh && node.skeleton.bones.some((b) => !present.has(b))) {
			missing.push(node)
		}
	})

	return missing
}

/** A scene assembled for serialization, and what the assembly cost its rigs. */
export interface SerializableScene {
	/** The scene to serialize. */
	scene: THREE.Scene
	/** Each node of the source that was kept, keyed to its twin in `scene`. */
	cloneOf: Map<THREE.Object3D, THREE.Object3D>
	/** The rigs `keep` broke, per {@link meshesMissingBones}. Usually empty. */
	missingBones: THREE.SkinnedMesh[]
}

/**
 * Assembles the children of `source` that `keep` accepts into a scene to write.
 *
 * Children are cloned one by one but re-bound together, at the end, against
 * everything kept: a skinned mesh and the bones posing it need not be under the
 * same child once the outliner has re-parented either, and binding per child
 * would lose a rig that spans two of them.
 *
 * What `keep` rejects is never cloned, because a scene holds things that cannot
 * be — `CameraHelper.clone()` throws, its constructor wanting the camera that
 * `Object3D.clone` does not pass, and every scene here has one. Rejecting a
 * child can strand a rig even so, so the meshes that lost bones are counted
 * against the assembled scene — the one that gets written — and handed back for
 * the caller to answer for.
 */
export function sceneForSerialization(
	source: THREE.Scene,
	keep: (child: THREE.Object3D) => boolean
): SerializableScene {
	const scene = new THREE.Scene()
	const cloneOf = new Map<THREE.Object3D, THREE.Object3D>()

	source.children.forEach((child) => {
		if (keep(child)) scene.add(cloneInto(child, cloneOf))
	})

	rebindSkeletons(cloneOf)

	return { scene, cloneOf, missingBones: meshesMissingBones(scene) }
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
