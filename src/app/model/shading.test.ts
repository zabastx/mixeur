import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'

const sceneStoreMock = vi.hoisted(() => ({
	scene: null as unknown as THREE.Scene,
	updateScene: vi.fn()
}))

vi.mock('./scene', () => ({
	useSceneStore: () => sceneStoreMock
}))

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	loadStudioLight: vi.fn().mockResolvedValue({ ok: false, error: new Error('not loaded in tests') })
}))

import { useShadingStore } from './shading'
import { useWorldStore } from './world'
import { VIEWPORT_BACKDROP } from './types/world'

function background(): string {
	const value = sceneStoreMock.scene.background
	if (!(value instanceof THREE.Color)) throw new Error('expected a colour background')
	return value.getHexString()
}

function makeShadableMesh(name = 'Mesh', color = 0xff0000) {
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color }))
	mesh.name = name
	getUserData(mesh).isShadable = true
	getUserData(mesh).userVisible = true
	return mesh
}

describe('useShadingStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		sceneStoreMock.scene = new THREE.Scene()
		sceneStoreMock.updateScene = vi.fn()
	})

	describe('cacheNewObjectMaterials / getMaterialCache', () => {
		it('caches materials for shadable meshes and applies the current mode', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			sceneStoreMock.scene.add(mesh)

			store.cacheNewObjectMaterials(mesh)
			const cache = store.getMaterialCache(mesh)

			expect(cache).toBeDefined()
			expect(cache?.wireframe).toBeInstanceOf(THREE.MeshBasicMaterial)
			expect(cache?.solid).toBeInstanceOf(THREE.MeshLambertMaterial)
			// default mode is 'solid'
			expect(mesh.material).toBe(cache?.solid)
		})

		it('does not cache meshes that are not marked shadable', () => {
			const store = useShadingStore()
			const plain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial())
			sceneStoreMock.scene.add(plain)

			store.cacheNewObjectMaterials(plain)

			expect(store.getMaterialCache(plain)).toBeUndefined()
		})
	})

	describe('setMode', () => {
		it('is a no-op when the mode is unchanged', () => {
			const store = useShadingStore()
			store.setMode('solid')
			expect(sceneStoreMock.updateScene).not.toHaveBeenCalled()
		})

		it('switches a cached mesh material when the mode changes', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			sceneStoreMock.scene.add(mesh)
			store.cacheNewObjectMaterials(mesh)
			const cache = store.getMaterialCache(mesh)!

			store.setMode('wireframe')

			expect(store.shadingMode).toBe('wireframe')
			expect(mesh.material).toBe(cache.wireframe)
			expect(sceneStoreMock.updateScene).toHaveBeenCalled()
		})

		it('hides objects whose hideInModes includes the mode and restores the rest', () => {
			const store = useShadingStore()
			const hidden = new THREE.Object3D()
			getUserData(hidden).hideInModes = ['wireframe']
			getUserData(hidden).userVisible = true
			const shown = new THREE.Object3D()
			getUserData(shown).userVisible = true
			sceneStoreMock.scene.add(hidden, shown)

			store.setMode('wireframe')

			expect(hidden.visible).toBe(false)
			expect(shown.visible).toBe(true)
		})

		it('clears scene.environment outside preview mode', () => {
			const store = useShadingStore()
			sceneStoreMock.scene.environment = new THREE.Texture()

			store.setMode('rendered')

			expect(sceneStoreMock.scene.environment).toBeNull()
		})
	})

	describe('the World / Studio Light mode table', () => {
		it('paints the World behind the scene in rendered mode only', () => {
			const store = useShadingStore()
			const world = useWorldStore()
			world.surface.color = '#ff0000'

			store.setMode('rendered')
			expect(background()).toBe('ff0000')

			store.setMode('solid')
			expect(background()).toBe(new THREE.Color(VIEWPORT_BACKDROP).getHexString())
		})

		it('reaches renders through export mode as well', () => {
			const store = useShadingStore()
			const world = useWorldStore()
			world.surface.color = '#00ff00'

			store.setMode('export')

			expect(background()).toBe('00ff00')
		})

		it('applies the World fog in rendered mode and clears it elsewhere', () => {
			const store = useShadingStore()
			const world = useWorldStore()
			world.setFogKind('linear')

			store.setMode('rendered')
			expect(sceneStoreMock.scene.fog).toBeInstanceOf(THREE.Fog)

			store.setMode('preview')
			expect(sceneStoreMock.scene.fog).toBeNull()
		})

		it('lights the scene with the World in rendered mode', () => {
			const store = useShadingStore()
			const world = useWorldStore()
			const envMap = new THREE.Texture()
			world.environment = envMap

			store.setMode('rendered')
			expect(sceneStoreMock.scene.environment).toBe(envMap)

			store.setMode('solid')
			expect(sceneStoreMock.scene.environment).toBeNull()
		})

		it('does not let the World strength survive into preview', () => {
			const store = useShadingStore()
			const world = useWorldStore()
			world.strength = 4
			store.studioLightIntensity = 0.5

			store.setMode('rendered')
			expect(sceneStoreMock.scene.environmentIntensity).toBe(4)

			store.setMode('preview')
			expect(sceneStoreMock.scene.environmentIntensity).toBe(0.5)
		})
	})

	describe('setStudioLight', () => {
		it('applies the studio light to the scene once preview mode is active', () => {
			const store = useShadingStore()
			const texture = new THREE.Texture()

			store.setStudioLight(texture)
			expect(store.studioLight).toBe(texture)
			// not applied yet because current mode is 'solid'
			expect(sceneStoreMock.scene.environment).toBeNull()

			store.setMode('preview')
			expect(sceneStoreMock.scene.environment).toBe(texture)
		})
	})

	describe('updateMaterial', () => {
		it('copies Color values and assigns plain props on the cached original', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			sceneStoreMock.scene.add(mesh)
			store.cacheNewObjectMaterials(mesh)
			const original = store.getMaterialCache(mesh)!.original as THREE.MeshStandardMaterial
			const versionBefore = original.version

			store.updateMaterial<THREE.MeshStandardMaterial>(mesh, {
				prop: 'color',
				value: new THREE.Color('#00ff00')
			})
			store.updateMaterial<THREE.MeshStandardMaterial>(mesh, { prop: 'roughness', value: 0.25 })

			expect(original.color.getHexString()).toBe('00ff00')
			expect(original.roughness).toBe(0.25)
			// `needsUpdate` is a write-only setter in three.js; assert the version bump instead.
			expect(original.version).toBeGreaterThan(versionBefore)
		})

		it('is a no-op when the mesh has no cache', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			expect(() =>
				store.updateMaterial<THREE.MeshStandardMaterial>(mesh, { prop: 'roughness', value: 0.5 })
			).not.toThrow()
		})
	})

	describe('changeMaterial', () => {
		it('replaces the cached original and re-applies the current mode', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			sceneStoreMock.scene.add(mesh)
			store.cacheNewObjectMaterials(mesh)
			store.setMode('rendered')

			const newMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff })
			store.changeMaterial(mesh, newMaterial)

			expect(store.getMaterialCache(mesh)?.original).toBe(newMaterial)
			expect(mesh.material).toBe(newMaterial)
		})
	})

	describe('clearMaterialCache', () => {
		it('returns false when nothing is cached for the uuid', () => {
			const store = useShadingStore()
			expect(store.clearMaterialCache('does-not-exist')).toBe(false)
		})

		it('disposes and removes the cache entry', () => {
			const store = useShadingStore()
			const mesh = makeShadableMesh()
			sceneStoreMock.scene.add(mesh)
			store.cacheNewObjectMaterials(mesh)
			const cache = store.getMaterialCache(mesh)!
			const disposeSpy = vi.spyOn(cache.solid as THREE.Material, 'dispose')

			const result = store.clearMaterialCache(mesh.uuid)

			expect(result).toBe(true)
			expect(disposeSpy).toHaveBeenCalled()
			expect(store.getMaterialCache(mesh)).toBeUndefined()
		})
	})
})
