import type { UvLayout, UvEdge } from './types'

const positionKey = (a: ArrayLike<number>, i: number) =>
	`${a[i * 3]}|${a[i * 3 + 1]}|${a[i * 3 + 2]}`

const edgeKey = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`)

/**
 * Read a geometry's topology once, so every later question about it is a lookup
 * rather than a scan. Takes the raw attribute arrays rather than a
 * `BufferGeometry` so it stays free of Three.js and testable on its own.
 *
 * `index` may be null for non-indexed geometry, in which case vertices are
 * consumed three at a time.
 *
 * Note what that costs: islands are connected runs of faces over *shared UV
 * vertices*, and a non-indexed geometry shares none, so every triangle becomes
 * its own island. Vertex, edge and face editing still behave; island selection
 * degrades to picking one triangle at a time. Deriving adjacency from mesh
 * edges instead would fix it, but it cannot be done by welding coincident UV
 * points — a freshly built primitive stacks its faces on the same tile, and
 * welding would fuse islands that are genuinely separate.
 */
export function createUvLayout(geometry: {
	position: ArrayLike<number>
	index: ArrayLike<number> | null
}): UvLayout {
	const { position, index } = geometry
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
	const byPosition = new Map<string, number>()
	for (let v = 0; v < vertCount; v++) {
		const key = positionKey(position, v)
		let group = byPosition.get(key)
		if (group === undefined) {
			group = uvVertsOfMeshVert.length
			byPosition.set(key, group)
			uvVertsOfMeshVert.push([])
		}
		meshVertOfUvVert[v] = group
		uvVertsOfMeshVert[group].push(v)
	}

	// Islands are connected components of faces over shared UV vertices, which
	// makes them a union-find over the index buffer and nothing more.
	const parent = new Int32Array(vertCount)
	for (let i = 0; i < vertCount; i++) parent[i] = i
	const find = (x: number): number => {
		while (parent[x] !== x) x = parent[x] = parent[parent[x]]
		return x
	}
	const union = (a: number, b: number) => {
		const rootA = find(a)
		const rootB = find(b)
		if (rootA !== rootB) parent[rootA] = rootB
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
		let island = islandOfRoot.get(root)
		if (island === undefined) {
			island = islandOfRoot.size
			islandOfRoot.set(root, island)
		}
		islandOfFace[f] = island
		for (let k = 0; k < 3; k++) islandOfVert[faces[f * 3 + k]] = island
	}
	const islandCount = islandOfRoot.size
	const vertsOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	const facesOfIsland: number[][] = Array.from({ length: islandCount }, () => [])
	for (let v = 0; v < vertCount; v++) {
		if (islandOfVert[v] >= 0) vertsOfIsland[islandOfVert[v]].push(v)
	}
	for (let f = 0; f < faceCount; f++) facesOfIsland[islandOfFace[f]].push(f)

	// A UV edge used by one face is a border. A border whose *mesh* edge is used
	// by two faces is a seam: the island was cut there rather than ending there.
	const uvEdges = new Map<string, { a: number; b: number; faces: number[] }>()
	const meshEdgeUse = new Map<string, number>()
	const facesOfVert: number[][] = Array.from({ length: vertCount }, () => [])
	for (let f = 0; f < faceCount; f++) {
		for (let k = 0; k < 3; k++) {
			const a = faces[f * 3 + k]
			const b = faces[f * 3 + ((k + 1) % 3)]
			const uvKey = edgeKey(a, b)
			const existing = uvEdges.get(uvKey)
			if (existing) existing.faces.push(f)
			else uvEdges.set(uvKey, { a, b, faces: [f] })
			const meshKey = edgeKey(meshVertOfUvVert[a], meshVertOfUvVert[b])
			meshEdgeUse.set(meshKey, (meshEdgeUse.get(meshKey) ?? 0) + 1)
			facesOfVert[a].push(f)
		}
	}

	const edges: UvEdge[] = []
	for (const edge of uvEdges.values()) {
		const border = edge.faces.length === 1
		const meshKey = edgeKey(meshVertOfUvVert[edge.a], meshVertOfUvVert[edge.b])
		edges.push({
			a: edge.a,
			b: edge.b,
			faces: edge.faces,
			border,
			seam: border && (meshEdgeUse.get(meshKey) ?? 0) > 1
		})
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
		seamCount: edges.reduce((n, edge) => n + (edge.seam ? 1 : 0), 0)
	}
}
