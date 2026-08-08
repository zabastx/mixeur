/**
 * A mesh's UV layout, and the vocabulary for talking about it.
 *
 * The words are Blender's on purpose, because that is the tool users are
 * comparing against:
 *
 * - **UV vertex** — one entry in `geometry.attributes.uv`. A mesh corner where
 *   three differently-mapped faces meet is *three* UV vertices, not one.
 * - **mesh vertex** — a position in 3D. Owns one or more UV vertices.
 * - **island** — a connected run of faces in UV space.
 * - **seam** — a mesh edge whose two faces disagree about UVs, so the island
 *   tears open along it.
 */

export type SelectMode = 'vertex' | 'edge' | 'face' | 'island'

/**
 * What comes along when you move what you picked.
 *
 * A mesh vertex can own several UV vertices, so "move this corner" has three
 * defensible answers and the choice is what makes a UV editor feel right or
 * feel possessed.
 *
 * - `off` — exactly what was picked. Tears seams freely.
 * - `shared-vertex` — every UV copy of the same mesh vertex, wherever it sits.
 *   Right when a seam was accidental; on a mesh whose seams are deliberate it
 *   drags them shut.
 * - `shared-location` — Blender's default, and a narrowing of `shared-vertex`
 *   rather than a separate rule: the copies of the same mesh vertex that also
 *   sit on the same spot. Welded points stay welded, existing seams survive.
 *   The mesh-vertex half matters — matching on location alone would join
 *   unrelated vertices wherever two islands overlap.
 */
export type StickyMode = 'off' | 'shared-vertex' | 'shared-location'

/**
 * What a rotation or scale turns around.
 *
 * `bounding-box` and `median` differ whenever the selection is lopsided: the
 * first is the centre of its extents, the second the average of its vertices,
 * so a dense cluster at one end pulls `median` towards it and leaves
 * `bounding-box` where it was.
 */
export type PivotMode = 'bounding-box' | 'median' | 'cursor' | 'individual'

/** A point in UV space. */
export type UvPoint = [u: number, v: number]

export interface UvRect {
	u0: number
	v0: number
	u1: number
	v1: number
}

export interface UvEdge {
	a: number
	b: number
	/**
	 * The layout stops here — part of an island's outline. Read from the mesh
	 * edge rather than from how many UV faces share this edge, so non-indexed
	 * geometry, where no UV edge is ever shared, does not report every edge as
	 * a border.
	 */
	border: boolean
	/** A border whose mesh edge is shared, i.e. the island was cut here. */
	seam: boolean
}

/**
 * Everything about a layout that does not change when UVs move. Built once per
 * geometry by `createUvLayout`, then treated as immutable.
 */
export interface UvLayout {
	/** Triangle corners, three UV vertex ids per face. */
	faces: Uint32Array
	faceCount: number
	vertCount: number
	/** Which mesh vertex each UV vertex belongs to. */
	meshVertOfUvVert: Int32Array
	/** UV vertices grouped by the mesh vertex they share. */
	uvVertsOfMeshVert: number[][]
	islandOfVert: Int32Array
	islandOfFace: Int32Array
	islandCount: number
	vertsOfIsland: number[][]
	facesOfIsland: number[][]
	facesOfVert: number[][]
	edges: UvEdge[]
	seamCount: number
}

export interface UvSelection {
	mode: SelectMode
	/** Interpreted per `mode`: vertex ids, edge indices, face indices, island ids. */
	ids: Set<number>
	sticky: StickyMode
	pivot: PivotMode
	cursor: UvPoint
}

export interface UvTransform {
	translate?: UvPoint
	rotate?: number
	scale?: UvPoint
}

/** What the UI reports about the current layout. */
export interface UvStats {
	islandCount: number
	seamCount: number
	/** UV vertices the user picked, before the sticky rule widened it. */
	pickedCount: number
	/** UV vertices a transform would actually write to. */
	movingCount: number
	/** How many of `movingCount` were added by the sticky rule. */
	stickyCount: number
	/** UV vertices outside the 0–1 tile. Legal — the texture wraps — but worth showing. */
	offTileCount: number
	/** Island pairs whose bounds intersect. Also legal; mirrored parts do this deliberately. */
	overlappingPairs: number
}
