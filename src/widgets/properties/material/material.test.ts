import { createPinia, setActivePinia } from 'pinia'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'

vi.mock('@/app/model/scene', () => ({
	useSceneStore: () => ({ scene: new THREE.Scene(), updateScene: vi.fn() })
}))

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: vi.fn().mockResolvedValue(null)
}))

import { useShadingStore } from '@/app/model/shading'
import { useSelectionStore } from '@/app/model/selection'
import { useMeshMaterial } from './material'

/**
 * Selects a mesh and seeds the shading cache the way `cacheNewObjectMaterials`
 * would, which is what the material target reads and writes through.
 */
function selectMesh(material: THREE.Material) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material)

	useShadingStore().materialCache.set(mesh.uuid, {
		original: material,
		wireframe: new THREE.MeshBasicMaterial(),
		solid: new THREE.MeshLambertMaterial()
	})
	useSelectionStore().selectedObject = mesh

	return mesh
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
		useSelectionStore().selectedObject = null
		useShadingStore().materialCache.clear()
	})

	it('reads the selected mesh’s cached original material', () => {
		const material = new THREE.MeshStandardMaterial({ roughness: 0.25 })
		selectMesh(material)

		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()

		expect(target.read('roughness')).toBe(0.25)
	})

	it('writes through the shading store rather than replacing the material', () => {
		const material = new THREE.MeshStandardMaterial({ roughness: 0.25 })
		selectMesh(material)

		const version = material.version
		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()
		target.write('roughness', 0.75)

		expect(material.roughness).toBe(0.75)
		// `needsUpdate` is write-only; setting it is what bumps `version`.
		expect(material.version).toBeGreaterThan(version)
	})

	it('copies into the existing Color instead of swapping the instance', () => {
		const material = new THREE.MeshStandardMaterial()
		const color = material.color
		selectMesh(material)

		const target = useMeshMaterial<THREE.MeshStandardMaterial>().createMaterialTarget()
		target.write('color', new THREE.Color('#ff8800'))

		expect(material.color).toBe(color)
		expect(material.color.getHexString()).toBe('ff8800')
	})

	it('makes a toon gradient ramp sample without interpolation', () => {
		const material = new THREE.MeshToonMaterial()
		selectMesh(material)

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
})
