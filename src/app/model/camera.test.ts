import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { useComposerStore } from './composer'
import { useSceneStore } from './scene'
import { useCameraStore } from './camera'

function addMesh(parent?: THREE.Object3D) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	useSceneStore().addObjectToScene(mesh, parent)
	return mesh
}

describe('useCameraStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
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
			const mesh = addMesh()

			store.setRenderCamera(mesh.uuid)

			expect(warn).toHaveBeenCalled()
			expect(store.renderCamera).toBeNull()
			warn.mockRestore()
		})

		it('sets a valid camera as the render camera', () => {
			const store = useCameraStore()
			const camera = new THREE.PerspectiveCamera()
			useSceneStore().addObjectToScene(camera)

			store.setRenderCamera(camera.uuid)

			expect(store.renderCamera).toBe(camera)
		})
	})

	describe('toggleCameraView', () => {
		it('keeps the viewport camera active and requests a resize when no render camera', () => {
			const store = useCameraStore()
			const composerStore = useComposerStore()
			composerStore.needsResize = false

			store.toggleCameraView()

			// activeCamera is wrapped in a reactive proxy, so compare by stable uuid.
			expect(store.activeCamera.uuid).toBe(store.viewportCameras[store.viewportCameraType].uuid)
			expect(composerStore.needsResize).toBe(true)
		})

		it('switches the active camera to the render camera', () => {
			const store = useCameraStore()
			const camera = new THREE.PerspectiveCamera()
			useSceneStore().addObjectToScene(camera)
			store.setRenderCamera(camera.uuid)

			store.toggleCameraView()

			expect(store.activeCamera.uuid).toBe(camera.uuid)
		})
	})

	describe('renderCameraList', () => {
		// Every camera added through the scene store becomes a render camera; one
		// put in the scene graph by other means, as a loader would, does not.
		function addPlainCamera(parent: THREE.Object3D) {
			const camera = new THREE.PerspectiveCamera()
			parent.add(camera)
			useSceneStore().updateScene()
			return camera
		}

		function addRenderCamera(parent?: THREE.Object3D) {
			const camera = new THREE.PerspectiveCamera()
			useSceneStore().addObjectToScene(camera, parent)
			return camera
		}

		it('returns only cameras flagged as render cameras', () => {
			const store = useCameraStore()
			const renderCam = addRenderCamera()
			addPlainCamera(useSceneStore().scene)
			addMesh()

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('finds a render camera nested inside a group', () => {
			const store = useCameraStore()
			const group = useSceneStore().addGroup()
			const renderCam = addRenderCamera(group)

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('finds a render camera nested several groups deep', () => {
			const store = useCameraStore()
			const sceneStore = useSceneStore()
			const outer = sceneStore.addGroup()
			const inner = sceneStore.addGroup()
			sceneStore.moveObjectToTarget(inner.uuid, outer.uuid)
			const renderCam = addRenderCamera(inner)

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('applies the same filter at depth as it does at the top level', () => {
			const store = useCameraStore()
			const group = useSceneStore().addGroup()
			const renderCam = addRenderCamera(group)
			addPlainCamera(group)
			addMesh(group)

			expect(store.renderCameraList).toEqual([renderCam])
		})

		it('lists top-level and nested render cameras together', () => {
			const store = useCameraStore()
			const topCam = addRenderCamera()
			const group = useSceneStore().addGroup()
			const nestedCam = addRenderCamera(group)

			expect(store.renderCameraList).toEqual([topCam, nestedCam])
		})
	})
})
