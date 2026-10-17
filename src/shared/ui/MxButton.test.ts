import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

	it('does not run its click handler when disabled', async () => {
		const onClick = vi.fn()
		render(MxButton, {
			props: { disabled: true },
			attrs: { onClick }
		})

		await userEvent.click(screen.getByRole('button'))
		expect(onClick).not.toHaveBeenCalled()
	})

	it('runs its click handler when enabled', async () => {
		const onClick = vi.fn()
		render(MxButton, {
			attrs: { onClick }
		})

		await userEvent.click(screen.getByRole('button'))
		expect(onClick).toHaveBeenCalledOnce()
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
