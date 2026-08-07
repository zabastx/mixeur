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

	describe('afterWrite', () => {
		it('runs after the assignment has landed, with the object and property', () => {
			const light = new THREE.PointLight()
			const afterWrite = vi.fn(() => expect(light.intensity).toBe(4))

			createObjectTarget(() => light, { afterWrite }).write('intensity', 4)

			expect(afterWrite).toHaveBeenCalledExactlyOnceWith(light, 'intensity')
		})

		it('is not called when there is nothing to write to', () => {
			const afterWrite = vi.fn()

			createObjectTarget<THREE.PointLight>(() => null, { afterWrite }).write('intensity', 4)

			expect(afterWrite).not.toHaveBeenCalled()
		})
	})
})
