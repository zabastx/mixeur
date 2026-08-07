import { describe, expect, it } from 'vitest'
import { MathUtils } from 'three'
import THREE from '@/shared/three'
import { decode, encode, fieldFormatOptions } from './marshal'

describe('decode', () => {
	it('reads a colour back as a hex string', () => {
		expect(decode('color', new THREE.Color('#ff8800'))).toBe('#ff8800')
	})

	it('falls back to black when there is no colour to read', () => {
		expect(decode('color', undefined)).toBe('#000000')
		expect(decode('color', null)).toBe('#000000')
	})

	it('reads an angle as degrees', () => {
		expect(decode('angle', Math.PI / 4)).toBeCloseTo(45)
	})

	it('reads a missing angle as zero rather than NaN', () => {
		expect(decode('angle', undefined)).toBe(0)
	})

	it('reads a range as a plain tuple, which is what the slider binds to', () => {
		expect(decode('range', new THREE.Vector2(2, 8))).toEqual([2, 8])
	})

	it('reads an absent range as an empty tuple', () => {
		expect(decode('range', undefined)).toEqual([])
	})

	it('passes every other type through untouched', () => {
		const texture = new THREE.Texture()

		expect(decode('number', 7)).toBe(7)
		expect(decode('checkbox', true)).toBe(true)
		expect(decode('select', THREE.FrontSide)).toBe(THREE.FrontSide)
		expect(decode('map', texture)).toBe(texture)
	})
})

describe('encode', () => {
	it('stores a hex string as a THREE.Color', () => {
		const stored = encode('color', '#ff8800')

		expect(stored).toBeInstanceOf(THREE.Color)
		expect((stored as THREE.Color).getHexString()).toBe('ff8800')
	})

	it('stores a nullish colour as black', () => {
		expect((encode('color', undefined as unknown as string) as THREE.Color).getHexString()).toBe(
			'000000'
		)
	})

	it('stores an angle as radians', () => {
		expect(encode('angle', 45)).toBeCloseTo(MathUtils.degToRad(45))
	})

	it('stores a nullish angle as zero', () => {
		expect(encode('angle', undefined)).toBe(0)
	})

	it('stores a range as a THREE.Vector2', () => {
		const stored = encode('range', [2, 8])

		expect(stored).toBeInstanceOf(THREE.Vector2)
		expect((stored as THREE.Vector2).toArray()).toEqual([2, 8])
	})

	it('passes every other type through untouched', () => {
		const euler = new THREE.Euler(0, 1, 0)

		expect(encode('number', 7)).toBe(7)
		expect(encode('checkbox', 'indeterminate')).toBe('indeterminate')
		expect(encode('euler', euler)).toBe(euler)
	})
})

describe('decode/encode round trip', () => {
	it('survives a colour', () => {
		expect(decode('color', encode('color', '#123456'))).toBe('#123456')
	})

	it('survives an angle', () => {
		expect(decode('angle', encode('angle', 30))).toBeCloseTo(30)
	})

	it('survives a range', () => {
		expect(decode('range', encode('range', [1, 4]))).toEqual([1, 4])
	})
})

describe('fieldFormatOptions', () => {
	it('formats angles as degrees by default', () => {
		expect(fieldFormatOptions('angle')).toEqual({
			style: 'unit',
			unitDisplay: 'narrow',
			unit: 'degree'
		})
	})

	it('lets a field override the degree default', () => {
		const explicit = { maximumFractionDigits: 4 }

		expect(fieldFormatOptions('angle', explicit)).toBe(explicit)
	})

	it('leaves other types unformatted unless the field says otherwise', () => {
		const explicit = { maximumFractionDigits: 0 }

		expect(fieldFormatOptions('number')).toBeUndefined()
		expect(fieldFormatOptions('vector2', explicit)).toBe(explicit)
	})
})
