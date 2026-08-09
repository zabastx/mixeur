import THREE from '@/shared/three'
import { textureToEnvMap } from '@/shared/three/utils'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import {
	defaultWorld,
	FOG_KINDS,
	type WorldFog,
	type WorldFogKind,
	type WorldSnapshot,
	type WorldSurface
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
	function rebuildEnvironment() {
		environment.value?.dispose()
		environment.value = buildEnvironment(surface.value)
	}

	/**
	 * The `THREE.Color` for `scene.background`.
	 *
	 * Deliberately not the environment texture: a plain colour renders through a
	 * different path than a PMREM-filtered one, and the World's default has to
	 * look precisely like the hardcoded backdrop it replaced.
	 */
	function background(): THREE.Color {
		return new THREE.Color(surface.value.color)
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

	/** Everything a `.mixeur` file records about the World. */
	function snapshot(): WorldSnapshot {
		return {
			surface: { ...surface.value },
			strength: strength.value,
			fog: { ...fog.value }
		}
	}

	/**
	 * Restores a World from a project file, or resets to the default when the
	 * file predates the World and carries no block.
	 */
	function restore(data: WorldSnapshot | undefined) {
		const fallback = defaultWorld()
		surface.value = data?.surface ? { ...data.surface } : fallback.surface
		strength.value = data?.strength ?? fallback.strength
		fog.value = data?.fog ? { ...data.fog } : fallback.fog
	}

	function dispose() {
		environment.value?.dispose()
		environment.value = null
	}

	return {
		surface,
		strength,
		fog,
		environment,
		background,
		sceneFog,
		rebuildEnvironment,
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

function buildEnvironment(surface: WorldSurface): THREE.Texture | null {
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
	return textureToEnvMap(image)
}

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useWorldStore, import.meta.hot))
}
