import THREE from '@/shared/three'
import {
	cloneForSerialization,
	meshesMissingBones,
	sceneForSerialization
} from '@/shared/three/utils'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import { useCameraStore } from './camera'
import { useShadingStore } from './shading'
import { useUvGridStore } from './uv-grid'
import { useWorldStore } from './world'

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

/** Copies the object hierarchy without editor helpers and reports meshes missing bones. */
function copyObjectTree(source: THREE.Object3D) {
	const { clone: object, cloneOf } = cloneForSerialization(
		source,
		(node) => !node.userData.mixeur?.isHelper
	)
	return { object, cloneOf, missingBones: meshesMissingBones(object) }
}

interface SceneCopyOptions {
	renderCamera?: THREE.Camera | null
	keep?: (object: THREE.Object3D) => boolean
}

/** File snapshots borrow vertex buffers; callers must not edit or dispose them. */
export function snapshotScene(source: THREE.Scene, options: SceneCopyOptions = {}) {
	const { scene, missingBones, renderCameraCopy } = copyScene(source, options)
	return { scene, missingBones, renderCameraUUID: renderCameraCopy?.uuid ?? null }
}

/** Copies scene data with snapshot ownership rules and pairs the Render Camera with its copy. */
function copyScene(source: THREE.Scene, { renderCamera, keep = () => true }: SceneCopyOptions) {
	const { scene, cloneOf, missingBones } = sceneForSerialization(
		source,
		(node) => !node.userData.mixeur?.isHelper && keep(node)
	)
	prepareCopies(cloneOf, 'snapshot')
	const renderCameraCopy = renderCamera ? cloneOf.get(renderCamera) : undefined
	return { scene, missingBones, renderCameraCopy }
}

/**
 * Assembles the scene a Render draws, copied by the same rules as a saved project,
 * and hands it to `draw` with the camera to see it through: the copy's own Render
 * Camera, framed for `width` × `height`. The user's camera is never touched.
 * Refuses before copying anything when no Render Camera is chosen.
 *
 * The World's map is shared rather than copied: the render draws with the
 * viewport's own renderer, whose PMREM output it is (ADR-0002). Released when
 * `draw` returns or throws, so nothing the copy owns outlives the render.
 */
export function withRenderScene<T>(
	source: THREE.Scene,
	{ width, height }: { width: number; height: number },
	draw: (scene: THREE.Scene, camera: THREE.Camera) => T
): T {
	const { renderCamera } = useCameraStore()
	if (!renderCamera) throw noRenderCamera()
	const { scene, renderCameraCopy } = copyScene(source, { renderCamera })
	try {
		// Chosen but not in `source`: a camera the scene no longer holds.
		if (!(renderCameraCopy instanceof THREE.Camera)) throw noRenderCamera()
		frame(renderCameraCopy, width / height)
		useWorldStore().writeTo(scene)
		return draw(scene, renderCameraCopy)
	} finally {
		release(scene)
	}
}

function noRenderCamera() {
	return new Error('There is no Render Camera to render through.')
}

/**
 * Fits a camera's projection to an aspect: a perspective camera takes it as is,
 * an orthographic one keeps its vertical extent and widens or narrows around
 * its centre.
 */
function frame(camera: THREE.Camera, aspect: number) {
	if (camera instanceof THREE.PerspectiveCamera) {
		camera.aspect = aspect
		camera.updateProjectionMatrix()
	} else if (camera instanceof THREE.OrthographicCamera) {
		const centre = (camera.left + camera.right) / 2
		const halfWidth = ((camera.top - camera.bottom) / 2) * aspect
		camera.left = centre - halfWidth
		camera.right = centre + halfWidth
		camera.updateProjectionMatrix()
	}
}

/**
 * Frees what a Render's copy owns: its cloned materials, and the shadow maps and
 * bone textures the renderer allocated for its own lights and skeletons. Its
 * geometry is borrowed and never disposed.
 */
function release(scene: THREE.Scene) {
	const skeletons = new Set<THREE.Skeleton>()
	scene.traverse((object) => {
		if (object instanceof THREE.Light) object.dispose()
		if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
		if (!hasMaterial(object)) return
		for (const material of materialsOf(object)) material.dispose()
	})
	for (const skeleton of skeletons) skeleton.dispose()
}

/**
 * Restores user visibility and real materials on copies. Duplicates own cloned
 * geometry and textures; snapshots borrow vertex buffers and textures.
 */
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
		for (const material of materialsOf(copy)) {
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

/** Borrows geometry buffers while keeping attribute slots separate for serialization. */
function snapshotGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
	// GLTFExporter temporarily replaces normals and indices, even across awaits.
	// Own those slots while borrowing the read-only buffers and geometry parameters.
	const geometry = Object.create(source) as THREE.BufferGeometry
	geometry.attributes = { ...source.attributes }
	return geometry
}

/** Returns an object's materials as an array, including single-material objects. */
function materialsOf(object: THREE.Mesh | THREE.Line | THREE.Points | THREE.Sprite) {
	return Array.isArray(object.material) ? object.material : [object.material]
}

/** Narrows a scene object to the supported types that carry materials. */
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
