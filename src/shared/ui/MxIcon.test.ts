import MxIcon from './MxIcon.vue'
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

describe('MxIcon', () => {
	const iconNames = Object.keys(
		import.meta.glob('@/app/assets/icons/**/*.svg', { query: '?raw', import: 'default' })
	).map((path) => path.replace('/src/app/assets/icons/', '').replace('.svg', '')) as MxIconName[]

	it('passes through class attribute', () => {
		const { container } = render(MxIcon, {
			props: {
				name: 'base/arrow-right'
			},
			attrs: {
				class: 'icon-custom-class'
			}
		})

		expect(container.firstElementChild).toHaveClass('icon-custom-class')
	})

	it('passes through style attribute', () => {
		const { container } = render(MxIcon, {
			props: {
				name: 'base/arrow-right'
			},
			attrs: {
				style: { color: 'red', width: '24px' }
			}
		})

		const iconElement = container.querySelector('[style*="color"]')
		expect(iconElement).toBeInTheDocument()
	})

	it('passes through data attributes', () => {
		const { container } = render(MxIcon, {
			props: {
				name: 'base/arrow-right'
			},
			attrs: {
				'data-testid': 'my-icon'
			}
		})

		const iconElement = container.querySelector('[data-testid="my-icon"]')
		expect(iconElement).toBeInTheDocument()
	})

	it('finds the icon set', () => {
		expect(iconNames).toEqual(
			expect.arrayContaining(['base/arrow-right', 'mesh/mesh-cube', 'ui/checkmark'])
		)
	})

	it.each(iconNames)('renders an SVG for %s', (name) => {
		const { container } = render(MxIcon, {
			props: { name }
		})

		expect(container.querySelector('svg')).toBeInTheDocument()
	})
})
