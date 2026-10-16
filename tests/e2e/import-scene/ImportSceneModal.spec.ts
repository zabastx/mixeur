import { test, expect } from '@playwright/test'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { openApp, openImportScene } from '../helpers'

test.describe('Import Scene Modal', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
		await openImportScene(page)
	})

	test('Import GLB file', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('button', { name: 'Upload files' }).click()
		])
		expect(fileChooser.isMultiple()).toBe(true)
		const filePath = fileURLToPath(new URL('../files/test-gltf.glb', import.meta.url))
		await fileChooser.setFiles(filePath)
		await expect(page.getByText('test-gltf.glb')).toBeVisible()
		await page.getByText('test-gltf.glb').click()
		await page.getByRole('button', { name: 'Import' }).click()
		await expect(page.getByTestId('import-scene')).toBeHidden()
		await expect(page.getByText('test-gltf.glb')).toBeVisible()
	})

	test('Import OBJ file with assets', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('button', { name: 'Upload a folder' }).click()
		])

		expect(fileChooser.isMultiple()).toBe(true)

		const dirPath = fileURLToPath(new URL('../files/obj', import.meta.url))
		await fileChooser.setFiles(dirPath)
		const dir = readdirSync(dirPath, { withFileTypes: true })

		await Promise.all(
			dir.map(async (file) => await expect(page.getByText(`${file.name}`)).toBeVisible())
		)

		await page.getByTestId('model-file').click()
		await page.getByRole('button', { name: 'Auto Fill' }).click()
		await page.getByRole('button', { name: 'Import' }).click()
		await expect(page.getByTestId('import-scene')).toBeHidden()
		await expect(page.getByText('female02.obj')).toBeVisible()

		// The material library is found and applied by the loader, not by this
		// modal, so check the meshes actually came back wearing it.
		const imported = page.getByTestId('outliner-item').filter({ hasText: 'female02.obj' })
		await imported.getByTestId('outliner-toggle').click()
		await page.getByTestId('outliner-item').last().click()
		await page.getByTestId('properties-tab-material').click()

		// Maps loaded from an MTL are named `map_<material>`; anything but "None"
		// in the base colour slot means the MTL and its textures resolved.
		await expect(page.getByTitle(/^map_/).first()).toBeVisible()
	})

	test('Import FBX file', async ({ page, browserName }) => {
		test.skip(browserName === 'webkit', 'WebKit FBX loader behaves differently')
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('button', { name: 'Upload files' }).click()
		])
		expect(fileChooser.isMultiple()).toBe(true)
		const filePath = fileURLToPath(new URL('../files/fbx/cliff-side.fbx', import.meta.url))
		await fileChooser.setFiles(filePath)
		await expect(page.getByText('cliff-side.fbx')).toBeVisible()
		await page.getByText('cliff-side.fbx').click()
		await page.getByRole('button', { name: 'Import' }).click()
		await expect(page.getByTestId('import-scene')).toBeHidden()
		await expect(page.getByText('cliff-side.fbx')).toBeVisible()
	})

	test('Modal close button', async ({ page }) => {
		await page.getByRole('button', { name: 'Close' }).click()
		await expect(page.getByTestId('import-scene')).toBeHidden()
	})

	test('Multiple model files', async ({ page }) => {
		const [fileChooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('button', { name: 'Upload files' }).click()
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
			page.getByRole('button', { name: 'Upload a folder' }).click()
		])
		const dirPath = fileURLToPath(new URL('../files/obj', import.meta.url))
		await fileChooser.setFiles(dirPath)

		// Select the model file (should show required assets)
		await page.getByTestId('model-file').click()

		// Verify required assets section appears (OBJ with MTL has required assets)
		await expect(page.getByRole('heading', { name: /Required Assets/i })).toBeVisible()

		// Selecting the model auto-fills only the MTL; the textures it names stay
		// empty until mapped. Pick a file other than the one Auto Fill would choose,
		// so the slot can only hold it if the dropdown put it there.
		const slot = page
			.getByTestId('required-asset')
			.filter({ has: page.getByText('01_-_Default1noCulling.JPG', { exact: true }) })
		await slot.getByRole('combobox').click()
		await page.getByRole('option', { name: '02_-_Default1noCulling.JPG', exact: true }).click()

		await expect(slot.getByRole('combobox')).toHaveText('02_-_Default1noCulling.JPG')
	})
})
