import { test, expect } from '@playwright/test'

// Note: this app binds Escape to the transform "cancel" shortcut, which swallows the
// key before reka's dialog sees it — so dialogs are closed via their X button (titled
// modals) or by clicking the overlay (the title-less About modal).

test.describe('Modals', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })
	})

	test('About modal opens and closes', async ({ page }) => {
		// The "mixeur" menu renders an image, not text, so target the first trigger.
		await page.locator('.menubar-trigger').first().click()
		await page.getByRole('menuitem', { name: 'About Mixeur' }).click()

		const modal = page.locator('[data-testid="modal-about"]')
		await expect(modal).toBeVisible()

		// About has no title bar / close button — dismiss by clicking the overlay.
		await page.mouse.click(5, 5)
		await expect(modal).toBeHidden()
	})

	test('Preferences modal opens and closes', async ({ page }) => {
		await page.click('text=Edit')
		await page.getByRole('menuitem', { name: 'Preferences' }).click()

		const modal = page.locator('[data-testid="modal-preferences"]')
		await expect(modal).toBeVisible()

		await page.getByRole('button', { name: 'Close dialog' }).click()
		await expect(modal).toBeHidden()
	})

	test('Render Image modal opens and closes', async ({ page }) => {
		await page.click('text=Render')
		await page.getByRole('menuitem', { name: 'Render Image' }).click()

		const modal = page.locator('[data-testid="modal-render-image"]')
		await expect(modal).toBeVisible()

		await page.getByRole('button', { name: 'Close dialog' }).click()
		await expect(modal).toBeHidden()
	})

	test('Asset library modal opens and closes', async ({ page }) => {
		// Avoid hitting the real PolyHaven API in tests.
		await page.route('**/api.polyhaven.com/**', (route) =>
			route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
		)

		await page.click('text=File')
		await page.hover('text=Import')
		await page.getByRole('menuitem', { name: 'Import from library' }).click()

		const modal = page.locator('[data-testid="modal-asset-browser-models"]')
		await expect(modal).toBeVisible()

		await page.getByRole('button', { name: 'Close dialog' }).click()
		await expect(modal).toBeHidden()
	})
})
