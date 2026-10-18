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
	// whatever the app does. The plugins' other test-smell rules come in once the
	// tests they would flag are fixed.
	{
		files: ['tests/e2e/**/*.ts'],
		plugins: { playwright },
		rules: {
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
			'no-restricted-syntax': ['error', noCloneTrue, noStoreMock, noUndefinedInToEqual],
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
