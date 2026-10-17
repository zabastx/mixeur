import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import MenuBar from './MenuBar.vue'
import type { IMenubarMenu } from './MenuBar.vue'

async function openMenu(label: string) {
	const user = userEvent.setup()
	await user.click(screen.getByRole('menuitem', { name: label }))
	return { user, menu: await screen.findByRole('menu') }
}

describe('MenuBar', () => {
	it('shows a trigger for each menu', () => {
		const items: IMenubarMenu[] = [
			{ label: 'File', items: [{ type: 'item', key: 'a', label: 'A', onClick: vi.fn() }] },
			{ label: 'Edit', items: [{ type: 'item', key: 'b', label: 'B', onClick: vi.fn() }] }
		]

		render(MenuBar, { props: { items } })

		const menubar = screen.getByRole('menubar')
		expect(within(menubar).getByRole('menuitem', { name: 'File' })).toBeInTheDocument()
		expect(within(menubar).getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument()
	})

	it('opens a menu on its label and lists its items in order', async () => {
		const items: IMenubarMenu[] = [
			{
				label: 'File',
				items: [
					{ type: 'item', key: 'new', label: 'New', onClick: vi.fn() },
					{ type: 'item', key: 'open', label: 'Open', onClick: vi.fn() },
					{ type: 'item', key: 'save', label: 'Save', onClick: vi.fn() }
				]
			}
		]
		render(MenuBar, { props: { items } })

		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
		const { menu } = await openMenu('File')

		expect(
			within(menu)
				.getAllByRole('menuitem')
				.map((item) => item.textContent?.trim())
		).toEqual(['New', 'Open', 'Save'])
	})

	it('runs the chosen item and closes the menu', async () => {
		const onNew = vi.fn()
		const onOpen = vi.fn()
		const items: IMenubarMenu[] = [
			{
				label: 'File',
				items: [
					{ type: 'item', key: 'new', label: 'New', onClick: onNew },
					{ type: 'item', key: 'open', label: 'Open', onClick: onOpen }
				]
			}
		]
		render(MenuBar, { props: { items } })

		const { user, menu } = await openMenu('File')
		await user.click(within(menu).getByRole('menuitem', { name: 'Open' }))

		expect(onOpen).toHaveBeenCalledOnce()
		expect(onNew).not.toHaveBeenCalled()
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('shows a shortcut beside its item', async () => {
		const items: IMenubarMenu[] = [
			{
				label: 'File',
				items: [
					{ type: 'item', key: 'save', label: 'Save', shortcut: 'Ctrl+S', onClick: vi.fn() },
					{ type: 'item', key: 'close', label: 'Close', onClick: vi.fn() }
				]
			}
		]
		render(MenuBar, { props: { items } })

		const { menu } = await openMenu('File')

		expect(within(menu).getByRole('menuitem', { name: /Save/ })).toHaveTextContent('Ctrl+S')
		expect(within(menu).getByRole('menuitem', { name: 'Close' })).not.toHaveTextContent('Ctrl')
	})

	it('toggles a checkbox item’s model when chosen', async () => {
		const wireframe = ref(false)
		const items: IMenubarMenu[] = [
			{
				label: 'View',
				items: [{ type: 'checkbox', key: 'wire', label: 'Wireframe', model: wireframe }]
			}
		]
		render(MenuBar, { props: { items } })

		let { user, menu } = await openMenu('View')
		const checkbox = within(menu).getByRole('menuitemcheckbox', { name: 'Wireframe' })
		expect(checkbox).toHaveAttribute('aria-checked', 'false')
		await user.click(checkbox)

		expect(wireframe.value).toBe(true)
		;({ user, menu } = await openMenu('View'))
		const reopened = within(menu).getByRole('menuitemcheckbox', { name: 'Wireframe' })
		expect(reopened).toHaveAttribute('aria-checked', 'true')
		await user.click(reopened)

		expect(wireframe.value).toBe(false)
	})

	// Pointing from the submenu's trigger to its items closes the submenu in
	// happy-dom, which gives every element an empty box, so the submenu is
	// walked with the keyboard.
	it('reaches and runs an item in a submenu', async () => {
		const onRecent = vi.fn()
		const items: IMenubarMenu[] = [
			{
				label: 'File',
				items: [
					{
						type: 'sub',
						key: 'recent',
						label: 'Open Recent',
						items: [
							{
								type: 'item',
								key: 'scene',
								label: 'scene.mxr',
								shortcut: 'Ctrl+1',
								onClick: onRecent
							}
						]
					}
				]
			}
		]
		render(MenuBar, { props: { items } })

		const { user, menu } = await openMenu('File')
		within(menu).getByRole('menuitem', { name: 'Open Recent' }).focus()
		await user.keyboard('{ArrowRight}')
		const submenu = (await screen.findAllByRole('menu')).find((m) => m !== menu)!
		const recent = within(submenu).getByRole('menuitem', { name: /scene\.mxr/ })
		expect(recent).toHaveTextContent('Ctrl+1')
		expect(recent).toHaveFocus()
		await user.keyboard('{Enter}')

		expect(onRecent).toHaveBeenCalledOnce()
	})

	it('skips a separator: it is not an item, clicking it keeps the menu open, and the arrow keys pass over it', async () => {
		const onUndo = vi.fn()
		const onDelete = vi.fn()
		const items: IMenubarMenu[] = [
			{
				label: 'Edit',
				items: [
					{ type: 'item', key: 'undo', label: 'Undo', onClick: onUndo },
					{ type: 'separator', key: 'sep' },
					{ type: 'item', key: 'delete', label: 'Delete', onClick: onDelete }
				]
			}
		]
		render(MenuBar, { props: { items } })

		const { user, menu } = await openMenu('Edit')

		expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
		await user.click(within(menu).getByRole('separator'))
		expect(menu).toBeInTheDocument()
		expect(onUndo).not.toHaveBeenCalled()
		expect(onDelete).not.toHaveBeenCalled()
		within(menu).getByRole('menuitem', { name: 'Undo' }).focus()
		await user.keyboard('{ArrowDown}')
		expect(within(menu).getByRole('menuitem', { name: 'Delete' })).toHaveFocus()
	})

	it('names an icon-only menu by its label and opens it', async () => {
		const onAbout = vi.fn()
		const items: IMenubarMenu[] = [
			{
				label: 'mixeur',
				icon: 'mixeur',
				items: [{ type: 'item', key: 'about', label: 'About', onClick: onAbout }]
			},
			{ label: 'Tools', icon: 'base/arrow-right', items: [] }
		]
		render(MenuBar, { props: { items } })

		expect(screen.getByRole('menuitem', { name: 'Tools' })).toBeInTheDocument()
		const { user, menu } = await openMenu('mixeur')
		await user.click(within(menu).getByRole('menuitem', { name: 'About' }))

		expect(onAbout).toHaveBeenCalledOnce()
	})

	it('opens an empty menu with no items', async () => {
		render(MenuBar, { props: { items: [{ label: 'Empty Menu', items: [] }] } })

		const { menu } = await openMenu('Empty Menu')

		expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0)
	})
})
