import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InputText from './InputText.vue'

describe('InputText', () => {
	it('renders input element', () => {
		render(InputText)

		const input = screen.getByRole('textbox')
		expect(input).toBeInTheDocument()
	})

	it('renders with custom placeholder', () => {
		render(InputText, {
			props: { placeholder: 'Enter text...' }
		})

		const input = screen.getByPlaceholderText('Enter text...')
		expect(input).toBeInTheDocument()
	})

	it('renders with custom input type', () => {
		const { container } = render(InputText, {
			props: { type: 'password' }
		})

		const input = container.querySelector('input') as HTMLInputElement
		expect(input.type).toBe('password')
	})

	it('renders with inputmode attribute', () => {
		render(InputText, {
			props: { inputmode: 'numeric' }
		})

		const input = screen.getByRole('textbox') as HTMLInputElement
		expect(input.inputMode).toBe('numeric')
	})

	it('renders with custom inputId', () => {
		render(InputText, {
			props: { inputId: 'my-input' }
		})

		const input = document.getElementById('my-input')
		expect(input).toBeInTheDocument()
	})

	it('renders icon when icon prop provided', () => {
		const { container } = render(InputText, {
			props: { icon: 'base/arrow-right' }
		})

		const icon = container.querySelector('svg')
		expect(icon).toBeInTheDocument()
	})

	it('does not render icon when icon not provided', () => {
		const { container } = render(InputText)

		const icon = container.querySelector('svg')
		expect(icon).not.toBeInTheDocument()
	})

	it('updates modelValue on input', async () => {
		let value = ''
		render(InputText, {
			props: {
				modelValue: value,
				'onUpdate:modelValue': (v: string | undefined) => {
					value = v ?? ''
				}
			}
		})

		const input = screen.getByRole('textbox')
		await userEvent.type(input, 'hello')

		expect(value).toBe('hello')
	})

	it('accepts class attribute', () => {
		const { container } = render(InputText, {
			attrs: { class: 'custom-class' }
		})

		const wrapper = container.firstChild as HTMLElement
		expect(wrapper.classList.contains('custom-class')).toBe(true)
	})
})
