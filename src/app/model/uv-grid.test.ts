import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowReactive } from 'vue'
import THREE from '@/shared/three'

const holders = vi.hoisted(() => ({
	selection: null as unknown as { refresh: () => void },
	shading: null as unknown as {
		shadingMode: string
		shadedMaterial: ReturnType<typeof vi.fn>
		setMode: ReturnType<typeof vi.fn>
	}
}))

vi.mock('./selection', () => ({ useSelectionStore: () => holders.selection }))
vi.mock('./shading', () => ({ useShadingStore: () => holders.shading }))

import { useUvGridStore } from './uv-grid'

function makeMesh() {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	holders.shading.shadedMaterial.mockReturnValue(mesh.material)
	return mesh
}

describe('useUvGridStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		holders.selection = shallowReactive({ refresh: vi.fn() })
		holders.shading = shallowReactive({
			shadingMode: 'solid',
			shadedMaterial: vi.fn(),
			setMode: vi.fn((mode: string) => {
				holders.shading.shadingMode = mode
			})
		})
	})

	it('puts the material back the way it was', () => {
		const store = useUvGridStore()
		const mesh = makeMesh()
		const original = (mesh.material as THREE.MeshStandardMaterial).map

		store.toggle(mesh)
		expect(store.isApplied(mesh.uuid)).toBe(true)
		expect((mesh.material as THREE.MeshStandardMaterial).map).not.toBe(original)

		store.toggle(mesh)
		expect(store.isApplied(mesh.uuid)).toBe(false)
		expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(original)
	})

	it('borrows a shading mode that hides maps, and hands it back', () => {
		// Solid shading ignores maps, so the grid would appear to do nothing.
		// Switching for it is fine; keeping the switch after the grid is gone
		// leaves the viewport somewhere the user never put it.
		const store = useUvGridStore()
		const mesh = makeMesh()

		store.toggle(mesh)
		expect(holders.shading.shadingMode).toBe('preview')

		store.toggle(mesh)
		expect(holders.shading.shadingMode).toBe('solid')
	})

	it('leaves a mode the user chose while the grid was on', () => {
		const store = useUvGridStore()
		const mesh = makeMesh()

		store.toggle(mesh)
		holders.shading.shadingMode = 'rendered'
		store.toggle(mesh)

		expect(holders.shading.shadingMode).toBe('rendered')
	})

	it('does not touch a mode that already shows maps', () => {
		const store = useUvGridStore()
		holders.shading.shadingMode = 'rendered'
		const mesh = makeMesh()

		store.toggle(mesh)
		store.toggle(mesh)

		expect(holders.shading.setMode).not.toHaveBeenCalled()
	})

	it('tracks each mesh separately', () => {
		const store = useUvGridStore()
		const one = makeMesh()
		store.toggle(one)
		const two = makeMesh()
		store.toggle(two)

		expect(store.isApplied(one.uuid)).toBe(true)
		expect(store.isApplied(two.uuid)).toBe(true)

		store.toggle(one)

		expect(store.isApplied(one.uuid)).toBe(false)
		expect(store.isApplied(two.uuid)).toBe(true)
	})

	it('releases a mesh that has been deleted', () => {
		const store = useUvGridStore()
		const mesh = makeMesh()
		store.toggle(mesh)

		store.forget(mesh.uuid)

		expect(store.isApplied(mesh.uuid)).toBe(false)
		// Toggling again treats it as new rather than restoring a map that
		// belonged to an object no longer in the scene.
		store.toggle(mesh)
		expect(store.isApplied(mesh.uuid)).toBe(true)
	})
})
