import { describe, expect, it, vi } from 'vitest'
import THREE from '@/shared/three'
import { invalidateShadowMap } from './fields'

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
