import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import {
	importGlb,
	importThreeJson,
	jsonFixture,
	moveTo,
	moveToNewGroup,
	openApp,
	openRenderModal,
	outlinerRows
} from '../helpers'

/**
 * A screenshot of the viewport once it has settled: two in a row, a couple of
 * frames apart, that come out the same. A shot taken while the first frames are
 * still coming in differs from a later one by a few stray pixels.
 */
async function viewportShot(page: Page) {
	const shoot = async () => {
		await page.evaluate(
			() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
		)
		return (await page.getByTestId('viewport-canvas').screenshot()).toString('base64')
	}
	let shot = await shoot()
	for (let attempt = 0; attempt < 10; attempt++) {
		const next = await shoot()
		if (next === shot) break
		shot = next
	}
	return shot
}

/**
 * How long to poll `viewportChange`. CI has no GPU, so a frame is drawn in
 * software and one settled shot (at least two screenshots) takes around nine
 * seconds there, past `expect.poll`'s five-second default.
 */
const viewportPoll = { timeout: 30_000 }

/**
 * The fraction of the viewport's pixels that differ from `baseline`, a shot
 * taken by `viewportShot`. Near zero when the viewport shows what it showed
 * then; well above it when something has left or entered the view.
 */
async function viewportChange(page: Page, baseline: string) {
	const current = await viewportShot(page)
	return await page.evaluate(
		async ([a, b]) => {
			async function pixels(base64: string) {
				const image = new Image()
				image.src = `data:image/png;base64,${base64}`
				await image.decode()
				const canvas = document.createElement('canvas')
				canvas.width = image.naturalWidth
				canvas.height = image.naturalHeight
				const context = canvas.getContext('2d')!
				context.drawImage(image, 0, 0)
				return context.getImageData(0, 0, canvas.width, canvas.height).data
			}
			const [before, after] = await Promise.all([pixels(a!), pixels(b!)])
			if (before.length !== after.length) return 1

			let changed = 0
			for (let i = 0; i < before.length; i += 4) {
				const delta = Math.max(
					Math.abs(before[i]! - after[i]!),
					Math.abs(before[i + 1]! - after[i + 1]!),
					Math.abs(before[i + 2]! - after[i + 2]!)
				)
				if (delta > 16) changed++
			}
			return changed / (before.length / 4)
		},
		[baseline, current]
	)
}

/**
 * Checks the Render Image modal will render through the camera named `name`, as
 * its Camera dropdown shows it. Opens the modal to read it and closes it again,
 * so the outliner is free to click afterwards.
 */
async function expectRenderCamera(page: Page, name: string) {
	await openRenderModal(page)
	const modal = page.getByTestId('modal-render-image')
	// Collapsed while there is a Render Camera.
	await modal.getByRole('button', { name: 'Render Camera' }).click()
	await expect(
		modal.getByRole('region', { name: 'Render Camera' }).getByRole('combobox')
	).toHaveText(name)
	await modal.getByRole('button', { name: 'Cancel' }).click()
	await expect(modal).toBeHidden()
}

test.describe('Outliner', () => {
	test('scene objects appear as rows, nested under their parent', async ({ page }) => {
		await importGlb(page)
		const parent = outlinerRows(page, 'test-gltf.glb')
		const child = outlinerRows(page, 'test-cube')

		await expect(parent).toHaveAttribute('aria-level', '1')
		await parent.getByTestId('outliner-toggle').click()
		await expect(child).toHaveAttribute('aria-level', '2')

		// Nested, not merely indented: collapsing the parent takes the child with it.
		await parent.getByTestId('outliner-toggle').click()
		await expect(child).toHaveCount(0)
	})

	test('editor objects do not appear', async ({ page }) => {
		await openApp(page)

		// The grid, its axes, the solid-mode lights and each light's and camera's
		// helper are all in the scene too.
		await expect(page.getByRole('treeitem')).toHaveText(['Point Light', 'Camera', 'cube.001'])
	})

	test('a camera helper inside a group does not appear', async ({ page }) => {
		await openApp(page)
		await moveToNewGroup(page, 'Camera')

		// A Duplicate's helper is added beside it, so into the group.
		await outlinerRows(page, 'Camera').click({ button: 'right' })
		await page.getByRole('menuitem', { name: /Duplicate Object/ }).click()

		await expect(outlinerRows(page, 'Camera')).toHaveCount(2)
		await expect(page.getByRole('treeitem', { name: /Helper/ })).toHaveCount(0)
	})

	test('an object with no name shows its type', async ({ page }) => {
		await openApp(page)
		const unnamed = JSON.parse(readFileSync(jsonFixture, 'utf8'))
		unnamed.object.name = ''

		await importThreeJson(page, {
			name: 'unnamed.json',
			mimeType: 'application/json',
			buffer: Buffer.from(JSON.stringify(unnamed))
		})

		await expect(outlinerRows(page, 'Mesh')).toHaveCount(1)
	})

	test('clicking a row selects it', async ({ page }) => {
		await openApp(page)
		// One row at a time: a second selected row would trip strict mode here.
		const selected = page.getByRole('treeitem', { selected: true })
		await expect(selected).toHaveAccessibleName('cube.001')
		const lightTab = page.getByTestId('properties-tab-light')
		await expect(lightTab).toHaveCount(0)

		await outlinerRows(page, 'Point Light').click()

		await expect(selected).toHaveAccessibleName('Point Light')
		// The tree keeps its own copy of the selection, so the row lights up even
		// when the click never reaches the selection store. The properties panel
		// reads the store, and only a light has a Light Properties tab.
		await expect(lightTab).toBeVisible()
	})

	test("a camera row's button makes that camera the Render Camera", async ({ page }) => {
		await openApp(page)
		const cameras = outlinerRows(page, 'Camera')
		await cameras.click({ button: 'right' })
		await page.getByRole('menuitem', { name: /Duplicate Object/ }).click()
		// Renamed, so the Render Image modal can tell the two apart.
		await cameras.last().click()
		await page.getByTestId('properties-tab-object').click()
		const name = page.getByLabel('Name', { exact: true })
		await name.fill('Second Camera')
		await name.press('Enter')
		const original = outlinerRows(page, 'Camera')
		const duplicate = outlinerRows(page, 'Second Camera')

		// The default scene's camera is its Render Camera; a Duplicate is not.
		await expect(original.getByRole('button', { pressed: true })).toBeVisible()
		await expect(duplicate.getByRole('button', { pressed: false })).toBeVisible()
		await expectRenderCamera(page, 'Camera')

		await duplicate.getByRole('button').click()

		await expect(duplicate.getByRole('button', { pressed: true })).toBeVisible()
		await expect(original.getByRole('button', { pressed: false })).toBeVisible()
		await expectRenderCamera(page, 'Second Camera')
	})

	test('Add Group adds a Group row', async ({ page }) => {
		await openApp(page)
		await expect(outlinerRows(page, 'Group')).toHaveCount(0)

		await page.getByTestId('outliner-add-group').click()

		await expect(outlinerRows(page, 'Group')).toHaveCount(1)
	})

	test('the visibility toggle takes an object out of the viewport and back', async ({ page }) => {
		await openApp(page)
		const toggle = outlinerRows(page, 'cube.001').getByTestId('visibility-toggle')
		const shown = await viewportShot(page)

		// The default cube covers about 1.4% of the viewport.
		await toggle.click()
		await expect.poll(() => viewportChange(page, shown), viewportPoll).toBeGreaterThan(0.005)

		await toggle.click()
		await expect.poll(() => viewportChange(page, shown), viewportPoll).toBeLessThan(0.001)
	})
})

// The default scene starts with cube.001 selected, so these tests right-click
// other rows: an action that ran on the selection, not the row clicked, fails them.
test.describe('Outliner context menu', () => {
	test('Move to › New Group puts the object in a new group', async ({ page }) => {
		await openApp(page)
		const light = outlinerRows(page, 'Point Light')
		await expect(light).toHaveAttribute('aria-level', '1')

		await moveToNewGroup(page, 'Point Light')

		await expect(light).toHaveAttribute('aria-level', '2')
		// Under the group, not merely indented: collapsing it hides the light.
		await outlinerRows(page, 'Group').getByTestId('outliner-toggle').click()
		await expect(light).toHaveCount(0)
	})

	test('Move to › a group puts the object in that group', async ({ page }) => {
		await openApp(page)
		await page.getByTestId('outliner-add-group').click()
		const light = outlinerRows(page, 'Point Light')

		await moveTo(page, 'Point Light', 'Group')

		// A group is added collapsed, so the light's row goes with it.
		await expect(light).toHaveCount(0)
		await outlinerRows(page, 'Group').getByTestId('outliner-toggle').click()
		await expect(light).toHaveAttribute('aria-level', '2')
	})

	test('Move to › Scene takes the object out of its group', async ({ page }) => {
		await openApp(page)
		await moveToNewGroup(page, 'Point Light')
		const light = outlinerRows(page, 'Point Light')
		await expect(light).toHaveAttribute('aria-level', '2')

		await moveTo(page, 'Point Light', 'Scene')

		await expect(light).toHaveAttribute('aria-level', '1')
		// Emptied, the group has nothing left to expand.
		await expect(outlinerRows(page, 'Group').getByTestId('outliner-toggle')).toHaveCount(0)
	})

	test('Duplicate Object adds a Duplicate beside the original', async ({ page }) => {
		await openApp(page)
		// Inside a group, so "beside" is told apart from "at the top level".
		await moveToNewGroup(page, 'Point Light')
		const lights = outlinerRows(page, 'Point Light')

		await lights.click({ button: 'right' })
		await page.getByRole('menuitem', { name: /Duplicate Object/ }).click()

		await expect(lights).toHaveCount(2)
		await expect(lights.last()).toHaveAttribute('aria-level', '2')
		await outlinerRows(page, 'Group').getByTestId('outliner-toggle').click()
		await expect(lights).toHaveCount(0)
	})

	test('Save to JSON writes the object as a file that imports back', async ({ page }) => {
		await openApp(page)

		await outlinerRows(page, 'Point Light').click({ button: 'right' })
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('menuitem', { name: 'Save to JSON' }).click()
		])
		expect(download.suggestedFilename()).toBe('Point Light.json')

		await importThreeJson(page, (await download.path())!)
		await expect(outlinerRows(page, 'Point Light')).toHaveCount(2)
	})

	test("Delete removes the object's row", async ({ page }) => {
		await openApp(page)

		await outlinerRows(page, 'Point Light').click({ button: 'right' })
		await page.getByRole('menuitem', { name: 'Delete' }).click()

		await expect(page.getByRole('treeitem')).toHaveText(['Camera', 'cube.001'])
	})

	test('Delete takes the rows nested under the object with it', async ({ page }) => {
		await importGlb(page)
		const parent = outlinerRows(page, 'test-gltf.glb')
		await parent.getByTestId('outliner-toggle').click()
		const items = page.getByRole('treeitem')
		await expect(items).toHaveText([
			'Point Light',
			'Camera',
			'cube.001',
			'test-gltf.glb',
			'test-cube'
		])

		await parent.click({ button: 'right' })
		await page.getByRole('menuitem', { name: 'Delete' }).click()

		await expect(items).toHaveText(['Point Light', 'Camera', 'cube.001'])
	})
})
