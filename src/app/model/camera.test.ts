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
		it('returns only cameras flagged as render cameras', () => {
			const store = useCameraStore()
			const renderCam = new THREE.PerspectiveCamera()
			getUserData(renderCam).isRenderCamera = true
			const plainCam = new THREE.PerspectiveCamera()
			const mesh = new THREE.Mesh()
			sceneHolder.sceneChildren = [renderCam, plainCam, mesh]

			expect(store.renderCameraList).toEqual([renderCam])
		})
	})
})
