import { boundsOf } from './transform'
import { faceFullyIn, movingVerts, pickedVerts } from './selection'
import type { UvLayout, UvPoint, UvRect, UvSelection, UvStats } from './types'

/**
 * Hit-testing and reporting over the *current* UV coordinates. Everything here
 * is a plain geometry query, kept out of the canvas component so the view stays
 * a renderer and the picking stays testable.
 */

export function nearestVert(
	layout: UvLayout,
	uv: ArrayLike<number>,
	point: UvPoint,
	radius: number
): number {
	let best = -1
	let bestDistance = radius * radius
	for (let v = 0; v < layout.vertCount; v++) {
		if (!layout.facesOfVert[v].length) continue
		const du = uv[v * 2] - point[0]
		const dv = uv[v * 2 + 1] - point[1]
		const distance = du * du + dv * dv
		if (distance < bestDistance) {
			bestDistance = distance
			best = v
		}
	}
	return best
}

export function nearestEdge(
	layout: UvLayout,
	uv: ArrayLike<number>,
	point: UvPoint,
	radius: number
): number {
	let best = -1
	let bestDistance = radius
	for (let i = 0; i < layout.edges.length; i++) {
		const { a, b } = layout.edges[i]
		const distance = distanceToSegment(
			point,
			[uv[a * 2], uv[a * 2 + 1]],
			[uv[b * 2], uv[b * 2 + 1]]
		)
		if (distance < bestDistance) {
			bestDistance = distance
			best = i
		}
	}
	return best
}

/** The topmost face containing `point`, or -1. */
export function faceAt(layout: UvLayout, uv: ArrayLike<number>, point: UvPoint): number {
	for (let f = layout.faceCount - 1; f >= 0; f--) {
		const a = layout.faces[f * 3]
		const b = layout.faces[f * 3 + 1]
		const c = layout.faces[f * 3 + 2]
		const inside = pointInTriangle(
			point,
			[uv[a * 2], uv[a * 2 + 1]],
			[uv[b * 2], uv[b * 2 + 1]],
			[uv[c * 2], uv[c * 2 + 1]]
		)
		if (inside) return f
	}
	return -1
}

export function vertsInRect(layout: UvLayout, uv: ArrayLike<number>, rect: UvRect): Set<number> {
	const inside = new Set<number>()
	for (let v = 0; v < layout.vertCount; v++) {
		if (!layout.facesOfVert[v].length) continue
		const u = uv[v * 2]
		const w = uv[v * 2 + 1]
		if (u >= rect.u0 && u <= rect.u1 && w >= rect.v0 && w <= rect.v1) inside.add(v)
	}
	return inside
}

/**
 * Everything inside `rect`, expressed in the ids the current mode selects by.
 * Faces and islands need every corner inside — see `faceFullyIn`.
 */
export function idsInRect(
	layout: UvLayout,
	uv: ArrayLike<number>,
	selection: UvSelection,
	rect: UvRect
): Set<number> {
	const inside = vertsInRect(layout, uv, rect)
	if (selection.mode === 'vertex') return inside

	const ids = new Set<number>()
	if (selection.mode === 'edge') {
		layout.edges.forEach((edge, i) => {
			if (inside.has(edge.a) && inside.has(edge.b)) ids.add(i)
		})
		return ids
	}
	for (let f = 0; f < layout.faceCount; f++) {
		if (faceFullyIn(layout, f, inside)) {
			ids.add(selection.mode === 'face' ? f : layout.islandOfFace[f])
		}
	}
	return ids
}

export function uvStats(layout: UvLayout, uv: ArrayLike<number>, selection: UvSelection): UvStats {
	const picked = pickedVerts(layout, selection)
	const moving = movingVerts(layout, uv, selection)

	let offTileCount = 0
	for (let v = 0; v < layout.vertCount; v++) {
		if (!layout.facesOfVert[v].length) continue
		const u = uv[v * 2]
		const w = uv[v * 2 + 1]
		if (u < -1e-6 || u > 1 + 1e-6 || w < -1e-6 || w > 1 + 1e-6) offTileCount++
	}

	// Reported, never blocked: mirrored parts share texture space on purpose.
	const overlappingPairs = countOverlaps(layout.vertsOfIsland.map((verts) => boundsOf(uv, verts)))

	return {
		islandCount: layout.islandCount,
		seamCount: layout.seamCount,
		pickedCount: picked.size,
		movingCount: moving.size,
		stickyCount: moving.size - picked.size,
		offTileCount,
		overlappingPairs
	}
}

/**
 * How many pairs of island bounds intersect.
 *
 * A sweep along u rather than every pair against every other. This runs on
 * every pointer move of a drag, and comparing all pairs is quadratic in the
 * island count — which is not a proxy for mesh size: 400 separate cubes are
 * 2400 islands at only 4800 triangles, and cost more here than a 64k-triangle
 * mesh that happens to unwrap as one piece.
 *
 * Islands are visited left to right, and each is tested only against those
 * still open — the ones whose right edge has not yet passed its left. The
 * pruning is all this does; `rectsOverlap` still decides every pair, so the
 * count is the same one the exhaustive loop produced.
 */
function countOverlaps(bounds: UvRect[]) {
	const order = bounds.map((_, island) => island).sort((a, b) => bounds[a].u0 - bounds[b].u0)
	const open: number[] = []
	let pairs = 0

	for (const island of order) {
		const rect = bounds[island]
		let kept = 0
		for (const other of open) {
			// Closed for good: nothing further right can reach back to it either.
			if (bounds[other].u1 <= rect.u0) continue
			open[kept++] = other
			if (rectsOverlap(rect, bounds[other])) pairs++
		}
		open.length = kept
		open.push(island)
	}
	return pairs
}

function rectsOverlap(a: UvRect, b: UvRect) {
	return a.u0 < b.u1 - 1e-6 && b.u0 < a.u1 - 1e-6 && a.v0 < b.v1 - 1e-6 && b.v0 < a.v1 - 1e-6
}

function distanceToSegment(point: UvPoint, a: UvPoint, b: UvPoint) {
	const dx = b[0] - a[0]
	const dy = b[1] - a[1]
	const lengthSquared = dx * dx + dy * dy
	let t = lengthSquared ? ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared : 0
	t = Math.max(0, Math.min(1, t))
	return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy))
}

function pointInTriangle(point: UvPoint, a: UvPoint, b: UvPoint, c: UvPoint) {
	const denominator = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
	if (!denominator) return false
	const w1 = ((b[1] - c[1]) * (point[0] - c[0]) + (c[0] - b[0]) * (point[1] - c[1])) / denominator
	const w2 = ((c[1] - a[1]) * (point[0] - c[0]) + (a[0] - c[0]) * (point[1] - c[1])) / denominator
	return w1 >= 0 && w2 >= 0 && w1 + w2 <= 1
}
