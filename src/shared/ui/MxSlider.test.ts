import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import MxSlider from './MxSlider.vue'

describe('MxSlider', () => {
	it('renders slider component', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50]
			}
		})

		const slider = container.querySelector('[role="slider"]')
		expect(slider).toBeInTheDocument()
	})

	it('renders with default value', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50, 100]
			}
		})

		const sliders = container.querySelectorAll('[role="slider"]')
		expect(sliders.length).toBe(2)
	})

	it('renders with group styling', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50, 100],
				group: true
			}
		})

		const slider = container.firstChild as HTMLElement
		expect(slider.classList.contains('not-last:border-b')).toBe(true)
	})

	it('renders two slider thumbs', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [0, 100]
			}
		})

		const sliders = container.querySelectorAll('[role="slider"]')
		expect(sliders.length).toBe(2)
	})

	it('accepts root props', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50],
				root: { min: 0, max: 200 }
			}
		})

		const slider = container.querySelector('[role="slider"]')
		expect(slider).toBeInTheDocument()
	})

	it('accepts track props', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50],
				track: { as: 'div' }
			}
		})

		const track = container.querySelector('.bg-ui-slider-inner')
		expect(track).toBeInTheDocument()
	})

	it('renders range styling when provided', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [30, 70],
				range: { as: 'div' }
			}
		})

		const range = container.querySelector('.bg-ui-slider-item')
		expect(range).toBeInTheDocument()
	})

	it('renders slot content', () => {
		const { container } = render(MxSlider, {
			props: {
				modelValue: [50]
			},
			slots: {
				default: '<div data-testid="slider-slot">Custom content</div>'
			}
		})

		const slot = container.querySelector('[data-testid="slider-slot"]')
		expect(slot).toBeInTheDocument()
	})
})
