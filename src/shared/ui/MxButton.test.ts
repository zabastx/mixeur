import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import MxButton from './MxButton.vue'

describe('MxButton', () => {
	it('renders with default type', () => {
		const { getByRole } = render(MxButton, {
			props: {}
		})

		const button = getByRole('button')
		expect(button.getAttribute('type')).toBe('button')
	})

	it('renders with custom type', () => {
		const { getByRole } = render(MxButton, {
			props: { type: 'submit' }
		})

		const button = getByRole('button')
		expect(button.getAttribute('type')).toBe('submit')
	})

	it('renders with icon', () => {
		const { container } = render(MxButton, {
			props: { icon: 'base/arrow-right' }
		})

		const icon = container.querySelector('svg')
		expect(icon).toBeInTheDocument()
	})

	it('renders with highlighted visual state', () => {
		const { getByRole } = render(MxButton, {
			props: { highlighted: true }
		})

		const button = getByRole('button')
		expect(button.classList.contains('bg-ui-btn-bg-highlight')).toBe(true)
	})

	it('disabled state prevents clicks', async () => {
		const { getByRole } = render(MxButton, {
			props: { disabled: true }
		})

		const button = getByRole('button')
		expect(button.getAttribute('disabled')).not.toBeNull()
	})

	it('passes through class attribute', () => {
		const { getByRole } = render(MxButton, {
			props: {},
			attrs: { class: 'custom-class' }
		})

		const button = getByRole('button')
		expect(button.classList.contains('custom-class')).toBe(true)
	})

	it('passes through style attribute', () => {
		const { getByRole } = render(MxButton, {
			props: {},
			attrs: { style: { color: 'red' } }
		})

		const button = getByRole('button')
		expect(button.getAttribute('style')).toContain('color')
	})

	it('passes through data attributes', () => {
		const { getByRole } = render(MxButton, {
			props: {},
			attrs: { 'data-testid': 'test-button' }
		})

		const button = getByRole('button')
		expect(button.getAttribute('data-testid')).toBe('test-button')
	})

	it('renders slot content', () => {
		const { getByText } = render(MxButton, {
			slots: { default: 'Click me' }
		})

		expect(getByText('Click me')).toBeInTheDocument()
	})
})
