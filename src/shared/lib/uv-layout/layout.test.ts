import { describe, expect, it } from 'vitest'
import THREE from '@/shared/three'
import { uvStats } from '.'
import { cube, read, select, sphere } from './test-fixtures'

describe('createUvLayout', () => {
	it('splits a cube into six islands over eight mesh vertices', () => {
		const { layout } = cube()

		expect(layout.vertCount).toBe(24)
		expect(layout.uvVertsOfMeshVert).toHaveLength(8)
		expect(layout.faceCount).toBe(12)
		expect(layout.islandCount).toBe(6)
	})

	it('reports every cube corner as three UV vertices', () => {
		const { layout } = cube()

		const group = layout.uvVertsOfMeshVert[layout.meshVertOfUvVert[0]]

		expect(group).toHaveLength(3)
	})

	it('marks a torn mesh edge as a seam and an open border as not one', () => {
		const { layout } = cube()

		// Every cube edge is shared by two faces that were mapped separately,
		// so every UV border is a seam.
		expect(layout.edges.filter((edge) => edge.border && !edge.seam)).toHaveLength(0)
		expect(layout.seamCount).toBe(24)

		const plane = read(new THREE.PlaneGeometry())

		// A plane's outline is a real boundary, not a cut.
		expect(plane.layout.seamCount).toBe(0)
		expect(plane.layout.edges.filter((edge) => edge.border)).toHaveLength(4)
	})

	it('keeps a sphere as one island cut by a seam column', () => {
		const { layout } = sphere()

		expect(layout.islandCount).toBe(1)
		expect(layout.seamCount).toBeGreaterThan(0)
	})

	// Non-indexed geometry shares no vertex indices at all, so islands have to
	// come from mesh-edge adjacency or every triangle stands alone.
	it.each([
		['cube', () => new THREE.BoxGeometry(), 6],
		['sphere', () => new THREE.SphereGeometry(1, 16, 12), 1],
		['plane', () => new THREE.PlaneGeometry(), 1],
		['cylinder', () => new THREE.CylinderGeometry(1, 1, 2, 16, 1), 3],
		['torus', () => new THREE.TorusGeometry(1, 0.4, 12, 24), 1]
	])('finds the same islands in %s whether indexed or not', (_name, build, expected) => {
		const indexed = read(build())
		const nonIndexed = read(build().toNonIndexed())

		expect(indexed.layout.islandCount).toBe(expected)
		expect(nonIndexed.layout.islandCount).toBe(expected)
	})

	it('reports the same seams whether indexed or not', () => {
		expect(cube().layout.seamCount).toBe(24)
		expect(read(new THREE.BoxGeometry().toNonIndexed()).layout.seamCount).toBe(24)
	})

	it('welds mesh vertices that differ only by the sign of zero', () => {
		// Geometry generators emit `-0` freely, and `-0 === 0`, so two triangles
		// meeting on an axis must still count as meeting. Two triangles sharing
		// the edge (1,0,0)–(0,1,0), where one writes that 0 as `-0`.
		const geometry = new THREE.BufferGeometry()
		// prettier-ignore
		geometry.setAttribute('position', new THREE.Float32BufferAttribute([
			0, 0, 0,   1, 0, 0,   -0, 1, 0,
			0, 1, 0,   1, 0, 0,    1, 1, 0
		], 3))
		// prettier-ignore
		geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
			0, 0,   1, 0,   0, 1,
			0, 1,   1, 0,   1, 1
		], 2))

		const { layout } = read(geometry)

		expect(layout.uvVertsOfMeshVert).toHaveLength(4)
		expect(layout.islandCount).toBe(1)
	})

	it('does not fuse faces that merely overlap in the tile', () => {
		// Every face of a fresh primitive is mapped to the whole 0–1 tile, so
		// coincident UV points are everywhere. Only agreement along a shared
		// mesh edge may join two faces — welding by position would collapse
		// the cube to a single island.
		const { layout, uv } = cube()

		expect(uvStats(layout, uv, select()).overlappingPairs).toBe(15)
		expect(layout.islandCount).toBe(6)
	})
})
