import { describe, it, expect } from 'vitest'
import { parseTheme, type ParsedTheme } from './parse-theme'

describe('parseTheme', () => {
	it('extracts variables from an @theme block', () => {
		const css = `
			@theme {
				--color-primary: #ff0000;
				--radius: 8;
			}
		`

		const result = parseTheme(css)

		expect(result).toEqual<ParsedTheme>({
			Ungrouped: [
				{ key: '--color-primary', label: 'Primary', type: 'color' },
				{ key: '--radius', label: 'Radius', type: 'number' }
			]
		})
	})

	it('falls back to the whole css when no @theme block is present', () => {
		const css = `--color-bg: #303030;`

		const result = parseTheme(css)

		expect(result.Ungrouped).toEqual([{ key: '--color-bg', label: 'Bg', type: 'color' }])
	})

	it('groups variables by comment headers', () => {
		const css = `
			@theme {
				/* Surfaces */
				--color-surface: #222222;
				/* Text */
				--color-text: #ffffff;
			}
		`

		const result = parseTheme(css)

		expect(Object.keys(result)).toEqual(['Surfaces', 'Text'])
		expect(result.Surfaces[0].key).toBe('--color-surface')
		expect(result.Text[0].key).toBe('--color-text')
	})

	it('detects color vs number types', () => {
		const css = `
			@theme {
				--hex3: #fff;
				--hex8: #ff0000ff;
				--int: 42;
				--float: 1.5;
				--negative: -0.25;
			}
		`

		const result = parseTheme(css)
		const byKey = Object.fromEntries(result.Ungrouped.map((v) => [v.key, v.type]))

		expect(byKey).toEqual({
			'--hex3': 'color',
			'--hex8': 'color',
			'--int': 'number',
			'--float': 'number',
			'--negative': 'number'
		})
	})

	it('ignores values that are neither hex colors nor plain numbers', () => {
		const css = `
			@theme {
				--keyword: red;
				--with-unit: 8px;
				--func: rgb(0, 0, 0);
				--valid: #abcdef;
			}
		`

		const result = parseTheme(css)

		expect(result.Ungrouped).toEqual([{ key: '--valid', label: 'Valid', type: 'color' }])
	})

	it('strips the prefix and color- segment when building labels', () => {
		const css = `
			@theme {
				--ui-radius-small: 4;
				--color-accent-strong: #00ff00;
			}
		`

		const result = parseTheme(css, 'ui')

		const labels = Object.fromEntries(result.Ungrouped.map((v) => [v.key, v.label]))
		expect(labels['--ui-radius-small']).toBe('Radius Small')
		expect(labels['--color-accent-strong']).toBe('Accent Strong')
	})

	it('returns an empty object for an empty @theme block', () => {
		expect(parseTheme('@theme {}')).toEqual({})
	})

	it('skips blank lines and malformed declarations', () => {
		const css = `
			@theme {

				not-a-var: 10;
				--ok: 1;
			}
		`

		const result = parseTheme(css)

		expect(result.Ungrouped).toEqual([{ key: '--ok', label: 'Ok', type: 'number' }])
	})
})
