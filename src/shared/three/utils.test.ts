import { describe, it, expect } from 'vitest'
import THREE from '.'
import { cloneForSerialization, meshesMissingBones, sceneForSerialization } from './utils'

/**
 * A rig shaped like the ones GLTFLoader builds: bones as siblings of the mesh
 * under a common root, and an identity bind matrix.
 */
function rig() {
	const root = new THREE.Group()

	const upper = new THREE.Bone()
	upper.name = 'upper'
	upper.position.set(0, 2, 0)

	const lower = new THREE.Bone()
	lower.name = 'lower'
	lower.position.set(0, 1, 0)

	upper.add(lower)
	root.add(upper)

	const geometry = new THREE.BufferGeometry()
	geometry.setAttribute(
		'position',
		new THREE.BufferAttribute(new Float32Array([0, 2, 0, 0, 3, 0]), 3)
	)
	geometry.setAttribute(
		'skinIndex',
		new THREE.BufferAttribute(new Uint16Array([0, 0, 0, 0, 1, 0, 0, 0]), 4)
	)
	geometry.setAttribute(
		'skinWeight',
		new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0]), 4)
	)

	const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial())
	mesh.name = 'Body'
	root.add(mesh)

	root.updateMatrixWorld(true)
	mesh.bind(new THREE.Skeleton([upper, lower]), new THREE.Matrix4())

	return { root, mesh, bones: [upper, lower] }
}

function skinnedMeshIn(root: THREE.Object3D) {
	let found: THREE.SkinnedMesh | null = null
	root.traverse((object) => {
		if (object instanceof THREE.SkinnedMesh) found = object
	})
	if (!found) throw new Error('no skinned mesh in tree')
	return found as THREE.SkinnedMesh
}

/**
 * Where the mesh's vertices actually end up, skinning included.
 * `applyBoneTransform` is the CPU mirror of the skinning vertex shader.
 */
function skinnedVertices(root: THREE.Object3D) {
	const mesh = skinnedMeshIn(root)
	root.updateMatrixWorld(true)
	mesh.skeleton.update()

	const positions = mesh.geometry.attributes.position
	const out: number[][] = []
	for (let i = 0; i < positions.count; i++) {
		const vertex = new THREE.Vector3().fromBufferAttribute(positions, i)
		mesh.applyBoneTransform(i, vertex)
		out.push(
			vertex
				.applyMatrix4(mesh.matrixWorld)
				.toArray()
				.map((n) => Number(n.toFixed(3)))
		)
	}
	return out
}

describe('cloneForSerialization', () => {
	it('re-binds cloned skinned meshes to the cloned bones', () => {
		const { root, bones } = rig()

		const { clone } = cloneForSerialization(root)
		const clonedSkeleton = skinnedMeshIn(clone).skeleton

		expect(meshesMissingBones(clone)).toEqual([])
		// the point of the exercise: not one bone of the source survives in the clone
		expect(clonedSkeleton.bones.map((bone) => bone.uuid)).not.toEqual(
			bones.map((bone) => bone.uuid)
		)
		expect(clonedSkeleton.bones.map((bone) => bone.name)).toEqual(['upper', 'lower'])
		clonedSkeleton.bones.forEach((bone) => expect(bone.parent).not.toBeNull())
	})

	it('survives a toJSON round trip that a plain clone does not', () => {
		const live = skinnedVertices(rig().root)
		expect(live).toEqual([
			[0, 2, 0],
			[0, 3, 0]
		])

		const viaPlainClone = new THREE.ObjectLoader().parse(rig().root.clone().toJSON())
		expect(skinnedVertices(viaPlainClone)).not.toEqual(live) // collapses onto the bone origins

		const viaHelper = new THREE.ObjectLoader().parse(
			cloneForSerialization(rig().root).clone.toJSON()
		)
		expect(skinnedVertices(viaHelper)).toEqual(live)
	})

	it('keeps bones it cannot map, so serializing still works', () => {
		const { root, mesh, bones } = rig()

		// what the outliner does when the mesh is dragged out of its armature
		root.remove(mesh)
		const detached = new THREE.Group()
		detached.add(mesh)

		const { clone } = cloneForSerialization(detached)

		// held onto rather than left as holes, which `Skeleton.toJSON` would throw on
		expect(skinnedMeshIn(clone).skeleton.bones.map((bone) => bone.uuid)).toEqual(
			bones.map((bone) => bone.uuid)
		)
		expect(() => clone.toJSON()).not.toThrow()
		expect(meshesMissingBones(clone).map((m) => m.name)).toEqual(['Body'])
	})

	it('keeps one skeleton shared between the meshes that shared it', () => {
		// how a glTF character arrives: body, eyes and teeth on one armature
		const { root, mesh } = rig()
		const second = new THREE.SkinnedMesh(mesh.geometry, mesh.material)
		second.name = 'Eyes'
		root.add(second)
		root.updateMatrixWorld(true)
		second.bind(mesh.skeleton, new THREE.Matrix4())
		expect(second.skeleton).toBe(mesh.skeleton)

		const { clone } = cloneForSerialization(root)

		const skeletons = new Set<THREE.Skeleton>()
		clone.traverse((node) => {
			if (node instanceof THREE.SkinnedMesh) skeletons.add(node.skeleton)
		})

		expect(skeletons.size).toBe(1)
		expect([...skeletons][0]).not.toBe(mesh.skeleton)
		// and the file says so too, rather than carrying the bone list twice.
		// `toJSON` is typed by its object block; the meta blocks beside it are not.
		const json = clone.toJSON() as unknown as { skeletons?: unknown[] }
		expect(json.skeletons).toHaveLength(1)
	})
})

describe('sceneForSerialization', () => {
	/** A scene holding a rig, plus whatever else the caller wants beside it. */
	function sceneWith(
		place: (scene: THREE.Scene, armature: THREE.Object3D, mesh: THREE.Object3D) => void
	) {
		const scene = new THREE.Scene()
		const { root, mesh } = rig()

		// the armature and the mesh as two separate top-level objects
		root.remove(mesh)
		place(scene, root, mesh)
		scene.updateMatrixWorld(true)

		return { scene, mesh }
	}

	it('keeps what the filter accepts and leaves out what it rejects', () => {
		const scene = new THREE.Scene()
		const kept = new THREE.Group()
		kept.name = 'kept'
		const dropped = new THREE.Group()
		dropped.name = 'dropped'
		scene.add(kept, dropped)

		const result = sceneForSerialization(scene, (child) => child.name === 'kept')

		expect(result.scene.children).toHaveLength(1)
		expect(result.scene.children[0].name).toBe('kept')
		expect(result.scene.children[0]).not.toBe(kept)
		expect(result.cloneOf.get(kept)).toBe(result.scene.children[0])
		expect(result.cloneOf.has(dropped)).toBe(false)
	})

	it('never clones what the filter rejects', () => {
		// `CameraHelper.clone()` throws: `Object3D.clone` calls its constructor with
		// no camera. Every scene here has one, so a filtered-out child has to be
		// left alone rather than cloned and dropped.
		const scene = new THREE.Scene()
		const camera = new THREE.PerspectiveCamera()
		const helper = new THREE.CameraHelper(camera)
		const keeper = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
		keeper.name = 'Keep me'
		scene.add(camera, helper, keeper)

		expect(() => helper.clone()).toThrow()

		const { scene: exportScene } = sceneForSerialization(
			scene,
			(child) => !(child instanceof THREE.CameraHelper)
		)

		expect(exportScene.children.map((child) => child.name)).toEqual(['', 'Keep me'])
	})

	it('carries a rig whose bones sit under a different child', () => {
		const { scene } = sceneWith((scene, armature, mesh) => scene.add(armature, mesh))

		const { scene: exportScene, missingBones } = sceneForSerialization(scene, () => true)

		expect(missingBones).toEqual([])
		const loaded = new THREE.ObjectLoader().parse(exportScene.toJSON())
		expect(skinnedVertices(loaded)).toEqual([
			[0, 2, 0],
			[0, 3, 0]
		])
	})

	it('reports the rig when the filter drops the child holding its bones', () => {
		// the bones parented under something the caller will not write — the case
		// a completeness check taken before assembly cannot see
		const { scene } = sceneWith((scene, armature, mesh) => {
			const helper = new THREE.Group()
			helper.name = 'helper'
			helper.add(armature)
			scene.add(helper, mesh)
		})

		const { scene: exportScene, missingBones } = sceneForSerialization(
			scene,
			(child) => child.name !== 'helper'
		)

		expect(missingBones.map((m) => m.name)).toEqual(['Body'])
		// and it really would have loaded broken, which is what the report is for
		expect(skinnedVertices(new THREE.ObjectLoader().parse(exportScene.toJSON()))).not.toEqual([
			[0, 2, 0],
			[0, 3, 0]
		])
	})
})
