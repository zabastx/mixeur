import { test, expect } from '@playwright/test'

test.describe('Viewport shading modes', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })
	})

	test('solid is active by default and modes can be switched', async ({ page }) => {
		await expect(page.locator('[data-testid="shading-btn-solid"]')).toHaveAttribute(
			'data-active',
			'true'
		)

		for (const mode of ['wireframe', 'preview', 'rendered', 'solid'] as const) {
			const button = page.locator(`[data-testid="shading-btn-${mode}"]`)
			await button.click()
			await expect(button).toHaveAttribute('data-active', 'true')
		}
	})
})
