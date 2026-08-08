import { quantize } from './same-spot'
import type { UvLayout, UvEdge } from './types'

/**
 * Hash a float by its bits, so grouping vertices by position stays exact
 * equality — no epsilon, no rounding — while costing no string per vertex.
 * A 65k-triangle non-indexed import is 195k vertices, and building a key
 * string for each was the single most expensive thing this module did.
 */
const bits = new Float64Array(1)
const bitsAsInts = new Int32Array(bits.buffer)
function hashFloat(n: number) {
	// `-0` and `0` have different bits but compare equal, so without this they
	// hash into different buckets and are never compared — silently splitting
	// mesh vertices that sit on an axis. Geometry generators emit `-0` freely.
	bits[0] = n === 0 ? 0 : n
	return bitsAsInts[0] ^ bitsAsInts[1]
}
function hashPosition(a: ArrayLike<number>, i: number) {
	let h = 0x811c9dc5
	h = Math.imul(h ^ hashFloat(a[i * 3]), 0x01000193)
	h = Math.imul(h ^ hashFloat(a[i * 3 + 1]), 0x01000193)
	h = Math.imul(h ^ hashFloat(a[i * 3 + 2]), 0x01000193)
	return h
}
const samePosition = (a: ArrayLike<number>, i: number, j: number) =>
	a[i * 3] === a[j * 3] && a[i * 3 + 1] === a[j * 3 + 1] && a[i * 3 + 2] === a[j * 3 + 2]

/**
 * One face's use of a mesh edge, with the quantised UVs it puts at each end.
 * Ends are ordered by mesh vertex id so two faces walking the edge in opposite
 * directions are still comparable.
 */
interface MeshEdgeUse {
	face: number
	fromU: number
	fromV: number
	toU: number
	toV: number
}

const sameUvs = (a: MeshEdgeUse, b: MeshEdgeUse) =>
	a.fromU === b.fromU && a.fromV === b.fromV && a.toU === b.toU && a.toV === b.toV

/**
 * Read a geometry's topology once, so every later question about it is a lookup
 * rather than a scan. Takes the raw attribute arrays rather than a
 * `BufferGeometry` so it stays free of Three.js and testable on its own.
 *
 * `index` may be null for non-indexed geometry, in which case vertices are
 * consumed three at a time.
 *
 * Islands are derived from **mesh edges**, not from shared UV vertex indices.
 * Two faces belong to the same island when they meet along a mesh edge and put
 * the same UV coordinates at both of its ends — the texture flows across that
 * edge without a break. Sharing a UV vertex index also joins them, since such
 * faces are literally welded and cannot move apart.
 *
 * Doing it by index alone would be simpler and is wrong for non-indexed
 * geometry, where nothing is shared and every triangle would be its own island.
 * Doing it by welding coincident UV points would be wrong the other way: a
 * freshly built primitive maps every face to the whole 0–1 tile, so coincident
 * points are everywhere and genuinely separate faces would fuse. Only agreement
 * *along a shared mesh edge* distinguishes the two cases.
 *
 * Runs once per mesh, and on a 65k-triangle import that is the difference
 * between a hitch and a freeze — hence the numeric map keys rather than the
 * obvious template strings.
 */
export function createUvLayout(geometry: {
	position: ArrayLike<number>
	uv: ArrayLike<number>
	index: ArrayLike<number> | null
}): UvLayout {
	const { position, uv, index } = geometry
	const vertCount = position.length / 3
	const faces = index
		? Uint32Array.from(index)
		: Uint32Array.from({ length: vertCount }, (_, i) => i)
	const faceCount = Math.floor(faces.length / 3)

	// Which UV vertices are really the same point in 3D. A cube corner is one
	// mesh vertex and three UV vertices; nothing downstream can tell them apart,
	// so it is resolved here, once.
	const meshVertOfUvVert = new Int32Array(vertCount).fill(-1)
	const uvVertsOfMeshVert: number[][] = []
	// Hash buckets rather than a key map: collisions are resolved by comparing
	// the coordinates outright, so distinct positions never merge.
	const byPosition = new Map<number, number[]>()
	for (let v = 0; v < vertCount; v++) {
		const bucket = byPosition.get(hashPosition(position, v))
		let group = -1
		if (bucket) {
			for (const candidate of bucket) {
				if (samePosition(position, v, uvVertsOfMeshVert[candidate][0])) {
					group = candidate
					break
				}
			}
		}
		if (group < 0) {
			group = uvVertsOfMeshVert.length
			uvVertsOfMeshVert.push([])
			if (bucket) bucket.push(group)
			else byPosition.set(hashPosition(position, v), [group])
		}
		meshVertOfUvVert[v] = group
		uvVertsOfMeshVert[group].push(v)
	}

	// Quantised once so edge comparisons are integer equality rather than
	// float comparisons with an epsilon at every use.
	const quantU = new Int32Array(vertCount)
	const quantV = new Int32Array(vertCount)
	for (let v = 0; v < vertCount; v++) {
		quantU[v] = quantize(uv[v * 2])
		quantV[v] = quantize(uv[v * 2 + 1])
	}

	// Pairs are packed into one number instead of a string. Both id spaces fit
	// well inside 2^53, so the products stay exact.
	const meshVertCount = uvVertsOfMeshVert.length
	const meshEdgeId = (a: number, b: number) =>
		a < b ? a * meshVertCount + b : b * meshVertCount + a
	const uvEdgeId = (a: number, b: number) => (a < b ? a * vertCount + b : b * vertCount + a)

	// Walk every face corner once, collecting what the rest of the function
	// needs: which faces touch each UV vertex, which faces meet along each mesh
	// edge and with what UVs, and the UV edges themselves.
	const facesOfVert: number[][] = Array.from({ length: vertCount }, () => [])
	const meshEdgeUses = new Map<number, MeshEdgeUse[]>()
	const seenUvEdges = new Set<number>()
	const uvEdgeList: { a: number; b: number; meshEdge: number }[] = []

	for (let f = 0; f < faceCount; f++) {
		for (let k = 0; k < 3; k++) {
			const a = faces[f * 3 + k]
			const b = faces[f * 3 + ((k + 1) % 3)]
			facesOfVert[a].push(f)

			const meshA = meshVertOfUvVert[a]
			const meshB = meshVertOfUvVert[b]
			// A degenerate edge — both ends the same point in 3D, as at a pole —
			// joins nothing and has no meaningful mesh edge.
			const meshEdge = meshA === meshB ? -1 : meshEdgeId(meshA, meshB)

			const uvEdge = uvEdgeId(a, b)
			if (!seenUvEdges.has(uvEdge)) {
				seenUvEdges.add(uvEdge)
				uvEdgeList.push({ a, b, meshEdge })
			}

			if (meshEdge < 0) continue
			const forward = meshA < meshB
			const from = forward ? a : b
			const to = forward ? b : a
			const use: MeshEdgeUse = {
				face: f,
				fromU: quantU[from],
				fromV: quantV[from],
				toU: quantU[to],
				toV: quantV[to]
			}
			const uses = meshEdgeUses.get(meshEdge)
			if (uses) uses.push(use)
			else meshEdgeUses.set(meshEdge, [use])
		}
	}

	// Islands, as a union-find over faces.
	const parent = new Int32Array(faceCount)
	for (let f = 0; f < faceCount; f++) parent[f] = f
	const find = (x: number): number => {
		while (parent[x] !== x) x = parent[x] = parent[parent[x]]
		return x
	}
	const union = (a: number, b: number) => {
		const rootA = find(a)
		const rootB = find(b)
		if (rootA !== rootB) parent[rootA] = rootB
	}

	// Faces sharing a UV vertex are welded — moving it moves both.
	for (const touching of facesOfVert) {
		for (let i = 1; i < touching.length; i++) union(touching[0], touching[i])
	}

	// Faces meeting along a mesh edge with matching UVs at both ends are
	// continuous across it.
	const continuousEdges = new Set<number>()
	for (const [edge, uses] of meshEdgeUses) {
		if (uses.length < 2) continue
		if (uses.length === 2) {
			// The manifold case, and the one worth keeping allocation-free.
			if (sameUvs(uses[0], uses[1])) {
				union(uses[0].face, uses[1].face)
				continuousEdges.add(edge)
			}
			continue
		}
		// Three or more faces on one edge is non-manifold; group them so only
		// the ones that actually agree are joined.
		let groups = 0
		const claimed = new Uint8Array(uses.length)
		for (let i = 0; i < uses.length; i++) {
			if (claimed[i]) continue
			groups++
			for (let j = i + 1; j < uses.length; j++) {
				if (claimed[j] || !sameUvs(uses[i], uses[j])) continue
				claimed[j] = 1
				union(uses[i].face, uses[j].face)
			}
		}
		if (groups === 1) continuousEdges.add(edge)
	}

	const islandOfRoot = new Map<number, number>()
	const islandOfFace = new Int32Array(faceCount).fill(-1)
	for (let f = 0; f < faceCount; f++) {
		const root = find(f)
		let island = islandOfRoot.get(root)
		if (island === undefined) {
			island = islandOfRoot.size
			islandOfRoot.set(root, island)
		}
		islandOfFace[f] = island
	}
	const islandCount = islandOfRoot.size

	// Every face touching a UV vertex is in the same island — that is what the
	// weld rule above guarantees — so this is unambiguous.
	const islandOfVert = new Int32Array(vertCount).fill(-1)
	for (let v = 0; v < vertCount; v++) {
		if (facesOfVert[v].length) islandOfVert[v] = islandOfFace[facesOfVert[v][0]]
	}

	const vertsOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	const facesOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	for (let v = 0; v < vertCount; v++) {
		if (islandOfVert[v] >= 0) vertsOfIsland[islandOfVert[v]].push(v)
	}
	for (let f = 0; f < faceCount; f++) facesOfIsland[islandOfFace[f]].push(f)

	// A UV edge is a border when the layout stops there, and a seam when it
	// stops there *because* the mesh edge was cut rather than because the mesh
	// ends. Both are read from the mesh edge, so a non-indexed geometry — where
	// no UV edge is ever shared — does not report every edge as a border.
	const edges: UvEdge[] = []
	let seamCount = 0
	for (const edge of uvEdgeList) {
		const continuous = continuousEdges.has(edge.meshEdge)
		const shared = edge.meshEdge >= 0 && (meshEdgeUses.get(edge.meshEdge)?.length ?? 0) > 1
		const seam = shared && !continuous
		if (seam) seamCount++
		edges.push({ a: edge.a, b: edge.b, border: !continuous, seam })
	}

	return {
		faces,
		faceCount,
		vertCount,
		meshVertOfUvVert,
		uvVertsOfMeshVert,
		islandOfVert,
		islandOfFace,
		islandCount,
		vertsOfIsland,
		facesOfIsland,
		facesOfVert,
		edges,
		seamCount
	}
}
