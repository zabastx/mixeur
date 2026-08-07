import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const shadingHolder = vi.hoisted(() => ({
	shadingMode: 'rendered' as string,
	cacheNewObjectMaterials: vi.fn(),
	getMaterialCache: vi.fn(),
	clearMaterialCache: vi.fn(),
	materialCache: new Map()
}))
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

import { useSceneStore } from './scene'

function makeMesh() {
	return new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
}

describe('useSceneStore graph operations', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		vi.clearAllMocks()
		shadingHolder.shadingMode = 'rendered'
		cameraHolder.renderCamera = null
		selectionHolder.selectedObject = null
		selectionHolder.isSelectedWithin.mockReturnValue(false)
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
