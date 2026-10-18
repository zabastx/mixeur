import { type FileChooser, type Page, expect } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/** The GLB fixture `importGlb` brings in. */
export const glbFixture = fileURLToPath(new URL('./files/test-gltf.glb', import.meta.url))

/** A Box mesh named "JSON Box", as Object3D.toJSON writes it. */
export const jsonFixture = fileURLToPath(new URL('./files/box.json', import.meta.url))

/** Opens the app and waits for the viewport's canvas to be in the page. */
export async function openApp(page: Page) {
	await page.goto('/')
	await expect(page.getByTestId('viewport-canvas')).toBeAttached()
}

/**
 * Opens a top-level menu by its name: the visible label, or for an icon-only
 * menu such as "mixeur", the label it carries as its accessible name.
 */
export async function openMenu(page: Page, label: string) {
	await page.getByRole('menuitem', { name: label, exact: true }).click()
}

/** Opens a submenu of the menu already open, by hovering its trigger. */
export async function openSubmenu(page: Page, label: string) {
	await page.getByRole('menuitem', { name: label, exact: true }).hover()
}

/** Opens the Import Scene modal through File › Import › Import from file. */
export async function openImportScene(page: Page) {
	await openMenu(page, 'File')
	await openSubmenu(page, 'Import')
	await page.getByRole('menuitem', { name: 'Import from file' }).click()
	await expect(page.getByTestId('import-scene')).toBeVisible()
}

/**
 * Imports the model file at `path` through the Import Scene modal, picking the
 * model listed as `name`, and returns once the modal has closed.
 */
export async function importModel(page: Page, path: string, name: string) {
	await openImportScene(page)

	const chooser = page.waitForEvent('filechooser')
	await page.getByRole('button', { name: 'Upload files' }).click()
	await (await chooser).setFiles(path)

	await page.getByText(name).click()
	await page.getByRole('button', { name: 'Import' }).click()
	await expect(page.getByTestId('import-scene')).toBeHidden()
}

/** Imports a Three.js JSON file through File › Import › Import Three.js JSON. */
export async function importThreeJson(page: Page, file: Parameters<FileChooser['setFiles']>[0]) {
	await openMenu(page, 'File')
	await openSubmenu(page, 'Import')
	const chooser = page.waitForEvent('filechooser')
	await page.getByRole('menuitem', { name: 'Import Three.js JSON' }).click()
	await (await chooser).setFiles(file)
}

/**
 * Opens the app and imports the shared GLB fixture through the Import Scene modal,
 * leaving the imported object selected and visible in the outliner.
 */
export async function importGlb(page: Page) {
	await openApp(page)
	await importModel(page, glbFixture, 'test-gltf.glb')
	await expect(page.getByTestId('outliner-item').first()).toBeVisible()
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
	await page.getByTestId(testId).getByRole('combobox').click()
	await page.getByRole('option', { name: option, exact: true }).click()
}

/**
 * Saves the project to a file and opens it again, returning once the load has
 * been confirmed. The round trip every "does this survive a save" test needs.
 */
export async function saveAndReopenProject(page: Page) {
	await openMenu(page, 'File')
	const [download] = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('menuitem', { name: 'Save' }).click()
	])
	const downloadPath = await download.path()
	expect(downloadPath).toBeTruthy()

	await openMenu(page, 'File')
	const [fileChooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.getByRole('menuitem', { name: 'Open' }).click()
	])
	await fileChooser.setFiles(downloadPath!)

	// Exact match avoids the duplicate aria-live announcer node.
	await expect(page.getByText('Project loaded successfully', { exact: true })).toBeVisible()
}

/**
 * The outliner rows for objects named exactly `name`, one per object.
 *
 * Exact, because a light's or camera's helper can show up as a row named after
 * it ("Point Light Helper"), which a substring match would count too.
 */
export function outlinerRows(page: Page, name: string) {
	return page.getByRole('treeitem', { name, exact: true })
}

/**
 * Moves the first object named `name` into a new group, through the outliner's
 * context menu, and expands that group so the object's row is visible again.
 */
export async function moveToNewGroup(page: Page, name: string) {
	await outlinerRows(page, name).first().click({ button: 'right' })
	// By keyboard: the submenu closes when the pointer cuts across to it
	// diagonally, so neither clicking nor hovering "Move to" reliably reaches it.
	await page.getByRole('menuitem', { name: 'Move to' }).focus()
	await page.keyboard.press('ArrowRight')
	await page.getByRole('menuitem', { name: 'New Group' }).press('Enter')
	// A new group is added collapsed, last among the scene's top-level rows.
	await outlinerRows(page, 'Group').last().getByTestId('outliner-toggle').click()
}
