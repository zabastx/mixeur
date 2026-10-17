/* eslint-disable vue/one-component-per-file */
import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, type PropType } from 'vue'
import InputField from './InputField.vue'

const TestInput = defineComponent({
	props: {
		id: { type: String as PropType<string | undefined>, required: false },
		disabled: { type: Boolean as PropType<boolean | undefined>, required: false }
	},
	setup(props) {
		return () =>
			h('input', {
				'data-testid': 'test-input',
				id: props.id,
				disabled: props.disabled,
				type: 'text'
			})
	}
})

describe('InputField', () => {
	it('renders label and input slot', () => {
		render(InputField, {
			props: { label: 'Test Label' },
			slots: {
				default: TestInput
			}
		})

		expect(screen.getByText('Test Label')).toBeInTheDocument()
		expect(screen.getByTestId('test-input')).toBeInTheDocument()
	})

	it('generates id for accessibility', () => {
		render(InputField, {
			props: { label: 'Label 1' },
			// A function, so the input receives the slot's `id` as the app's fields do.
			slots: { default: (slotProps: { id: string }) => h(TestInput, slotProps) }
		})

		expect(screen.getByLabelText('Label 1')).toBe(screen.getByTestId('test-input'))
	})

	it('shows the tooltip text when a tooltip is provided', () => {
		render(InputField, {
			props: {
				label: 'Test Label',
				tooltip: { title: 'Tooltip title', text: 'This is a tooltip', footer: 'Tooltip footer' }
			},
			slots: { default: TestInput }
		})

		screen.getByText('Tooltip title')
		screen.getByText('This is a tooltip')
		screen.getByText('Tooltip footer')
	})

	it('marks a label that has a tooltip with an icon', () => {
		const { container } = render(InputField, {
			props: { label: 'Test Label', tooltip: { text: 'This is a tooltip' } },
			slots: { default: TestInput }
		})

		expect(container.querySelector('label svg')).not.toBeNull()
	})

	it('shows no tooltip or icon when none is provided', () => {
		render(InputField, {
			props: { label: 'Test Label' },
			slots: { default: TestInput }
		})

		expect(screen.queryByRole('tooltip')).toBeNull()
		expect(document.querySelector('label svg')).toBeNull()
	})

	it('disables the control when the field is disabled', () => {
		render(InputField, {
			props: { label: 'Test Label', disabled: true },
			slots: { default: (slotProps: { id: string; disabled: boolean }) => h(TestInput, slotProps) }
		})

		expect(screen.getByLabelText('Test Label')).toBeDisabled()
	})

	it('renders slot content correctly', () => {
		const CustomSlot = defineComponent({
			setup() {
				return () => h('div', { 'data-testid': 'custom-slot' }, 'Custom Content')
			}
		})

		render(InputField, {
			props: { label: 'Test Label' },
			slots: { default: CustomSlot }
		})

		expect(screen.getByTestId('custom-slot')).toBeInTheDocument()
		expect(screen.getByText('Custom Content')).toBeInTheDocument()
	})
})
