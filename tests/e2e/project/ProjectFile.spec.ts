import { test, expect } from '@playwright/test'
import {
	chooseOption,
	equirectFixture,
	importGlb,
	openApp,
	outlinerRows,
	saveAndReopenProject
} from '../helpers'

test.describe('Project file', () => {
	test('saves a .mixeur file and reopens it', async ({ page }) => {
		await importGlb(page)
		const rows = page.getByRole('treeitem')
		const saved = ['Point Light', 'Camera', 'cube.001', 'test-gltf.glb']
		await expect(rows).toHaveText(saved)

		await saveAndReopenProject(page, async () => {
			// Changed after saving, so an Open that loads nothing leaves it showing.
			await outlinerRows(page, 'test-gltf.glb').click({ button: 'right' })
			await page.getByRole('menuitem', { name: 'Delete' }).click()
			await page.getByTestId('outliner-add-group').click()
			await expect(rows).toHaveText(['Point Light', 'Camera', 'cube.001', 'Group'])
		})

		await expect(rows).toHaveText(saved)
	})

	test('an imported World reopens asking for its file again', async ({ page }) => {
		await openApp(page)
		await page.getByTestId('properties-tab-world').click()

		// Give the World an imported image.
		await chooseOption(page, 'world-surface', 'Image')
		const chooser = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		await (await chooser).setFiles(equirectFixture)
		await expect(page.getByTestId('world-image')).toContainText('sunset.exr')
		await expect(page.getByTestId('world-image-detail')).toHaveText('')

		await saveAndReopenProject(page)

		// The name survives; the bytes cannot. A browser has no path to go back
		// for, so the World says so rather than silently showing nothing (ADR-0002).
		// Exact, like the load toast above: the aria-live announcer duplicates the text.
		await expect(page.getByText('World image not loaded', { exact: true })).toBeVisible()
		await page.getByTestId('properties-tab-world').click()
		await expect(page.getByTestId('world-image')).toContainText('sunset.exr')
		await expect(page.getByTestId('world-image-detail')).toHaveText('not loaded')
	})
})
