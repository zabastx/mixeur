import { test, expect } from '@playwright/test'
import { importGlb, outlinerRows } from '../helpers'

test.describe('Properties · Transform', () => {
	test.beforeEach(async ({ page }) => {
		await importGlb(page)
		await outlinerRows(page, 'Point Light').click()
	})

	test('object tab is available when an object is selected', async ({ page }) => {
		await expect(page.getByTestId('properties-tab-object')).toBeVisible()
	})

	test('editing a transform field moves the object', async ({ page }) => {
		await page.getByTestId('properties-tab-object').click()

		// Transform values live behind a collapsible accordion section.
		await page.getByRole('button', { name: 'Transform' }).click()

		const input = page.getByTestId('number-input').first()
		await expect(input).toBeVisible()

		await input.focus()
		await input.press('Control+a')
		await input.pressSequentially('5')
		await input.press('Enter')

		// The input shows what was typed whether or not the object took it.
		// Selecting away and back makes it read the value from the object again.
		await outlinerRows(page, 'Camera').click()
		await expect(input).toHaveValue(/^-4(\.0+)?$/)
		await outlinerRows(page, 'Point Light').click()

		// Anchored so "15", "0.5" or "50" would not pass — only a committed 5(.000…).
		await expect(input).toHaveValue(/^5(\.0+)?$/)
	})
})
