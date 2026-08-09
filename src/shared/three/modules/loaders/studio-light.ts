import THREE from '@/shared/three'
import { loaded, type LoadResult } from '@/shared/lib/asset-source'
import { loadTexture } from '.'

const worldMapCache = new Map<string, THREE.Texture>()

export function disposeWorldMapCache() {
	worldMapCache.forEach((texture) => texture.dispose())
	worldMapCache.clear()
}

/**
 * Loads one of the bundled world maps as a PMREM-processed environment map,
 * ready for `scene.environment`. Cached by name — a repeat request for the same
 * map returns the texture already built.
 */
export async function loadWorldTexture(
	name: (typeof DEFAULT_WORLD_MAPS)[number]
): Promise<LoadResult<THREE.Texture>> {
	const cached = worldMapCache.get(name)
	if (cached) return loaded(cached)

	const filename = `${name}.exr`
	const result = await loadTexture({ url: `/textures/world/${filename}` }, { isEnvMap: true })

	if (!result.ok) return result

	result.value.name = name
	worldMapCache.set(name, result.value)

	return result
}

export const DEFAULT_WORLD_MAPS = [
	'city',
	'courtyard',
	'forest',
	'interior',
	'night',
	'studio',
	'sunrise',
	'sunset'
] as const
