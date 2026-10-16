import { test, expect } from '@playwright/test'
import { openApp } from '../helpers'

test.describe('Viewport Controls', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('Toolbar buttons switch transform mode', async ({ page }) => {
		const translateBtn = page.getByTestId('toolbar-btn-translate')
		const rotateBtn = page.getByTestId('toolbar-btn-rotate')
		const scaleBtn = page.getByTestId('toolbar-btn-scale')

		await expect(translateBtn).toHaveAttribute('data-active', 'true')
		await expect(rotateBtn).toHaveAttribute('data-active', 'false')
		await expect(scaleBtn).toHaveAttribute('data-active', 'false')

		await rotateBtn.click()
		await expect(translateBtn).toHaveAttribute('data-active', 'false')
		await expect(rotateBtn).toHaveAttribute('data-active', 'true')
		await expect(scaleBtn).toHaveAttribute('data-active', 'false')

		await scaleBtn.click()
		await expect(translateBtn).toHaveAttribute('data-active', 'false')
		await expect(rotateBtn).toHaveAttribute('data-active', 'false')
		await expect(scaleBtn).toHaveAttribute('data-active', 'true')
	})

	test('Keyboard shortcuts G,R,S switch tools', async ({ page }) => {
		const translateBtn = page.getByTestId('toolbar-btn-translate')
		const rotateBtn = page.getByTestId('toolbar-btn-rotate')
		const scaleBtn = page.getByTestId('toolbar-btn-scale')
		const canvas = page.getByTestId('viewport-canvas')

		await canvas.click()
		await canvas.press('g')
		await expect(translateBtn).toHaveAttribute('data-active', 'true')

		await canvas.click()
		await canvas.press('r')
		await expect(rotateBtn).toHaveAttribute('data-active', 'true')

		await canvas.click()
		await canvas.press('s')
		await expect(scaleBtn).toHaveAttribute('data-active', 'true')
	})
})
