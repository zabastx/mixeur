import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import { openApp } from '../helpers'

const imageFixture = fileURLToPath(
	new URL('../../../public/textures/studio/city.png', import.meta.url)
)

test.describe('Texture input', () => {
	test('the same image can be picked again after the texture is cleared', async ({ page }) => {
		await openApp(page)
		await page.getByTestId('properties-tab-material').click()
		const field = page.getByTestId('texture-map')

		const first = page.waitForEvent('filechooser')
		await field.getByText('None').click()
		await field.getByRole('button', { name: 'File' }).click()
		await (await first).setFiles(imageFixture)
		await expect(field).toContainText('city.png')

		await field.getByRole('button', { name: 'Clear' }).click()
		await expect(field).toContainText('None')

		// The dialog reuses one input and keeps its selection, so re-picking the
		// identical file used to fire no change event and quietly do nothing.
		const second = page.waitForEvent('filechooser')
		await field.getByText('None').click()
		await field.getByRole('button', { name: 'File' }).click()
		await (await second).setFiles(imageFixture)

		await expect(field).toContainText('city.png')
	})
})
