import eslint from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import gitignore from 'eslint-config-flat-gitignore'
import eslintPluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import typescriptEslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig(
	// Flat config does not read .gitignore on its own. Without this, `eslint .` walks
	// into `.agents/worktrees/*` (full repo copies) and the TS parser fails on multiple
	// candidate tsconfig roots.
	gitignore({ root: true }),
	// Not gitignored, but never worth linting.
	{ ignores: ['**/*.d.ts', 'public/**'] },
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
			'vue/require-default-prop': 'off'
		}
	},
	eslintConfigPrettier
)
