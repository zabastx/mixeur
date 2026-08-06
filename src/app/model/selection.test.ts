import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { watchEffect } from 'vue'
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
	useComposerStore: () => ({ setOutlineObjects: composerHolder.setOutlineObjects })
}))

import { useSelectionStore } from './selection'

describe('useSelectionStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		sceneHolder.scene = new THREE.Scene()
		controlsHolder.transformControls = { attach: vi.fn(), detach: vi.fn() }
		composerHolder.setOutlineObjects = vi.fn()
	})

	describe('select', () => {
		it('selects a mesh, attaches controls, and outlines it', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh()

			store.select(mesh)

			expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(mesh)
			expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([mesh])
			expect(store.selectedObject).toBe(mesh)
		})

		it('resolves a string uuid against the scene', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh()
			mesh.uuid = 'mesh-uuid'
			sceneHolder.scene.add(mesh)

			store.select('mesh-uuid')

			expect(store.selectedObject).toBe(mesh)
		})

		it('leaves the selection untouched when the uuid is unknown', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh()
			store.select(mesh)

			store.select('no-such-uuid')

			expect(store.selectedObject).toBe(mesh)
		})

		it('clears the selection when called with no target', () => {
			const store = useSelectionStore()
			store.select(new THREE.Mesh())

			store.select()

			expect(store.selectedObject).toBeNull()
		})

		it('ignores raycasted objects that are not selectable', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh() // no userData.isSelectable

			store.select(mesh, { fromRaycast: true })

			expect(store.selectedObject).toBeNull()
			expect(controlsHolder.transformControls.attach).not.toHaveBeenCalled()
		})

		it('accepts raycasted objects flagged as selectable', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh()
			getUserData(mesh).isSelectable = true

			store.select(mesh, { fromRaycast: true })

			expect(store.selectedObject).toBe(mesh)
		})

		it('selects objects from the outliner regardless of isSelectable', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh() // no userData.isSelectable

			store.select(mesh)

			expect(store.selectedObject).toBe(mesh)
		})
	})

	describe('lights and cameras', () => {
		it('attaches the light itself and outlines its helper', () => {
			const store = useSelectionStore()
			const light = new THREE.PointLight()
			const helper = new THREE.PointLightHelper(light)
			sceneHolder.scene.add(helper)

			store.select(light)

			expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(light)
			expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([helper])
			expect(store.selectedObject).toBe(light)
		})

		it('outlines nothing when a light has no helper', () => {
			const store = useSelectionStore()
			const light = new THREE.PointLight()

			store.select(light)

			expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([])
			expect(store.selectedObject).toBe(light)
		})

		it('attaches the camera itself when a camera is selected', () => {
			const store = useSelectionStore()
			const camera = new THREE.PerspectiveCamera()

			store.select(camera)

			expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(camera)
			expect(store.selectedObject).toBe(camera)
		})

		it('attaches the inner light and outlines the helper for a light helper', () => {
			const store = useSelectionStore()
			const innerLight = new THREE.PointLight()
			const helper = new THREE.Object3D() as THREE.Object3D & { light: THREE.Light }
			helper.light = innerLight

			store.select(helper)

			expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(innerLight)
			expect(composerHolder.setOutlineObjects).toHaveBeenCalledWith([helper])
			expect(store.selectedObject).toBe(innerLight)
		})

		it('promotes a helper part to the light it belongs to', () => {
			const store = useSelectionStore()
			const innerLight = new THREE.PointLight()
			const helper = new THREE.Object3D() as THREE.Object3D & { light: THREE.Light }
			helper.light = innerLight

			const part = new THREE.Mesh()
			getUserData(part).skipRaycast = true
			helper.add(part)

			store.select(part)

			expect(controlsHolder.transformControls.attach).toHaveBeenCalledWith(innerLight)
			expect(store.selectedObject).toBe(innerLight)
		})
	})

	describe('clear', () => {
		it('detaches the gizmo, empties the outline, and nulls the selection', () => {
			const store = useSelectionStore()
			store.select(new THREE.Mesh())

			store.clear()

			expect(controlsHolder.transformControls.detach).toHaveBeenCalled()
			expect(composerHolder.setOutlineObjects).toHaveBeenLastCalledWith([])
			expect(store.selectedObject).toBeNull()
		})
	})

	describe('refresh', () => {
		it('republishes the selection after an in-place mutation', () => {
			const store = useSelectionStore()
			const mesh = new THREE.Mesh()
			store.select(mesh)

			// The selection is a shallowRef, so mutating the object it points at is
			// invisible until refresh() republishes it. A comparing watcher would
			// never see this — only a re-running effect does.
			const positions: number[] = []
			watchEffect(
				() => {
					const x = store.selectedObject?.position.x
					if (x !== undefined) positions.push(x)
				},
				{ flush: 'sync' }
			)

			mesh.position.x = 5
			store.refresh()

			expect(positions).toEqual([0, 5])
		})
	})
})
