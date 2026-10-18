/**
 * Runs the tests against one hand-made mutant and names the tests it fails.
 *
 *   bun run test:mutant <source> <original> <mutated> [test files…]
 *
 * `<original>` must occur exactly once in `<source>`; it is replaced by
 * `<mutated>` for one test run, then the file is written back as it was,
 * also on Ctrl-C. Without test files, Vitest runs the tests related to
 * `<source>`. Playwright specs (`*.spec.ts`) run under Playwright instead.
 * Exits 0 when the mutant is killed, 1 when it survives.
 *
 * For the mutations Stryker cannot make (ask the wrong object, skip a call);
 * CODING_STANDARDS.md, "A test whose name claims a behaviour fails when that
 * behaviour is removed". The names it prints are the ones the commit-msg hook
 * wants in the message.
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const [source, original, mutated, ...testFiles] = process.argv.slice(2)

if (!source || original === undefined || mutated === undefined) {
	console.error('usage: bun run test:mutant <source> <original> <mutated> [test files…]')
	process.exit(2)
}

// Playwright has no notion of related tests, so its specs are always named.
const e2e = testFiles.some((file) => file.endsWith('.spec.ts'))
if (e2e && !testFiles.every((file) => file.endsWith('.spec.ts'))) {
	console.error('Pass either Vitest tests or Playwright specs, not both.')
	process.exit(2)
}

const before = readFileSync(source, 'utf8')
const occurrences = before.split(original).length - 1
if (occurrences !== 1) {
	console.error(`${source}: the original text occurs ${occurrences} times; it must occur once.`)
	process.exit(2)
}

const reportDir = mkdtempSync(path.join(tmpdir(), 'mutant-'))
const reportPath = path.join(reportDir, 'report.json')

let restored = false
function restore() {
	if (restored) return
	restored = true
	writeFileSync(source, before)
	rmSync(reportDir, { recursive: true, force: true })
}
process.on('exit', restore)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
	process.on(signal, () => {
		restore()
		process.exit(130)
	})
}

writeFileSync(
	source,
	before.replace(original, () => mutated)
)

/** What one run against the mutant came to, whichever runner made it. */
interface Outcome {
	total: number
	/** "<file>: <test name>" for each test that failed. */
	killedBy: string[]
	/** Files that failed to load, so failed no test of their own. */
	brokenFiles: string[]
}

/** Runs `bunx <args>` and resolves once it exits, with its stdout when `capture`. */
function run(args: string[], capture = false) {
	return new Promise<string>((resolve) => {
		let stdout = ''
		const child = spawn('bunx', args, {
			stdio: ['ignore', capture ? 'pipe' : 'ignore', 'inherit']
		})
		child.stdout?.on('data', (chunk) => (stdout += chunk))
		child.on('close', () => resolve(stdout))
	})
}

async function runVitest(): Promise<Outcome> {
	const args = testFiles.length ? ['run', ...testFiles] : ['related', '--run', source!]
	await run(['vitest', ...args, '--reporter=json', `--outputFile=${reportPath}`, '--silent'])

	interface Report {
		numTotalTests: number
		testResults: {
			name: string
			status: string
			message?: string
			assertionResults: { title: string; status: string }[]
		}[]
	}
	const report: Report = JSON.parse(readFileSync(reportPath, 'utf8'))

	const killedBy: string[] = []
	const brokenFiles: string[] = []
	for (const file of report.testResults) {
		const relative = path.relative(process.cwd(), file.name)
		const failed = file.assertionResults.filter((test) => test.status === 'failed')
		for (const test of failed) killedBy.push(`${relative}: ${test.title}`)
		// A file that fails to load fails no test of its own, and says nothing about them.
		if (file.status === 'failed' && !failed.length) brokenFiles.push(`${relative}: ${file.message}`)
	}
	return { total: report.numTotalTests, killedBy, brokenFiles }
}

async function runPlaywright(): Promise<Outcome> {
	// No retries: a test the mutant fails once has killed it, where a retry
	// would let a pass on the second try report it as merely flaky.
	const stdout = await run(
		['playwright', 'test', ...testFiles, '--reporter=json', '--retries=0'],
		true
	)

	interface Suite {
		specs: { title: string; file: string; tests: { status: string }[] }[]
		suites?: Suite[]
	}
	interface Report {
		config: { rootDir: string }
		suites: Suite[]
		errors: { message: string }[]
		stats: { expected: number; unexpected: number; flaky: number }
	}
	const report: Report = JSON.parse(stdout)

	const killedBy: string[] = []
	const walk = (suite: Suite) => {
		for (const spec of suite.specs) {
			if (!spec.tests.some((test) => test.status === 'unexpected')) continue
			const file = path.relative(process.cwd(), path.join(report.config.rootDir, spec.file))
			killedBy.push(`${file}: ${spec.title}`)
		}
		suite.suites?.forEach(walk)
	}
	report.suites.forEach(walk)

	const { expected, unexpected, flaky } = report.stats
	return {
		total: expected + unexpected + flaky,
		killedBy,
		brokenFiles: report.errors.map((error) => error.message)
	}
}

let outcome: Outcome
try {
	outcome = await (e2e ? runPlaywright() : runVitest())
} catch {
	restore()
	console.error(`${e2e ? 'Playwright' : 'Vitest'} wrote no report; the run itself failed.`)
	process.exit(2)
}
restore()

const { total, killedBy, brokenFiles } = outcome
if (brokenFiles.length) {
	console.log('Failed to run, which kills nothing:')
	for (const line of brokenFiles) console.log(`  ${line}`)
}
if (killedBy.length) {
	console.log(`Killed by ${killedBy.length} of ${total} tests:`)
	for (const line of killedBy) console.log(`  ${line}`)
	process.exit(0)
}
console.log(`Survived all ${total} tests.`)
process.exit(1)
