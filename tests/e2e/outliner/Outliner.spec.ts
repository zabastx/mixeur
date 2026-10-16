import { test, expect } from '@playwright/test'
import { importGlb } from '../helpers'

test.describe('Outliner', () => {
	test.beforeEach(async ({ page }) => {
		await importGlb(page)
	})

	test('imported object appears and can be selected', async ({ page }) => {
		const item = page.getByTestId('outliner-item').first()
		await expect(item).toBeVisible()

		await item.click()

		await expect(item).toHaveAttribute('data-selected', 'true')
	})

	test('add group creates a new outliner row', async ({ page }) => {
		const items = page.getByTestId('outliner-item')
		const before = await items.count()

		await page.getByTestId('outliner-add-group').click()

		await expect(items).toHaveCount(before + 1)
		await expect(page.getByText('Group', { exact: true })).toBeVisible()
	})

	test('visibility toggle flips the checkbox state', async ({ page }) => {
		const checkbox = page.getByTestId('visibility-toggle').first()
		const initial = await checkbox.getAttribute('data-state')

		await checkbox.click()

		await expect(checkbox).not.toHaveAttribute('data-state', initial ?? '')
	})

	test('delete removes an object through the context menu', async ({ page }) => {
		const items = page.getByTestId('outliner-item')
		const before = await items.count()

		await items.first().click({ button: 'right' })
		await page.getByRole('menuitem', { name: 'Delete' }).click()

		await expect(items).toHaveCount(before - 1)
	})
})
