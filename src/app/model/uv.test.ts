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
	shading: null as unknown as { shadedMaterial: ReturnType<typeof vi.fn> },
	workspace: null as unknown as { current: string },
	grid: null as unknown as { appliedTo: ReadonlySet<string> }
}))

vi.mock('./selection', () => ({ useSelectionStore: () => holders.selection }))
vi.mock('./shading', () => ({ useShadingStore: () => holders.shading }))
vi.mock('./workspace', () => ({ useWorkspaceStore: () => holders.workspace }))
vi.mock('./uv-grid', () => ({ useUvGridStore: () => holders.grid }))

import { useUvStore } from './uv'

function makeMesh() {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
	holders.shading.shadedMaterial.mockReturnValue(mesh.material)
	return mesh
}

describe('useUvStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		holders.selection = shallowReactive({ selectedObject: null, refresh: vi.fn() })
		holders.shading = shallowReactive({ shadedMaterial: vi.fn() })
		holders.workspace = shallowReactive({ current: 'uv' })
		holders.grid = shallowReactive({ appliedTo: new Set<string>() })
	})

	describe('mapImage', () => {
		it('reads the image off the material the mesh is really shaded with', async () => {
			const store = useUvStore()
			const mesh = makeMesh()
			const canvas = document.createElement('canvas')
			;(mesh.material as THREE.MeshStandardMaterial).map = new THREE.CanvasTexture(canvas)
			holders.selection.selectedObject = mesh
			await nextTick()

			expect(store.mapImage).toBe(canvas)
		})

		it('is null for a map a canvas cannot draw', async () => {
			// A compressed texture holds no decodable image.
			const store = useUvStore()
			const mesh = makeMesh()
			const texture = new THREE.Texture()
			texture.image = { width: 4, height: 4, data: new Uint8Array(16) }
			;(mesh.material as THREE.MeshStandardMaterial).map = texture
			holders.selection.selectedObject = mesh
			await nextTick()

			expect(store.mapImage).toBeNull()
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
