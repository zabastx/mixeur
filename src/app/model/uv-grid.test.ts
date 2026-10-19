import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: () => Promise.resolve({ ok: false, error: new Error('not loaded in tests') })
}))

import { useSceneStore } from './scene'
import { useShadingStore } from './shading'
import { useUvGridStore } from './uv-grid'
import { displayedMap, onDispose } from '@/app/test/materials'

/** Adds a textured mesh to the scene, which caches its Material for shading. */
function addMesh() {
	const map = new THREE.Texture()
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }))
	useSceneStore().addObjectToScene(mesh)
	return { mesh, map }
}

describe('useUvGridStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('shows the grid on the mesh and takes it off again', () => {
		const store = useUvGridStore()
		useShadingStore().setMode('rendered')
		const { mesh, map } = addMesh()

		store.toggle(mesh)
		expect(store.isApplied(mesh.uuid)).toBe(true)
		expect(displayedMap(mesh)).toBe(store.gridTexture())

		store.toggle(mesh)
		expect(store.isApplied(mesh.uuid)).toBe(false)
		expect(mesh.material).toBe(useShadingStore().materialOf(mesh))
		expect(displayedMap(mesh)).toBe(map)
	})

	it.each(['preview', 'rendered'] as const)(
		'restores the Material after shading reinitializes with UV Grid on in %s',
		(mode) => {
			const store = useUvGridStore()
			const shading = useShadingStore()
			shading.init()
			shading.setMode(mode)
			const { mesh, map } = addMesh()
			const material = shading.materialOf(mesh)
			store.toggle(mesh)

			shading.init()
			store.toggle(mesh)

			expect(shading.materialOf(mesh)).toBe(material)
			expect(mesh.material).toBe(material)
			expect(displayedMap(mesh)).toBe(map)
		}
	)

	it('leaves the Material’s own map in place while the grid is on', () => {
		const store = useUvGridStore()
		const { mesh, map } = addMesh()

		store.toggle(mesh)

		expect(useShadingStore().materialOf(mesh)).toMatchObject({ map })
	})

	it.each(['solid', 'wireframe'] as const)(
		'borrows %s shading, which hides maps, and hands it back',
		(mode) => {
			// Flat shading ignores maps, so the grid would appear to do nothing.
			// Switching for it is fine; keeping the switch after the grid is gone
			// leaves the viewport somewhere the user never put it.
			const store = useUvGridStore()
			const shading = useShadingStore()
			shading.setMode(mode)
			const { mesh } = addMesh()

			store.toggle(mesh)
			expect(shading.shadingMode).toBe('preview')
			expect(displayedMap(mesh)).toBe(store.gridTexture())

			store.toggle(mesh)
			expect(shading.shadingMode).toBe(mode)
		}
	)

	it('leaves a mode the user chose while the grid was on', () => {
		const store = useUvGridStore()
		const shading = useShadingStore()
		const { mesh } = addMesh()

		store.toggle(mesh)
		shading.setMode('rendered')
		store.toggle(mesh)

		expect(shading.shadingMode).toBe('rendered')
	})

	it('does not touch a mode that already shows maps', () => {
		const store = useUvGridStore()
		const shading = useShadingStore()
		shading.setMode('rendered')
		const { mesh } = addMesh()
		const modes: string[] = []
		const stop = shading.$onAction(({ name, args }) => {
			if (name === 'setMode') modes.push(args[0])
		})

		store.toggle(mesh)
		store.toggle(mesh)
		stop()

		expect(modes).toEqual([])
	})

	it('tracks each mesh separately', () => {
		const store = useUvGridStore()
		useShadingStore().setMode('rendered')
		const one = addMesh()
		store.toggle(one.mesh)
		const two = addMesh()
		store.toggle(two.mesh)

		expect(store.isApplied(one.mesh.uuid)).toBe(true)
		expect(store.isApplied(two.mesh.uuid)).toBe(true)

		store.toggle(one.mesh)

		expect(store.isApplied(one.mesh.uuid)).toBe(false)
		expect(displayedMap(one.mesh)).toBe(one.map)
		expect(store.isApplied(two.mesh.uuid)).toBe(true)
		expect(displayedMap(two.mesh)).toBe(store.gridTexture())
	})

	it('releases a mesh that has been deleted', () => {
		const store = useUvGridStore()
		const { mesh } = addMesh()
		store.toggle(mesh)

		useSceneStore().deleteFromScene(mesh.uuid)

		expect(store.isApplied(mesh.uuid)).toBe(false)
	})

	it('forgets the borrowed mode with the last mesh that wore the grid', () => {
		// The deleted mesh borrowed Solid; a later grid, put on in Preview,
		// borrowed nothing and has nothing to hand back.
		const store = useUvGridStore()
		const shading = useShadingStore()
		const first = addMesh()
		store.toggle(first.mesh)
		useSceneStore().deleteFromScene(first.mesh.uuid)
		const second = addMesh()

		store.toggle(second.mesh)
		store.toggle(second.mesh)

		expect(shading.shadingMode).toBe('preview')
	})

	it('releases the grid’s stand-in when the grid comes off', () => {
		const store = useUvGridStore()
		const { mesh } = addMesh()
		store.toggle(mesh)
		const standIn = mesh.material
		const released = onDispose(standIn)

		store.toggle(mesh)

		expect(released).toEqual([standIn])
	})

	it('releases the grid’s stand-in with a mesh deleted while it shows Solid', () => {
		// Deleting a mesh releases what it displays, which in Solid is not the
		// grid's stand-in; the shading cache has to release that one itself.
		const store = useUvGridStore()
		const { mesh } = addMesh()
		store.toggle(mesh)
		const standIn = mesh.material
		const released = onDispose(standIn)
		useShadingStore().setMode('solid')

		useSceneStore().deleteFromScene(mesh.uuid)

		expect(released).toEqual([standIn])
	})
})
