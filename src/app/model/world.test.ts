import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import THREE from '@/shared/three'
import { useWorldStore } from './world'
import { VIEWPORT_BACKDROP, type WorldSnapshot } from './types/world'

describe('useWorldStore', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
	})

	describe('surface', () => {
		it('defaults to the viewport backdrop, so a new project looks unchanged', () => {
			const world = useWorldStore()

			expect(world.surface).toEqual({ kind: 'color', color: VIEWPORT_BACKDROP })
			expect(world.background().getHex()).toBe(new THREE.Color(VIEWPORT_BACKDROP).getHex())
		})

		it('reports the chosen colour as the scene background', () => {
			const world = useWorldStore()

			world.setSurfaceColor('#ff0000')

			expect(world.background().getHexString()).toBe('ff0000')
		})
	})

	describe('fog', () => {
		it('is off by default and produces no scene fog', () => {
			const world = useWorldStore()

			expect(world.fog.kind).toBe('none')
			expect(world.sceneFog()).toBeNull()
		})

		it('builds a linear fog from near and far', () => {
			const world = useWorldStore()

			world.setFogKind('linear')
			expect(world.fog).toMatchObject({ kind: 'linear' })
			if (world.fog.kind !== 'linear') throw new Error('expected linear fog')
			world.fog.near = 5
			world.fog.far = 50

			const fog = world.sceneFog()
			expect(fog).toBeInstanceOf(THREE.Fog)
			expect((fog as THREE.Fog).near).toBe(5)
			expect((fog as THREE.Fog).far).toBe(50)
		})

		it('builds an exponential fog from density', () => {
			const world = useWorldStore()

			world.setFogKind('exp2')
			if (world.fog.kind !== 'exp2') throw new Error('expected exp2 fog')
			world.fog.density = 0.5

			const fog = world.sceneFog()
			expect(fog).toBeInstanceOf(THREE.FogExp2)
			expect((fog as THREE.FogExp2).density).toBe(0.5)
		})

		it('leaves the fog alone when set to the kind it already is', () => {
			const world = useWorldStore()
			world.setFogKind('linear')
			if (world.fog.kind !== 'linear') throw new Error('expected linear fog')
			world.fog.near = 42

			world.setFogKind('linear')

			expect(world.fog).toMatchObject({ kind: 'linear', near: 42 })
		})
	})

	describe('snapshot / restore', () => {
		it('round-trips through a plain object', () => {
			const world = useWorldStore()
			world.setSurfaceColor('#123456')
			world.strength = 2.5
			world.setFogKind('exp2')

			const saved = JSON.parse(JSON.stringify(world.snapshot())) as WorldSnapshot
			world.setSurfaceColor('#000000')
			world.strength = 1
			world.setFogKind('none')

			world.restore(saved)

			expect(world.surface).toEqual({ kind: 'color', color: '#123456' })
			expect(world.strength).toBe(2.5)
			expect(world.fog.kind).toBe('exp2')
		})

		it('snapshots by value, so later edits do not reach a saved copy', () => {
			const world = useWorldStore()
			world.setFogKind('linear')

			const saved = world.snapshot()
			world.setSurfaceColor('#abcdef')
			if (world.fog.kind !== 'linear') throw new Error('expected linear fog')
			world.fog.near = 999

			expect(saved.surface.color).toBe(VIEWPORT_BACKDROP)
			expect(saved.fog).toMatchObject({ near: 1 })
		})

		it('falls back to the default World for a project saved before it existed', () => {
			const world = useWorldStore()
			world.setSurfaceColor('#ff0000')
			world.strength = 9
			world.setFogKind('linear')

			world.restore(undefined)

			expect(world.surface).toEqual({ kind: 'color', color: VIEWPORT_BACKDROP })
			expect(world.strength).toBe(1)
			expect(world.fog.kind).toBe('none')
		})
	})
})
