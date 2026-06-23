import { describe, it, expect, vi } from 'vitest'
import { MathUtils } from 'three'
import THREE from '@/shared/three'
import { useInputFields } from './index'

describe('useInputFields', () => {
	describe('color', () => {
		it('stores a hex string as a THREE.Color and reads it back as hex', () => {
			const light = new THREE.PointLight()
			const { setProp, getProp } = useInputFields(light)

			setProp('color', 'color', '#ff8800')

			expect(light.color).toBeInstanceOf(THREE.Color)
			expect(getProp('color', 'color')).toBe('#ff8800')
		})

		it('falls back to black when the value is nullish', () => {
			const light = new THREE.PointLight()
			const { setProp, getProp } = useInputFields(light)

			setProp('color', 'color', null as unknown as string)

			expect(getProp('color', 'color')).toBe('#000000')
		})
	})

	describe('angle', () => {
		it('converts degrees to radians on set and back to degrees on get', () => {
			const light = new THREE.SpotLight()
			const { setProp, getProp } = useInputFields(light)

			setProp('angle', 'angle', 45)

			expect(light.angle).toBeCloseTo(MathUtils.degToRad(45))
			expect(getProp('angle', 'angle')).toBeCloseTo(45)
		})
	})

	describe('default pass-through', () => {
		it('assigns the raw value for non-color/angle types', () => {
			const light = new THREE.PointLight()
			const { setProp, getProp } = useInputFields(light)

			setProp('number', 'intensity', 7)

			expect(light.intensity).toBe(7)
			expect(getProp('number', 'intensity')).toBe(7)
		})
	})

	describe('mapSize side effect', () => {
		it('disposes and clears an existing shadow map when mapSize changes', () => {
			const shadow = new THREE.DirectionalLight().shadow
			const dispose = vi.fn()
			shadow.map = { dispose } as unknown as THREE.WebGLRenderTarget

			const { setProp } = useInputFields(shadow)
			setProp('vector2', 'mapSize', new THREE.Vector2(1024, 1024))

			expect(shadow.mapSize.width).toBe(1024)
			expect(dispose).toHaveBeenCalledOnce()
			expect(shadow.map).toBeNull()
		})

		it('does nothing to map when there is no existing map', () => {
			const shadow = new THREE.DirectionalLight().shadow
			shadow.map = null

			const { setProp } = useInputFields(shadow)
			expect(() => setProp('vector2', 'mapSize', new THREE.Vector2(512, 512))).not.toThrow()
			expect(shadow.map).toBeNull()
		})
	})
})
