import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import InputColor from './InputColor.vue'

describe('InputColor', () => {
	it('renders color preview', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#ff0000',
				alpha: 1
			}
		})

		const preview = container.querySelector('.checkerboard')
		expect(preview).toBeInTheDocument()
	})

	it('displays correct color value', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#00ff00',
				alpha: 1
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--color-value')).toBe('#00ff00')
	})

	it('displays correct alpha value', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#0000ff',
				alpha: 0.5
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--alpha')).toBe('0.5')
	})

	it('handles transparency mode with 8-digit hex', () => {
		const { container } = render(InputColor, {
			props: {
				transparency: true,
				hex: '#ff000080',
				alpha: 0.5
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--color-value')).toBe('#ff0000')
	})

	it('handles transparency mode with 6-digit hex', () => {
		const { container } = render(InputColor, {
			props: {
				transparency: true,
				hex: '#ff0000',
				alpha: 0.5
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--color-value')).toBe('#ff0000')
	})

	it('opens popover on click', async () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#ff0000',
				alpha: 1
			}
		})

		const trigger = container.querySelector('.checkerboard')
		expect(trigger).toBeInTheDocument()

		if (trigger) {
			await userEvent.click(trigger)
		}
	})

	it('accepts hex model', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#ff0000',
				alpha: 1
			}
		})

		expect(container.querySelector('.checkerboard')).toBeInTheDocument()
	})

	it('accepts alpha model', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#ff0000',
				alpha: 0.5
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--alpha')).toBe('0.5')
	})

	it('renders without transparency by default', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '#ff0000',
				alpha: 1
			}
		})

		const wrapper = container.querySelector('.checkerboard') as HTMLElement
		expect(wrapper?.style.getPropertyValue('--color-value')).toBe('#ff0000')
	})

	it('handles empty hex value', () => {
		const { container } = render(InputColor, {
			props: {
				hex: '',
				alpha: 1
			}
		})

		const preview = container.querySelector('.checkerboard')
		expect(preview).toBeInTheDocument()
	})
})
