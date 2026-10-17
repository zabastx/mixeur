import { render, screen, waitFor, within, type RenderResult } from '@testing-library/vue'
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

	// The trigger always draws its chevron; a value's icon comes on top of it.
	const iconsIn = (element: HTMLElement) => element.querySelectorAll('svg').length

	// A closed select mounts its options off-document one tick after the trigger,
	// and the trigger reads the chosen label from them.
	const expectLabel = (label: RegExp) =>
		waitFor(() => expect(screen.getByRole('combobox')).toHaveTextContent(label))

	it('shows the placeholder while nothing is chosen', () => {
		render(InputSelect, {
			props: {
				items: mockItems,
				placeholder: 'Select an option'
			}
		})

		expect(screen.getByRole('combobox')).toHaveTextContent('Select an option')
	})

	it("shows the selected option's label", async () => {
		render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt3'
			}
		})

		await expectLabel(/^Option 3$/)
	})

	it("shows the selected option's icon", async () => {
		const { rerender } = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt1'
			}
		})
		expect(iconsIn(screen.getByRole('combobox'))).toBe(1)

		await rerender({ items: mockItems, modelValue: 'opt2' })

		expect(iconsIn(screen.getByRole('combobox'))).toBe(2)
	})

	it('lists the options when opened', async () => {
		render(InputSelect, {
			props: {
				items: mockItems
			}
		})

		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
		await userEvent.click(screen.getByRole('combobox'))

		const listbox = await screen.findByRole('listbox')
		expect(
			within(listbox)
				.getAllByRole('option')
				.map((option) => within(option).getByText(/^Option/).textContent)
		).toEqual(['Option 1', 'Option 2', 'Option 3'])
	})

	it("shows an option's tooltip in the list", async () => {
		render(InputSelect, {
			props: {
				items: mockItems
			}
		})

		await userEvent.click(screen.getByRole('combobox'))

		const option = screen.getByRole('option', { name: /Option 3/ })
		expect(within(option).getByRole('tooltip')).toHaveTextContent('This is option 3')
	})

	it('shows and emits the chosen option', async () => {
		// Bound like `v-model`: the parent stores what the select emits.
		const view: RenderResult = render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt1',
				'onUpdate:modelValue': (value: unknown) =>
					view.rerender({ items: mockItems, modelValue: value })
			}
		})
		const { emitted } = view

		await userEvent.click(screen.getByRole('combobox'))
		await userEvent.click(screen.getByRole('option', { name: /Option 3/ }))

		expect(emitted('update:modelValue')).toEqual([['opt3']])
		await expectLabel(/^Option 3$/)
		expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
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
		await userEvent.click(screen.getByRole('option', { name: /Option 1/ }))

		expect(screen.getByRole('combobox')).toHaveTextContent(/^$/)
	})

	it('opens with no options when given none', async () => {
		render(InputSelect, {
			props: {
				items: [],
				placeholder: 'No options'
			}
		})

		expect(screen.getByRole('combobox')).toHaveTextContent('No options')
		await userEvent.click(screen.getByRole('combobox'))

		expect(within(await screen.findByRole('listbox')).queryAllByRole('option')).toEqual([])
	})

	it("shows only the value's icon when the trigger is icon-only", async () => {
		render(InputSelect, {
			props: {
				items: mockItems,
				modelValue: 'opt2',
				trigger: { onlyIcon: true }
			}
		})

		// Opened, so the options the label is read from are certainly mounted.
		const combobox = screen.getByRole('combobox')
		await userEvent.click(combobox)
		await screen.findByRole('listbox')

		expect(combobox).toHaveTextContent(/^$/)
		expect(iconsIn(combobox)).toBe(2)
	})

	it('passes through class attribute', () => {
		render(InputSelect, {
			props: {
				items: mockItems
			},
			attrs: { class: 'custom-select' }
		})

		expect(screen.getByRole('combobox')).toHaveClass('custom-select')
	})
})
