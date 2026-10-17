// @ts-check
import { relative } from 'node:path'
import { declareClassPlugin, PluginKind } from '@stryker-mutator/api/plugin'

/**
 * Fails a `bun run test:mutation` run when a mutant "survives" without a single
 * test having run against it. That is never a verdict on the tests: it means the
 * runner is broken. A test file that fails to load, or a test filter that matches
 * nothing, both leave every covered mutant reported as surviving, with a plausible
 * score. Both have happened here (see `stryker.config.mjs`).
 *
 * @implements {import('@stryker-mutator/api/report').Reporter}
 */
class NoTestSurvivorGuard {
	/** @type {string[]} */
	hollow = []

	/** @param {Readonly<import('@stryker-mutator/api/core').MutantResult>} result */
	onMutantTested(result) {
		if (result.status === 'Survived' && result.testsCompleted === 0) {
			const { fileName, location, mutatorName } = result
			this.hollow.push(`${relative('.', fileName)}:${location.start.line} ${mutatorName}`)
		}
	}

	// Stryker logs an error thrown here and still exits 0, so set the exit code.
	wrapUp() {
		if (!this.hollow.length) return
		console.error(
			`\n${this.hollow.length} mutant(s) survived without any test running, so the ` +
				'runner is broken and the report is not a verdict on the tests.\n' +
				`First: ${this.hollow.slice(0, 3).join(', ')}`
		)
		process.exitCode = 1
	}
}

export const strykerPlugins = [
	declareClassPlugin(PluginKind.Reporter, 'no-test-survivor-guard', NoTestSurvivorGuard)
]
