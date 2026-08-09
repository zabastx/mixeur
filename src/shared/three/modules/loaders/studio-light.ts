import THREE from '@/shared/three'
import { failed, loaded, type LoadResult } from '@/shared/lib/asset-source'
import { textureToEnvMap } from '@/shared/three/utils'
import { loadTexture } from '.'

/**
 * One bundled image in both the forms the app needs it in.
 *
 * `envMap` is PMREM-filtered and lights a scene. `image` is the equirectangular
 * original and is what you show behind one: the filtered map's mip chain is a
 * roughness ladder built for lighting, so drawing it as a picture yields a
 * blurred picture and `backgroundBlurriness` has no usable range on it.
 */
interface StudioLightTextures {
	envMap: THREE.Texture
	image: THREE.Texture
}

const studioLightCache = new Map<string, StudioLightTextures>()

export function disposeStudioLightCache() {
	studioLightCache.forEach(({ envMap, image }) => {
		envMap.dispose()
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
): Promise<LoadResult<StudioLightTextures>> {
	const cached = studioLightCache.get(name)
	if (cached) return loaded(cached)

	const result = await loadTexture({ url: `/textures/studio/${name}.exr` })
	if (!result.ok) return result

	const image = result.value
	image.name = name

	const envMap = textureToEnvMap(image, { keepSource: true })
	if (!envMap) {
		image.dispose()
		return failed(new Error('Environment maps are unavailable until the viewport starts'))
	}
	envMap.name = name

	const textures = { envMap, image }
	studioLightCache.set(name, textures)

	return loaded(textures)
}

/** The PMREM-filtered map alone, for callers that only light with it. */
export async function loadStudioLight(name: StudioLightName): Promise<LoadResult<THREE.Texture>> {
	const result = await loadStudioLightTextures(name)
	return result.ok ? loaded(result.value.envMap) : result
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

export type StudioLightName = (typeof DEFAULT_STUDIO_LIGHTS)[number]
