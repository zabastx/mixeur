import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowReactive } from 'vue'
import THREE from '@/shared/three'

/**
 * The stores this one reads are mocked as reactive objects rather than plain
 * ones: `useUvStore` watches the selection and the workspace, and a plain
 * object would make those watches silently inert.
 */
const holders = vi.hoisted(() => ({
	selection: null as unknown as { selectedObject: THREE.Object3D | null; refresh: () => void },
	shading: null as unknown as {
		shadingMode: string
		getMaterialCache: ReturnType<typeof vi.fn>
		setMode: ReturnType<typeof vi.fn>
	},
	workspace: null as unknown as { current: string }
}))

vi.mock('./selection', () => ({ useSelectionStore: () => holders.selection }))
vi.mock('./shading', () => ({ useShadingStore: () => holders.shading }))
vi.mock('./workspace', () => ({ useWorkspaceStore: () => holders.workspace }))

import { useUvStore } from './uv'

function makeMesh() {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	holders.shading.getMaterialCache.mockReturnValue({ original: mesh.material })
	return mesh
}

describe('useUvStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		holders.selection = shallowReactive({ selectedObject: null, refresh: vi.fn() })
		holders.shading = shallowReactive({
			shadingMode: 'solid',
			getMaterialCache: vi.fn(),
			setMode: vi.fn((mode: string) => {
				holders.shading.shadingMode = mode
			})
		})
		holders.workspace = shallowReactive({ current: 'uv' })
	})

	describe('toggleGrid', () => {
		it('borrows a shading mode that hides maps, and hands it back', async () => {
			// Solid shading ignores maps, so the grid would appear to do nothing.
			// Switching for it is fine; keeping the switch after the grid is gone
			// leaves the viewport somewhere the user never put it.
			const store = useUvStore()
			holders.selection.selectedObject = makeMesh()
			await nextTick()

			store.toggleGrid()
			expect(holders.shading.shadingMode).toBe('preview')

			store.toggleGrid()
			expect(holders.shading.shadingMode).toBe('solid')
		})

		it('leaves a mode the user chose while the grid was on', async () => {
			const store = useUvStore()
			holders.selection.selectedObject = makeMesh()
			await nextTick()

			store.toggleGrid()
			holders.shading.shadingMode = 'rendered'
			store.toggleGrid()

			expect(holders.shading.shadingMode).toBe('rendered')
		})

		it('does not touch a mode that already shows maps', async () => {
			const store = useUvStore()
			holders.shading.shadingMode = 'rendered'
			holders.selection.selectedObject = makeMesh()
			await nextTick()

			store.toggleGrid()
			store.toggleGrid()

			expect(holders.shading.setMode).not.toHaveBeenCalled()
		})

		it('puts the material back the way it was', async () => {
			const store = useUvStore()
			const mesh = makeMesh()
			const original = (mesh.material as THREE.MeshStandardMaterial).map
			holders.selection.selectedObject = mesh
			await nextTick()

			store.toggleGrid()
			expect(store.hasGrid).toBe(true)
			expect((mesh.material as THREE.MeshStandardMaterial).map).not.toBe(original)

			store.toggleGrid()
			expect(store.hasGrid).toBe(false)
			expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(original)
		})
	})

	describe('the layout watcher', () => {
		it('builds a layout for the selected mesh', async () => {
			const store = useUvStore()
			holders.selection.selectedObject = makeMesh()
			await nextTick()

			expect(store.status).toBe('ready')
			expect(store.layout?.islandCount).toBe(6)
		})

		it('stays out of the way while another workspace is on screen', async () => {
			// Building a layout for a dense mesh is not free, and nothing outside
			// the UV workspace reads one.
			holders.workspace.current = 'layout'
			const store = useUvStore()
			holders.selection.selectedObject = makeMesh()
			await nextTick()

			expect(store.layout).toBeNull()

			holders.workspace.current = 'uv'
			await nextTick()

			expect(store.layout).not.toBeNull()
		})
	})

	describe('forget', () => {
		it('drops the UVs remembered for a mesh that has gone', async () => {
			const store = useUvStore()
			const mesh = makeMesh()
			holders.selection.selectedObject = mesh
			await nextTick()
			store.apply({ translate: [0.25, 0] }, 'Moved')

			store.forget(mesh.uuid)
			const moved = Float32Array.from(mesh.geometry.attributes.uv.array)
			store.reset()

			// Nothing left to restore, so `reset` is a no-op rather than a revert.
			expect(Float32Array.from(mesh.geometry.attributes.uv.array)).toEqual(moved)
		})
	})
})
