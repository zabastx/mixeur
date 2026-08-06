import { describe, expect, it, vi } from 'vitest'
import { shallowRef, watchSyncEffect } from 'vue'
import THREE from '@/shared/three'
import { createObjectTarget } from './object-target'

describe('createObjectTarget', () => {
	it('reads and writes the object in place', () => {
		const light = new THREE.PointLight()
		const target = createObjectTarget(() => light)

		target.write('intensity', 7)

		expect(light.intensity).toBe(7)
		expect(target.read('intensity')).toBe(7)
	})

	it('makes an in-place mutation visible to an effect that read the property', () => {
		const light = new THREE.PointLight()
		const target = createObjectTarget(() => light)
		const seen: unknown[] = []

		watchSyncEffect(() => seen.push(target.read('intensity')))
		target.write('intensity', 4)

		expect(seen).toEqual([1, 4])
	})

	it('resolves the source on every access, so the target follows the selection', () => {
		const first = new THREE.PointLight(undefined, 1)
		const second = new THREE.PointLight(undefined, 9)
		const selected = shallowRef(first)
		const target = createObjectTarget(selected)

		expect(target.read('intensity')).toBe(1)

		selected.value = second

		expect(target.read('intensity')).toBe(9)
	})

	it('repaints when the source changes even without a write', () => {
		const selected = shallowRef(new THREE.PointLight(undefined, 1))
		const target = createObjectTarget(selected)
		const seen: unknown[] = []

		watchSyncEffect(() => seen.push(target.read('intensity')))
		selected.value = new THREE.PointLight(undefined, 3)

		expect(seen).toEqual([1, 3])
	})

	it('reads undefined and ignores writes while nothing is selected', () => {
		const target = createObjectTarget<THREE.PointLight>(() => null)

		expect(target.read('intensity')).toBeUndefined()
		expect(() => target.write('intensity', 5)).not.toThrow()
	})

	describe('shadow map invalidation', () => {
		it('disposes and clears the render target when mapSize changes', () => {
			const shadow = new THREE.DirectionalLight().shadow
			const dispose = vi.fn()
			shadow.map = { dispose } as unknown as THREE.WebGLRenderTarget

			const target = createObjectTarget(() => shadow)
			target.write('mapSize', new THREE.Vector2(1024, 1024))

			expect(shadow.mapSize.width).toBe(1024)
			expect(dispose).toHaveBeenCalledOnce()
			expect(shadow.map).toBeNull()
		})

		it('does nothing when there is no render target to drop', () => {
			const shadow = new THREE.DirectionalLight().shadow
			shadow.map = null

			const target = createObjectTarget(() => shadow)

			expect(() => target.write('mapSize', new THREE.Vector2(512, 512))).not.toThrow()
			expect(shadow.map).toBeNull()
		})

		it('leaves the render target alone for every other property', () => {
			const shadow = new THREE.DirectionalLight().shadow
			const dispose = vi.fn()
			shadow.map = { dispose } as unknown as THREE.WebGLRenderTarget

			const target = createObjectTarget(() => shadow)
			target.write('bias', -0.001)

			expect(dispose).not.toHaveBeenCalled()
			expect(shadow.map).not.toBeNull()
		})
	})
})
