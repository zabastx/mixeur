import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const shadingHolder = vi.hoisted(() => {
	const materialCache = new Map()
	return {
		shadingMode: 'rendered' as string,
		cacheNewObjectMaterials: vi.fn(),
		// The real store answers from the same cache, and callers are expected to
		// come through here rather than read the Map themselves.
		getMaterialCache: vi.fn((mesh: { uuid: string }) => materialCache.get(mesh.uuid)),
		clearMaterialCache: vi.fn(),
		materialCache
	}
})
const raycastHolder = vi.hoisted(() => ({
	addToRaycaster: vi.fn(),
	removeFromRaycaster: vi.fn()
}))
const composerHolder = vi.hoisted(() => ({ removeFromOutline: vi.fn() }))
const cameraHolder = vi.hoisted(() => ({
	renderCamera: null as THREE.Object3D | null,
	setRenderCamera: vi.fn()
}))
const selectionHolder = vi.hoisted(() => ({
	select: vi.fn(),
	clear: vi.fn(),
	isSelectedWithin: vi.fn(() => false),
	selectedObject: null as THREE.Object3D | null
}))

vi.mock('./shading', () => ({ useShadingStore: () => shadingHolder }))
vi.mock('./raycast', () => ({ useRaycastStore: () => raycastHolder }))
vi.mock('./composer', () => ({ useComposerStore: () => composerHolder }))
vi.mock('./camera', () => ({ useCameraStore: () => cameraHolder }))
vi.mock('./selection', () => ({ useSelectionStore: () => selectionHolder }))
const uvHolder = vi.hoisted(() => ({ forget: vi.fn() }))
vi.mock('./uv', () => ({ useUvStore: () => uvHolder }))
const uvGridHolder = vi.hoisted(() => ({ forget: vi.fn() }))
vi.mock('./uv-grid', () => ({ useUvGridStore: () => uvGridHolder }))
const worldHolder = vi.hoisted(() => ({ snapshot: vi.fn(() => ({})) }))
vi.mock('./world', () => ({ useWorldStore: () => worldHolder }))
const projectFileHolder = vi.hoisted(() => ({
	encodeProject: vi.fn<(data: unknown) => Uint8Array>(() => new Uint8Array([1, 2, 3]))
}))
vi.mock('@/shared/lib/project-file', () => ({
	encodeProject: projectFileHolder.encodeProject,
	decodeProject: vi.fn()
}))
const filesHolder = vi.hoisted(() => ({ downloadFile: vi.fn() }))
vi.mock('@/shared/lib/files', () => ({ downloadFile: filesHolder.downloadFile }))

import { useSceneStore } from './scene'

function makeMesh() {
	return new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
}

interface SerializedMaterial {
	uuid: string
	name?: string
	wireframe?: boolean
}
interface SerializedNode {
	uuid: string
	name?: string
	material?: string
	children?: SerializedNode[]
}
/** `Object3D.toJSON()` — the shape both exports are built out of. */
interface SerializedGraph {
	materials?: SerializedMaterial[]
	object: SerializedNode
}

function nodeOf(graph: SerializedGraph | undefined, name: string) {
	function find(node: SerializedNode): SerializedNode | undefined {
		if (node.name === name) return node
		for (const child of node.children ?? []) {
			const hit = find(child)
			if (hit) return hit
		}
	}

	return graph && find(graph.object)
}

function materialOf(graph: SerializedGraph | undefined, meshName: string) {
	const node = nodeOf(graph, meshName)
	return graph?.materials?.find((mat) => mat.uuid === node?.material)
}

/** What the last `saveProjectFile` handed to `encodeProject`. */
function savedProject() {
	return projectFileHolder.encodeProject.mock.calls.at(-1)?.[0] as
		{ scene: SerializedGraph; renderCameraUUID: string | null } | undefined
}

/** The node the last `saveProjectFile` wrote out under the given name. */
function savedNodeOf(name: string) {
	return nodeOf(savedProject()?.scene, name)
}

/** The material the last `saveProjectFile` wrote out for the named mesh. */
function savedMaterialOf(meshName: string) {
	return materialOf(savedProject()?.scene, meshName)
}

/** The camera the last `saveProjectFile` named as the one to render with. */
function savedRenderCameraUUID() {
	return savedProject()?.renderCameraUUID
}

/** The graph the last `objectToJSON` put in the downloaded file. */
async function downloadedGraph() {
	const blob = filesHolder.downloadFile.mock.calls.at(-1)?.[0] as Blob | undefined
	if (!blob) return undefined
	return JSON.parse(await blob.text()) as SerializedGraph
}

/**
 * A mesh whose viewport material is the wireframe stand-in, with the real one
 * only in the cache — what any mesh looks like while shading mode is
 * 'wireframe' or 'solid'.
 */
function makeShadedMesh(name: string) {
	const mesh: THREE.Mesh = makeMesh()
	mesh.name = name

	const original = new THREE.MeshStandardMaterial({ name: `${name} Original` })
	shadingHolder.materialCache.set(mesh.uuid, {
		original,
		solid: new THREE.MeshLambertMaterial(),
		wireframe: new THREE.MeshBasicMaterial({ wireframe: true })
	})
	mesh.material = new THREE.MeshBasicMaterial({ name: `${name} Wireframe`, wireframe: true })

	return mesh
}

describe('useSceneStore graph operations', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		shadingHolder.shadingMode = 'rendered'
		cameraHolder.renderCamera = null
		selectionHolder.selectedObject = null
		selectionHolder.isSelectedWithin.mockReturnValue(false)
		shadingHolder.materialCache.clear()
	})

	describe('objectToJSON', () => {
		it('exports the original material of a mesh nested inside the object', async () => {
			// Exporting a Group is the ordinary case — an imported glTF is one — so
			// restoring the root alone leaves everything inside it wearing the
			// viewport's wireframe or flat grey.
			const store = useSceneStore()
			const group = new THREE.Group()
			group.name = 'Exported'
			group.add(makeShadedMesh('Nested'))
			store.addObjectToScene(group)

			store.objectToJSON(group.uuid)

			expect(materialOf(await downloadedGraph(), 'Nested')?.name).toBe('Nested Original')
			expect(materialOf(await downloadedGraph(), 'Nested')?.wireframe).toBeFalsy()
		})

		it('exports the original material when the object is the mesh itself', async () => {
			const store = useSceneStore()
			const mesh = makeShadedMesh('Solo')
			store.addObjectToScene(mesh)

			store.objectToJSON(mesh.uuid)

			expect(materialOf(await downloadedGraph(), 'Solo')?.name).toBe('Solo Original')
		})

		it('does not download anything for a uuid that is not in the scene', () => {
			const store = useSceneStore()

			store.objectToJSON('missing-object')

			expect(filesHolder.downloadFile).not.toHaveBeenCalled()
		})
	})

	describe('saveProjectFile', () => {
		it('saves the original material of a mesh nested inside a group', () => {
			// An imported glTF arrives as a Group, so every one of its meshes is
			// nested — and under wireframe or solid `mesh.material` is the viewport's
			// stand-in. Restoring the root alone bakes that stand-in into the file for
			// everything below it.
			const store = useSceneStore()
			const group = new THREE.Group()
			const mesh = makeShadedMesh('Nested')
			group.add(mesh)
			store.addObjectToScene(group)

			store.saveProjectFile()

			expect(savedMaterialOf('Nested')?.name).toBe('Nested Original')
			expect(savedMaterialOf('Nested')?.wireframe).toBeFalsy()
		})

		it('saves the original material of a mesh several levels down', () => {
			const store = useSceneStore()
			const outer = new THREE.Group()
			const inner = new THREE.Group()
			const mesh = makeShadedMesh('Deep')
			inner.add(mesh)
			outer.add(inner)
			store.addObjectToScene(outer)

			store.saveProjectFile()

			expect(savedMaterialOf('Deep')?.name).toBe('Deep Original')
		})

		it('still saves the original material of a top-level mesh', () => {
			const store = useSceneStore()
			const mesh = makeShadedMesh('TopLevel')
			store.addObjectToScene(mesh)

			store.saveProjectFile()

			expect(savedMaterialOf('TopLevel')?.name).toBe('TopLevel Original')
		})

		it('points renderCameraUUID at the clone of a camera nested in a group', () => {
			// Cameras can be re-parented into groups, and the clone gets a fresh uuid,
			// so a saved uuid that was never remapped resolves to nothing on load and
			// the project reopens with no render camera.
			const store = useSceneStore()
			const group = new THREE.Group()
			const camera = new THREE.PerspectiveCamera()
			camera.name = 'Nested Camera'
			group.add(camera)
			store.addObjectToScene(group)
			cameraHolder.renderCamera = camera

			store.saveProjectFile()

			const savedCamera = savedNodeOf('Nested Camera')
			expect(savedCamera?.uuid).toBeTruthy()
			// The clone carries a fresh uuid, so the saved one has to be remapped.
			expect(savedCamera?.uuid).not.toBe(camera.uuid)
			expect(savedRenderCameraUUID()).toBe(savedCamera?.uuid)
		})

		it('points renderCameraUUID at the clone of a top-level camera', () => {
			const store = useSceneStore()
			const camera = new THREE.PerspectiveCamera()
			camera.name = 'Top Camera'
			store.addObjectToScene(camera)
			cameraHolder.renderCamera = camera

			store.saveProjectFile()

			expect(savedRenderCameraUUID()).toBe(savedNodeOf('Top Camera')?.uuid)
		})

		it('saves no render camera uuid when nothing is set to render', () => {
			const store = useSceneStore()
			store.addObjectToScene(new THREE.PerspectiveCamera())
			cameraHolder.renderCamera = null

			store.saveProjectFile()

			expect(savedRenderCameraUUID()).toBeNull()
		})

		it('saves a light subtree with its children intact and no duplicates', () => {
			// `DirectionalLight.copy` drops the `recursive` flag and deep-copies
			// whatever it is given, so the clone of a light is where a subtree gets
			// duplicated or paired up wrong. Its children have to come out one for one.
			const store = useSceneStore()
			const light = new THREE.DirectionalLight()
			light.name = 'Key'
			const target = new THREE.Object3D()
			target.name = 'Key Target'
			getUserData(target).isLightTarget = true
			light.add(target)
			light.add(makeShadedMesh('On The Light'))
			store.addObjectToScene(light)

			store.saveProjectFile()

			const saved = savedNodeOf('Key')
			expect(saved?.children).toHaveLength(2)
			expect(saved?.children?.map((child) => child.name).sort()).toEqual([
				'Key Target',
				'On The Light'
			])
			expect(savedMaterialOf('On The Light')?.name).toBe('On The Light Original')
		})

		it('keeps a mesh with no cached original as it is', () => {
			// Nothing shades it, so `mesh.material` is the only material there is —
			// writing `undefined` over it would lose it.
			const store = useSceneStore()
			const mesh = makeMesh()
			mesh.name = 'Uncached'
			mesh.material = new THREE.MeshStandardMaterial({ name: 'Uncached Own' })
			store.addObjectToScene(mesh)

			store.saveProjectFile()

			expect(savedMaterialOf('Uncached')?.name).toBe('Uncached Own')
		})
	})

	describe('deleteFromScene', () => {
		it('clears the selection when it lives inside the deleted object', () => {
			const store = useSceneStore()
			const group = new THREE.Group()
			store.addObjectToScene(group)
			selectionHolder.isSelectedWithin.mockReturnValue(true)

			store.deleteFromScene(group.uuid)

			expect(selectionHolder.clear).toHaveBeenCalled()
		})

		it('leaves the selection alone when it is elsewhere in the scene', () => {
			const store = useSceneStore()
			const group = new THREE.Group()
			store.addObjectToScene(group)
			selectionHolder.isSelectedWithin.mockReturnValue(false)

			store.deleteFromScene(group.uuid)

			expect(selectionHolder.clear).not.toHaveBeenCalled()
		})

		it('clears the render camera when it lives inside the deleted object', () => {
			const store = useSceneStore()
			const group = new THREE.Group()
			const camera = new THREE.PerspectiveCamera()
			group.add(camera)
			store.addObjectToScene(group)
			cameraHolder.renderCamera = camera

			store.deleteFromScene(group.uuid)

			expect(cameraHolder.renderCamera).toBeNull()
		})

		it('clears the render camera nested more than one level down', () => {
			const store = useSceneStore()
			const outer = new THREE.Group()
			const inner = new THREE.Group()
			const camera = new THREE.PerspectiveCamera()
			inner.add(camera)
			outer.add(inner)
			store.addObjectToScene(outer)
			cameraHolder.renderCamera = camera

			store.deleteFromScene(outer.uuid)

			expect(cameraHolder.renderCamera).toBeNull()
		})

		it('clears the render camera when the camera itself is deleted', () => {
			const store = useSceneStore()
			const camera = new THREE.PerspectiveCamera()
			store.addObjectToScene(camera)
			cameraHolder.renderCamera = camera

			store.deleteFromScene(camera.uuid)

			expect(cameraHolder.renderCamera).toBeNull()
		})

		it('leaves the render camera alone when it is outside the deleted subtree', () => {
			const store = useSceneStore()
			const camera = new THREE.PerspectiveCamera()
			store.addObjectToScene(camera)
			const group = new THREE.Group()
			store.addObjectToScene(group)
			cameraHolder.renderCamera = camera

			store.deleteFromScene(group.uuid)

			expect(cameraHolder.renderCamera).toBe(camera)
		})

		it('lets the UV stores forget every mesh in the deleted subtree', () => {
			// They remember a mesh's original UVs and replaced map against its
			// uuid, and deleting a group takes its meshes with it — so the whole
			// subtree has to be released, not just the object that was named.
			const store = useSceneStore()
			const group = new THREE.Group()
			const mesh = makeMesh()
			group.add(mesh)
			store.addObjectToScene(group)

			store.deleteFromScene(group.uuid)

			expect(uvHolder.forget).toHaveBeenCalledWith(group.uuid)
			expect(uvHolder.forget).toHaveBeenCalledWith(mesh.uuid)
			expect(uvGridHolder.forget).toHaveBeenCalledWith(group.uuid)
			expect(uvGridHolder.forget).toHaveBeenCalledWith(mesh.uuid)
		})
	})

	describe('addGroup', () => {
		it('adds a shadow-casting Group with user data to the scene', () => {
			const store = useSceneStore()
			const before = store.scene.children.length

			const group = store.addGroup()

			expect(group).toBeInstanceOf(THREE.Group)
			expect(group.name).toBe('Group')
			expect(getUserData(group).userVisible).toBe(true)
			expect(group.castShadow).toBe(true)
			expect(store.scene.children).toContain(group)
			expect(store.scene.children.length).toBe(before + 1)
		})

		it('exposes user groups through sceneGroups but hides system helpers', () => {
			const store = useSceneStore()
			const group = store.addGroup()

			expect(store.sceneGroups).toContain(group)
			// grid/axes helpers are flagged hideInOutliner and must not leak in
			expect(store.sceneGroups.every((g) => !getUserData(g).hideInOutliner)).toBe(true)
		})
	})

	describe('moveObjectToTarget', () => {
		it('re-parents an object under the target', () => {
			const store = useSceneStore()
			const target = store.addGroup()
			const obj = store.addGroup()

			store.moveObjectToTarget(obj.uuid, target.uuid)

			expect(obj.parent).toBe(target)
		})

		it('is a no-op when the object is already a child of the target', () => {
			const store = useSceneStore()
			const target = store.addGroup()
			const obj = store.addGroup()
			store.moveObjectToTarget(obj.uuid, target.uuid)

			store.moveObjectToTarget(obj.uuid, target.uuid)

			expect(obj.parent).toBe(target)
		})

		it('is a no-op when the target does not exist', () => {
			const store = useSceneStore()
			const obj = store.addGroup()
			const originalParent = obj.parent

			store.moveObjectToTarget(obj.uuid, 'missing-target')

			expect(obj.parent).toBe(originalParent)
		})
	})

	describe('addObjectToScene', () => {
		it('marks the object, registers it with the raycaster, and selects it', () => {
			const store = useSceneStore()
			const mesh = makeMesh()

			store.addObjectToScene(mesh)

			expect(store.scene.children).toContain(mesh)
			expect(getUserData(mesh).userVisible).toBe(true)
			expect(getUserData(mesh).isShadable).toBe(true)
			expect(getUserData(mesh).isSelectable).toBe(true)
			expect(mesh.castShadow).toBe(true)
			expect(raycastHolder.addToRaycaster).toHaveBeenCalledWith(mesh)
			expect(shadingHolder.cacheNewObjectMaterials).toHaveBeenCalledWith(mesh)
			expect(selectionHolder.select).toHaveBeenCalledWith(mesh)
		})

		it('adds the object under an explicit parent when provided', () => {
			const store = useSceneStore()
			const parent = store.addGroup()
			const mesh = makeMesh()

			store.addObjectToScene(mesh, parent)

			expect(mesh.parent).toBe(parent)
		})
	})

	describe('objectVisibilityUpdate', () => {
		it('updates userVisible and the live visibility for normal modes', () => {
			const store = useSceneStore()
			const group = store.addGroup()
			shadingHolder.shadingMode = 'rendered'

			store.objectVisibilityUpdate(group.uuid, false)

			expect(getUserData(group).userVisible).toBe(false)
			expect(group.visible).toBe(false)
		})

		it('does not change live visibility when the object is hidden in the current mode', () => {
			const store = useSceneStore()
			const group = store.addGroup()
			getUserData(group).hideInModes = ['rendered']
			shadingHolder.shadingMode = 'rendered'
			group.visible = false

			store.objectVisibilityUpdate(group.uuid, true)

			expect(getUserData(group).userVisible).toBe(true)
			expect(group.visible).toBe(false)
		})
	})

	describe('clearScene', () => {
		it('removes user objects but keeps system helpers', () => {
			const store = useSceneStore()
			const a = store.addGroup()
			const b = store.addGroup()
			const systemBefore = store.scene.children.filter((c) => getUserData(c).isSystemObj).length

			store.clearScene()

			expect(store.scene.children).not.toContain(a)
			expect(store.scene.children).not.toContain(b)
			expect(store.scene.children.filter((c) => getUserData(c).isSystemObj).length).toBe(
				systemBefore
			)
		})

		it('clears a render camera nested inside one of the cleared objects', () => {
			const store = useSceneStore()
			const group = new THREE.Group()
			const camera = new THREE.PerspectiveCamera()
			group.add(camera)
			store.addObjectToScene(group)
			cameraHolder.renderCamera = camera

			store.clearScene()

			expect(cameraHolder.renderCamera).toBeNull()
		})
	})
})
