import THREE from '@/shared/three'
import { loaded, type LoadResult } from '@/shared/lib/asset-source'
import { loadTexture } from '.'

const studioLightCache = new Map<string, THREE.Texture>()

export function disposeStudioLightCache() {
	studioLightCache.forEach((texture) => texture.dispose())
	studioLightCache.clear()
}

/**
 * Loads one of the bundled studio lights as a PMREM-processed environment map,
 * ready for `scene.environment`. Cached by name — a repeat request for the same
 * light returns the texture already built.
 *
 * A studio light is the editor's preview rig, not the scene's World: it is never
 * saved with a project and never reaches a render. The same files are also
 * offered as World presets, and that cache is shared — see ADR-0002.
 */
export async function loadStudioLight(
	name: (typeof DEFAULT_STUDIO_LIGHTS)[number]
): Promise<LoadResult<THREE.Texture>> {
	const cached = studioLightCache.get(name)
	if (cached) return loaded(cached)

	const filename = `${name}.exr`
	const result = await loadTexture({ url: `/textures/studio/${filename}` }, { isEnvMap: true })

	if (!result.ok) return result

	result.value.name = name
	studioLightCache.set(name, result.value)

	return result
}

export const DEFAULT_STUDIO_LIGHTS = [
	'city',
	'courtyard',
	'forest',
	'interior',
	'night',
	'studio',
	'sunrise',
	'sunset'
] as const
