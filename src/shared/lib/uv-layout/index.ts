/**
 * Reading and editing a mesh's UV layout.
 *
 * Pure: no DOM, no Three.js, no reactivity. It takes the plain arrays off a
 * `BufferGeometry` and answers the questions a UV editor asks — what is an
 * island, where are the seams, what does this click select, and what does
 * moving it actually change.
 *
 * See `./types.ts` for the vocabulary, which is Blender's on purpose.
 */
export * from './types'
export { createUvLayout } from './layout'
export {
	allIds,
	centroid,
	createUvSelection,
	movingVerts,
	pickedVerts,
	selectedFaces
} from './selection'
export { boundsOf, packIslands, transformUvs, weldUvs } from './transform'
export { faceAt, idsInRect, nearestEdge, nearestVert, uvStats, vertsInRect } from './pick'
