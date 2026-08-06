import { describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { getLightFields, invalidateShadowMap } from './fields'

describe('getLightFields', () => {
	it('puts the fields every light shares first', () => {
		const props = getLightFields(new THREE.PointLight()).map((field) => field.prop)

		expect(props.slice(0, 2)).toEqual(['color', 'intensity'])
	})

	it('adds the fields specific to each light type', () => {
		const propsOf = (light: THREE.Light) => getLightFields(light).map((field) => field.prop)

		expect(propsOf(new THREE.SpotLight())).toContain('penumbra')
		expect(propsOf(new THREE.PointLight())).not.toContain('penumbra')
		expect(propsOf(new THREE.RectAreaLight())).toContain('width')
	})

	it('offers only the shared fields for a light with no extras', () => {
		expect(getLightFields(new THREE.AmbientLight()).map((field) => field.prop)).toEqual([
			'color',
			'intensity'
		])
	})
})

describe('invalidateShadowMap', () => {
	it('disposes and clears the render target when mapSize changes', () => {
		const shadow = new THREE.DirectionalLight().shadow
		const dispose = vi.fn()
		shadow.map = { dispose } as unknown as THREE.WebGLRenderTarget

		invalidateShadowMap(shadow, 'mapSize')

		expect(dispose).toHaveBeenCalledOnce()
		expect(shadow.map).toBeNull()
	})

	it('does nothing when there is no render target to drop', () => {
		const shadow = new THREE.DirectionalLight().shadow
		shadow.map = null

		expect(() => invalidateShadowMap(shadow, 'mapSize')).not.toThrow()
		expect(shadow.map).toBeNull()
	})

	it('leaves the render target alone for every other property', () => {
		const shadow = new THREE.DirectionalLight().shadow
		const dispose = vi.fn()
		shadow.map = { dispose } as unknown as THREE.WebGLRenderTarget

		invalidateShadowMap(shadow, 'bias')

		expect(dispose).not.toHaveBeenCalled()
		expect(shadow.map).not.toBeNull()
	})
})
