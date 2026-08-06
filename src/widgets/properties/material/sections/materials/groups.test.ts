import { describe, expect, it } from 'vitest'
import type THREE from '@/shared/three'
import {
	alphaGroup,
	ambientOcclusionGroup,
	emissionGroup,
	environmentGroup,
	lightGroup,
	normalBumpGroup
} from './groups'

function props(group: { fields: { prop: string }[] }) {
	return group.fields.map((field) => field.prop)
}

describe('shared material groups', () => {
	it('gives every surface the same Alpha group', () => {
		const standard = alphaGroup<THREE.MeshStandardMaterial>()
		const toon = alphaGroup<THREE.MeshToonMaterial>()

		expect(props(standard)).toEqual([
			'transparent',
			'opacity',
			'alphaMap',
			'alphaTest',
			'alphaToCoverage'
		])
		expect(props(toon)).toEqual(props(standard))
	})

	it('omits the alpha map for materials without one', () => {
		expect(props(alphaGroup<THREE.MeshNormalMaterial>({ alphaMap: false }))).toEqual([
			'transparent',
			'opacity',
			'alphaTest',
			'alphaToCoverage'
		])
	})

	it('keeps opacity conditional on transparency', () => {
		const opacity = alphaGroup<THREE.MeshStandardMaterial>().fields.find(
			(field) => field.prop === 'opacity'
		)

		expect(opacity?.showIf).toBe('transparent')
	})

	it('omits the environment intensity for materials without one', () => {
		expect(props(environmentGroup<THREE.MeshStandardMaterial>())).toEqual([
			'envMap',
			'envMapIntensity',
			'envMapRotation'
		])
		expect(props(environmentGroup<THREE.MeshBasicMaterial>({ intensity: false }))).toEqual([
			'envMap',
			'envMapRotation'
		])
	})

	it('keeps the ambient occlusion intensity conditional on its map', () => {
		const intensity = ambientOcclusionGroup<THREE.MeshStandardMaterial>().fields.find(
			(field) => field.prop === 'aoMapIntensity'
		)

		expect(intensity?.showIf).toBe('aoMap')
	})

	it('gives each group a distinct accordion id', () => {
		const ids = [
			alphaGroup<THREE.MeshStandardMaterial>(),
			environmentGroup<THREE.MeshStandardMaterial>(),
			emissionGroup<THREE.MeshStandardMaterial>(),
			normalBumpGroup<THREE.MeshStandardMaterial>(),
			lightGroup<THREE.MeshStandardMaterial>(),
			ambientOcclusionGroup<THREE.MeshStandardMaterial>()
		].map((group) => group.value)

		expect(new Set(ids).size).toBe(ids.length)
	})
})
