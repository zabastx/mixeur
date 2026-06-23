import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const sceneHolder = vi.hoisted(() => ({ scene: null as unknown as THREE.Scene }))
const controlsHolder = vi.hoisted(() => ({
	transformControls: { attach: vi.fn(), detach: vi.fn() }
}))
const composerHolder = vi.hoisted(() => ({ setOutlineObjects: vi.fn() }))

vi.mock('./scene', () => ({ useSceneStore: () => sceneHolder }))
vi.mock('./controls', () => ({ useControlsStore: () => controlsHolder }))
vi.mock('./composer', () => ({
	useComposerStore: () => ({ setOutlineObjects: composerHolder.setOutlineObjects, init: vi.fn() })
}))
vi.mock('./shading', () => ({ useShadingStore: () => ({ init: vi.fn() }) }))
vi.mock('./camera', () => ({ useCameraStore: () => ({}) }))
vi.mock('./raycast', () => ({ useRaycastStore: () => ({ init: vi.fn() }) }))
vi.mock('./preferences', () => ({ usePreferencesStore: () => ({ initTheme: vi.fn() }) }))
vi.mock('@/shared/three/modules/extras/stats', () => ({
	useStats: () => ({ setFPSCounter: vi.fn(), monitor: {}, updateMonitor: vi.fn() })
}))

import { useThreeStore } from './three'

describe('useThreeStore.selectObject', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		sceneHolder.scene = new THREE.Scene()
		controlsHolder.transformControls = { attach: vi.fn(), detach: vi.fn() }
		composerHolder.setOutlineObjects = vi.fn()
	})

	it('clears the selection when called with no target', () => {
		const store = useThreeStore()
		store.selectObject(new THREE.Mesh())
		store.selectObject()
		expect(store.selectedObject).toBeNull()
	})

	it('selects a mesh, attaches controls, and outlines it', () => {
		const store = useThreeStore()
		const mesh = new THREE.Mesh()

		store.selectObject(mesh)

		expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(mesh)
		expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([mesh])
		expect(store.selectedObject).toBe(mesh)
	})

	it('resolves a string uuid against the scene', () => {
		const store = useThreeStore()
		const mesh = new THREE.Mesh()
		mesh.uuid = 'mesh-uuid'
		sceneHolder.scene.add(mesh)

		store.selectObject('mesh-uuid')

		expect(store.selectedObject).toBe(mesh)
	})

	it('ignores raycasted objects that are not selectable', () => {
		const store = useThreeStore()
		const mesh = new THREE.Mesh() // no userData.isSelectable

		store.selectObject(mesh, true)

		expect(store.selectedObject).toBeNull()
		expect(controlsHolder.transformControls.attach).not.toHaveBeenCalled()
	})

	it('accepts raycasted objects flagged as selectable', () => {
		const store = useThreeStore()
		const mesh = new THREE.Mesh()
		getUserData(mesh).isSelectable = true

		store.selectObject(mesh, true)

		expect(store.selectedObject).toBe(mesh)
	})

	it('attaches the light itself when a light is selected', () => {
		const store = useThreeStore()
		const light = new THREE.PointLight()

		store.selectObject(light)

		expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(light)
		expect(store.selectedObject).toBe(light)
	})

	it('attaches the camera itself when a camera is selected', () => {
		const store = useThreeStore()
		const camera = new THREE.PerspectiveCamera()

		store.selectObject(camera)

		expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(camera)
		expect(store.selectedObject).toBe(camera)
	})

	it('attaches the inner light and outlines the helper for a light helper', () => {
		const store = useThreeStore()
		const innerLight = new THREE.PointLight()
		const helper = new THREE.Object3D() as THREE.Object3D & { light: THREE.Light }
		helper.light = innerLight

		store.selectObject(helper)

		expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(innerLight)
		expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([helper])
		expect(store.selectedObject).toBe(innerLight)
	})
})
