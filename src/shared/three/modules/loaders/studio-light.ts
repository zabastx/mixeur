import THREE from '@/shared/three'
import { loaded, type LoadResult } from '@/shared/lib/asset-source'
import { disposeEnvMap } from '@/shared/three/utils'
import { loadEnvironmentTextures, type EnvironmentTextures } from '.'

const studioLightCache = new Map<string, EnvironmentTextures>()

export function disposeStudioLightCache() {
	studioLightCache.forEach(({ envMap, image }) => {
		// The filtered map is a PMREM render target's texture; disposing the
		// texture alone would leave its framebuffer allocated.
		disposeEnvMap(envMap)
		image.dispose()
	})
	studioLightCache.clear()
}

/**
 * Loads one of the bundled images, filtered and unfiltered, from a single
 * fetch. Cached by name — a repeat request returns what was already built.
 *
 * A studio light is the editor's preview rig, not the scene's World: it is never
 * saved with a project and never reaches a render. The same files are also
 * offered as World presets, and this cache is shared — see ADR-0002. Nothing
 * outside here may dispose what it hands back.
 */
export async function loadStudioLightTextures(
	name: StudioLightName
): Promise<LoadResult<EnvironmentTextures>> {
	const cached = studioLightCache.get(name)
	if (cached) return loaded(cached)

	const result = await loadEnvironmentTextures({ url: `/textures/studio/${name}.exr` })
	if (!result.ok) return result

	const textures = result.value
	textures.image.name = name
	textures.envMap.name = name
	studioLightCache.set(name, textures)

	return loaded(textures)
}

/** The PMREM-filtered map alone, for callers that only light with it. */
export async function loadStudioLight(name: StudioLightName): Promise<LoadResult<THREE.Texture>> {
	const result = await loadStudioLightTextures(name)
	return result.ok ? loaded(result.value.envMap) : result
}

export const STUDIO_LIGHTS = [
	'city',
	'courtyard',
	'forest',
	'interior',
	'night',
	'studio',
	'sunrise',
	'sunset'
] as const

export type StudioLightName = (typeof STUDIO_LIGHTS)[number]
