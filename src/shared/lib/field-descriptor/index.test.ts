import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { MathUtils } from 'three'
import THREE from '@/shared/three'
import { createObjectTarget, useFields } from './index'
import type { FieldDescriptor, FieldTarget } from './types'

describe('useFields', () => {
	it('marshals values in both directions on the way through the target', () => {
		const light = new THREE.SpotLight()
		const { getValue, setValue } = useFields(createObjectTarget(() => light))

		setValue('color', 'color', '#ff8800')
		setValue('angle', 'angle', 45)

		expect(light.color).toBeInstanceOf(THREE.Color)
		expect(light.angle).toBeCloseTo(MathUtils.degToRad(45))

		expect(getValue('color', 'color')).toBe('#ff8800')
		expect(getValue('angle', 'angle')).toBeCloseTo(45)
	})

	it('reads a target swapped in after construction', () => {
		const first = new THREE.PointLight(undefined, 1)
		const second = new THREE.PointLight(undefined, 9)
		const target = shallowRef<FieldTarget<THREE.PointLight>>(createObjectTarget(() => first))
		const { getValue } = useFields(target)

		expect(getValue('number', 'intensity')).toBe(1)

		target.value = createObjectTarget(() => second)

		expect(getValue('number', 'intensity')).toBe(9)
	})

	describe('enabledIf', () => {
		const opacity: FieldDescriptor<THREE.MeshStandardMaterial> = {
			type: 'number',
			label: 'Opacity',
			prop: 'opacity',
			enabledIf: 'transparent'
		}

		it('disables a field while the named property is falsy', () => {
			const material = new THREE.MeshStandardMaterial({ transparent: false })
			const { isEnabled } = useFields(createObjectTarget(() => material))

			expect(isEnabled(opacity)).toBe(false)
		})

		it('enables it once the named property is truthy', () => {
			const material = new THREE.MeshStandardMaterial({ transparent: true })
			const { isEnabled } = useFields(createObjectTarget(() => material))

			expect(isEnabled(opacity)).toBe(true)
		})

		it('treats a zeroed numeric property as falsy', () => {
			const material = new THREE.MeshPhysicalMaterial({ anisotropy: 0 })
			const { isEnabled } = useFields(createObjectTarget(() => material))

			const anisotropyMap: FieldDescriptor<THREE.MeshPhysicalMaterial> = {
				type: 'map',
				label: 'Anisotropy Map',
				prop: 'anisotropyMap',
				enabledIf: 'anisotropy'
			}

			expect(isEnabled(anisotropyMap)).toBe(false)

			material.anisotropy = 0.5

			expect(isEnabled(anisotropyMap)).toBe(true)
		})

		it('enables a field that declares no condition', () => {
			const light = new THREE.PointLight()
			const { isEnabled } = useFields(createObjectTarget(() => light))

			expect(isEnabled({ type: 'number', label: 'Intensity', prop: 'intensity' })).toBe(true)
		})
	})
})
