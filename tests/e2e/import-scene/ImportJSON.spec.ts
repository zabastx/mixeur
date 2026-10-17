import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { openApp, openMenu, openSubmenu, outlinerRows } from '../helpers'

/** A Box mesh named "JSON Box", as Object3D.toJSON writes it. */
const jsonFixture = fileURLToPath(new URL('../files/box.json', import.meta.url))

test.describe('Three.js JSON import', () => {
	test('the same file can be imported twice', async ({ page }) => {
		await openApp(page)

		for (const count of [1, 2]) {
			await openMenu(page, 'File')
			await openSubmenu(page, 'Import')
			const chooser = page.waitForEvent('filechooser')
			await page.getByRole('menuitem', { name: 'Import Three.js JSON' }).click()
			await (await chooser).setFiles(jsonFixture)

			// The dialog reuses one input and keeps its selection, so the second
			// pick of the identical file used to fire no change event at all.
			await expect(outlinerRows(page, 'JSON Box')).toHaveCount(count)
		}
	})
})
