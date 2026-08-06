import { render } from '@testing-library/vue'
import { mount } from '@vue/test-utils'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { Component } from 'vue'
import THREE from '@/shared/three'
import { createObjectTarget } from '@/shared/lib/field-descriptor'
import type { FieldDescriptor } from '@/shared/lib/field-descriptor'
import FieldList from './FieldList.vue'
import InputField from './InputField.vue'

// `FieldList`'s generic parameter is erased when the component is handed to a
// test renderer, so it is mounted untyped and the descriptors are typed instead.
const Fields = FieldList as Component

function renderFields<T extends object>(
	object: T,
	fields: FieldDescriptor<T>[],
	tooltips?: ReadonlyMap<string, { text?: string }>
) {
	return render(Fields, {
		props: { fields, target: createObjectTarget(() => object), tooltips }
	})
}

describe('FieldList', () => {
	it('renders one labelled input per descriptor', () => {
		const light = new THREE.SpotLight()

		const { getByText } = renderFields(light, [
			{ type: 'number', label: 'Intensity', prop: 'intensity' },
			{ type: 'angle', label: 'Angle', prop: 'angle' }
		])

		getByText('Intensity')
		getByText('Angle')
	})

	it('shows the value currently on the object', () => {
		const light = new THREE.PointLight(undefined, 7)

		const { getByTestId } = renderFields(light, [
			{ type: 'number', label: 'Intensity', prop: 'intensity' }
		])

		// Three fraction digits is InputNumber's own default, applied when a field
		// declares no format of its own.
		expect(getByTestId('number-input')).toHaveProperty('value', '7.000')
	})

	it('writes an edit back to the object', async () => {
		const material = new THREE.MeshStandardMaterial({ transparent: false })

		const { getByRole } = renderFields(material, [
			{ type: 'checkbox', label: 'Transparent', prop: 'transparent' }
		])

		await userEvent.click(getByRole('checkbox'))

		expect(material.transparent).toBe(true)
	})

	describe('showIf', () => {
		const fields: FieldDescriptor<THREE.MeshStandardMaterial>[] = [
			{ type: 'checkbox', label: 'Transparent', prop: 'transparent' },
			{ type: 'number', label: 'Opacity', prop: 'opacity', showIf: 'transparent' }
		]

		it('disables a field whose condition is not met', () => {
			const material = new THREE.MeshStandardMaterial({ transparent: false })

			const { getByTestId } = renderFields(material, fields)

			expect(getByTestId('number-input')).toHaveProperty('disabled', true)
		})

		it('leaves a field whose condition is met enabled', () => {
			const material = new THREE.MeshStandardMaterial({ transparent: true })

			const { getByTestId } = renderFields(material, fields)

			expect(getByTestId('number-input')).toHaveProperty('disabled', false)
		})

		it('re-enables the field once the condition becomes true', async () => {
			const material = new THREE.MeshStandardMaterial({ transparent: false })

			const { getByRole, getByTestId } = renderFields(material, fields)

			expect(getByTestId('number-input')).toHaveProperty('disabled', true)

			await userEvent.click(getByRole('checkbox'))

			expect(getByTestId('number-input')).toHaveProperty('disabled', false)
		})
	})

	describe('formatOptions', () => {
		it('formats an angle in degrees without the field saying so', () => {
			const light = new THREE.SpotLight()
			light.angle = Math.PI / 4

			const { getByTestId } = renderFields(light, [
				{ type: 'angle', label: 'Angle', prop: 'angle' }
			])

			expect(getByTestId('number-input')).toHaveProperty('value', '45°')
		})

		it('honours a format the field declares', () => {
			const shadow = new THREE.DirectionalLight().shadow
			shadow.bias = -0.0015

			const { getByTestId } = renderFields(shadow, [
				{
					type: 'number',
					label: 'Bias',
					prop: 'bias',
					step: 0.0001,
					formatOptions: { minimumFractionDigits: 4, maximumFractionDigits: 4 }
				}
			])

			expect(getByTestId('number-input')).toHaveProperty('value', '-0.0015')
		})

		it('lets a field override the degree default', () => {
			const light = new THREE.SpotLight()
			light.angle = Math.PI / 4

			const { getByTestId } = renderFields(light, [
				{
					type: 'angle',
					label: 'Angle',
					prop: 'angle',
					formatOptions: { maximumFractionDigits: 0 }
				}
			])

			expect(getByTestId('number-input')).toHaveProperty('value', '45')
		})
	})

	// MxTooltip is stubbed out globally in the test setup, so tooltip content never
	// reaches the DOM — these read it off the InputField that received it instead.
	describe('tooltips', () => {
		const field: FieldDescriptor<THREE.PointLight> = {
			type: 'number',
			label: 'Intensity',
			prop: 'intensity'
		}

		function tooltipOf(fields: FieldDescriptor<THREE.PointLight>[]) {
			const light = new THREE.PointLight()

			return mount(Fields, {
				props: { fields, target: createObjectTarget(() => light), tooltips: TOOLTIP_MAP }
			})
				.findComponent(InputField)
				.props('tooltip')
		}

		const TOOLTIP_MAP = new Map([['intensity', { text: 'From the map' }]])

		it('falls back to the tooltip map for a field that declares none', () => {
			expect(tooltipOf([field])).toEqual({ text: 'From the map' })
		})

		it('prefers a tooltip the field declares itself', () => {
			expect(tooltipOf([{ ...field, tooltip: { text: 'From the field' } }])).toEqual({
				text: 'From the field'
			})
		})

		it('leaves the tooltip unset when neither source has one', () => {
			expect(tooltipOf([{ ...field, prop: 'power' }])).toBeUndefined()
		})
	})
})
