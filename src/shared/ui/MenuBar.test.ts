import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MenuBar from './MenuBar.vue'
import type { IMenubarMenu } from './MenuBar.vue'

describe('MenuBar', () => {
	it('renders menu bar', () => {
		const items = [
			{
				label: 'File',
				items: [{ type: 'item' as const, key: 'new', label: 'New', onClick: vi.fn() }]
			}
		]

		const { container } = render(MenuBar, {
			props: { items }
		})

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('renders menu labels', () => {
		const items = [
			{ label: 'File', items: [{ type: 'item' as const, key: 'a', label: 'A', onClick: vi.fn() }] },
			{ label: 'Edit', items: [{ type: 'item' as const, key: 'b', label: 'B', onClick: vi.fn() }] }
		]

		render(MenuBar, { props: { items } })

		expect(screen.getByText('File')).toBeInTheDocument()
		expect(screen.getByText('Edit')).toBeInTheDocument()
	})

	it('handles item click when menu is opened', async () => {
		const onClick = vi.fn()
		const items = [
			{
				label: 'Menu',
				items: [{ type: 'item' as const, key: 'item', label: 'Item', onClick }]
			}
		]

		render(MenuBar, { props: { items } })

		const menuLabel = screen.getByText('Menu')
		await userEvent.click(menuLabel)

		const itemLabel = screen.getByText('Item')
		await userEvent.click(itemLabel)

		expect(onClick).toHaveBeenCalled()
	})

	it('renders menu with multiple items', () => {
		const items = [
			{
				label: 'File',
				items: [
					{ type: 'item' as const, key: 'new', label: 'New', onClick: vi.fn() },
					{ type: 'item' as const, key: 'open', label: 'Open', onClick: vi.fn() },
					{ type: 'item' as const, key: 'save', label: 'Save', onClick: vi.fn() }
				]
			}
		]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('handles checkbox items', () => {
		const items = [
			{
				label: 'Menu',
				items: [{ type: 'checkbox' as const, key: 'bold', label: 'Bold', model: ref(true) }]
			}
		]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('handles submenu items', () => {
		const items = [
			{
				label: 'Menu',
				items: [
					{
						type: 'sub' as const,
						key: 'sub',
						label: 'Submenu',
						items: [{ type: 'item' as const, key: 'sub1', label: 'Sub 1', onClick: vi.fn() }]
					}
				]
			}
		]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('handles separator items', () => {
		const items = [
			{
				label: 'Menu',
				items: [
					{ type: 'item' as const, key: 'a', label: 'A', onClick: vi.fn() },
					{ type: 'separator' as const, key: 'sep' },
					{ type: 'item' as const, key: 'b', label: 'B', onClick: vi.fn() }
				]
			}
		]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('handles menu with icon property', () => {
		const items: IMenubarMenu[] = [
			{
				label: 'Menu',
				icon: 'base/folder' as unknown as IMenubarMenu['icon'],
				items: [{ type: 'item' as const, key: 'new', label: 'New', onClick: vi.fn() }]
			}
		]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})

	it('names an icon-only menu by its label', () => {
		const items: IMenubarMenu[] = [
			{ label: 'mixeur', icon: 'mixeur', items: [] },
			{ label: 'Tools', icon: 'base/folder' as unknown as IMenubarMenu['icon'], items: [] }
		]

		render(MenuBar, { props: { items } })

		expect(screen.getByRole('menuitem', { name: 'mixeur' })).toBeInTheDocument()
		expect(screen.getByRole('menuitem', { name: 'Tools' })).toBeInTheDocument()
	})

	it('renders with empty items', () => {
		const items = [{ label: 'Empty Menu', items: [] }]

		const { container } = render(MenuBar, { props: { items } })

		expect(container.querySelector('[role="menubar"]')).toBeInTheDocument()
	})
})
