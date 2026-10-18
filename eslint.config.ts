import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import gitignore from 'eslint-config-flat-gitignore'
import eslintPluginVue from 'eslint-plugin-vue'
import playwright from 'eslint-plugin-playwright'
import vitest from '@vitest/eslint-plugin'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

const noCloneTrue = {
	selector: "CallExpression[callee.property.name='clone'][arguments.0.value=true]",
	message:
		'clone(true) drops children of DirectionalLight, LOD and others, and throws on helpers. Copy scene objects through scene-copy or cloneForSerialization (see the note above it in shared/three/utils.ts).'
}

// CODING_STANDARDS.md, "Mock only what the test environment cannot run". Matches
// a sibling module (`./scene`), a store under `@/app/model/`, and the pure
// project file module. esquery regexes cannot hold a `/`, hence `\W`.
const noStoreMock = {
	selector:
		"CallExpression[callee.object.name='vi'][callee.property.name=/^(mock|doMock)$/][arguments.0.value=/^(\\.\\W|@\\Wapp\\Wmodel\\W|@\\Wshared\\Wlib\\Wproject-file$)/]",
	message:
		'Run neighbouring stores and pure modules for real; mock only the GPU, the network and the file picker or download. A module that truly needs a live WebGLRenderer can disable this line, saying why.'
}

// CODING_STANDARDS.md, "Assert the value": toEqual skips undefined properties, so
// `{ title: undefined }` passes whatever title the result has.
const noUndefinedInToEqual = {
	selector:
		"CallExpression[callee.property.name='toEqual'] > :matches(ObjectExpression, ArrayExpression) Property[value.type='Identifier'][value.name='undefined']",
	message:
		'toEqual ignores undefined properties. Use toStrictEqual to pin the key as undefined, or drop it.'
}

// CODING_STANDARDS.md, "A component test renders its real children and drives
// them as the user does": a class name and a raw innerHTML string are markup, so
// a test that reads them breaks on a rename and passes on the wrong element.
// Find the element by role, label or an aria-* attribute and assert on what it
// shows instead. `toHaveClass` still covers a class the consumer passes through.
const noMarkupLookup = [
	{
		selector:
			"CallExpression[callee.object.property.name='classList'][callee.property.name='contains']",
		message:
			'Look the element up by role, label or an aria-* attribute, and use toHaveClass when the class itself is the prop under test.'
	},
	{
		selector: "CallExpression[callee.name='expect'] MemberExpression[property.name='innerHTML']",
		message: 'Assert on the rendered text, role or aria-* attribute instead of reading innerHTML.'
	},
	{
		// A class selector anywhere in the string — `.foo` or `div.foo` — but not a
		// dotted attribute value such as `[href$=".pdf"]`, hence the lookbehind.
		selector:
			'CallExpression[callee.property.name=/^(querySelector|querySelectorAll)$/][arguments.0.value=/(?<!["\'])\\.[A-Za-z_-]/]',
		message: 'Find the element by role, label or an aria-* attribute instead of a class selector.'
	}
]

export default defineConfig(
	// Flat config does not read .gitignore on its own. Without this, `eslint .` walks
	// into `.agents/worktrees/*` (full repo copies) and the TS parser fails on multiple
	// candidate tsconfig roots.
	gitignore({ root: true }),
	// Not gitignored, but never worth linting.
	{ ignores: ['**/*.d.ts', 'public/**'] },
	// A disable comment that no longer suppresses anything fails lint, so the store
	// mocks still waiting for real stores (see noStoreMock) cannot outlive their move.
	{ linterOptions: { reportUnusedDisableDirectives: 'error' } },
	{
		extends: [
			eslint.configs.recommended,
			...typescriptEslint.configs.recommended,
			...eslintPluginVue.configs['flat/recommended']
		],
		files: ['**/*.{ts,vue}'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.browser,
			parserOptions: {
				parser: typescriptEslint.parser
			}
		},
		rules: {
			'@typescript-eslint/ban-ts-comment': 'warn',
			'no-undef': 'off',
			'no-useless-assignment': 'off',
			'no-restricted-syntax': ['error', noCloneTrue],
			'vue/require-default-prop': 'off'
		}
	},
	// An unawaited assertion can settle after the test has ended, so the test passes
	// whatever the app does.
	{
		files: ['tests/e2e/**/*.ts'],
		plugins: { playwright },
		rules: {
			'playwright/expect-expect': 'error',
			'playwright/missing-playwright-await': 'error',
			// Locate by role, label, text or test id, and wait on a condition: a raw
			// selector couples the test to markup, a fixed sleep to the machine's speed.
			'playwright/no-raw-locators': 'error',
			'playwright/prefer-locator': 'error',
			'playwright/prefer-web-first-assertions': 'error',
			'playwright/no-wait-for-selector': 'error',
			'playwright/no-wait-for-timeout': 'error'
		}
	},
	{
		files: ['src/**/*.test.ts'],
		plugins: { vitest },
		rules: {
			'no-restricted-syntax': [
				'error',
				noCloneTrue,
				noStoreMock,
				noUndefinedInToEqual,
				...noMarkupLookup
			],
			'vitest/expect-expect': [
				'error',
				{
					// A get-or-throw query is an assertion on its own: `getBy*` and
					// `getAllBy*` fail when nothing matches, so a query-only check still
					// reads the DOM. The dotted forms cover the same queries taken off an
					// object — `screen.getBy*`, or `within(scope).getBy*`. `expect*` lets a
					// test name its own assertion helper (see expectLabel) and still pass.
					assertFunctionNames: [
						'expect*',
						'assert',
						'getBy*',
						'getAllBy*',
						'*.getBy*',
						'*.getAllBy*'
					]
				}
			],
			'vitest/no-conditional-in-test': 'error',
			'vitest/valid-expect': ['error', { alwaysAwait: true }],
			// CODING_STANDARDS.md, "Assert the value": these pass for any result that
			// exists. Pin the value, or use jest-dom's toBeInTheDocument for presence.
			'vitest/no-restricted-matchers': [
				'error',
				{
					toBeDefined: 'Pin the value the result should have.',
					toBeTruthy: 'Pin the value, or use toBeInTheDocument for an element.',
					toBeFalsy: 'Pin the value, or use not.toBeInTheDocument for an element.'
				}
			]
		}
	},
	eslintConfigPrettier
)
