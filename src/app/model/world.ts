import THREE from '@/shared/three'
import { textureToEnvMap } from '@/shared/three/utils'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import {
	VIEWPORT_BACKDROP,
	type WorldFog,
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
	const surface = ref<WorldSurface>({ kind: 'color', color: VIEWPORT_BACKDROP })
	const strength = ref(1)
	const fog = ref<WorldFog>({ kind: 'none' })

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

	watch(surface, rebuildEnvironment, { immediate: true, deep: true })

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

	function setSurfaceColor(color: string) {
		surface.value = { kind: 'color', color }
	}

	function setFogKind(kind: WorldFog['kind']) {
		if (kind === fog.value.kind) return
		fog.value = defaultFog(kind)
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
		surface.value = data?.surface
			? { ...data.surface }
			: { kind: 'color', color: VIEWPORT_BACKDROP }
		strength.value = data?.strength ?? 1
		fog.value = data?.fog ? { ...data.fog } : { kind: 'none' }
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
		setSurfaceColor,
		setFogKind,
		snapshot,
		restore,
		dispose
	}
})

function buildEnvironment(surface: WorldSurface): THREE.Texture | null {
	const color = new THREE.Color(surface.color)
	const pixel = new THREE.DataTexture(
		new Float32Array([color.r, color.g, color.b, 1]),
		1,
		1,
		THREE.RGBAFormat,
		THREE.FloatType
	)
	pixel.needsUpdate = true
	// Consumes and disposes `pixel`. Returns null before a renderer exists —
	// there is no PMREM generator to filter with, and the World simply casts no
	// light until one does.
	return textureToEnvMap(pixel)
}

function defaultFog(kind: WorldFog['kind']): WorldFog {
	switch (kind) {
		case 'none':
			return { kind: 'none' }
		case 'linear':
			return { kind: 'linear', color: VIEWPORT_BACKDROP, near: 1, far: 100 }
		case 'exp2':
			return { kind: 'exp2', color: VIEWPORT_BACKDROP, density: 0.02 }
	}
}

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useWorldStore, import.meta.hot))
}
