import { render } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import MxContextMenu, { type MxContextMenuItem } from './MxContextMenu.vue'

describe('MxContextMenu', () => {
	const mockItems: MxContextMenuItem[] = [
		{ key: 'item1', label: 'Item 1', shortcut: 'Ctrl+A' },
		{ key: 'item2', label: 'Item 2' },
		{ key: 'separator', label: '', onSelect: () => {} },
		{
			key: 'submenu1',
			label: 'Submenu',
			submenu: [
				{ key: 'subitem1', label: 'Sub Item 1', shortcut: 'Ctrl+S' },
				{ key: 'subitem2', label: 'Sub Item 2' }
			]
		}
	]

	it('renders with items', () => {
		expect(() =>
			render(MxContextMenu, {
				props: { items: mockItems }
			})
		).not.toThrow()
	})

	it('renders with trigger element', () => {
		const { container } = render(MxContextMenu, {
			props: { items: mockItems },
			slots: { default: '<div>Trigger</div>' }
		})

		expect(container.querySelector('div')).toBeInTheDocument()
	})

	it('renders with custom root props', () => {
		expect(() =>
			render(MxContextMenu, {
				props: {
					items: mockItems,
					root: { modal: false }
				}
			})
		).not.toThrow()
	})

	it('renders with custom subContent props', () => {
		expect(() =>
			render(MxContextMenu, {
				props: {
					items: mockItems,
					subContent: { alignOffset: -8 }
				}
			})
		).not.toThrow()
	})

	it('renders trigger slot', () => {
		const { container } = render(MxContextMenu, {
			props: { items: mockItems },
			slots: {
				default: '<button data-testid="trigger-btn">Right click me</button>'
			}
		})

		expect(container.querySelector('[data-testid="trigger-btn"]')).toBeInTheDocument()
	})

	it('handles items without icons', () => {
		const items: MxContextMenuItem[] = [{ key: 'item1', label: 'Simple Item' }]

		expect(() =>
			render(MxContextMenu, {
				props: { items }
			})
		).not.toThrow()
	})

	it('handles items with submenu', () => {
		const items: MxContextMenuItem[] = [
			{
				key: 'submenu',
				label: 'Has Submenu',
				submenu: [
					{ key: 'sub1', label: 'Sub 1' },
					{ key: 'sub2', label: 'Sub 2' }
				]
			}
		]

		expect(() =>
			render(MxContextMenu, {
				props: { items }
			})
		).not.toThrow()
	})
})
