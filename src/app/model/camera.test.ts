import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const sceneHolder = vi.hoisted(() => ({
	scene: null as unknown as THREE.Scene,
	sceneChildren: [] as THREE.Object3D[]
}))
const composerHolder = vi.hoisted(() => ({ needsResize: false }))

vi.mock('./scene', () => ({ useSceneStore: () => sceneHolder }))
vi.mock('./composer', () => ({ useComposerStore: () => composerHolder }))

import { useCameraStore } from './camera'

describe('useCameraStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		sceneHolder.scene = new THREE.Scene()
		sceneHolder.sceneChildren = []
		composerHolder.needsResize = false
	})

	describe('toggleViewportCamera', () => {
		it('flips between perspective and orthographic', () => {
			const store = useCameraStore()
			expect(store.viewportCameraType).toBe('perspective')

			store.toggleViewportCamera()
			expect(store.viewportCameraType).toBe('orthographic')

			store.toggleViewportCamera()
			expect(store.viewportCameraType).toBe('perspective')
		})
	})

	describe('setRenderCamera', () => {
		it('warns and keeps renderCamera null for a non-camera uuid', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
			const store = useCameraStore()
			const mesh = new THREE.Mesh()
			mesh.uuid = 'mesh-1'
			sceneHolder.scene.add(mesh)

			store.setRenderCamera('mesh-1')

			expect(warn).toHaveBeenCalled()
			expect(store.renderCamera).toBeNull()
			warn.mockRestore()
		})

		it('sets a valid camera as the render camera', () => {
			const store = useCameraStore()
			const camera = new THREE.PerspectiveCamera()
			camera.uuid = 'camera-1'
			sceneHolder.scene.add(camera)

			store.setRenderCamera('camera-1')

			expect(store.renderCamera).toBe(camera)
		})
	})

	describe('toggleCameraView', () => {
		it('keeps the viewport camera active and requests a resize when no render camera', () => {
			const store = useCameraStore()

			store.toggleCameraView()

			// activeCamera is wrapped in a reactive proxy, so compare by stable uuid.
			expect(store.activeCamera.uuid).toBe(store.viewportCameras[store.viewportCameraType].uuid)
			expect(composerHolder.needsResize).toBe(true)
		})

		it('switches the active camera to the render camera', () => {
			const store = useCameraStore()
			const camera = new THREE.PerspectiveCamera()
			camera.uuid = 'camera-1'
			sceneHolder.scene.add(camera)
			store.setRenderCamera('camera-1')

			store.toggleCameraView()

			expect(store.activeCamera.uuid).toBe(camera.uuid)
		})
	})

	describe('renderCameraList', () => {
		function makeRenderCamera() {
			const camera = new THREE.PerspectiveCamera()
			getUserData(camera).isRenderCamera = true
			return camera
		}

		it('returns only cameras flagged as render cameras', () => {
			const store = useCameraStore()
			const renderCam = makeRenderCamera()
			const plainCam = new THREE.PerspectiveCamera()
			const mesh = new THREE.Mesh()
			sceneHolder.sceneChildren = [renderCam, plainCam, mesh]

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('finds a render camera nested inside a group', () => {
			const store = useCameraStore()
			const renderCam = makeRenderCamera()
			const group = new THREE.Group()
			group.add(renderCam)
			sceneHolder.sceneChildren = [group]

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('finds a render camera nested several groups deep', () => {
			const store = useCameraStore()
			const renderCam = makeRenderCamera()
			const inner = new THREE.Group()
			inner.add(renderCam)
			const outer = new THREE.Group()
			outer.add(inner)
			sceneHolder.sceneChildren = [outer]

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('applies the same filter at depth as it does at the top level', () => {
			const store = useCameraStore()
			const renderCam = makeRenderCamera()
			const plainCam = new THREE.PerspectiveCamera()
			const mesh = new THREE.Mesh()
			const group = new THREE.Group()
			group.add(renderCam, plainCam, mesh)
			sceneHolder.sceneChildren = [group]

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('lists top-level and nested render cameras together', () => {
			const store = useCameraStore()
			const topCam = makeRenderCamera()
			const nestedCam = makeRenderCamera()
			const group = new THREE.Group()
			group.add(nestedCam)
			sceneHolder.sceneChildren = [topCam, group]

			expect(store.renderCameraList).toEqual([topCam, nestedCam])
		})
	})
})
