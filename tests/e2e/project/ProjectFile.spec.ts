import { test, expect } from '@playwright/test'
import { importGlb } from '../helpers'

test.describe('Project file', () => {
	test('saves a .mixeur file and reopens it', async ({ page }) => {
		await importGlb(page)
		const items = page.locator('[data-testid="outliner-item"]')
		expect(await items.count()).toBeGreaterThan(0)

		// Save the project — triggers a binary .mixeur download.
		await page.click('text=File')
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('menuitem', { name: 'Save' }).click()
		])
		expect(download.suggestedFilename()).toContain('.mixeur')
		const downloadPath = await download.path()
		expect(downloadPath).toBeTruthy()

		// Reopen the saved project — clears the scene and reloads from the file.
		await page.click('text=File')
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('menuitem', { name: 'Open' }).click()
		])
		await fileChooser.setFiles(downloadPath!)

		// Exact match avoids the duplicate aria-live announcer node.
		await expect(page.getByText('Project loaded successfully', { exact: true })).toBeVisible()
		await expect(items.first()).toBeVisible()
	})
})
