import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import MxSlider from './MxSlider.vue'

describe('MxSlider', () => {
	it('exposes one thumb with its value, min and max', async () => {
		render(MxSlider, {
			props: {
				modelValue: [50]
			}
		})

		const thumbs = await screen.findAllByRole('slider')
		expect(thumbs).toHaveLength(1)
		const [thumb] = thumbs
		expect(thumb).toHaveAttribute('aria-valuenow', '50')
		expect(thumb).toHaveAttribute('aria-valuemin', '0')
		expect(thumb).toHaveAttribute('aria-valuemax', '100')
	})

	it('exposes one thumb per value of a range', async () => {
		render(MxSlider, {
			props: {
				modelValue: [30, 70]
			}
		})

		const thumbs = await screen.findAllByRole('slider')
		expect(thumbs.map((thumb) => thumb.getAttribute('aria-valuenow'))).toEqual(['30', '70'])
	})

	it('applies the root min and max to its thumbs', async () => {
		render(MxSlider, {
			props: {
				modelValue: [150],
				root: { min: 100, max: 200 }
			}
		})

		const thumb = await screen.findByRole('slider')
		expect(thumb).toHaveAttribute('aria-valuenow', '150')
		expect(thumb).toHaveAttribute('aria-valuemin', '100')
		expect(thumb).toHaveAttribute('aria-valuemax', '200')
	})

	it('renders slot content', () => {
		render(MxSlider, {
			props: {
				modelValue: [50]
			},
			slots: {
				default: 'Custom content'
			}
		})

		expect(screen.getByText('Custom content')).toBeInTheDocument()
	})
})
