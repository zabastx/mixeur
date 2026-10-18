/**
 * Test-smell fixtures for `lint-rules.test.ts`. Each is a whole file, linted in
 * memory against the real `eslint.config.ts`.
 *
 * Kept out of a `.test.ts` on purpose: the commit-msg assertion hook scans staged
 * test files textually, so a fixture's own `it(...)` and `expect(...)` lines would
 * read as tests that gained assertions.
 */

/** One fixture and the rule it is meant to exercise. */
export interface LintFixture {
	name: string
	code: string
	rule: string
}

/** A path that matches the unit-test glob in `eslint.config.ts`. */
export const UNIT_PATH = 'src/app/model/lint-fixture.test.ts'

/** A path that matches the e2e glob in `eslint.config.ts`. */
export const E2E_PATH = 'tests/e2e/lint-fixture.spec.ts'

export const unitFlagged: LintFixture[] = [
	{
		name: 'a test with no assertion',
		rule: 'vitest/expect-expect',
		code: `import { it } from 'vitest'

it('renders', () => {})
`
	},
	{
		name: 'a conditional inside a test',
		rule: 'vitest/no-conditional-in-test',
		code: `import { expect, it } from 'vitest'

it('branches', () => {
	if (Date.now() > 0) {
		expect(1).toBe(1)
	}
})
`
	},
	{
		name: 'clone(true)',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('clones with children', () => {
	const source = { clone: (deep: boolean) => deep }
	source.clone(true)
	expect(source.clone).toBeTypeOf('function')
})
`
	},
	{
		name: 'a mock of a neighbouring store',
		rule: 'no-restricted-syntax',
		code: `import { vi } from 'vitest'

vi.mock('./scene', () => ({}))
`
	},
	{
		name: 'undefined in toEqual',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('compares a title', () => {
	expect({}).toEqual({ title: undefined })
})
`
	},
	{
		name: 'classList.contains',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('checks a class', () => {
	expect(document.body.classList.contains('item')).toBe(true)
})
`
	},
	{
		name: 'innerHTML inside expect',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('reads the markup', () => {
	expect(document.body.innerHTML).toBe('')
})
`
	},
	{
		name: 'a class selector in querySelector',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('finds an item', () => {
	expect(document.querySelector('.item')).toBeNull()
})
`
	}
]

export const unitAccepted: LintFixture[] = [
	{
		name: 'a query-only test',
		rule: 'vitest/expect-expect',
		code: `import { it } from 'vitest'
import { screen } from '@testing-library/vue'

it('finds the button', () => {
	screen.getByRole('button')
})
`
	},
	{
		name: 'a query scoped by within',
		rule: 'vitest/expect-expect',
		code: `import { it } from 'vitest'
import { within } from '@testing-library/vue'

it('finds the option', () => {
	within(document.body).getByRole('option')
})
`
	},
	{
		name: 'a test using an expect-named helper',
		rule: 'vitest/expect-expect',
		code: `import { expect, it } from 'vitest'

const expectShown = (count: number) => expect(count).toBeGreaterThan(0)

it('shows a count', () => {
	expectShown(1)
})
`
	},
	{
		name: 'a narrowing guard in a helper beside the test',
		rule: 'vitest/no-conditional-in-test',
		code: `import { expect, it } from 'vitest'

function asString(value: unknown): string {
	if (typeof value !== 'string') throw new Error('expected a string')
	return value
}

it('reads a string', () => {
	expect(asString('mixeur')).toBe('mixeur')
})
`
	},
	{
		name: 'a dotted attribute value in querySelector',
		rule: 'no-restricted-syntax',
		code: `import { expect, it } from 'vitest'

it('finds a link', () => {
	expect(document.querySelector('a[href$=".pdf"]')).toBeNull()
})
`
	}
]

export const e2eFlagged: LintFixture[] = [
	{
		name: 'a test with no assertion',
		rule: 'playwright/expect-expect',
		code: `import { test } from '@playwright/test'

test('loads', async ({ page }) => {
	await page.goto('/')
})
`
	},
	{
		name: 'a fixed wait',
		rule: 'playwright/no-wait-for-timeout',
		code: `import { expect, test } from '@playwright/test'

test('settles', async ({ page }) => {
	await page.waitForTimeout(500)
	await expect(page).toHaveTitle(/mixeur/)
})
`
	},
	{
		name: 'a wait for a selector',
		rule: 'playwright/no-wait-for-selector',
		code: `import { expect, test } from '@playwright/test'

test('waits', async ({ page }) => {
	await page.waitForSelector('#viewport')
	await expect(page).toHaveTitle(/mixeur/)
})
`
	},
	{
		name: 'an assertion read out of the page',
		rule: 'playwright/prefer-web-first-assertions',
		code: `import { expect, test } from '@playwright/test'

test('reads the title', async ({ page }) => {
	expect(await page.textContent('h1')).toBe('mixeur')
})
`
	}
]

export const cleanUnit = `import { expect, it } from 'vitest'

it('adds two numbers', () => {
	expect(1 + 1).toBe(2)
})
`

export const cleanE2e = `import { expect, test } from '@playwright/test'

test('loads the app', async ({ page }) => {
	await page.goto('/')
	await expect(page.getByTestId('viewport-canvas')).toBeAttached()
})
`
