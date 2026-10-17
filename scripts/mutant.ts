/**
 * Runs the tests against one hand-made mutant and names the tests it fails.
 *
 *   bun run test:mutant <source> <original> <mutated> [test files…]
 *
 * `<original>` must occur exactly once in `<source>`; it is replaced by
 * `<mutated>` for one Vitest run, then the file is written back as it was,
 * also on Ctrl-C. Without test files, Vitest runs the tests related to
 * `<source>`. Exits 0 when the mutant is killed, 1 when it survives.
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

const vitestArgs = testFiles.length ? ['run', ...testFiles] : ['related', '--run', source]
await new Promise<void>((resolve) => {
	spawn(
		'bunx',
		['vitest', ...vitestArgs, '--reporter=json', `--outputFile=${reportPath}`, '--silent'],
		{ stdio: ['ignore', 'ignore', 'inherit'] }
	).on('close', () => resolve())
})

interface Report {
	numTotalTests: number
	testResults: {
		name: string
		status: string
		message?: string
		assertionResults: { title: string; status: string }[]
	}[]
}

let report: Report
try {
	report = JSON.parse(readFileSync(reportPath, 'utf8'))
} catch {
	restore()
	console.error('Vitest wrote no report; the run itself failed.')
	process.exit(2)
}
restore()

const killedBy: string[] = []
const brokenFiles: string[] = []
for (const file of report.testResults) {
	const relative = path.relative(process.cwd(), file.name)
	const failed = file.assertionResults.filter((test) => test.status === 'failed')
	for (const test of failed) killedBy.push(`${relative}: ${test.title}`)
	// A file that fails to load fails no test of its own, and says nothing about them.
	if (file.status === 'failed' && !failed.length) brokenFiles.push(`${relative}: ${file.message}`)
}

if (brokenFiles.length) {
	console.log('Failed to run, which kills nothing:')
	for (const line of brokenFiles) console.log(`  ${line}`)
}
if (killedBy.length) {
	console.log(`Killed by ${killedBy.length} of ${report.numTotalTests} tests:`)
	for (const line of killedBy) console.log(`  ${line}`)
	process.exit(0)
}
console.log(`Survived all ${report.numTotalTests} tests.`)
process.exit(1)
