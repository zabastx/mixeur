import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import MxContextMenu, { type MxContextMenuItem } from './MxContextMenu.vue'

function renderMenu(items: MxContextMenuItem[]) {
	return render(MxContextMenu, {
		props: { items },
		slots: { default: '<div>Right click me</div>' }
	})
}

async function openMenu() {
	const user = userEvent.setup()
	await user.pointer({ keys: '[MouseRight]', target: screen.getByText('Right click me') })
	return { user, menu: await screen.findByRole('menu') }
}

describe('MxContextMenu', () => {
	it('shows its items when the trigger is right-clicked', async () => {
		renderMenu([
			{ key: 'copy', label: 'Copy' },
			{ key: 'paste', label: 'Paste' },
			{ key: 'more', label: 'More', submenu: [{ key: 'x', label: 'X' }] }
		])

		expect(screen.getByText('Right click me')).toBeInTheDocument()
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
		const { menu } = await openMenu()

		expect(
			within(menu)
				.getAllByRole('menuitem')
				.map((item) => item.textContent?.trim())
		).toEqual(['Copy', 'Paste', 'More'])
	})

	it('reports that it opened', async () => {
		const { emitted } = renderMenu([{ key: 'copy', label: 'Copy' }])

		await openMenu()

		expect(emitted('update:open')).toEqual([[true]])
	})

	it('calls the chosen item’s onSelect and closes', async () => {
		const onCopy = vi.fn()
		const onPaste = vi.fn()
		renderMenu([
			{ key: 'copy', label: 'Copy', onSelect: onCopy },
			{ key: 'paste', label: 'Paste', onSelect: onPaste }
		])

		const { user, menu } = await openMenu()
		await user.click(within(menu).getByRole('menuitem', { name: 'Paste' }))

		expect(onPaste).toHaveBeenCalledOnce()
		expect(onCopy).not.toHaveBeenCalled()
		expect(screen.queryByRole('menu')).not.toBeInTheDocument()
	})

	it('shows a shortcut beside its item', async () => {
		renderMenu([
			{ key: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
			{ key: 'rename', label: 'Rename' }
		])

		const { menu } = await openMenu()

		expect(within(menu).getByRole('menuitem', { name: /Copy/ })).toHaveTextContent('Ctrl+C')
		expect(within(menu).getByRole('menuitem', { name: 'Rename' })).not.toHaveTextContent('Ctrl')
	})

	// Pointing from the submenu's trigger to its items closes the submenu in
	// happy-dom, which gives every element an empty box, so the submenu is
	// walked with the keyboard.
	it('reaches and chooses an item in a submenu', async () => {
		const onCube = vi.fn()
		renderMenu([
			{
				key: 'add',
				label: 'Add',
				submenu: [
					{ key: 'cube', label: 'Cube', shortcut: 'Shift+A', onSelect: onCube },
					{ key: 'sphere', label: 'Sphere' }
				]
			}
		])

		const { user, menu } = await openMenu()
		within(menu).getByRole('menuitem', { name: 'Add' }).focus()
		await user.keyboard('{ArrowRight}')
		const submenu = (await screen.findAllByRole('menu')).find((m) => m !== menu)!
		const cube = within(submenu).getByRole('menuitem', { name: /Cube/ })
		expect(cube).toHaveTextContent('Shift+A')
		expect(cube).toHaveFocus()
		await user.keyboard('{Enter}')

		expect(onCube).toHaveBeenCalledOnce()
	})

	it('opens an empty menu with no items', async () => {
		renderMenu([])

		const { menu } = await openMenu()

		expect(within(menu).queryAllByRole('menuitem')).toHaveLength(0)
	})
})
