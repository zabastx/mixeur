import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import THREE from '@/shared/three'
import type { LoadResult } from '@/shared/lib/asset-source'
import { useWorldStore } from './world'
import {
	defaultWorld,
	MAX_BLURRINESS,
	VIEWPORT_BACKDROP,
	type WorldSnapshot,
	type WorldSource
} from './types/world'

// PMREM filtering needs a renderer, which no unit test has. Standing in for it
// keeps the environment's *lifecycle* testable — when it is built, when it is
// rebuilt, when it is released, and whether it was ours to release — which is
// where the bugs live.
// Distinct objects on purpose: a preset's filtered map and its image are not
// interchangeable, and the tests below say which belongs where.
const {
	fakeEnvMap,
	fakePreset,
	fakePresetImage,
	fakeHdri,
	fakeHdriEnvMap,
	loadEnvironmentTextures
} = vi.hoisted(() => ({
	fakeEnvMap: { dispose: () => {} } as THREE.Texture,
	fakePreset: { dispose: () => {}, name: 'forest-envmap' } as THREE.Texture,
	fakePresetImage: { dispose: () => {}, name: 'forest-image' } as THREE.Texture,
	fakeHdri: { dispose: () => {}, name: 'downloaded-hdri' } as THREE.Texture,
	fakeHdriEnvMap: { dispose: () => {}, name: 'downloaded-hdri-envmap' } as THREE.Texture,
	loadEnvironmentTextures:
		vi.fn<
			(source: unknown) => Promise<LoadResult<{ envMap: THREE.Texture; image: THREE.Texture }>>
		>()
}))

let envMapCalls = 0
let colorDisposed = false
let presetDisposed = false
let hdriDisposed = false
let hdriEnvMapDisposed = false

vi.mock('@/shared/three/utils', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/shared/three/utils')>()),
	textureToEnvMap: () => {
		envMapCalls++
		return fakeEnvMap
	}
}))

vi.mock('@/shared/three/modules/loaders/studio-light', () => ({
	STUDIO_LIGHTS: ['forest', 'city'],
	loadStudioLightTextures: vi.fn(async () => ({
		ok: true,
		value: { envMap: fakePreset, image: fakePresetImage }
	}))
}))

vi.mock('@/shared/three/modules/loaders', () => ({ loadEnvironmentTextures }))

/** A Poly Haven Source, as the HDRI browser hands one back. */
const KLOOFENDAL: WorldSource = {
	kind: 'polyhaven',
	id: 'kloofendal_43d_clear',
	name: 'Kloofendal 43d Clear',
	resolution: '2k',
	url: 'https://example.com/kloofendal_2k.hdr',
	size: 2048
}

type World = ReturnType<typeof useWorldStore>

/** Points the Surface at a bundled preset, the way the thumbnail picker does. */
function setPreset(world: World, name: 'forest' | 'city') {
	world.setSource({ kind: 'preset', name })
}

/** Sets a colour Surface, narrowing the union the way the panel's `v-if` does. */
function setColor(world: World, color: string) {
	world.setSurfaceKind('color')
	if (world.surface.kind !== 'color') throw new Error('expected a colour Surface')
	world.surface.color = color
}

function backgroundHex(world: World): string {
	const value = world.background()
	if (!(value instanceof THREE.Color)) throw new Error('expected a colour background')
	return value.getHexString()
}

describe('useWorldStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		envMapCalls = 0
		colorDisposed = false
		presetDisposed = false
		hdriDisposed = false
		hdriEnvMapDisposed = false
		fakeEnvMap.dispose = () => {
			colorDisposed = true
		}
		fakePreset.dispose = () => {
			presetDisposed = true
		}
		fakeHdri.dispose = () => {
			hdriDisposed = true
		}
		fakeHdriEnvMap.dispose = () => {
			hdriEnvMapDisposed = true
		}
		loadEnvironmentTextures.mockClear()
		loadEnvironmentTextures.mockResolvedValue({
			ok: true,
			value: { envMap: fakeHdriEnvMap, image: fakeHdri }
		})
	})

	describe('environment', () => {
		it('is not built on construction, when no renderer exists yet', () => {
			const world = useWorldStore()

			expect(envMapCalls).toBe(0)
			expect(world.environment).toBeNull()
		})

		it('is built when the viewport asks, once it has a renderer', async () => {
			const world = useWorldStore()

			await world.rebuildEnvironment()

			expect(envMapCalls).toBe(1)
			expect(world.environment).toBe(fakeEnvMap)
		})

		it('rebuilds when the Surface changes, so the light follows the colour', async () => {
			const world = useWorldStore()
			await world.rebuildEnvironment()

			setColor(world, '#00ff00')
			await nextTick()
			await world.rebuildEnvironment()

			expect(envMapCalls).toBeGreaterThan(1)
		})

		it('releases the map on dispose, so it cannot outlive its renderer', async () => {
			const world = useWorldStore()
			await world.rebuildEnvironment()

			world.dispose()

			expect(colorDisposed).toBe(true)
			expect(world.environment).toBeNull()
		})
	})

	describe('preset Surfaces', () => {
		it('lights from the bundled preset the Source names', async () => {
			const world = useWorldStore()

			setPreset(world, 'forest')
			await world.rebuildEnvironment()

			expect(world.environment).toBe(fakePreset)
			expect(world.surface).toEqual({ kind: 'texture', source: { kind: 'preset', name: 'forest' } })
		})

		it('shows the unfiltered image behind the scene, not the map it lights with', async () => {
			const world = useWorldStore()

			setPreset(world, 'forest')
			await world.rebuildEnvironment()

			// The filtered map's mips are a roughness ladder. Drawn as a backdrop it
			// is permanently soft, and `backgroundBlurriness` reaches a flat wash a
			// third of the way along its range.
			expect(world.background()).toBe(fakePresetImage)
			expect(world.background()).not.toBe(world.environment)
		})

		it('never disposes a preset, which the studio light picker also shows', async () => {
			const world = useWorldStore()
			setPreset(world, 'forest')
			await world.rebuildEnvironment()

			setColor(world, '#ff0000')
			await world.rebuildEnvironment()
			world.dispose()

			expect(presetDisposed).toBe(false)
		})

		it('disposes the colour map it owns when a preset replaces it', async () => {
			const world = useWorldStore()
			await world.rebuildEnvironment()

			setPreset(world, 'forest')
			await world.rebuildEnvironment()

			expect(colorDisposed).toBe(true)
			expect(world.environment).toBe(fakePreset)
		})

		it('keeps the last Surface asked for when two builds overlap', async () => {
			const world = useWorldStore()

			setPreset(world, 'forest')
			const slow = world.rebuildEnvironment()
			setColor(world, '#ff0000')
			const fast = world.rebuildEnvironment()
			await Promise.all([slow, fast])

			// The colour was chosen last, so the colour is what lights the scene —
			// whichever load happened to resolve first.
			expect(world.environment).toBe(fakeEnvMap)
		})
	})

	describe('Poly Haven Surfaces', () => {
		it('downloads the file the Source names', async () => {
			const world = useWorldStore()

			world.setSource(KLOOFENDAL)
			await world.rebuildEnvironment()

			// Size and all: the progress bar can be sized before the transfer starts.
			expect(loadEnvironmentTextures).toHaveBeenCalledWith({
				url: KLOOFENDAL.url,
				size: KLOOFENDAL.size
			})
		})

		it('lights from the downloaded image and shows it behind the scene', async () => {
			const world = useWorldStore()

			world.setSource(KLOOFENDAL)
			await world.rebuildEnvironment()

			expect(world.environment).toBe(fakeHdriEnvMap)
			expect(world.background()).toBe(fakeHdri)
		})

		it('disposes both textures the moment another Surface replaces it', async () => {
			const world = useWorldStore()
			world.setSource(KLOOFENDAL)
			await world.rebuildEnvironment()

			setPreset(world, 'forest')
			await world.rebuildEnvironment()

			// Single-reference, unlike a preset: nothing else holds the download, and
			// a session spent browsing HDRIs otherwise leaks in proportion to
			// curiosity. Both halves go: the image behind the scene and the map
			// filtered from it.
			expect(hdriDisposed).toBe(true)
			expect(hdriEnvMapDisposed).toBe(true)
		})

		it('drops a download that lost the race rather than the Surface that won', async () => {
			const world = useWorldStore()

			world.setSource(KLOOFENDAL)
			const slow = world.rebuildEnvironment()
			setColor(world, '#ff0000')
			const fast = world.rebuildEnvironment()
			await Promise.all([slow, fast])

			expect(hdriDisposed).toBe(true)
			expect(hdriEnvMapDisposed).toBe(true)
			expect(world.environment).toBe(fakeEnvMap)
			expect(world.background()).toBeInstanceOf(THREE.Color)
		})

		it('leaves the World unlit when the download fails', async () => {
			loadEnvironmentTextures.mockResolvedValue({ ok: false, error: new Error('offline') })
			const world = useWorldStore()

			world.setSource(KLOOFENDAL)
			await world.rebuildEnvironment()

			// The loader has already told the user; a World that throws here would
			// take the panel down with it.
			expect(world.environment).toBeNull()
			expect(world.background()).toBeNull()
		})

		it('round-trips through a project file, so it fetches itself again on reopen', () => {
			const world = useWorldStore()
			world.setSource(KLOOFENDAL)

			const saved = JSON.parse(JSON.stringify(world.snapshot())) as WorldSnapshot
			setColor(world, '#000000')
			world.restore(saved)

			expect(world.surface).toEqual({ kind: 'texture', source: KLOOFENDAL })
		})
	})

	describe('surface', () => {
		it('defaults to the viewport backdrop, so a new project looks unchanged', () => {
			const world = useWorldStore()

			expect(world.surface).toEqual({ kind: 'color', color: VIEWPORT_BACKDROP })
			expect(backgroundHex(world)).toBe(new THREE.Color(VIEWPORT_BACKDROP).getHexString())
		})

		it('reports the chosen colour as the scene background', () => {
			const world = useWorldStore()

			setColor(world, '#ff0000')

			expect(backgroundHex(world)).toBe('ff0000')
		})

		it('scales a colour backdrop by strength, so showing and lighting agree', () => {
			const world = useWorldStore()
			setColor(world, '#808080')

			world.strength = 0.5

			// Three.js clears a colour background straight to the framebuffer and
			// ignores `backgroundIntensity`, so strength has to be baked in here or
			// the Surface lights at strength while showing at 1.
			const value = world.background()
			if (!(value instanceof THREE.Color)) throw new Error('expected a colour background')
			expect(value.r).toBeCloseTo(new THREE.Color('#808080').r * 0.5)
		})
	})

	describe('fog', () => {
		it('is off by default and produces no scene fog', () => {
			const world = useWorldStore()

			expect(world.fog.kind).toBe('none')
			expect(world.sceneFog()).toBeNull()
		})

		it('builds a linear fog from near and far', () => {
			const world = useWorldStore()

			world.setFogKind('linear')
			if (world.fog.kind !== 'linear') throw new Error('expected linear fog')
			world.fog.near = 5
			world.fog.far = 50

			const fog = world.sceneFog()
			expect(fog).toBeInstanceOf(THREE.Fog)
			expect((fog as THREE.Fog).near).toBe(5)
			expect((fog as THREE.Fog).far).toBe(50)
		})

		it('builds an exponential fog from density', () => {
			const world = useWorldStore()

			world.setFogKind('exp2')
			if (world.fog.kind !== 'exp2') throw new Error('expected exp2 fog')
			world.fog.density = 0.5

			const fog = world.sceneFog()
			expect(fog).toBeInstanceOf(THREE.FogExp2)
			expect((fog as THREE.FogExp2).density).toBe(0.5)
		})

		it('leaves the fog alone when set to the kind it already is', () => {
			const world = useWorldStore()
			world.setFogKind('linear')
			if (world.fog.kind !== 'linear') throw new Error('expected linear fog')
			world.fog.near = 42

			world.setFogKind('linear')

			expect(world.fog).toMatchObject({ kind: 'linear', near: 42 })
		})
	})

	describe('snapshot / restore', () => {
		it('round-trips a colour World through a plain object', () => {
			const world = useWorldStore()
			setColor(world, '#123456')
			world.strength = 2.5
			world.setFogKind('exp2')

			const saved = JSON.parse(JSON.stringify(world.snapshot())) as WorldSnapshot
			setColor(world, '#000000')
			world.strength = 1
			world.setFogKind('none')

			world.restore(saved)

			expect(world.surface).toEqual({ kind: 'color', color: '#123456' })
			expect(world.strength).toBe(2.5)
			expect(world.fog.kind).toBe('exp2')
		})

		it('round-trips a preset World, blurriness and rotation', () => {
			const world = useWorldStore()
			setPreset(world, 'city')
			world.blurriness = 0.15
			world.rotation.y = 1.25

			const saved = JSON.parse(JSON.stringify(world.snapshot())) as WorldSnapshot
			world.restore(defaultWorld())
			world.restore(saved)

			expect(world.surface).toEqual({ kind: 'texture', source: { kind: 'preset', name: 'city' } })
			expect(world.blurriness).toBe(0.15)
			expect(world.rotation.y).toBeCloseTo(1.25)
		})

		it('snapshots by value, so later edits do not reach a saved copy', () => {
			const world = useWorldStore()
			setPreset(world, 'forest')

			const saved = world.snapshot()
			setPreset(world, 'city')
			world.rotation.x = 2

			expect(saved.surface).toEqual({ kind: 'texture', source: { kind: 'preset', name: 'forest' } })
			expect(saved.rotation).toEqual([0, 0, 0])
		})

		it('clamps a blurriness the control could never reach', () => {
			const world = useWorldStore()

			world.restore({ ...defaultWorld(), blurriness: 0.9 })

			expect(world.blurriness).toBe(MAX_BLURRINESS)
		})

		it('falls back to the default World for a project saved before it existed', () => {
			const world = useWorldStore()
			setColor(world, '#ff0000')
			world.strength = 9
			world.blurriness = 0.5
			world.setFogKind('linear')

			world.restore(undefined)

			expect(world.surface).toEqual({ kind: 'color', color: VIEWPORT_BACKDROP })
			expect(world.strength).toBe(1)
			expect(world.blurriness).toBe(0)
			expect(world.fog.kind).toBe('none')
		})
	})
})
