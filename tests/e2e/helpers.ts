import { type Page, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * Opens the app and imports the shared GLB fixture through the Import Scene modal,
 * leaving the imported object selected and visible in the outliner.
 */
export async function importGlb(page: Page) {
	await page.goto('/')
	await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

	await page.click('text=File')
	await page.hover('text=Import')
	await page.click('text=Import from file')
	await page.waitForSelector('[data-testid="import-scene"]', { state: 'visible' })

	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.click('text=Upload files')
	])
	const filePath = fileURLToPath(new URL('./files/test-gltf.glb', import.meta.url))
	await fileChooser.setFiles(filePath)

	await page.locator('text=test-gltf.glb').click()
	await page.getByRole('button', { name: 'Import' }).click()
	await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })

	await expect(page.locator('[data-testid="outliner-item"]').first()).toBeVisible()
}

/** Opens a top-level menubar menu by its visible label. */
export async function openMenu(page: Page, label: string) {
	await page.click(`text=${label}`)
}
