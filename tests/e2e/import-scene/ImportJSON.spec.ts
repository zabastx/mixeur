import { test, expect } from '@playwright/test'
import { importThreeJson, jsonFixture, openApp, outlinerRows } from '../helpers'

test.describe('Three.js JSON import', () => {
	test('the same file can be imported twice', async ({ page }) => {
		await openApp(page)

		for (const count of [1, 2]) {
			await importThreeJson(page, jsonFixture)

			// The dialog reuses one input and keeps its selection, so the second
			// pick of the identical file used to fire no change event at all.
			await expect(outlinerRows(page, 'JSON Box')).toHaveCount(count)
		}
	})
})
