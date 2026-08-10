import { test, expect, type Page } from '@playwright/test'
import { chooseOption } from '../helpers'

/**
 * What a rendered image is lit by, whether it keeps its alpha, and whether the
 * viewport survives being rendered from.
 *
 * The render draws with the viewport's *own* renderer into an offscreen target
 * and reads the pixels back (issue #29). The World's environment map is that
 * renderer's PMREM output, so it lights the render directly — no second GL
 * context for a map to fail to cross. Nothing in the DOM shows whether the World
 * reached the objects, or whether the background stayed transparent; only the
 * pixels do, so these tests sample the render's own image.
 */

/**
 * The darkest pixel in the middle of the render, where the default cube sits.
 *
 * A cube lit by the World has no black faces. A cube the World never reached
 * has several, so a floor on this one number separates the two cases without
 * depending on exactly where the cube lands in frame.
 */
async function darkestCentrePixel(page: Page): Promise<number> {
	return await page.evaluate(() => {
		const img = document.querySelector<HTMLImageElement>('[data-testid="modal-render-image"] img')
		if (!img?.naturalWidth) return -1

		const canvas = document.createElement('canvas')
		canvas.width = img.naturalWidth
		canvas.height = img.naturalHeight
		const context = canvas.getContext('2d')
		if (!context) return -1
		context.drawImage(img, 0, 0)

		const { data } = context.getImageData(
			Math.round(canvas.width * 0.3),
			Math.round(canvas.height * 0.3),
			Math.round(canvas.width * 0.4),
			Math.round(canvas.height * 0.4)
		)

		let darkest = 255
		for (let i = 0; i < data.length; i += 4) {
			const brightness = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
			if (brightness < darkest) darkest = brightness
		}
		return darkest
	})
}

/**
 * The alpha of a corner pixel and of the centre, as the preview decodes them.
 *
 * A transparent render must leave the corner see-through and the cube in the
 * middle opaque. Reading alpha back through the `<img>` is the only place the
 * read-back's alpha handling shows: composite onto black instead and the corner
 * comes back fully opaque.
 */
async function alphaSample(page: Page): Promise<{ corner: number; centre: number }> {
	return await page.evaluate(() => {
		const img = document.querySelector<HTMLImageElement>('[data-testid="modal-render-image"] img')
		if (!img?.naturalWidth) return { corner: -1, centre: -1 }

		const canvas = document.createElement('canvas')
		canvas.width = img.naturalWidth
		canvas.height = img.naturalHeight
		const context = canvas.getContext('2d')
		if (!context) return { corner: -1, centre: -1 }
		context.drawImage(img, 0, 0)

		const corner = context.getImageData(2, 2, 1, 1).data[3]!
		const centre = context.getImageData(
			Math.round(canvas.width / 2),
			Math.round(canvas.height / 2),
			1,
			1
		).data[3]!
		return { corner, centre }
	})
}

/** Whether the viewport's WebGL context has been lost. */
async function viewportContextLost(page: Page): Promise<boolean> {
	return await page.evaluate(() => {
		const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')
		if (!canvas) return true
		const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
		return gl ? gl.isContextLost() : true
	})
}

/** Opens the Render Image modal from the top menu. */
async function openRenderModal(page: Page) {
	await page.click('text=Render')
	await page.getByRole('menuitem', { name: 'Render Image' }).click()
	await expect(page.locator('[data-testid="modal-render-image"]')).toBeVisible()
}

test.describe('Render Image', () => {
	test('renders the scene lit by the World, not by scene lights alone', async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		// An image Surface: bright enough on every side that a cube lit by it
		// cannot come out with a black face.
		await page.locator('[data-testid="properties-tab-world"]').click()
		await chooseOption(page, 'world-surface', 'Image')

		await openRenderModal(page)
		await page.getByRole('button', { name: 'Render Image' }).click()

		// Polls: the render runs behind a timeout and the preview arrives as a
		// blob the <img> then has to decode.
		await expect.poll(() => darkestCentrePixel(page), { timeout: 20_000 }).toBeGreaterThan(25)
	})

	test('keeps real transparency when the Background toggle is off', async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		await openRenderModal(page)

		// Off makes the render's backdrop transparent; the cube in the middle stays
		// opaque. The one checkbox in the render settings is this toggle.
		await page.locator('[data-testid="modal-render-image"]').getByRole('checkbox').click()
		await page.getByRole('button', { name: 'Render Image' }).click()

		// Wait on the centre first: it only goes opaque once the preview has
		// decoded, which rules out reading a corner off an image that is not there
		// yet (a missing read comes back as -1, which is also "transparent").
		await expect
			.poll(() => alphaSample(page).then((s) => s.centre), { timeout: 20_000 })
			.toBeGreaterThan(200)

		// A read-back that composited onto black would report the corner opaque; a
		// correct one leaves it see-through.
		expect((await alphaSample(page)).corner).toBeLessThan(40)
	})

	test('leaves the viewport rendering after repeated renders', async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		await page.locator('[data-testid="properties-tab-world"]').click()
		await chooseOption(page, 'world-surface', 'Image')

		await openRenderModal(page)

		// Twice over: each render used to allocate a fresh GL context, and the
		// browser drops the oldest once too many pile up — the failure this change
		// removes. The viewport's context has to be untouched by either render.
		for (let run = 0; run < 2; run++) {
			await page.getByRole('button', { name: 'Render Image' }).click()
			await expect.poll(() => darkestCentrePixel(page), { timeout: 20_000 }).toBeGreaterThan(25)
		}

		expect(await viewportContextLost(page)).toBe(false)
	})
})
