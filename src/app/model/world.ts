import THREE from '@/shared/three'
import { textureToEnvMap } from '@/shared/three/utils'
import { loadStudioLightTextures } from '@/shared/three/modules/loaders/studio-light'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, shallowRef, toRaw, watch } from 'vue'
import {
	defaultWorld,
	FOG_KINDS,
	SURFACE_KINDS,
	type StudioLightName,
	type WorldFog,
	type WorldFogKind,
	type WorldSnapshot,
	type WorldSource,
	type WorldSurface,
	type WorldSurfaceKind
} from './types/world'

/**
 * The scene's World — what is behind everything, and the light it casts.
 *
 * The store holds the World's *description*; it does not decide when the World
 * is on screen. That is the shading mode's call, and it lives in `shading.ts`
 * beside the material substitution it belongs with (ADR-0002). What this store
 * publishes is what to write when the World is shown: `background`,
 * `environment`, `strength` and `fog`.
 */
export const useWorldStore = defineStore('world', () => {
	const initial = defaultWorld()
	const surface = ref<WorldSurface>(initial.surface)
	const strength = ref(initial.strength)
	const blurriness = ref(initial.blurriness)
	const rotation = ref(new THREE.Euler(...initial.rotation))
	const fog = ref<WorldFog>(initial.fog)

	/**
	 * The environment map the current Surface lights with, rebuilt whenever the
	 * Surface changes.
	 *
	 * A colour cannot be assigned to `scene.environment` — Three.js lights from
	 * textures only — so a flat colour is PMREM-filtered from a single pixel.
	 * Uniform in every direction is exactly what a colour World means, and one
	 * pixel is the cheapest way to say it.
	 */
	const environment = shallowRef<THREE.Texture | null>(null)

	/**
	 * The unfiltered image behind the scene, for an image Surface.
	 *
	 * Kept apart from `environment` because they are not interchangeable: the
	 * filtered map's mips are a roughness ladder, so using it as the backdrop
	 * makes it permanently soft and leaves `backgroundBlurriness` with almost no
	 * range — a third of the way along it is already a flat wash.
	 */
	const surfaceImage = shallowRef<THREE.Texture | null>(null)

	/**
	 * Whether the current environment map is ours to dispose.
	 *
	 * A colour Surface builds its own and owns it. A preset borrows from the
	 * cache the Studio Light picker reads: disposing that would blank the
	 * popover and every other World that names the same preset.
	 */
	let ownsEnvironment = false

	/**
	 * Which rebuild is the current one.
	 *
	 * Presets load asynchronously, so two quick changes can resolve out of
	 * order and leave the scene lit by the Surface the user moved away from.
	 */
	let rebuildToken = 0

	watch(surface, rebuildEnvironment, { deep: true })

	/**
	 * Builds the environment map for the current Surface.
	 *
	 * Deliberately not called on store creation. PMREM filtering needs a
	 * renderer, and the store is constructed before the viewport has one — a
	 * build at that moment silently yields no environment, and nothing would
	 * rebuild it until the user happened to edit the colour. The viewport calls
	 * this once its renderer exists.
	 */
	async function rebuildEnvironment() {
		const token = ++rebuildToken
		const current = surface.value

		const built =
			current.kind === 'color' ? buildColorEnvironment(current) : await loadSource(current.source)

		if (token !== rebuildToken) {
			// A later Surface won. Drop what this build produced rather than the
			// live one, and only if it was ours to drop.
			if (built.owned) built.texture?.dispose()
			return
		}

		releaseEnvironment()
		environment.value = built.texture
		surfaceImage.value = built.image
		ownsEnvironment = built.owned
	}

	function releaseEnvironment() {
		if (ownsEnvironment) environment.value?.dispose()
		environment.value = null
		surfaceImage.value = null
		ownsEnvironment = false
	}

	/**
	 * What goes behind the scene: the image itself, or the Surface colour.
	 *
	 * A colour Surface deliberately hands back a `THREE.Color` rather than the
	 * flat environment map it lights with. The two render through different
	 * paths, and the World's default has to look precisely like the hardcoded
	 * backdrop it replaced.
	 */
	function background(): THREE.Color | THREE.Texture | null {
		const current = surface.value
		if (current.kind === 'color') return new THREE.Color(current.color)
		return surfaceImage.value
	}

	/** The `THREE.Fog` instance for `scene.fog`, or `null` when fog is off. */
	function sceneFog(): THREE.Fog | THREE.FogExp2 | null {
		const value = fog.value
		switch (value.kind) {
			case 'none':
				return null
			case 'linear':
				return new THREE.Fog(value.color, value.near, value.far)
			case 'exp2':
				return new THREE.FogExp2(value.color, value.density)
		}
	}

	/**
	 * Switches the fog to a different kind, with fresh defaults.
	 *
	 * Actions here change a *kind*, because that replaces the whole value and
	 * the panel cannot do it field by field. Editing fields within a kind is
	 * plain `v-model` against the state, which is why there is no setter for
	 * every number.
	 */
	function setFogKind(kind: WorldFogKind) {
		if (kind === fog.value.kind) return
		fog.value = FOG_KINDS[kind].create()
	}

	/**
	 * Switches the Surface to a different kind, with fresh defaults. Same rule as
	 * `setFogKind`: actions change a kind, `v-model` edits within one.
	 */
	function setSurfaceKind(kind: WorldSurfaceKind) {
		if (kind === surface.value.kind) return
		surface.value = SURFACE_KINDS[kind].create()
	}

	/** Points an image Surface at a different bundled preset. */
	function setPreset(name: StudioLightName) {
		surface.value = { kind: 'texture', source: { kind: 'preset', name } }
	}

	/** Everything a `.mixeur` file records about the World. */
	function snapshot(): WorldSnapshot {
		return {
			surface: structuredClone(toRaw(surface.value)),
			strength: strength.value,
			blurriness: blurriness.value,
			rotation: rotation.value.toArray().slice(0, 3) as [number, number, number],
			fog: { ...fog.value }
		}
	}

	/**
	 * Restores a World from a project file, or resets to the default when the
	 * file predates the World and carries no block.
	 */
	function restore(data: WorldSnapshot | undefined) {
		const fallback = defaultWorld()
		surface.value = data?.surface ? structuredClone(data.surface) : fallback.surface
		strength.value = data?.strength ?? fallback.strength
		blurriness.value = data?.blurriness ?? fallback.blurriness
		rotation.value = new THREE.Euler(...(data?.rotation ?? fallback.rotation))
		fog.value = data?.fog ? { ...data.fog } : fallback.fog
	}

	function dispose() {
		releaseEnvironment()
	}

	return {
		surface,
		strength,
		blurriness,
		rotation,
		fog,
		environment,
		background,
		sceneFog,
		rebuildEnvironment,
		setSurfaceKind,
		setPreset,
		setFogKind,
		snapshot,
		restore,
		dispose
	}
})

/**
 * Width of the equirectangular image a flat colour is painted onto.
 *
 * One pixel would say the same thing and cost less, but `PMREMGenerator` sizes
 * its cube target as `width / 4` and bakes that into `CUBEUV_TEXEL_WIDTH` and
 * friends. Below 4 those come out as integers, and the fragment shader fails to
 * compile for every physical material in the scene. 64 gives the generator the
 * power-of-two 16 it wants.
 */
const COLOR_SURFACE_WIDTH = 64
const COLOR_SURFACE_HEIGHT = COLOR_SURFACE_WIDTH / 2

/**
 * What a Surface resolves to: the map that lights the scene, the image seen
 * behind it, and whether either is the World's to dispose.
 *
 * A colour Surface has no image — it is drawn as a flat `THREE.Color` — so
 * `image` is null and the backdrop comes from the colour itself.
 */
interface BuiltEnvironment {
	texture: THREE.Texture | null
	image: THREE.Texture | null
	owned: boolean
}

/**
 * Resolves an image Surface's Source to a filtered map and the image itself.
 *
 * Presets come from the cache the Studio Light picker shares, so both are
 * borrowed, never owned. A failed load leaves the World unlit rather than
 * throwing: the loader has already told the user.
 */
async function loadSource(source: WorldSource): Promise<BuiltEnvironment> {
	const result = await loadStudioLightTextures(source.name)
	if (!result.ok) return { texture: null, image: null, owned: false }
	return { texture: result.value.envMap, image: result.value.image, owned: false }
}

function buildColorEnvironment(surface: { color: string }): BuiltEnvironment {
	const color = new THREE.Color(surface.color)
	const pixels = new Float32Array(COLOR_SURFACE_WIDTH * COLOR_SURFACE_HEIGHT * 4)
	for (let i = 0; i < pixels.length; i += 4) {
		pixels[i] = color.r
		pixels[i + 1] = color.g
		pixels[i + 2] = color.b
		pixels[i + 3] = 1
	}

	const image = new THREE.DataTexture(
		pixels,
		COLOR_SURFACE_WIDTH,
		COLOR_SURFACE_HEIGHT,
		THREE.RGBAFormat,
		THREE.FloatType
	)
	image.needsUpdate = true
	// Consumes and disposes `image`. Returns null before a renderer exists —
	// there is no PMREM generator to filter with, and the World simply casts no
	// light until one does.
	return { texture: textureToEnvMap(image), image: null, owned: true }
}

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useWorldStore, import.meta.hot))
}
