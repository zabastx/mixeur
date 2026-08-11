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
 * Everything these tests read off one finished render, decoded once.
 *
 * `null` until the preview has arrived and decoded — the render runs behind a
 * timeout and reaches the `<img>` as a blob, so every caller polls on this.
 * One decode rather than one per measurement: they all want the same pixels.
 */
interface RenderSample {
	/**
	 * The darkest pixel where the default cube sits. A cube lit by the World has
	 * no black faces; one the World never reached has several, so a floor here
	 * separates the two without depending on where the cube lands in frame.
	 */
	darkestCentre: number
	/** Mean brightness over the whole image, 0-255. */
	mean: number
	/** Alpha at a corner and at the centre — see the transparency test. */
	cornerAlpha: number
	centreAlpha: number
	/**
	 * Mean brightness of partly covered (antialiased) pixels against that of
	 * fully opaque ones. Un-premultiplying is what separates them, and doing it
	 * in the wrong colour space blows the edges out — so the ratio, not either
	 * number, is the thing worth asserting on.
	 */
	edgeMean: number
	opaqueMean: number
}

async function sampleRender(page: Page): Promise<RenderSample | null> {
	return await page.evaluate(() => {
		const img = document.querySelector<HTMLImageElement>('[data-testid="modal-render-image"] img')
		if (!img?.naturalWidth) return null

		const canvas = document.createElement('canvas')
		canvas.width = img.naturalWidth
		canvas.height = img.naturalHeight
		const context = canvas.getContext('2d')
		if (!context) return null
		context.drawImage(img, 0, 0)

		const all = context.getImageData(0, 0, canvas.width, canvas.height).data
		let sum = 0
		let edgeSum = 0
		let edgeCount = 0
		let opaqueSum = 0
		let opaqueCount = 0
		for (let i = 0; i < all.length; i += 4) {
			const brightness = (all[i]! + all[i + 1]! + all[i + 2]!) / 3
			sum += brightness
			const alpha = all[i + 3]!
			if (alpha > 8 && alpha < 200) {
				edgeSum += brightness
				edgeCount++
			} else if (alpha >= 250) {
				opaqueSum += brightness
				opaqueCount++
			}
		}

		const centre = context.getImageData(
			Math.round(canvas.width * 0.3),
			Math.round(canvas.height * 0.3),
			Math.round(canvas.width * 0.4),
			Math.round(canvas.height * 0.4)
		).data
		let darkest = 255
		for (let i = 0; i < centre.length; i += 4) {
			const brightness = (centre[i]! + centre[i + 1]! + centre[i + 2]!) / 3
			if (brightness < darkest) darkest = brightness
		}

		return {
			darkestCentre: darkest,
			mean: sum / (all.length / 4),
			edgeMean: edgeCount ? edgeSum / edgeCount : -1,
			opaqueMean: opaqueCount ? opaqueSum / opaqueCount : -1,
			cornerAlpha: context.getImageData(2, 2, 1, 1).data[3]!,
			centreAlpha: context.getImageData(
				Math.round(canvas.width / 2),
				Math.round(canvas.height / 2),
				1,
				1
			).data[3]!
		}
	})
}

/**
 * What the viewport itself is showing, straight off its canvas.
 *
 * The render borrows the viewport's renderer and resizes nothing, but it does
 * bind another target and drive the passes — so "the viewport still works"
 * has to be read from its pixels. A lost context is the loud failure; a viewport
 * left black or frozen is the quiet one, which is what `spread` catches: a live
 * 3D view has a range of values across it, a dead one is flat.
 */
async function sampleViewport(
	page: Page
): Promise<{ lost: boolean; buffer: string; mean: number; spread: number }> {
	// The drawing buffer's own dimensions, which are the sharpest evidence that
	// the renderer came back the size it was lent out at. `setSize(w, h, false)`
	// leaves the CSS size alone, so a renderer handed back at the render's size
	// barely moves the average brightness while being plainly wrong.
	const { lost, buffer } = await page.evaluate(() => {
		const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="viewport-canvas"]')
		if (!canvas) return { lost: true, buffer: '' }
		const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
		return { lost: gl ? gl.isContextLost() : true, buffer: `${canvas.width}x${canvas.height}` }
	})
	if (lost) return { lost: true, buffer, mean: -1, spread: -1 }

	// Screenshotted rather than read off the canvas: the viewport renderer keeps
	// no drawing buffer between frames, so `drawImage` on it comes back blank.
	// A screenshot is the composited result, which is what the user sees — so
	// nothing may cover the canvas when this is called.
	const png = (await page.locator('[data-testid="viewport-canvas"]').screenshot()).toString(
		'base64'
	)

	const stats = await page.evaluate(async (base64) => {
		const image = new Image()
		image.src = `data:image/png;base64,${base64}`
		await image.decode()

		const canvas = document.createElement('canvas')
		canvas.width = image.naturalWidth
		canvas.height = image.naturalHeight
		const context = canvas.getContext('2d')
		if (!context) return { mean: -1, spread: -1 }
		context.drawImage(image, 0, 0)

		const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
		let sum = 0
		let min = 255
		let max = 0
		for (let i = 0; i < data.length; i += 4) {
			const brightness = (data[i]! + data[i + 1]! + data[i + 2]!) / 3
			sum += brightness
			if (brightness < min) min = brightness
			if (brightness > max) max = brightness
		}
		return { mean: sum / (data.length / 4), spread: max - min }
	}, png)

	return { lost: false, buffer, ...stats }
}

/** Orbits the viewport camera — middle-drag, as the controls bind it. */
async function orbitViewport(page: Page) {
	const box = (await page.locator('[data-testid="viewport-canvas"]').boundingBox())!
	const x = box.x + box.width / 2
	const y = box.y + box.height / 2

	await page.mouse.move(x, y)
	await page.mouse.down({ button: 'middle' })
	await page.mouse.move(x + 160, y + 90, { steps: 10 })
	await page.mouse.up({ button: 'middle' })
	// A frame to redraw before the pixels are read.
	await page.waitForTimeout(300)
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

		await expect
			.poll(() => sampleRender(page).then((s) => s?.darkestCentre ?? -1), { timeout: 20_000 })
			.toBeGreaterThan(25)
	})

	test('carries HDR through the chain, so a point-lit scene is exposed correctly', async ({
		page
	}) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		// A point light on the default (dark) World is the case that exposes the
		// composer's buffer precision. SSAA accumulates 16 jittered samples at
		// ~1/16 weight each and the light drives radiance past 1: in an 8-bit
		// buffer every small addition rounds up to the nearest 1/255 and anything
		// over 1 clips before `OutputPass` tone maps it.
		await page.click('text=Add')
		await page.getByRole('menuitem', { name: 'Light' }).click()
		await page.getByRole('menuitem', { name: 'Point', exact: true }).click()

		await openRenderModal(page)
		await page.getByRole('button', { name: 'Render Image' }).click()

		await expect
			.poll(() => sampleRender(page).then((s) => s?.mean ?? -1), { timeout: 20_000 })
			.toBeGreaterThan(0)

		// A coarse tripwire on a measured value, not a golden image: this scene
		// renders at 48.6 through a half-float chain and 61.3 through an 8-bit one,
		// so the band sits between them and well clear of both. It is tied to the
		// default scene plus the light added above — if that scene changes, measure
		// again against `main` and move the band rather than widening it.
		const { mean } = (await sampleRender(page))!
		expect(mean).toBeGreaterThan(40)
		expect(mean).toBeLessThan(55)
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
		// yet.
		await expect
			.poll(() => sampleRender(page).then((s) => s?.centreAlpha ?? -1), { timeout: 20_000 })
			.toBeGreaterThan(200)

		const sample = (await sampleRender(page))!
		// A read-back that composited onto black would report the corner opaque; a
		// correct one leaves it see-through.
		expect(sample.cornerAlpha).toBeLessThan(40)

		// Antialiased edges must not come out brighter than the surface they
		// border. The buffer holds colour premultiplied by coverage *and*
		// sRGB-encoded, so un-premultiplying in the encoded space overshoots and
		// rims the silhouette in light fringes: this scene reads 90.7 against 106.2
		// when the division happens in linear light, and 121.1 against the same
		// 106.2 when it happens in sRGB.
		expect(sample.edgeMean).toBeGreaterThan(0)
		expect(sample.edgeMean).toBeLessThan(sample.opaqueMean)
	})

	test('leaves the viewport rendering after repeated renders', async ({ page }) => {
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })

		await page.locator('[data-testid="properties-tab-world"]').click()
		await chooseOption(page, 'world-surface', 'Image')

		// What the viewport looked like before anything borrowed its renderer.
		const before = await sampleViewport(page)
		expect(before.lost).toBe(false)
		expect(before.spread).toBeGreaterThan(5)

		await openRenderModal(page)

		// Twice over: each render used to allocate a fresh GL context, and the
		// browser drops the oldest once too many pile up — the failure this change
		// removes. The viewport's context has to survive both.
		for (let run = 0; run < 2; run++) {
			await page.getByRole('button', { name: 'Render Image' }).click()
			await expect
				.poll(() => sampleRender(page).then((s) => s?.darkestCentre ?? -1), { timeout: 20_000 })
				.toBeGreaterThan(25)
		}

		// The modal sits over the viewport, and the sample below reads composited
		// pixels — so it has to go before the viewport can be looked at.
		await page.getByRole('button', { name: 'Cancel' }).click()
		await expect(page.locator('[data-testid="modal-render-image"]')).toBeHidden()

		// Not just "the context lives" — that was true of every failure worth
		// worrying about here. A renderer handed back at the render's size, still
		// bound to its target, or with `autoClear` left off keeps its context
		// perfectly well and stops drawing the right thing, which is the regression
		// this change most plausibly introduces.
		const after = await sampleViewport(page)
		expect(after.lost).toBe(false)
		expect(after.buffer).toBe(before.buffer)
		expect(after.spread).toBeGreaterThan(5)

		// And it has to still be *drawing*, not showing the last frame it managed
		// before the render borrowed its renderer. Orbiting is the cheapest proof:
		// a viewport left bound to the render's target keeps its context and its
		// stale picture, and only a changed camera tells the two apart.
		await orbitViewport(page)
		const moved = await sampleViewport(page)
		expect(Math.abs(moved.mean - after.mean)).toBeGreaterThan(0.3)
	})
})
