import { test, expect, type Page } from '@playwright/test'
import { fileURLToPath } from 'node:url'

/**
 * A rigged model has to come back from a file the same shape it went in.
 *
 * Serializing one is not the same as serializing anything else: a `SkinnedMesh`
 * carries its pose in a `Skeleton` that lives beside it in the tree rather than
 * inside it, and a clone taken on the way out shares the *source's* skeleton
 * while its own bones get fresh UUIDs. What that writes is a skeleton naming
 * bones the file does not contain, and three.js says so on the way back in —
 * one `No bone found with UUID` per bone — before dropping the mesh onto its
 * bones' origins. So these tests watch for that message and look at the pixels:
 * a rig that collapsed is a rig that vanished from the viewport.
 */

const riggedFixture = fileURLToPath(new URL('../files/rigged.glb', import.meta.url))

/** Every "no bone found" three.js reports, from the moment the page opens. */
function watchForLostBones(page: Page) {
	const lost: string[] = []
	page.on('console', (message) => {
		if (message.text().includes('No bone found with UUID')) lost.push(message.text())
	})
	return lost
}

async function openApp(page: Page) {
	await page.goto('/')
	await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

	// Solid shading paints everything the same grey, which is no use for telling
	// the fixture apart from the default cube. Preview draws its own material.
	await page.locator('[data-testid="shading-btn-preview"]').click()
	await expect(page.locator('[data-testid="shading-btn-preview"]')).toHaveAttribute(
		'data-active',
		'true'
	)

	// And the default cube is in front of where the fixture lands, so it goes.
	const cube = page.locator('[data-testid="outliner-item"]', { hasText: 'cube' }).first()
	await cube.click({ button: 'right' })
	await page.getByRole('menuitem', { name: 'Delete' }).click()
	await expect(cube).toHaveCount(0)
}

/** Imports a model file through the Import Scene modal. */
async function importModel(page: Page, path: string, name: string) {
	await page.click('text=File')
	await page.hover('text=Import')
	await page.click('text=Import from file')
	await page.waitForSelector('[data-testid="import-scene"]', { state: 'visible' })

	const [chooser] = await Promise.all([
		page.waitForEvent('filechooser'),
		page.click('text=Upload files')
	])
	await chooser.setFiles(path)

	await page.locator(`text=${name}`).click()
	await page.getByRole('button', { name: 'Import' }).click()
	await page.locator('[data-testid="import-scene"]').waitFor({ state: 'hidden' })
}

/**
 * How much of the viewport the rig covers, as a fraction of the canvas.
 *
 * Counted on the mesh's own colour rather than on "not the backdrop", so the
 * grid, the gizmo and the default cube cannot be mistaken for it. A rig that
 * lost its skeleton collapses onto a point and this goes to roughly zero.
 */
async function rigCoverage(page: Page) {
	// Two frames, so the reading is never taken mid-draw.
	await page.evaluate(
		() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))))
	)

	const shot = await page.locator('[data-testid="viewport-canvas"]').screenshot()

	return await page.evaluate(async (bytes) => {
		const blob = new Blob([new Uint8Array(bytes)], { type: 'image/png' })
		const bitmap = await createImageBitmap(blob)
		const canvas = document.createElement('canvas')
		canvas.width = bitmap.width
		canvas.height = bitmap.height
		const context = canvas.getContext('2d')!
		context.drawImage(bitmap, 0, 0)
		const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

		let hits = 0
		for (let i = 0; i < data.length; i += 4) {
			const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
			// the fixture's orange (0xff7043) under any lighting: red leads, blue trails
			if (r > 90 && r > g * 1.35 && g > b * 1.15) hits++
		}
		return hits / (canvas.width * canvas.height)
	}, Array.from(shot))
}

test.describe('Skinned models survive a round trip', () => {
	test('a project save and reopen keeps the rig posed', async ({ page }) => {
		const lostBones = watchForLostBones(page)
		await openApp(page)
		await importModel(page, riggedFixture, 'rigged.glb')

		const before = await rigCoverage(page)
		expect(before).toBeGreaterThan(0.01)

		await page.click('text=File')
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('menuitem', { name: 'Save' }).click()
		])
		const saved = await download.path()
		expect(saved).toBeTruthy()

		await page.click('text=File')
		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.getByRole('menuitem', { name: 'Open' }).click()
		])
		await chooser.setFiles(saved!)
		await expect(page.getByText('Project loaded successfully', { exact: true })).toBeVisible()

		const after = await rigCoverage(page)

		expect(lostBones).toEqual([])
		// the same rig, drawn the same size — not a dot where a column was
		expect(after).toBeGreaterThan(before * 0.8)
	})

	test('Save to JSON and Import Three.js JSON keeps the rig posed', async ({ page }) => {
		const lostBones = watchForLostBones(page)
		await openApp(page)
		await importModel(page, riggedFixture, 'rigged.glb')

		const before = await rigCoverage(page)
		expect(before).toBeGreaterThan(0.01)

		const rig = page.locator('[data-testid="outliner-item"]', { hasText: 'rigged.glb' }).first()
		await rig.click({ button: 'right' })
		const [download] = await Promise.all([
			page.waitForEvent('download'),
			page.getByRole('menuitem', { name: 'Save to JSON' }).click()
		])
		const saved = await download.path()
		expect(saved).toBeTruthy()

		// take the original away, so what is measured next can only be the import
		await rig.click({ button: 'right' })
		await page.getByRole('menuitem', { name: 'Delete' }).click()
		expect(await rigCoverage(page)).toBeLessThan(0.001)

		await page.click('text=File')
		await page.hover('text=Import')
		const [chooser] = await Promise.all([
			page.waitForEvent('filechooser'),
			page.click('text=Import Three.js JSON')
		])
		await chooser.setFiles(saved!)

		await expect(
			page.locator('[data-testid="outliner-item"]', { hasText: 'rigged.glb' }).first()
		).toBeVisible()

		const after = await rigCoverage(page)

		expect(lostBones).toEqual([])
		expect(after).toBeGreaterThan(before * 0.8)
	})
})
