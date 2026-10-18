import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: vi.fn().mockResolvedValue(null)
}))

import { useSceneStore } from '@/app/model/scene'
import { useShadingStore } from '@/app/model/shading'
import { useUvGridStore } from '@/app/model/uv-grid'
import { useMeshMaterial } from './material'

/**
 * Adds a mesh to the scene, which caches its materials in the shading store and
 * selects it, and returns the cached original the material target reads and
 * writes through. The cache holds a clone, not the material the mesh came with.
 */
function selectMeshWith<T extends THREE.Material>(material: T) {
	return selectMesh(material).original
}

/** As `selectMeshWith`, and the mesh itself, for tests that act on it too. */
function selectMesh<T extends THREE.Material>(material: T) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)
	useSceneStore().addObjectToScene(mesh)

	const original = useShadingStore().materialOf(mesh)
	if (!original) throw new Error('addObjectToScene did not cache the mesh’s materials')
	return { mesh, original: original as T }
}

/** The map the viewport is showing on a mesh, whatever stand-in it wears. */
function displayedMap(mesh: THREE.Mesh) {
	if (Array.isArray(mesh.material)) throw new Error('expected a single material')
	return (mesh.material as THREE.MeshStandardMaterial).map
}

describe('createMaterialTarget', () => {
	// One pinia for the whole file: `material.ts` derives the selected mesh and its
	// material from module-level computeds, which every panel shares so that a
	// write in one refreshes the rest. Swapping the pinia per test would leave
	// those computeds subscribed to the discarded store's refs.
	beforeAll(() => {
		setActivePinia(createPinia())
	})

	beforeEach(() => {
		useSceneStore().clearScene()
	})

	it('reads the selected mesh’s cached original material', () => {
		selectMeshWith(new THREE.MeshStandardMaterial({ roughness: 0.25 }))

		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

		expect(target.read('roughness')).toBe(0.25)
	})

	it('writes through the shading store rather than replacing the material', () => {
		const material = selectMeshWith(new THREE.MeshStandardMaterial({ roughness: 0.25 }))

		const version = material.version
		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()
		target.write('roughness', 0.75)

		expect(material.roughness).toBe(0.75)
		// `needsUpdate` is write-only; setting it is what bumps `version`.
		expect(material.version).toBeGreaterThan(version)
	})

	it('copies into the existing Color instead of swapping the instance', () => {
		const material = selectMeshWith(new THREE.MeshStandardMaterial())
		const color = material.color

		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()
		target.write('color', new THREE.Color('#ff8800'))

		expect(material.color).toBe(color)
		expect(material.color.getHexString()).toBe('ff8800')
	})

	it('makes a toon gradient ramp sample without interpolation', () => {
		const material = selectMeshWith(new THREE.MeshToonMaterial())

		const target = useMeshMaterial<THREE.MeshToonMaterial>().createMaterialTarget()
		const gradient = new THREE.Texture()
		target.write('gradientMap', gradient)

		expect(gradient.magFilter).toBe(THREE.NearestFilter)
		expect(gradient.minFilter).toBe(THREE.NearestFilter)
		expect(material.gradientMap).toBe(gradient)
	})

	it('reads undefined and ignores writes while no mesh is selected', () => {
		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

		expect(target.read('roughness')).toBeUndefined()
		expect(() => target.write('roughness', 0.5)).not.toThrow()
	})

	describe('changeMaterial', () => {
		it('releases the Material it replaces', () => {
			const old = selectMeshWith(new THREE.MeshStandardMaterial())
			let released = false
			old.addEventListener('dispose', () => {
				released = true
			})

			useMeshMaterial().changeMaterial(new THREE.MeshPhongMaterial())

			expect(released).toBe(true)
		})

		it('shades the new Material in Solid with its own transparency', () => {
			const mesh = selectMesh(new THREE.MeshStandardMaterial()).mesh
			useShadingStore().setMode('solid')

			useMeshMaterial().changeMaterial(
				new THREE.MeshPhongMaterial({ transparent: true, opacity: 0.5 })
			)

			expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial)
			expect(mesh.material).toMatchObject({ transparent: true, opacity: 0.5 })
		})
	})

	describe('in Solid and Wireframe', () => {
		it.each(['solid', 'wireframe'] as const)(
			'shows a transparency edit on the %s stand-in',
			(mode) => {
				const { mesh } = selectMesh(new THREE.MeshStandardMaterial())
				useShadingStore().setMode(mode)
				const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

				target.write('transparent', true)
				target.write('opacity', 0.25)

				expect(mesh.material).toMatchObject({ transparent: true, opacity: 0.25 })
			}
		)
	})

	describe('while UV Grid is on', () => {
		it('reads the Material’s own map, not the grid', () => {
			const map = new THREE.Texture()
			const { mesh } = selectMesh(new THREE.MeshStandardMaterial({ map }))
			useUvGridStore().toggle(mesh)

			const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

			expect(displayedMap(mesh)).not.toBe(map)
			expect(target.read('map')).toBe(map)
		})

		it('keeps a map chosen while the grid is on once the grid comes off', () => {
			const { mesh } = selectMesh(new THREE.MeshStandardMaterial({ map: new THREE.Texture() }))
			useShadingStore().setMode('rendered')
			const grid = useUvGridStore()
			grid.toggle(mesh)
			const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()
			const chosen = new THREE.Texture()

			target.write('map', chosen)
			grid.toggle(mesh)

			expect(target.read('map')).toBe(chosen)
			expect(displayedMap(mesh)).toBe(chosen)
		})

		it('shows an edit at once and keeps the grid over it', () => {
			const { mesh } = selectMesh(new THREE.MeshStandardMaterial())
			const grid = useUvGridStore()
			grid.toggle(mesh)
			const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

			target.write('color', new THREE.Color('#ff8800'))
			target.write('map', new THREE.Texture())

			expect(mesh.material).toMatchObject({ color: new THREE.Color('#ff8800') })
			expect(displayedMap(mesh)).toBe(grid.gridTexture())
		})
		it('puts a changed Surface under the grid, without the old map', () => {
			const { mesh } = selectMesh(new THREE.MeshStandardMaterial({ map: new THREE.Texture() }))
			useShadingStore().setMode('rendered')
			const grid = useUvGridStore()
			grid.toggle(mesh)

			useMeshMaterial().changeMaterial(new THREE.MeshPhongMaterial())

			expect(mesh.material).toBeInstanceOf(THREE.MeshPhongMaterial)
			expect(displayedMap(mesh)).toBe(grid.gridTexture())
			grid.toggle(mesh)
			expect(displayedMap(mesh)).toBeNull()
		})
	})
})
