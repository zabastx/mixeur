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

/**
 * An equirectangular image with real high-dynamic-range bytes, for tests that
 * need a World image the loaders and PMREM actually have to read.
 *
 * One of the app's own studio lights rather than a copy under `files/`: it is
 * already in the repo, and no test here cares which image it is beyond it being
 * a genuine EXR. Resolved from this module's own URL so it does not depend on
 * the working directory the runner happens to start in.
 */
export const equirectFixture = fileURLToPath(
	new URL('../../public/textures/studio/sunset.exr', import.meta.url)
)

/** A second one, for tests that have to tell two imported images apart. */
export const otherEquirectFixture = fileURLToPath(
	new URL('../../public/textures/studio/night.exr', import.meta.url)
)

/** Opens one of the properties panel's selects and picks an option by label. */
export async function chooseOption(page: Page, testId: string, option: string) {
	await page.locator(`[data-testid="${testId}"]`).getByRole('combobox').click()
	await page.getByRole('option', { name: option, exact: true }).click()
}

/**
 * Saves the project to a file and opens it again, returning once the load has
 * been confirmed. The round trip every "does this survive a save" test needs.
 */
export async function saveAndReopenProject(page: Page) {
	await page.click('text=File')
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Save' }).click()
	])
	const downloadPath = await download.path()
	expect(downloadPath).toBeTruthy()

	await page.click('text=File')
	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.getByRole('menuitem', { name: 'Open' }).click()
	])
	await fileChooser.setFiles(downloadPath!)

	// Exact match avoids the duplicate aria-live announcer node.
	await expect(page.getByText('Project loaded successfully', { exact: true })).toBeVisible()
}
