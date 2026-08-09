import { test, expect, type Page } from '@playwright/test'
import { chooseOption, equirectFixture, otherEquirectFixture } from '../helpers'

/**
 * Choosing where a World's image comes from.
 *
 * The rule under test is that the World is never half-chosen: picking Poly
 * Haven opens the browser, and the Surface changes only if something comes back
 * from it. That is a claim about two components and a modal registry agreeing,
 * which is exactly what a unit test of any one of them cannot show.
 */

/** One HDRI, so the browser has something to list without reaching the network. */
const ASSET = {
	name: 'Kloofendal 43d Clear',
	type: 0,
	date_published: 1600000000,
	download_count: 1,
	files_hash: 'hash',
	authors: { 'Greg Zaal': 'All' },
	categories: ['skies'],
	tags: ['sunny'],
	max_resolution: [16384, 8192],
	thumbnail_url: 'https://example.com/thumb.png'
}

const ASSETS = { kloofendal_43d_clear: ASSET }

const FILES = {
	hdri: {
		'1k': { hdr: { url: 'https://example.com/k_1k.hdr', md5: 'a', size: 1000 } },
		'2k': { hdr: { url: 'https://example.com/k_2k.hdr', md5: 'b', size: 2000 } },
		'4k': { hdr: { url: 'https://example.com/k_4k.hdr', md5: 'c', size: 4000 } }
	}
}

/**
 * A real Radiance HDR, small enough to write by hand.
 *
 * The point is that the bytes are genuinely what `HDRLoader` parses and what
 * PMREM then filters: a stubbed texture would prove the panel wires up and
 * nothing about whether the result compiles as an environment map.
 */
function radianceHDR(width = 16, height = 8): Buffer {
	const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${height} +X ${width}\n`)
	const pixels = Buffer.alloc(width * height * 4)
	// Flat RGBE, no run-length encoding — a scanline starting 0x02 0x02 is what
	// signals RLE, and 200 is not that.
	pixels.fill(200)
	return Buffer.concat([header, pixels])
}

async function stubPolyHaven(page: Page) {
	await page.route('https://example.com/*.hdr', (route) =>
		route.fulfill({ status: 200, contentType: 'image/vnd.radiance', body: radianceHDR() })
	)

	await page.route('**/api.polyhaven.com/**', (route) => {
		const url = route.request().url()
		const body = url.includes('/assets')
			? ASSETS
			: url.includes('/files/')
				? FILES
				: url.includes('/info/')
					? ASSET
					: {}
		return route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(body)
		})
	})
}


test.describe('World Source', () => {
	test.beforeEach(async ({ page }) => {
		await stubPolyHaven(page)
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })
		await page.locator('[data-testid="properties-tab-world"]').click()
	})

	test('an image Surface starts on a preset', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')

		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()
	})

	test('choosing Poly Haven opens the HDRI browser', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')

		await chooseOption(page, 'world-source', 'Poly Haven')

		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeVisible()
	})

	test('leaving the browser without importing keeps the preset Source', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')
		await chooseOption(page, 'world-source', 'Poly Haven')
		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeVisible()

		await page.getByRole('button', { name: 'Close dialog' }).click()

		// The select reads from the Surface, so a cancelled browse leaves it showing
		// the Source really in effect rather than one with no image behind it.
		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeHidden()
		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()
	})

	test('importing an HDRI names it in the panel', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')
		await chooseOption(page, 'world-source', 'Poly Haven')

		await page.getByText('Kloofendal 43d Clear').first().click()
		await page.getByRole('button', { name: 'Import' }).click()

		const image = page.locator('[data-testid="world-image"]')
		await expect(image).toContainText('Kloofendal 43d Clear')
		// 2k unless asked otherwise: large enough not to look soft, small enough to
		// browse several in a row.
		await expect(image).toContainText('2k')
	})

	test('a downloaded HDRI lights rendered mode without shader errors', async ({ page }) => {
		const errors: string[] = []
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text())
		})
		page.on('pageerror', (error) => errors.push(error.message))

		await chooseOption(page, 'world-surface', 'Image')
		await chooseOption(page, 'world-source', 'Poly Haven')
		await page.getByText('Kloofendal 43d Clear').first().click()
		await page.getByRole('button', { name: 'Import' }).click()
		await expect(page.locator('[data-testid="world-image"]')).toContainText('2k')

		// Rendered is the only mode where the World reaches `scene.environment`, so
		// a map PMREM could not filter fails to compile here and nowhere else.
		await page.locator('[data-testid="shading-btn-rendered"]').click()
		await expect(page.locator('[data-testid="shading-btn-rendered"]')).toHaveAttribute(
			'data-active',
			'true'
		)

		expect(errors).toEqual([])
	})

	test('an imported file lights rendered mode and is named by its filename', async ({ page }) => {
		const errors: string[] = []
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text())
		})
		page.on('pageerror', (error) => errors.push(error.message))

		await chooseOption(page, 'world-surface', 'Image')

		const chooser = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		// A real EXR off disk, so the sniffing, the loader and PMREM all run on
		// bytes rather than on a stub.
		await (await chooser).setFiles(equirectFixture)

		const image = page.locator('[data-testid="world-image"]')
		await expect(image).toContainText('sunset.exr')
		// A file that is here has nothing to say beyond its name.
		await expect(page.locator('[data-testid="world-image-detail"]')).toHaveText('')

		await page.locator('[data-testid="shading-btn-rendered"]').click()
		await expect(page.locator('[data-testid="shading-btn-rendered"]')).toHaveAttribute(
			'data-active',
			'true'
		)

		expect(errors).toEqual([])
	})

	test('the same file can be imported again after another Source', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')

		const first = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		await (await first).setFiles(equirectFixture)
		await expect(page.locator('[data-testid="world-image"]')).toContainText('sunset.exr')

		await chooseOption(page, 'world-source', 'Preset')
		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()

		// The dialog reuses one input and keeps its selection, so re-picking the
		// identical file used to fire no change event and quietly do nothing.
		const second = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		await (await second).setFiles(equirectFixture)

		await expect(page.locator('[data-testid="world-image"]')).toContainText('sunset.exr')
	})

	test('the image row picks a different file without changing Source', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')
		const first = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		await (await first).setFiles(equirectFixture)
		await expect(page.locator('[data-testid="world-image"]')).toContainText('sunset.exr')

		// The Source select changes the *kind* and stays quiet when re-picking the
		// kind already in effect, so swapping one imported image for another is the
		// row's job.
		const second = page.waitForEvent('filechooser')
		await page.locator('[data-testid="world-image"] button').click()
		await (await second).setFiles(otherEquirectFixture)

		await expect(page.locator('[data-testid="world-image"]')).toContainText('night.exr')
	})

	test('cancelling the file dialog keeps the preset Source', async ({ page }) => {
		await chooseOption(page, 'world-surface', 'Image')

		const chooser = page.waitForEvent('filechooser')
		await chooseOption(page, 'world-source', 'Import')
		await (await chooser).setFiles([])

		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()
	})
})
