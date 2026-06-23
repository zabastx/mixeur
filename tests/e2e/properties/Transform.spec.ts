import { test, expect } from '@playwright/test'
import { importGlb } from '../helpers'

test.describe('Properties · Transform', () => {
	test.beforeEach(async ({ page }) => {
		await importGlb(page)
		await page.locator('[data-testid="outliner-item"]').first().click()
	})

	test('object tab is available when an object is selected', async ({ page }) => {
		await expect(page.locator('[data-testid="properties-tab-object"]')).toBeVisible()
	})

	test('editing a transform field commits the new value', async ({ page }) => {
		await page.locator('[data-testid="properties-tab-object"]').click()

		// Transform values live behind a collapsible accordion section.
		await page.getByRole('button', { name: 'Transform' }).click()

		const input = page.locator('[data-testid="number-input"]').first()
		await expect(input).toBeVisible()

		await input.focus()
		await input.press('Control+a')
		await input.pressSequentially('5')
		await input.press('Enter')

		// Anchored so "15", "0.5" or "50" would not pass — only a committed 5(.000…).
		await expect(input).toHaveValue(/^5(\.0+)?$/)
	})
})
