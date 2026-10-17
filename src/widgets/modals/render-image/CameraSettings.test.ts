import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const sceneHolder = vi.hoisted(() => ({
	scene: null as unknown as THREE.Scene,
	sceneChildren: [] as THREE.Object3D[]
}))

// eslint-disable-next-line no-restricted-syntax -- store mock left from before the rule; replace with the real store
vi.mock('@/app/model/scene', () => ({ useSceneStore: () => sceneHolder }))
// eslint-disable-next-line no-restricted-syntax -- store mock left from before the rule; replace with the real store
vi.mock('@/app/model/composer', () => ({ useComposerStore: () => ({ needsResize: false }) }))

import { useCameraStore } from '@/app/model/camera'
import CameraSettings from './CameraSettings.vue'

function addCamera(uuid: string, settings: Partial<THREE.PerspectiveCamera>) {
	const camera = Object.assign(new THREE.PerspectiveCamera(), settings)
	camera.uuid = uuid
	getUserData(camera).isRenderCamera = true
	sceneHolder.scene.add(camera)
	sceneHolder.sceneChildren.push(camera)
	return camera
}

/** The number input that `label` names. */
function field(label: string): HTMLInputElement {
	return screen.getByLabelText<HTMLInputElement>(label)
}

describe('CameraSettings', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		sceneHolder.scene = new THREE.Scene()
		sceneHolder.sceneChildren = []
	})

	it('shows the values of whichever camera is the Render Camera', async () => {
		addCamera('a', { fov: 30, near: 0.5, far: 100, zoom: 1 })
		addCamera('b', { fov: 70, near: 2, far: 500, zoom: 3 })
		const cameraStore = useCameraStore()
		cameraStore.setRenderCamera('a')

		render(CameraSettings)
		expect(field('FOV').value).toBe('30°')

		cameraStore.setRenderCamera('b')
		await nextTick()

		expect(field('FOV').value).toBe('70°')
		expect(field('Clip Start').value).toBe('2.0')
		expect(field('Clip End').value).toBe('500.0')
		expect(field('Zoom').value).toBe('3.00')
	})

	it('changes only the field that was edited', async () => {
		addCamera('a', { fov: 30, near: 0.5, far: 100, zoom: 1 })
		const b = addCamera('b', { fov: 70, near: 2, far: 500, zoom: 3 })
		const cameraStore = useCameraStore()
		cameraStore.setRenderCamera('a')
		render(CameraSettings)

		cameraStore.setRenderCamera('b')
		await nextTick()
		await userEvent.clear(field('Zoom'))
		await userEvent.type(field('Zoom'), '4')
		await userEvent.tab()

		expect(b.zoom).toBe(4)
		expect(b.fov).toBe(70)
		expect(b.near).toBe(2)
		expect(b.far).toBe(500)
	})

	it('updates the projection, so a view through the camera shows the edit at once', async () => {
		const camera = addCamera('a', { fov: 30, near: 0.5, far: 100, zoom: 1 })
		camera.updateProjectionMatrix()
		useCameraStore().setRenderCamera('a')
		render(CameraSettings)

		await userEvent.clear(field('FOV'))
		await userEvent.type(field('FOV'), '60')
		await userEvent.tab()

		const expected = new THREE.PerspectiveCamera(60, camera.aspect, 0.5, 100)
		expect(camera.projectionMatrix.elements).toEqual(expected.projectionMatrix.elements)
	})

	it('keeps the camera as it was when a field is cleared', async () => {
		const camera = addCamera('a', { fov: 30, near: 0.5, far: 100, zoom: 1 })
		useCameraStore().setRenderCamera('a')
		render(CameraSettings)

		await userEvent.clear(field('Clip Start'))
		await userEvent.tab()

		expect(camera.near).toBe(0.5)
		expect(field('Clip Start').value).toBe('0.5')
	})
})
