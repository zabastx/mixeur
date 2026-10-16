import { test, expect, type Page } from '@playwright/test'
import { openApp } from '../helpers'

/**
 * A smoke test for the properties panel, aimed at the two failure shapes that
 * unit tests, the type checker and the build all miss:
 *
 * - a tab that renders at an absurd size and pushes its neighbours out of the
 *   panel, which is invisible to any assertion about the DOM alone
 * - a shader that fails to compile once a mode is entered, which surfaces only
 *   as a console error from Three.js at draw time
 *
 * Both have happened. Neither was reachable without a browser.
 */

/** Tabs present with the default scene's cube selected, in strip order. */
const TABS = ['viewport-camera', 'world', 'object', 'geometry', 'material'] as const

/** Collects everything the page logs at error level for the life of the test. */
function collectConsoleErrors(page: Page): string[] {
	const errors: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(message.text())
	})
	page.on('pageerror', (error) => errors.push(error.message))
	return errors
}

test.describe('Properties tabs', () => {
	test.beforeEach(async ({ page }) => {
		await openApp(page)
	})

	test('every tab is reachable and none is oversized', async ({ page }) => {
		const panel = page.getByRole('tablist')
		await expect(panel).toBeVisible()

		const viewportHeight = page.viewportSize()?.height ?? 0

		for (const tab of TABS) {
			const trigger = page.getByTestId(`properties-tab-${tab}`)
			await expect(trigger).toBeVisible()

			const box = await trigger.boundingBox()
			expect(box, `${tab} tab has no box`).not.toBeNull()

			// An icon sized in the wrong unit once made one trigger 3266px tall,
			// which shoved every later tab thousands of pixels down the page. The
			// triggers are icon buttons; anything past a few times their own width
			// is a broken asset, not a design.
			expect(box!.height, `${tab} tab is ${box!.height}px tall`).toBeLessThan(60)
			expect(box!.y, `${tab} tab sits below the window`).toBeLessThan(viewportHeight)

			await trigger.click()
			await expect(trigger).toHaveAttribute('data-state', 'active')
		}
	})

	test('visiting every tab logs no console errors', async ({ page }) => {
		const errors = collectConsoleErrors(page)

		for (const tab of TABS) {
			await page.getByTestId(`properties-tab-${tab}`).click()
			// Every panel stays mounted; only one is not hidden, so only one has the role.
			await expect(page.getByRole('tabpanel')).toBeVisible()
		}

		expect(errors).toEqual([])
	})

	test('the World renders in every shading mode without shader errors', async ({ page }) => {
		const errors = collectConsoleErrors(page)

		await page.getByTestId('properties-tab-world').click()
		await expect(page.getByText('Strength')).toBeVisible()

		// Rendered is where the World occupies `scene.environment`. A malformed
		// environment map fails to compile there and nowhere else.
		for (const mode of ['wireframe', 'preview', 'rendered', 'solid'] as const) {
			await page.getByTestId(`shading-btn-${mode}`).click()
			await expect(page.getByTestId(`shading-btn-${mode}`)).toHaveAttribute('data-active', 'true')
		}

		expect(errors).toEqual([])
	})
})
