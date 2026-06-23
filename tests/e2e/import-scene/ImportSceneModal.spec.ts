import { test, expect } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

test.describe('Import Scene Modal', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/')
		await page.click('text=File')
		await page.hover('text=Import')
		await page.click('text=Import from file')
		await page.waitForSelector('[data-testid="import-scene"]', { state: 'visible' })
	})

	test('Import GLB file', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Upload files')
		])
		expect(fileChooser.isMultiple()).toBe(true)
		const filePath = fileURLToPath(new URL('../files/test-gltf.glb', import.meta.url))
		await fileChooser.setFiles(filePath)
		await expect(page.locator('text=test-gltf.glb')).toBeVisible()
		await page.locator('text=test-gltf.glb').click()
		await page.getByRole('button', { name: 'Import' }).click()
		await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })
		expect(page.getByText('test-gltf.glb')).toBeVisible()
	})

	test('Import OBJ file with assets', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Upload a folder')
		])

		expect(fileChooser.isMultiple()).toBe(true)

		const dirPath = fileURLToPath(new URL('../files/obj', import.meta.url))
		await fileChooser.setFiles(dirPath)
		const dir = readdirSync(dirPath, { withFileTypes: true })

		await Promise.all(
			dir.map(async (file) => await expect(page.getByText(`${file.name}`)).toBeVisible())
		)

		await page.locator('[data-testid="model-file"]').click()
		page.getByRole('button', { name: 'Import' })
		const autoFillBtn = page.locator('button', { hasText: 'Auto Fill' })
		await autoFillBtn.waitFor()
		await autoFillBtn.click()
		await page.getByRole('button', { name: 'Import' }).click()
		await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })
		await expect(page.getByText('female02.obj')).toBeVisible()
	})

	test('Import FBX file', async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'WebKit FBX loader behaves differently')
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Upload files')
		])
		expect(fileChooser.isMultiple()).toBe(true)
		const filePath = fileURLToPath(new URL('../files/fbx/cliff-side.fbx', import.meta.url))
		await fileChooser.setFiles(filePath)
		await expect(page.locator('text=cliff-side.fbx')).toBeVisible()
		await page.locator('text=cliff-side.fbx').click()
		await page.getByRole('button', { name: 'Import' }).click()
		await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })
		await expect(page.getByText('cliff-side.fbx')).toBeVisible()
	})

	test('Modal close button', async ({ page }) => {
		await page.getByRole('button', { name: 'Close' }).click()
		await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })
	})

	test('Multiple model files', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Upload files')
		])
		const glbPath = fileURLToPath(new URL('../files/test-gltf.glb', import.meta.url))
		const objPath = fileURLToPath(new URL('../files/obj/female02.obj', import.meta.url))
		await fileChooser.setFiles([glbPath, objPath])
		await expect(page.getByText('test-gltf.glb')).toBeVisible()
		await expect(page.getByText('female02.obj')).toBeVisible()
	})

	test('Manual asset mapping', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Upload a folder')
		])
		const dirPath = fileURLToPath(new URL('../files/obj', import.meta.url))
		await fileChooser.setFiles(dirPath)

		// Select the model file (should show required assets)
		await page.locator('[data-testid="model-file"]').click()

		// Verify required assets section appears (OBJ with MTL has required assets)
		await expect(page.getByRole('heading', { name: /Required Assets/i })).toBeVisible()

		// Change asset selection via dropdown instead of using Auto Fill
		const assetSelect = page.locator('[data-testid^="asset-file"]').first()
		await assetSelect.click()
	})
})
