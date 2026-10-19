import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import THREE from '@/shared/three'

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: () => Promise.resolve({ ok: false, error: new Error('not loaded in tests') })
}))

import { useSceneStore } from './scene'
import { useUvGridStore } from './uv-grid'
import { useUvStore } from './uv'
import { useWorkspaceStore } from './workspace'

/** Adds a mesh wearing `map`, which selects it, and opens the UV workspace on it. */
async function openInUvEditor(map: THREE.Texture) {
	const uv = useUvStore()
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map }))
	useSceneStore().addObjectToScene(mesh)
	useWorkspaceStore().setWorkspace('uv')
	await nextTick()
	return { uv, mesh }
}

describe('the UV editor’s map image', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	it('is the Material’s map, not the stand-in Solid shows', async () => {
		const image = document.createElement('canvas')
		const { uv } = await openInUvEditor(new THREE.CanvasTexture(image))

		expect(uv.mapImage).toBe(image)
	})

	it('is null for a map a canvas cannot draw', async () => {
		// A compressed texture holds no decodable image.
		const texture = new THREE.Texture()
		texture.image = { width: 4, height: 4, data: new Uint8Array(16) }
		const { uv } = await openInUvEditor(texture)

		expect(uv.mapImage).toBeNull()
	})

	it('shows the grid while the mesh wears it, and the Material’s map once it is off', async () => {
		const image = document.createElement('canvas')
		const { uv, mesh } = await openInUvEditor(new THREE.CanvasTexture(image))
		const grid = useUvGridStore()

		grid.toggle(mesh)
		expect(uv.mapImage).toBe(grid.gridTexture().image)

		grid.toggle(mesh)
		expect(uv.mapImage).toBe(image)
	})
})
