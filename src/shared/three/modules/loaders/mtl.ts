import THREE from '@/shared/three'
import { MTLLoader, type MaterialCreatorOptions } from 'three/examples/jsm/Addons.js'
import { applyUrlModifier, type LoadRequest } from './internal'

/**
 * Internal adapter — use `loadModel` from this directory's index instead.
 *
 * Rejects on failure; progress, toasts and URL lifetime belong to the caller.
 */
export async function loadMTL({ url, onProgress, urlModifier, materialOptions }: LoadMTLRequest) {
	const loader = new MTLLoader()
	if (materialOptions) loader.setMaterialOptions(materialOptions)
	applyUrlModifier(loader, urlModifier)

	const mtl = await loader.loadAsync(url, onProgress)
	mtl.preload()
	nameTextures(mtl)

	return mtl
}

/** MTL textures arrive unnamed, which leaves them unidentifiable in the outliner. */
function nameTextures(mtl: MTLLoader.MaterialCreator) {
	for (const matName in mtl.materials) {
		const mat = mtl.materials[matName]

		for (const key in mat) {
			const value = mat[key as keyof typeof mat]
			if (value instanceof THREE.Texture) {
				value.name = `${key}_${matName}`
			}
		}
	}
}

export interface LoadMTLRequest extends LoadRequest {
	materialOptions?: MaterialCreatorOptions
}
