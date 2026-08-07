/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * The validated model lifted out of `src/app/model/prototype-uv-editing/`, now
 * in TypeScript and driving three real UI variants. Still pure: no DOM, no Vue,
 * no THREE. It takes the plain arrays off a BufferGeometry and answers the
 * questions a UV editor asks.
 *
 * Vocabulary is Blender's on purpose, so the two can be compared:
 *   UV vertex    one entry in geometry.attributes.uv. A mesh corner meeting
 *                three differently-mapped faces is THREE UV vertices, not one.
 *   mesh vertex  a position in 3D. Owns 1..n UV vertices.
 *   island       a connected run of faces in UV space.
 *   seam         a mesh edge whose two faces disagree about UVs, so the island
 *                tears open there.
 */

export type SelectMode = 'vertex' | 'edge' | 'face' | 'island'

/**
 * What else moves with what you picked. This is the decision the throwaway
 * demo existed to settle; see the README for why the default is not Blender's.
 */
export type StickyMode = 'off' | 'shared-vertex' | 'shared-location'

export type PivotMode = 'median' | 'cursor' | 'individual'

export interface UvEdge {
	a: number
	b: number
	faces: number[]
	/** used by exactly one face — the outline of an island */
	border: boolean
	/** a border whose mesh edge is shared, i.e. the island was cut here */
	seam: boolean
}

export interface UvModel {
	faces: Uint32Array
	faceCount: number
	vertCount: number
	groupOfVert: Int32Array
	meshVertGroups: number[][]
	islandOfVert: Int32Array
	islandOfFace: Int32Array
	islandCount: number
	vertsOfIsland: number[][]
	facesOfIsland: number[][]
	facesOfVert: number[][]
	edges: UvEdge[]
	neighbours: Set<number>[]
	originalUv: Float32Array
	seamCount: number
	splitVertCount: number
}

export interface UvSelection {
	mode: SelectMode
	ids: Set<number>
	sticky: StickyMode
	pivot: PivotMode
	cursor: [number, number]
	/** null = the whole mesh is editable; a Set = only these faces are */
	visibleFaces: Set<number> | null
}

export interface UvSummary {
	vertCount: number
	meshVertCount: number
	splitVertCount: number
	faceCount: number
	islandCount: number
	seamCount: number
	pickedCount: number
	movingCount: number
	stickyExtra: number
	islandsTouched: number
	offTile: number
	overlaps: number
	closedSeams: number
}

export interface Rect {
	u0: number
	v0: number
	u1: number
	v1: number
}

export type Point = [number, number]

const key3 = (a: ArrayLike<number>, i: number) => `${a[i * 3]}|${a[i * 3 + 1]}|${a[i * 3 + 2]}`
const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)
const locKey = (uv: ArrayLike<number>, v: number) =>
	`${uv[v * 2].toFixed(4)}|${uv[v * 2 + 1].toFixed(4)}`

/**
 * Precompute everything about the layout that does NOT change when UVs move.
 * Built once per mesh; ~1ms for a few thousand vertices.
 */
export function createUvModel(input: {
	position: ArrayLike<number>
	uv: ArrayLike<number>
	index: ArrayLike<number> | null
}): UvModel {
	const { position, uv, index } = input
	const vertCount = position.length / 3
	const faces = index
		? Uint32Array.from(index as ArrayLike<number>)
		: Uint32Array.from({ length: vertCount }, (_, i) => i)
	const faceCount = faces.length / 3

	// Which UV vertices are really the same mesh vertex. A cube corner is one
	// point in 3D and three points in UV space; nothing downstream can tell
	// them apart, so it is resolved here, once.
	const groupOfVert = new Int32Array(vertCount).fill(-1)
	const meshVertGroups: number[][] = []
	const byPosition = new Map<string, number>()
	for (let v = 0; v < vertCount; v++) {
		const k = key3(position, v)
		let g = byPosition.get(k)
		if (g === undefined) {
			g = meshVertGroups.length
			byPosition.set(k, g)
			meshVertGroups.push([])
		}
		groupOfVert[v] = g
		meshVertGroups[g].push(v)
	}

	// Islands: connected components of faces over shared UV vertices.
	const parent = new Int32Array(vertCount)
	for (let i = 0; i < vertCount; i++) parent[i] = i
	const find = (x: number): number => {
		while (parent[x] !== x) x = parent[x] = parent[parent[x]]
		return x
	}
	const union = (a: number, b: number) => {
		const ra = find(a)
		const rb = find(b)
		if (ra !== rb) parent[ra] = rb
	}
	for (let f = 0; f < faceCount; f++) {
		union(faces[f * 3], faces[f * 3 + 1])
		union(faces[f * 3 + 1], faces[f * 3 + 2])
	}
	const islandOfRoot = new Map<number, number>()
	const islandOfVert = new Int32Array(vertCount).fill(-1)
	const islandOfFace = new Int32Array(faceCount).fill(-1)
	for (let f = 0; f < faceCount; f++) {
		const root = find(faces[f * 3])
		let id = islandOfRoot.get(root)
		if (id === undefined) {
			id = islandOfRoot.size
			islandOfRoot.set(root, id)
		}
		islandOfFace[f] = id
		for (let k = 0; k < 3; k++) islandOfVert[faces[f * 3 + k]] = id
	}
	const islandCount = islandOfRoot.size
	const vertsOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	const facesOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	for (let v = 0; v < vertCount; v++) {
		if (islandOfVert[v] >= 0) vertsOfIsland[islandOfVert[v]].push(v)
	}
	for (let f = 0; f < faceCount; f++) facesOfIsland[islandOfFace[f]].push(f)

	// Edges, borders and seams. A UV edge used by one face is a border; a
	// border whose mesh edge is used by two faces is a seam.
	const uvEdgeUse = new Map<string, { a: number; b: number; faces: number[] }>()
	const meshEdgeUse = new Map<string, number>()
	const facesOfVert: number[][] = Array.from({ length: vertCount }, () => [])
	for (let f = 0; f < faceCount; f++) {
		for (let k = 0; k < 3; k++) {
			const a = faces[f * 3 + k]
			const b = faces[f * 3 + ((k + 1) % 3)]
			const uk = edgeKey(a, b)
			const rec = uvEdgeUse.get(uk)
			if (rec) rec.faces.push(f)
			else uvEdgeUse.set(uk, { a, b, faces: [f] })
			const mk = edgeKey(groupOfVert[a], groupOfVert[b])
			meshEdgeUse.set(mk, (meshEdgeUse.get(mk) ?? 0) + 1)
			facesOfVert[a].push(f)
		}
	}
	const edges: UvEdge[] = []
	for (const rec of uvEdgeUse.values()) {
		const border = rec.faces.length === 1
		const mk = edgeKey(groupOfVert[rec.a], groupOfVert[rec.b])
		edges.push({
			a: rec.a,
			b: rec.b,
			faces: rec.faces,
			border,
			seam: border && (meshEdgeUse.get(mk) ?? 0) > 1
		})
	}

	const neighbours: Set<number>[] = Array.from({ length: vertCount }, () => new Set<number>())
	for (const e of edges) {
		neighbours[e.a].add(e.b)
		neighbours[e.b].add(e.a)
	}

	return {
		faces,
		faceCount,
		vertCount,
		groupOfVert,
		meshVertGroups,
		islandOfVert,
		islandOfFace,
		islandCount,
		vertsOfIsland,
		facesOfIsland,
		facesOfVert,
		edges,
		neighbours,
		originalUv: Float32Array.from(uv as ArrayLike<number>),
		seamCount: edges.filter((e) => e.seam).length,
		splitVertCount: meshVertGroups.filter((g) => g.length > 1).length
	}
}

export function createSelection(): UvSelection {
	return {
		mode: 'island',
		ids: new Set(),
		// Not Blender's default. Mixeur's meshes arrive already unwrapped, so
		// their seams are deliberate and 'shared-vertex' would drag them shut.
		sticky: 'shared-location',
		pivot: 'median',
		cursor: [0.5, 0.5],
		visibleFaces: null
	}
}

/** The UV vertices the user literally picked, before the sticky rule. */
export function pickedVerts(model: UvModel, sel: UvSelection): Set<number> {
	const out = new Set<number>()
	if (sel.mode === 'vertex') {
		for (const v of sel.ids) out.add(v)
	} else if (sel.mode === 'edge') {
		for (const i of sel.ids) {
			const e = model.edges[i]
			if (!e) continue
			out.add(e.a)
			out.add(e.b)
		}
	} else if (sel.mode === 'face') {
		for (const f of sel.ids) for (let k = 0; k < 3; k++) out.add(model.faces[f * 3 + k])
	} else {
		for (const i of sel.ids) for (const v of model.vertsOfIsland[i] ?? []) out.add(v)
	}
	return out
}

/**
 * The UV vertices a transform will actually write to: `pickedVerts` widened by
 * the sticky rule, then narrowed by what is editable. The order matters — the
 * visibility filter has to run last, or sticky smuggles hidden faces back in.
 */
export function movingVerts(model: UvModel, uv: ArrayLike<number>, sel: UvSelection): Set<number> {
	const base = pickedVerts(model, sel)
	if (sel.sticky === 'off') return filterVisible(model, sel, base)
	const out = new Set(base)
	if (sel.sticky === 'shared-vertex') {
		for (const v of base)
			for (const other of model.meshVertGroups[model.groupOfVert[v]]) out.add(other)
	} else {
		const here = new Set<string>()
		for (const v of base) here.add(locKey(uv, v))
		for (let v = 0; v < model.vertCount; v++) if (here.has(locKey(uv, v))) out.add(v)
	}
	return filterVisible(model, sel, out)
}

function filterVisible(model: UvModel, sel: UvSelection, verts: Set<number>): Set<number> {
	if (!sel.visibleFaces) return verts
	const out = new Set<number>()
	for (const v of verts) {
		if (model.facesOfVert[v].some((f) => sel.visibleFaces?.has(f))) out.add(v)
	}
	return out
}

export function isFaceVisible(sel: UvSelection, f: number) {
	return !sel.visibleFaces || sel.visibleFaces.has(f)
}

export interface TransformOp {
	translate?: Point
	rotate?: number
	scale?: Point
}

/** Every transform is this one function. Returns a new UV buffer. */
export function transform(
	model: UvModel,
	uv: Float32Array,
	sel: UvSelection,
	op: TransformOp
): { uv: Float32Array; moved: number } {
	const verts = movingVerts(model, uv, sel)
	if (!verts.size) return { uv, moved: 0 }
	const next = Float32Array.from(uv)
	const pivotOf = pivotsFor(model, uv, verts, sel)
	const cos = op.rotate ? Math.cos(op.rotate) : 1
	const sin = op.rotate ? Math.sin(op.rotate) : 0
	for (const v of verts) {
		let u = uv[v * 2]
		let w = uv[v * 2 + 1]
		if (op.rotate || op.scale) {
			const [pu, pw] = pivotOf(v)
			let du = u - pu
			let dw = w - pw
			if (op.scale) {
				du *= op.scale[0]
				dw *= op.scale[1]
			}
			if (op.rotate) {
				const r = du * cos - dw * sin
				dw = du * sin + dw * cos
				du = r
			}
			u = pu + du
			w = pw + dw
		}
		if (op.translate) {
			u += op.translate[0]
			w += op.translate[1]
		}
		next[v * 2] = u
		next[v * 2 + 1] = w
	}
	return { uv: next, moved: verts.size }
}

/**
 * Where each moving vertex turns around. 'individual' gives every island its
 * own centre, which is why rotating two islands has two defensible outcomes.
 */
function pivotsFor(
	model: UvModel,
	uv: ArrayLike<number>,
	verts: Set<number>,
	sel: UvSelection
): (v: number) => Point {
	if (sel.pivot === 'cursor') {
		const p = sel.cursor
		return () => p
	}
	if (sel.pivot === 'individual') {
		const acc = new Map<number, [number, number, number]>()
		for (const v of verts) {
			const i = model.islandOfVert[v]
			const a = acc.get(i) ?? [0, 0, 0]
			a[0] += uv[v * 2]
			a[1] += uv[v * 2 + 1]
			a[2]++
			acc.set(i, a)
		}
		const centres = new Map<number, Point>()
		for (const [i, a] of acc) centres.set(i, [a[0] / a[2], a[1] / a[2]])
		return (v) => centres.get(model.islandOfVert[v]) ?? [0.5, 0.5]
	}
	const c = centroid(uv, verts)
	return () => c
}

export function centroid(uv: ArrayLike<number>, verts: Iterable<number>): Point {
	let u = 0
	let v = 0
	let n = 0
	for (const i of verts) {
		u += uv[i * 2]
		v += uv[i * 2 + 1]
		n++
	}
	return n ? [u / n, v / n] : [0.5, 0.5]
}

export function bboxOf(uv: ArrayLike<number>, verts: Iterable<number>): Rect {
	let u0 = Infinity
	let v0 = Infinity
	let u1 = -Infinity
	let v1 = -Infinity
	for (const v of verts) {
		u0 = Math.min(u0, uv[v * 2])
		u1 = Math.max(u1, uv[v * 2])
		v0 = Math.min(v0, uv[v * 2 + 1])
		v1 = Math.max(v1, uv[v * 2 + 1])
	}
	return { u0, v0, u1, v1 }
}

/**
 * Lay every island out in a grid inside the tile. Not an unwrap — the shapes
 * are untouched — but Mixeur's primitives arrive with every island mapped to
 * the whole 0–1 tile, so without this there is nothing legible to edit.
 */
export function packIslands(model: UvModel, uv: Float32Array, margin = 0.015): Float32Array {
	const cols = Math.ceil(Math.sqrt(model.islandCount))
	const rows = Math.ceil(model.islandCount / cols)
	const cw = 1 / cols
	const ch = 1 / rows
	const next = Float32Array.from(uv)
	for (let i = 0; i < model.islandCount; i++) {
		const verts = model.vertsOfIsland[i]
		const b = bboxOf(uv, verts)
		const w = b.u1 - b.u0 || 1e-6
		const h = b.v1 - b.v0 || 1e-6
		const fitW = cw - margin * 2
		const fitH = ch - margin * 2
		const s = Math.min(fitW / w, fitH / h)
		const ox = (i % cols) * cw + margin + (fitW - w * s) / 2
		const oy = Math.floor(i / cols) * ch + margin + (fitH - h * s) / 2
		for (const v of verts) {
			next[v * 2] = ox + (uv[v * 2] - b.u0) * s
			next[v * 2 + 1] = oy + (uv[v * 2 + 1] - b.v0) * s
		}
	}
	return next
}

/** Collapse nearly-coincident moving vertices onto their average. */
export function weld(model: UvModel, uv: Float32Array, sel: UvSelection, threshold = 0.02) {
	const verts = [...movingVerts(model, uv, sel)]
	const next = Float32Array.from(uv)
	const cells = new Map<string, number[]>()
	const q = (n: number) => Math.round(n / threshold)
	for (const v of verts) {
		const k = `${q(uv[v * 2])}|${q(uv[v * 2 + 1])}`
		const cell = cells.get(k)
		if (cell) cell.push(v)
		else cells.set(k, [v])
	}
	let welded = 0
	for (const group of cells.values()) {
		if (group.length < 2) continue
		const [cu, cv] = centroid(uv, group)
		for (const v of group) {
			next[v * 2] = cu
			next[v * 2 + 1] = cv
		}
		welded += group.length
	}
	return { uv: next, welded }
}

// --- picking: pure geometry queries over the current UVs -------------------

export function nearestVertex(
	model: UvModel,
	uv: ArrayLike<number>,
	p: Point,
	radius: number
): number {
	let best = -1
	let bestD = radius * radius
	for (let v = 0; v < model.vertCount; v++) {
		if (!model.facesOfVert[v].length) continue
		const du = uv[v * 2] - p[0]
		const dv = uv[v * 2 + 1] - p[1]
		const d = du * du + dv * dv
		if (d < bestD) {
			bestD = d
			best = v
		}
	}
	return best
}

export function nearestEdge(
	model: UvModel,
	uv: ArrayLike<number>,
	p: Point,
	radius: number
): number {
	let best = -1
	let bestD = radius
	for (let i = 0; i < model.edges.length; i++) {
		const e = model.edges[i]
		const d = distToSegment(p, [uv[e.a * 2], uv[e.a * 2 + 1]], [uv[e.b * 2], uv[e.b * 2 + 1]])
		if (d < bestD) {
			bestD = d
			best = i
		}
	}
	return best
}

export function faceAt(model: UvModel, uv: ArrayLike<number>, p: Point): number {
	for (let f = model.faceCount - 1; f >= 0; f--) {
		const a = model.faces[f * 3]
		const b = model.faces[f * 3 + 1]
		const c = model.faces[f * 3 + 2]
		const hit = pointInTriangle(
			p,
			[uv[a * 2], uv[a * 2 + 1]],
			[uv[b * 2], uv[b * 2 + 1]],
			[uv[c * 2], uv[c * 2 + 1]]
		)
		if (hit) return f
	}
	return -1
}

export function vertsInRect(model: UvModel, uv: ArrayLike<number>, r: Rect): number[] {
	const out: number[] = []
	for (let v = 0; v < model.vertCount; v++) {
		if (!model.facesOfVert[v].length) continue
		const u = uv[v * 2]
		const w = uv[v * 2 + 1]
		if (u >= r.u0 && u <= r.u1 && w >= r.v0 && w <= r.v1) out.push(v)
	}
	return out
}

export function grow(model: UvModel, sel: UvSelection): Set<number> {
	if (sel.mode !== 'vertex') return sel.ids
	const out = new Set(sel.ids)
	for (const v of sel.ids) for (const n of model.neighbours[v]) out.add(n)
	return out
}

function distToSegment(p: Point, a: Point, b: Point) {
	const vx = b[0] - a[0]
	const vy = b[1] - a[1]
	const l2 = vx * vx + vy * vy
	let t = l2 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0
	t = Math.max(0, Math.min(1, t))
	return Math.hypot(p[0] - (a[0] + t * vx), p[1] - (a[1] + t * vy))
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point) {
	const d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
	if (!d) return false
	const w1 = ((b[1] - c[1]) * (p[0] - c[0]) + (c[0] - b[0]) * (p[1] - c[1])) / d
	const w2 = ((c[1] - a[1]) * (p[0] - c[0]) + (a[0] - c[0]) * (p[1] - c[1])) / d
	return w1 >= 0 && w2 >= 0 && w1 + w2 <= 1
}

/** Everything a UI would want to report about the current layout. */
export function summarize(model: UvModel, uv: ArrayLike<number>, sel: UvSelection): UvSummary {
	const picked = pickedVerts(model, sel)
	const moving = movingVerts(model, uv, sel)
	const islands = new Set<number>()
	for (const v of picked) islands.add(model.islandOfVert[v])

	let offTile = 0
	for (let v = 0; v < model.vertCount; v++) {
		if (!model.facesOfVert[v].length) continue
		const u = uv[v * 2]
		const w = uv[v * 2 + 1]
		if (u < -1e-6 || u > 1 + 1e-6 || w < -1e-6 || w > 1 + 1e-6) offTile++
	}

	// Two islands sharing texture space is legal and sometimes wanted
	// (mirrored parts), so this is reported, never blocked.
	const boxes = model.vertsOfIsland.map((verts) => bboxOf(uv, verts))
	let overlaps = 0
	for (let i = 0; i < boxes.length; i++) {
		for (let j = i + 1; j < boxes.length; j++) {
			if (boxesOverlap(boxes[i], boxes[j])) overlaps++
		}
	}

	let closedSeams = 0
	for (const g of model.meshVertGroups) {
		if (g.length < 2) continue
		if (g.every((v) => locKey(uv, v) === locKey(uv, g[0]))) closedSeams++
	}

	return {
		vertCount: model.vertCount,
		meshVertCount: model.meshVertGroups.length,
		splitVertCount: model.splitVertCount,
		faceCount: model.faceCount,
		islandCount: model.islandCount,
		seamCount: model.seamCount,
		pickedCount: picked.size,
		movingCount: moving.size,
		stickyExtra: moving.size - picked.size,
		islandsTouched: islands.size,
		offTile,
		overlaps,
		closedSeams
	}
}

const boxesOverlap = (a: Rect, b: Rect) =>
	a.u0 < b.u1 - 1e-6 && b.u0 < a.u1 - 1e-6 && a.v0 < b.v1 - 1e-6 && b.v0 < a.v1 - 1e-6
