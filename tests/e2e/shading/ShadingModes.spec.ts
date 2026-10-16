import { test, expect } from '@playwright/test'
import { openApp } from '../helpers'

test.describe('Viewport shading modes', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('solid is active by default and modes can be switched', async ({ page }) => {
		await expect(page.getByTestId('shading-btn-solid')).toHaveAttribute('data-active', 'true')

		for (const mode of ['wireframe', 'preview', 'rendered', 'solid'] as const) {
			const button = page.getByTestId(`shading-btn-${mode}`)
			await button.click()
			await expect(button).toHaveAttribute('data-active', 'true')
		}
	})
})
