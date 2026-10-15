import type { ShadingMode } from '@/app/model/types/shading'
import type THREE from '@/shared/three'

declare global {
	interface DocumentEventMap {
		'shading:modeChange': CustomEvent<ShadingMode>
		'scene:objectDeleted': CustomEvent<unknown>
		'scene:objectAdded': CustomEvent<THREE.Object3D>
		'three:renderRequested': CustomEvent<unknown>
	}
}

/** Dispatches a document event with the detail type declared in DocumentEventMap. */
export function emitCustomEvent<K extends keyof DocumentEventMap>(
	type: K,
	detail?: DocumentEventMap[K] extends CustomEvent<infer D> ? D : never
) {
	document.dispatchEvent(new CustomEvent(type, { detail }))
}

export function listenCustomEvent<K extends keyof DocumentEventMap>(
	type: K,
	handler: (e: DocumentEventMap[K]) => void
) {
	document.addEventListener(type, handler)
	return () => document.removeEventListener(type, handler)
}
