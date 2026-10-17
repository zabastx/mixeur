import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import userEvent from '@testing-library/user-event'
import InputCheckbox from './InputCheckbox.vue'

describe('InputCheckbox', () => {
	it('shows a false model unchecked', () => {
		render(InputCheckbox, {
			props: {
				modelValue: false
			}
		})

		expect(screen.getByRole('checkbox')).not.toBeChecked()
	})

	it('shows a true model checked', () => {
		render(InputCheckbox, {
			props: {
				modelValue: true
			}
		})

		expect(screen.getByRole('checkbox')).toBeChecked()
	})

	it('emits checked when an unchecked box is clicked', async () => {
		const { emitted } = render(InputCheckbox, {
			props: { modelValue: false }
		})

		await userEvent.click(screen.getByRole('checkbox'))

		expect(emitted('update:modelValue')).toEqual([[true]])
	})

	it('emits unchecked when a checked box is clicked', async () => {
		const { emitted } = render(InputCheckbox, {
			props: { modelValue: true }
		})

		await userEvent.click(screen.getByRole('checkbox'))

		expect(emitted('update:modelValue')).toEqual([[false]])
	})

	it('follows its model when the parent changes it', async () => {
		const { rerender } = render(InputCheckbox, {
			props: { modelValue: false }
		})

		await rerender({ modelValue: true })

		expect(screen.getByRole('checkbox')).toBeChecked()
	})
})
