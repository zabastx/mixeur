import { quantize } from './same-spot'
import type { UvLayout, UvPoint, UvSelection } from './types'

const locationKey = (uv: ArrayLike<number>, v: number) =>
	`${quantize(uv[v * 2])}|${quantize(uv[v * 2 + 1])}`

export function createUvSelection(): UvSelection {
	return {
		mode: 'island',
		ids: new Set(),
		// Blender's default, and the right one here for a second reason: meshes
		// reach Mixeur already unwrapped, so their seams were chosen by whoever
		// unwrapped them, and `shared-vertex` would drag those shut on the first
		// drag.
		sticky: 'shared-location',
		// Blender's default too, so the muscle memory carries over.
		pivot: 'bounding-box',
		cursor: [0.5, 0.5]
	}
}

/** The UV vertices the user literally picked, before the sticky rule. */
export function pickedVerts(layout: UvLayout, selection: UvSelection): Set<number> {
	const picked = new Set<number>()
	switch (selection.mode) {
		case 'vertex':
			for (const v of selection.ids) picked.add(v)
			break
		case 'edge':
			for (const i of selection.ids) {
				const edge = layout.edges[i]
				if (!edge) continue
				picked.add(edge.a)
				picked.add(edge.b)
			}
			break
		case 'face':
			for (const f of selection.ids) {
				if (f >= layout.faceCount) continue
				for (let k = 0; k < 3; k++) picked.add(layout.faces[f * 3 + k])
			}
			break
		case 'island':
			for (const i of selection.ids) {
				for (const v of layout.vertsOfIsland[i] ?? []) picked.add(v)
			}
			break
	}
	return picked
}

/**
 * The UV vertices a transform will actually write to: `pickedVerts` widened by
 * the sticky rule. This is the single most consequential function in the
 * editor — see `StickyMode` for what each rule means.
 */
export function movingVerts(
	layout: UvLayout,
	uv: ArrayLike<number>,
	selection: UvSelection
): Set<number> {
	const picked = pickedVerts(layout, selection)
	if (selection.sticky === 'off' || picked.size === 0) return picked

	const moving = new Set(picked)
	if (selection.sticky === 'shared-vertex') {
		for (const v of picked) {
			for (const twin of layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[v]]) moving.add(twin)
		}
		return moving
	}

	// Shared location is a *narrowing* of shared vertex, not a different rule:
	// the UV copies of the same mesh vertex that also happen to sit on the same
	// spot. Matching on location alone would join UV vertices belonging to
	// unrelated mesh vertices, so any two islands that overlapped — which
	// mirrored parts do deliberately — would drag each other around.
	for (const v of picked) {
		const twins = layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[v]]
		// A mesh vertex with one UV copy can only join itself, and most of them
		// are: skipping those before building a location key is what keeps this
		// off the critical path of a drag.
		if (twins.length < 2) continue
		const spot = locationKey(uv, v)
		for (const twin of twins) {
			if (locationKey(uv, twin) === spot) moving.add(twin)
		}
	}
	return moving
}

/**
 * Whether every corner of a face is in `verts`.
 *
 * Wholly covered, not merely touched — which is what makes both the face
 * highlight and a box drag feel like they grab shapes rather than stray points.
 */
export function faceFullyIn(layout: UvLayout, face: number, verts: ReadonlySet<number>): boolean {
	return (
		verts.has(layout.faces[face * 3]) &&
		verts.has(layout.faces[face * 3 + 1]) &&
		verts.has(layout.faces[face * 3 + 2])
	)
}

/** Every face whose three corners are all picked — what the views highlight. */
export function selectedFaces(layout: UvLayout, selection: UvSelection): Set<number> {
	const faces = new Set<number>()
	if (selection.mode === 'face') {
		for (const f of selection.ids) if (f < layout.faceCount) faces.add(f)
		return faces
	}
	if (selection.mode === 'island') {
		for (const i of selection.ids) for (const f of layout.facesOfIsland[i] ?? []) faces.add(f)
		return faces
	}
	const picked = pickedVerts(layout, selection)
	for (let f = 0; f < layout.faceCount; f++) {
		if (faceFullyIn(layout, f, picked)) faces.add(f)
	}
	return faces
}

/** Every selectable id for the current mode. */
export function allIds(layout: UvLayout, mode: UvSelection['mode']): Set<number> {
	switch (mode) {
		case 'vertex':
			return new Set(
				Array.from({ length: layout.vertCount }, (_, v) => v).filter(
					(v) => layout.facesOfVert[v].length > 0
				)
			)
		case 'edge':
			return new Set(layout.edges.map((_, i) => i))
		case 'face':
			return new Set(Array.from({ length: layout.faceCount }, (_, f) => f))
		case 'island':
			return new Set(Array.from({ length: layout.islandCount }, (_, i) => i))
	}
}

/**
 * What a click does to the selection, and whether it begins a drag.
 *
 * `hit` is the id under the pointer, or -1 for empty space. `additive` is the
 * shift key.
 *
 * The subtlety is the last case: shift-clicking something already selected
 * *removes* it, and that is a deselect gesture, not the start of a drag —
 * arming one anyway means a pixel of pointer travel slides the rest of the
 * selection away under the cursor.
 */
export function resolvePick(
	current: Set<number>,
	hit: number,
	additive: boolean
): { ids: Set<number>; startsDrag: boolean } {
	if (hit < 0) {
		// Empty space. Shift keeps what is there so a box can extend it.
		return { ids: additive ? new Set(current) : new Set(), startsDrag: false }
	}
	if (current.has(hit)) {
		if (additive) {
			const ids = new Set(current)
			ids.delete(hit)
			return { ids, startsDrag: false }
		}
		// Already selected: keep the whole selection, so dragging moves all of
		// it rather than collapsing to the one thing under the pointer.
		return { ids: new Set(current), startsDrag: true }
	}
	const ids = additive ? new Set(current) : new Set<number>()
	ids.add(hit)
	return { ids, startsDrag: true }
}

export function centroid(uv: ArrayLike<number>, verts: Iterable<number>): UvPoint {
	let u = 0
	let v = 0
	let count = 0
	for (const i of verts) {
		u += uv[i * 2]
		v += uv[i * 2 + 1]
		count++
	}
	return count ? [u / count, v / count] : [0.5, 0.5]
}
