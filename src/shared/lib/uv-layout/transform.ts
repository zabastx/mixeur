import { centroid, movingVerts } from './selection'
import type { UvLayout, UvPoint, UvRect, UvSelection, UvTransform } from './types'

/**
 * Move, rotate and scale are one operation. Returns a new buffer; the caller
 * decides when to write it back to the geometry.
 *
 * `moved` is the count the UI reports — it is `movingVerts`, not the number of
 * things clicked, and the gap between the two is the sticky rule at work.
 */
export function transformUvs(
	layout: UvLayout,
	uv: Float32Array,
	selection: UvSelection,
	operation: UvTransform
): { uv: Float32Array; moved: number } {
	const verts = movingVerts(layout, uv, selection)
	if (!verts.size) return { uv, moved: 0 }

	const next = Float32Array.from(uv)
	const pivotOf = pivotResolver(layout, uv, verts, selection)
	const cos = operation.rotate ? Math.cos(operation.rotate) : 1
	const sin = operation.rotate ? Math.sin(operation.rotate) : 0

	for (const vert of verts) {
		let u = uv[vert * 2]
		let v = uv[vert * 2 + 1]

		if (operation.rotate || operation.scale) {
			const [pivotU, pivotV] = pivotOf(vert)
			let du = u - pivotU
			let dv = v - pivotV
			if (operation.scale) {
				du *= operation.scale[0]
				dv *= operation.scale[1]
			}
			if (operation.rotate) {
				const rotated = du * cos - dv * sin
				dv = du * sin + dv * cos
				du = rotated
			}
			u = pivotU + du
			v = pivotV + dv
		}
		if (operation.translate) {
			u += operation.translate[0]
			v += operation.translate[1]
		}

		next[vert * 2] = u
		next[vert * 2 + 1] = v
	}

	return { uv: next, moved: verts.size }
}

/**
 * Where each moving vertex turns around. `individual` gives every island its
 * own centre, which is why rotating two islands at once has two right answers
 * and the mode cannot be retrofitted later.
 */
function pivotResolver(
	layout: UvLayout,
	uv: ArrayLike<number>,
	verts: Set<number>,
	selection: UvSelection
): (vert: number) => UvPoint {
	if (selection.pivot === 'cursor') {
		const cursor = selection.cursor
		return () => cursor
	}

	if (selection.pivot === 'individual') {
		const sums = new Map<number, [number, number, number]>()
		for (const vert of verts) {
			const island = layout.islandOfVert[vert]
			const sum = sums.get(island) ?? [0, 0, 0]
			sum[0] += uv[vert * 2]
			sum[1] += uv[vert * 2 + 1]
			sum[2]++
			sums.set(island, sum)
		}
		const centres = new Map<number, UvPoint>()
		for (const [island, [u, v, count]] of sums) centres.set(island, [u / count, v / count])
		return (vert) => centres.get(layout.islandOfVert[vert]) ?? [0.5, 0.5]
	}

	const median = centroid(uv, verts)
	return () => median
}

/**
 * Lay every island out in a grid inside the tile.
 *
 * Not an unwrap — island shapes are untouched, only moved and uniformly scaled.
 * It exists because Three.js maps every primitive face to the *whole* 0–1 tile,
 * so a freshly created cube is six islands stacked exactly on top of each
 * other and there is nothing legible to edit until they are spread out.
 */
export function packIslands(layout: UvLayout, uv: Float32Array, margin = 0.015): Float32Array {
	if (!layout.islandCount) return uv
	const columns = Math.ceil(Math.sqrt(layout.islandCount))
	const rows = Math.ceil(layout.islandCount / columns)
	const cellWidth = 1 / columns
	const cellHeight = 1 / rows
	const next = Float32Array.from(uv)

	for (let island = 0; island < layout.islandCount; island++) {
		const verts = layout.vertsOfIsland[island]
		const bounds = boundsOf(uv, verts)
		const width = bounds.u1 - bounds.u0 || 1e-6
		const height = bounds.v1 - bounds.v0 || 1e-6
		const fitWidth = cellWidth - margin * 2
		const fitHeight = cellHeight - margin * 2
		const scale = Math.min(fitWidth / width, fitHeight / height)
		const originU = (island % columns) * cellWidth + margin + (fitWidth - width * scale) / 2
		const originV =
			Math.floor(island / columns) * cellHeight + margin + (fitHeight - height * scale) / 2

		for (const vert of verts) {
			next[vert * 2] = originU + (uv[vert * 2] - bounds.u0) * scale
			next[vert * 2 + 1] = originV + (uv[vert * 2 + 1] - bounds.v0) * scale
		}
	}
	return next
}

/**
 * Collapse selected UV vertices that are nearly coincident onto their average.
 * This is how a seam gets closed on purpose — and closing one is usually not a
 * repair, so it stays an explicit action rather than something a drag can do.
 */
export function weldUvs(
	layout: UvLayout,
	uv: Float32Array,
	selection: UvSelection,
	threshold = 0.02
): { uv: Float32Array; welded: number } {
	const next = Float32Array.from(uv)
	const cells = new Map<string, number[]>()
	const quantize = (n: number) => Math.round(n / threshold)

	for (const vert of movingVerts(layout, uv, selection)) {
		const key = `${quantize(uv[vert * 2])}|${quantize(uv[vert * 2 + 1])}`
		const cell = cells.get(key)
		if (cell) cell.push(vert)
		else cells.set(key, [vert])
	}

	let welded = 0
	for (const group of cells.values()) {
		if (group.length < 2) continue
		const [u, v] = centroid(uv, group)
		for (const vert of group) {
			next[vert * 2] = u
			next[vert * 2 + 1] = v
		}
		welded += group.length
	}
	return { uv: next, welded }
}

export function boundsOf(uv: ArrayLike<number>, verts: Iterable<number>): UvRect {
	let u0 = Infinity
	let v0 = Infinity
	let u1 = -Infinity
	let v1 = -Infinity
	for (const vert of verts) {
		u0 = Math.min(u0, uv[vert * 2])
		u1 = Math.max(u1, uv[vert * 2])
		v0 = Math.min(v0, uv[vert * 2 + 1])
		v1 = Math.max(v1, uv[vert * 2 + 1])
	}
	return { u0, v0, u1, v1 }
}
