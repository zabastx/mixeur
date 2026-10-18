import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'
import {
	cleanE2e,
	cleanUnit,
	E2E_PATH,
	e2eFlagged,
	UNIT_PATH,
	unitAccepted,
	unitFlagged
} from './lint-fixtures'

/**
 * Locks the test-smell rules in `eslint.config.ts`. They pass on clean code, so
 * nothing else in the suite would notice a selector dropped, a rule downgraded
 * or a file glob narrowed — a smell could come back unseen. Every rule the audit
 * asked for appears twice: once on a file it must flag, once on a near-miss it
 * must leave alone.
 */
const eslint = new ESLint()

/** The error-level rule ids ESLint reports for `code` as if it were `filePath`. */
async function errorRules(code: string, filePath: string): Promise<string[]> {
	const [result] = await eslint.lintText(code, { filePath })
	return result.messages
		.filter((message) => message.severity === 2)
		.map((message) => message.ruleId ?? `parse error: ${message.message}`)
}

describe('unit test rules', () => {
	it.each(unitFlagged)('flags $name', async ({ code, rule }) => {
		expect(await errorRules(code, UNIT_PATH)).toContain(rule)
	})

	it.each(unitAccepted)('accepts $name', async ({ code, rule }) => {
		expect(await errorRules(code, UNIT_PATH)).not.toContain(rule)
	})

	it('leaves a clean unit test alone', async () => {
		expect(await errorRules(cleanUnit, UNIT_PATH)).toEqual([])
	})
})

describe('e2e rules', () => {
	it.each(e2eFlagged)('flags $name', async ({ code, rule }) => {
		expect(await errorRules(code, E2E_PATH)).toContain(rule)
	})

	it('leaves a clean spec alone', async () => {
		expect(await errorRules(cleanE2e, E2E_PATH)).toEqual([])
	})
})
