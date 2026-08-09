import { test, expect, type Page } from '@playwright/test'
import { chooseOption } from '../helpers'

/**
 * What a rendered image is lit by.
 *
 * The render draws through a second `WebGLRenderer` on its own canvas, and the
 * World's environment map is PMREM output — a render target with no pixels
 * outside the context that filtered it. Sharing it silently lit nothing: the
 * backdrop came out right, being an ordinary image, while every object fell
 * back to the scene lights alone. Nothing in the DOM shows that; only the
 * pixels do.
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

test.describe('Render Image', () => {
	test('renders the scene lit by the World, not by scene lights alone', async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		// An image Surface: bright enough on every side that a cube lit by it
		// cannot come out with a black face.
		await page.locator('[data-testid="properties-tab-world"]').click()
		await chooseOption(page, 'world-surface', 'Image')

		await page.click('text=Render')
		await page.getByRole('menuitem', { name: 'Render Image' }).click()
		await expect(page.locator('[data-testid="modal-render-image"]')).toBeVisible()
		await page.getByRole('button', { name: 'Render Image' }).click()

		// Polls: the render runs behind a timeout and the preview arrives as a
		// blob the <img> then has to decode.
		await expect
			.poll(() => darkestCentrePixel(page), { timeout: 20_000 })
			.toBeGreaterThan(25)
	})
})
