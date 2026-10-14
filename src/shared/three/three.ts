import type { ShadingMode } from '@/app/model/types/shading'
import type {
	computeBoundsTree,
	disposeBoundsTree,
	computeBatchedBoundsTree,
	disposeBatchedBoundsTree,
	acceleratedRaycast
} from 'three-mesh-bvh'
import type { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

export interface MxTextObjectData {
	textValue: string
	parameters: TextGeometry['parameters']
}

export interface MxObjectUserData {
	isShadable?: boolean
	isHelper?: boolean
	helperUUID?: string
	isSceneLight?: boolean
	isRenderCamera?: boolean
	skipRaycast?: boolean
	isSelectable?: boolean
	hideInModes?: ShadingMode[]
	hideInOutliner?: boolean
	userVisible?: boolean
	text?: MxTextObjectData
	isLightTarget?: boolean
	isSystemObj?: boolean
}

declare module 'three' {
	interface BufferGeometry {
		computeBoundsTree: typeof computeBoundsTree
		disposeBoundsTree: typeof disposeBoundsTree
		_hasBoundsTree: boolean
	}

	interface Mesh {
		raycast: typeof acceleratedRaycast
	}

	interface BatchedMesh {
		computeBoundsTree: typeof computeBatchedBoundsTree
		disposeBoundsTree: typeof disposeBatchedBoundsTree
		raycast: typeof acceleratedRaycast
	}
}
