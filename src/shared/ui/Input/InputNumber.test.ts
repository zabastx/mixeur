import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InputNumber from './InputNumber.vue'

describe('InputNumber', () => {
	it('renders with default value', () => {
		render(InputNumber, {
			props: { modelValue: 42 }
		})

		expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('42.000')
	})

	it('emits the typed number once the field is left', async () => {
		const { emitted } = render(InputNumber, {
			props: { modelValue: 0 }
		})

		const input = screen.getByRole('spinbutton')
		await userEvent.clear(input)
		await userEvent.type(input, '100')
		await userEvent.tab()

		expect(emitted('update:modelValue')?.at(-1)).toEqual([100])
	})

	it('respects formatOptions for decimal places', () => {
		render(InputNumber, {
			props: {
				modelValue: 3.14159,
				formatOptions: { minimumFractionDigits: 2, maximumFractionDigits: 2 }
			}
		})

		expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('3.14')
	})
})
