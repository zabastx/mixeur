import { test, expect, type Page } from '@playwright/test'

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

/** Opens one of the panel's selects and picks an option by its label. */
async function choose(page: Page, field: string, option: string) {
	await page.locator(`[data-testid="${field}"]`).getByRole('combobox').click()
	await page.getByRole('option', { name: option, exact: true }).click()
}

test.describe('World Source', () => {
	test.beforeEach(async ({ page }) => {
		await stubPolyHaven(page)
		await page.goto('/')
		await page.waitForSelector('[data-testid="viewport-canvas"]', { state: 'attached' })
		await page.locator('[data-testid="properties-tab-world"]').click()
	})

	test('an image Surface starts on a preset', async ({ page }) => {
		await choose(page, 'world-surface', 'Image')

		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()
	})

	test('choosing Poly Haven opens the HDRI browser', async ({ page }) => {
		await choose(page, 'world-surface', 'Image')

		await choose(page, 'world-source', 'Poly Haven')

		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeVisible()
	})

	test('leaving the browser without importing keeps the preset Source', async ({ page }) => {
		await choose(page, 'world-surface', 'Image')
		await choose(page, 'world-source', 'Poly Haven')
		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeVisible()

		await page.getByRole('button', { name: 'Close dialog' }).click()

		// The select reads from the Surface, so a cancelled browse leaves it showing
		// the Source really in effect rather than one with no image behind it.
		await expect(page.locator('[data-testid="modal-asset-browser-hdris"]')).toBeHidden()
		await expect(page.locator('[data-testid="world-preset"]')).toBeVisible()
	})

	test('importing an HDRI names it in the panel', async ({ page }) => {
		await choose(page, 'world-surface', 'Image')
		await choose(page, 'world-source', 'Poly Haven')

		await page.getByText('Kloofendal 43d Clear').first().click()
		await page.getByRole('button', { name: 'Import' }).click()

		const hdri = page.locator('[data-testid="world-hdri"]')
		await expect(hdri).toContainText('Kloofendal 43d Clear')
		// 2k unless asked otherwise: large enough not to look soft, small enough to
		// browse several in a row.
		await expect(hdri).toContainText('2k')
	})

	test('a downloaded HDRI lights rendered mode without shader errors', async ({ page }) => {
		const errors: string[] = []
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text())
		})
		page.on('pageerror', (error) => errors.push(error.message))

		await choose(page, 'world-surface', 'Image')
		await choose(page, 'world-source', 'Poly Haven')
		await page.getByText('Kloofendal 43d Clear').first().click()
		await page.getByRole('button', { name: 'Import' }).click()
		await expect(page.locator('[data-testid="world-hdri"]')).toContainText('2k')

		// Rendered is the only mode where the World reaches `scene.environment`, so
		// a map PMREM could not filter fails to compile here and nowhere else.
		await page.locator('[data-testid="shading-btn-rendered"]').click()
		await expect(page.locator('[data-testid="shading-btn-rendered"]')).toHaveAttribute(
			'data-active',
			'true'
		)

		expect(errors).toEqual([])
	})
})
