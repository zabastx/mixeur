/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Which UV-editor layout is on screen, held in `?variant=` so a particular one
 * can be linked and survives a reload. `off` is the default on purpose: without
 * the search param the editor is exactly the app that ships.
 */
import { customRef } from 'vue'

export const VARIANTS = [
	{ key: 'off', name: 'App as it ships' },
	{ key: 'A', name: 'Split viewport' },
	{ key: 'B', name: 'Workspace tab' },
	{ key: 'C', name: 'Sidebar dock' },
	// The merge of A and B, and the one to judge the others against.
	{ key: 'D', name: 'Workspace split' }
] as const

export type VariantKey = (typeof VARIANTS)[number]['key']

const KEYS = VARIANTS.map((v) => v.key) as readonly string[]

function read(): VariantKey {
	const raw = new URLSearchParams(window.location.search).get('variant')
	return (KEYS.includes(raw ?? '') ? raw : 'off') as VariantKey
}

/**
 * A ref backed by the URL. There is no router in this app, so the search param
 * is edited directly and `replaceState` keeps it out of the history stack.
 */
export function useVariant() {
	return customRef<VariantKey>((track, trigger) => {
		let value = read()
		const sync = () => {
			const next = read()
			if (next === value) return
			value = next
			trigger()
		}
		window.addEventListener('popstate', sync)
		return {
			get() {
				track()
				return value
			},
			set(next) {
				value = next
				const url = new URL(window.location.href)
				if (next === 'off') url.searchParams.delete('variant')
				else url.searchParams.set('variant', next)
				window.history.replaceState(null, '', url)
				trigger()
			}
		}
	})
}
