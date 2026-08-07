<template>
	<div
		class="fixed bottom-0.5 left-1/2 z-1000 flex -translate-x-1/2 items-center gap-1 rounded-full
			border border-orange-400 bg-black/85 px-1.5 py-1 text-xs text-white shadow-lg backdrop-blur"
		data-testid="uv-prototype-switcher"
	>
		<button
			class="rounded-full px-2 py-0.5 hover:bg-white/15"
			title="Previous variant (Alt+←)"
			@click="cycle(-1)"
		>
			←
		</button>
		<span class="min-w-56 px-1 text-center">
			<span class="text-orange-400">UV prototype</span>
			· {{ current.key }} — {{ current.name }}
		</span>
		<button
			class="rounded-full px-2 py-0.5 hover:bg-white/15"
			title="Next variant (Alt+→)"
			@click="cycle(1)"
		>
			→
		</button>
	</div>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE — throwaway. See ./README.md.
 *
 * Deliberately not styled like the editor: it must never be mistaken for part
 * of the design being judged. Gated on `import.meta.env.DEV` by its host, so a
 * stray merge cannot ship it.
 */
import { computed } from 'vue'
import { useEventListener } from '@vueuse/core'
import { VARIANTS, useVariant, type VariantKey } from './variant'

const variant = useVariant()

const current = computed(() => VARIANTS.find((v) => v.key === variant.value) ?? VARIANTS[0])

function cycle(step: number) {
	const i = VARIANTS.findIndex((v) => v.key === variant.value)
	const next = VARIANTS[(i + step + VARIANTS.length) % VARIANTS.length]
	variant.value = next.key as VariantKey
}

// Alt is required because bare arrows belong to the editor underneath.
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
	if (!e.altKey) return
	const el = document.activeElement
	if (
		el instanceof HTMLInputElement ||
		el instanceof HTMLTextAreaElement ||
		el instanceof HTMLSelectElement ||
		(el instanceof HTMLElement && el.isContentEditable)
	) {
		return
	}
	if (e.key === 'ArrowLeft') cycle(-1)
	else if (e.key === 'ArrowRight') cycle(1)
})
</script>
