<template>
	<aside
		class="flex w-48 shrink-0 flex-col gap-3 overflow-y-auto border-r border-editor-outline
			bg-window-bg p-2"
		data-testid="uv-tool-rail"
	>
		<section>
			<h3 class="mb-1 text-xs text-header-text">Pivot</h3>
			<div class="flex flex-col gap-1">
				<button
					v-for="option in PIVOTS"
					:key="option.value"
					class="btn text-left text-xs"
					:class="{ 'btn--highlight': uvStore.selection.pivot === option.value }"
					@click="setPivot(option.value)"
				>
					{{ option.label }}
				</button>
			</div>
		</section>

		<section>
			<h3 class="mb-1 text-xs text-header-text">Transform</h3>
			<div class="grid grid-cols-2 gap-1">
				<button class="btn text-xs" @click="uvStore.apply({ rotate: STEP_ROTATION }, 'Rotated')">
					⟲ 15°
				</button>
				<button class="btn text-xs" @click="uvStore.apply({ rotate: -STEP_ROTATION }, 'Rotated')">
					⟳ 15°
				</button>
				<button class="btn text-xs" @click="uvStore.apply({ scale: [1.1, 1.1] }, 'Scaled up')">
					Scale +
				</button>
				<button
					class="btn text-xs"
					@click="uvStore.apply({ scale: [1 / 1.1, 1 / 1.1] }, 'Scaled down')"
				>
					Scale −
				</button>
				<button class="btn text-xs" @click="uvStore.apply({ scale: [-1, 1] }, 'Flipped in U')">
					Flip U
				</button>
				<button class="btn text-xs" @click="uvStore.apply({ scale: [1, -1] }, 'Flipped in V')">
					Flip V
				</button>
			</div>
		</section>

		<section>
			<h3 class="mb-1 text-xs text-header-text">Layout</h3>
			<div class="flex flex-col gap-1">
				<button class="btn text-xs" @click="uvStore.pack()">Pack islands</button>
				<button class="btn text-xs" @click="uvStore.weld()">Weld selected</button>
				<button class="btn text-xs" @click="uvStore.reset()">Reset UVs</button>
				<button
					class="btn text-xs"
					:class="{ 'btn--highlight': uvStore.hasGrid }"
					@click="uvStore.toggleGrid()"
				>
					UV grid texture
				</button>
			</div>
		</section>

		<!--
			Moving is the number that matters, and it is not the number of things
			clicked — the gap between Picked and Moving is the sticky rule at work,
			which is otherwise invisible until something moves unexpectedly.
		-->
		<section v-if="uvStore.stats" class="mt-auto text-xs">
			<h3 class="mb-1 text-header-text">Stats</h3>
			<dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-header-text">
				<dt>Islands</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.islandCount }}</dd>
				<dt>Seams</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.seamCount }}</dd>
				<dt>Picked</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.pickedCount }}</dd>
				<dt>Moving</dt>
				<dd class="text-right text-outliner-active-object">{{ uvStore.stats.movingCount }}</dd>
				<dt>By sticky</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.stickyCount }}</dd>
				<dt>Overlaps</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.overlappingPairs }}</dd>
				<dt>Off tile</dt>
				<dd class="text-right text-gray-200">{{ uvStore.stats.offTileCount }}</dd>
			</dl>
		</section>
	</aside>
</template>

<script lang="ts" setup>
/**
 * The UV editor's controls. Labelled rather than a strip of glyphs, because
 * pivot is one of the two settings nobody guesses right from an icon. The
 * other, sticky, lives in the header as a dropdown so it sits next to the
 * select modes it modifies — see `UvStickySelect`.
 */
import { useUvStore } from '@/app/model/uv'
import type { PivotMode } from '@/shared/lib/uv-layout'

const STEP_ROTATION = Math.PI / 12

const PIVOTS: { value: PivotMode; label: string }[] = [
	{ value: 'median', label: 'Median point' },
	{ value: 'cursor', label: '2D cursor' },
	{ value: 'individual', label: 'Individual origins' }
]

const uvStore = useUvStore()

function setPivot(value: PivotMode) {
	uvStore.selection.pivot = value
	uvStore.touch()
}
</script>
