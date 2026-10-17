// @ts-check
/**
 * Mutation testing, run on demand for one source file, never in CI:
 *
 *   bun run test:mutation src/shared/lib/project-file.ts
 *
 * Each mutant runs only the tests that cover it, among those Vitest finds
 * related to the file. The clear-text report lists every surviving mutant.
 *
 * Stryker is pinned to 10.0.0 because of a local patch,
 * `patches/@stryker-mutator%2Fvitest-runner@10.0.0.patch`: without it, under
 * Vitest 5, every test inside a `describe` is filtered out and every covered
 * mutant reports as surviving (stryker-js#6210). Drop the patch and the pin
 * once a release includes the fix. The pool override is in
 * `vitest.stryker.config.ts`.
 *
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
	testRunner: 'vitest',
	vitest: { configFile: 'vitest.stryker.config.ts' },
	coverageAnalysis: 'perTest',
	// Listing plugins replaces the default `@stryker-mutator/*` glob, so the
	// runner is named alongside the local guard.
	plugins: ['@stryker-mutator/vitest-runner', import.meta.resolve('./stryker.guard.mjs')],
	reporters: ['clear-text', 'progress', 'no-test-survivor-guard'],
	// Stryker does not read `.gitignore`, so the ignored entries the sandbox copy
	// must skip are repeated here: the agent and tool directories (`.claude/skills`
	// is a symlink to a directory, which the copy fails on) and build and test output.
	ignorePatterns: [
		'/.agents',
		'/.claude',
		'/.kilo',
		'/.kilocode',
		'/.playwright-cli',
		'/dist',
		'/coverage',
		'/playwright-report',
		'/test-results'
	]
}
