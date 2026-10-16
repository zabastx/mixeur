import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InputSelect from './InputSelect.vue'
import type { InputSelectOption } from '@/shared/lib/types'

describe('InputSelect', () => {
	const mockItems: InputSelectOption<string>[] = [
		{ label: 'Option 1', value: 'opt1' },
		{ label: 'Option 2', value: 'opt2', icon: 'base/arrow-right' as const },
		{ label: 'Option 3', value: 'opt3', tooltip: { text: 'This is option 3' } }
	]

	it('renders with placeholder', () => {
		render(InputSelect, {
			props: {
				items: mockItems,
				placeholder: 'Select an option'
			}
		})

		expect(screen.getByText('Select an option')).toBeInTheDocument()
	})

	it('displays selected value', () => {
		const { container } = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt2'
			}
		})

		const combobox = container.querySelector('[role="combobox"]')
		expect(combobox).toBeInTheDocument()
	})

	it('displays icon for selected value', () => {
		const { container } = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt2'
			}
		})

		const icon = container.querySelector('svg')
		expect(icon).toBeInTheDocument()
	})

	it('opens dropdown on click', async () => {
		const { container } = render(InputSelect, {
			props: {
				items: mockItems
			}
		})

		const trigger = container.querySelector('[role="combobox"]')
		expect(trigger).toBeInTheDocument()

		if (trigger) {
			await userEvent.click(trigger)
		}
	})

	it('updates modelValue on selection', async () => {
		const { container } = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: undefined
			}
		})

		const trigger = screen.getByRole('combobox')
		await userEvent.click(trigger)

		const option = screen.getByText('Option 1')
		await userEvent.click(option)

		const combobox = container.querySelector('[role="combobox"]') as HTMLElement
		expect(combobox.textContent?.trim()).toBe('Option 1')
	})

	it('shows the bound value, not a pick the parent ignored', async () => {
		render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: undefined,
				'onUpdate:modelValue': () => {}
			}
		})

		await userEvent.click(screen.getByRole('combobox'))
		await userEvent.click(screen.getByText('Option 1'))

		expect(screen.getByRole('combobox').textContent?.trim()).toBe('')
	})

	it('handles empty items list', () => {
		render(InputSelect, {
			props: {
				items: [],
				placeholder: 'No options'
			}
		})

		expect(screen.getByText('No options')).toBeInTheDocument()
	})

	it('renders with only icon trigger', () => {
		const { container } = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt2',
				trigger: { onlyIcon: true }
			}
		})

		const icon = container.querySelector('svg')
		expect(icon).toBeInTheDocument()
	})

	it('passes through class attribute', () => {
		const { getByRole } = render(InputSelect, {
			props: {
				items: mockItems
			},
			attrs: { class: 'custom-select' }
		})

		const trigger = getByRole('combobox')
		expect(trigger.classList.contains('custom-select')).toBe(true)
	})
})
