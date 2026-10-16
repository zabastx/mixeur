import MxIcon from './MxIcon.vue'
import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

describe('MxIcon', () => {
	it('renders with name prop', () => {
		const { container } = render(MxIcon, {
			props: {
				name: 'base/arrow-right'
			}
		})

		expect(container.querySelector('svg')).toBeInTheDocument()
	})

	it('accepts name prop with folder/filename format', () => {
		const { container: container1 } = render(MxIcon, {
			props: { name: 'base/arrow-right' }
		})
		expect(container1.querySelector('svg')).toBeInTheDocument()

		const { container: container2 } = render(MxIcon, {
			props: { name: 'mesh/mesh-cube' }
		})
		expect(container2.querySelector('svg')).toBeInTheDocument()

		const { container: container3 } = render(MxIcon, {
			props: { name: 'ui/checkmark' }
		})
		expect(container3.querySelector('svg')).toBeInTheDocument()
	})

	it('passes through class attribute', () => {
		const { container } = render(MxIcon, {
			props: {
				name: 'base/arrow-right'
			},
			attrs: {
				class: 'icon-custom-class'
			}
		})

		const iconElement = container.querySelector('.icon-custom-class')
		expect(iconElement).toBeInTheDocument()
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

	it('handles all icon paths', () => {
		const icons = import.meta.glob('@/app/assets/icons/**/*.svg', { eager: true })

		const validIcons = Object.keys(icons).map((path) =>
			path.replace('/src/app/assets/icons/', '').replace('.svg', '')
		) as MxIconName[]

		for (const iconPath of validIcons) {
			const { container } = render(MxIcon, {
				props: { name: iconPath }
			})
			expect(container.querySelector('svg')).toBeInTheDocument()
		}
	})
})
