import THREE from '@/shared/three'
import { createUvLayout, createUvSelection, type UvSelection } from '.'

/**
 * Shared setup for this module's tests.
 *
 * They run against the real primitives the editor creates, not hand-written
 * fixtures — coping with the vertex splitting those geometries produce is the
 * whole point of the module, and a hand-written layout would quietly assume it
 * away.
 */
export function read(geometry: THREE.BufferGeometry) {
	const layout = createUvLayout({
		position: geometry.attributes.position.array,
		uv: geometry.attributes.uv.array,
		index: geometry.index?.array ?? null
	})
	return { layout, uv: Float32Array.from(geometry.attributes.uv.array) }
}

export const cube = () => read(new THREE.BoxGeometry())
export const sphere = () => read(new THREE.SphereGeometry(1, 16, 12))

export function select(overrides: Partial<UvSelection> = {}): UvSelection {
	return { ...createUvSelection(), ...overrides }
}
