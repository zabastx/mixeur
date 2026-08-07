<template>
	<!-- The tab strip replaces the layout wholesale, so it sits above `main`. -->
	<nav class="flex items-end gap-0.5 bg-topbar-background px-2 pt-1">
		<button
			v-for="tab in TABS"
			:key="tab.id"
			class="flex items-center gap-1.5 rounded-t px-3 py-1 text-xs"
			:class="
				active === tab.id
					? 'bg-window-bg text-gray-200'
					: 'text-header-text hover:bg-panel-background'
			"
			@click="active = tab.id"
		>
			<MxIcon :name="tab.icon" />
			{{ tab.label }}
		</button>
	</nav>

	<main class="relative flex min-h-0 flex-1 gap-1 bg-editor-border p-1 select-none">
		<!-- A labelled rail, not a strip of glyphs: in a dedicated mode there is
		     room to say what each control does. -->
		<aside
			v-if="active === 'uv'"
			class="block-border flex w-56 shrink-0 flex-col gap-3 overflow-y-auto rounded bg-window-bg
				p-2"
		>
			<section>
				<h3 class="mb-1 text-xs text-header-text">Select</h3>
				<div class="grid grid-cols-2 gap-1">
					<button
						v-for="m in MODES"
						:key="m"
						class="btn text-xs capitalize"
						:class="{ 'btn--highlight': editor.selection.value.mode === m }"
						@click="editor.setMode(m)"
					>
						{{ m }}
					</button>
				</div>
				<div class="mt-1 grid grid-cols-2 gap-1">
					<button class="btn text-xs" @click="editor.selectAll()">All</button>
					<button class="btn text-xs" @click="editor.clearSelection()">None</button>
				</div>
			</section>

			<section>
				<h3 class="mb-1 text-xs text-header-text">Sticky</h3>
				<div class="flex flex-col gap-1">
					<button
						v-for="s in STICKY"
						:key="s.value"
						class="btn text-left text-xs"
						:class="{ 'btn--highlight': editor.selection.value.sticky === s.value }"
						@click="editor.selection.value.sticky = s.value"
					>
						{{ s.label }}
					</button>
				</div>
				<p class="mt-1 text-[10px] leading-snug text-header-text">{{ stickyHint }}</p>
			</section>

			<section>
				<h3 class="mb-1 text-xs text-header-text">Pivot</h3>
				<div class="flex flex-col gap-1">
					<button
						v-for="p in PIVOTS"
						:key="p.value"
						class="btn text-left text-xs"
						:class="{ 'btn--highlight': editor.selection.value.pivot === p.value }"
						@click="editor.selection.value.pivot = p.value"
					>
						{{ p.label }}
					</button>
				</div>
			</section>

			<section>
				<h3 class="mb-1 text-xs text-header-text">Transform</h3>
				<div class="grid grid-cols-3 gap-1">
					<button class="btn text-xs" @click="editor.apply({ rotate: STEP_ROT }, 'Rotated')">
						⟲ 15°
					</button>
					<button class="btn text-xs" @click="editor.apply({ scale: [1.1, 1.1] }, 'Scaled up')">
						Scale +
					</button>
					<button
						class="btn text-xs"
						@click="editor.apply({ scale: [1 / 1.1, 1 / 1.1] }, 'Scaled down')"
					>
						Scale −
					</button>
					<button class="btn text-xs" @click="editor.apply({ rotate: -STEP_ROT }, 'Rotated')">
						⟳ 15°
					</button>
					<button class="btn text-xs" @click="editor.apply({ scale: [-1, 1] }, 'Flipped U')">
						Flip U
					</button>
					<button class="btn text-xs" @click="editor.apply({ scale: [1, -1] }, 'Flipped V')">
						Flip V
					</button>
				</div>
			</section>

			<section>
				<h3 class="mb-1 text-xs text-header-text">Layout</h3>
				<div class="flex flex-col gap-1">
					<button class="btn text-xs" @click="editor.pack()">Pack islands</button>
					<button class="btn text-xs" @click="editor.weldSelected()">Weld selected</button>
					<button class="btn text-xs" @click="editor.reset()">Reset UVs</button>
					<button
						class="btn text-xs"
						:class="{ 'btn--highlight': editor.hasGrid.value }"
						@click="editor.toggleGrid()"
					>
						UV grid texture
					</button>
				</div>
			</section>

			<!-- In a dedicated mode the numbers get room to be a real readout. -->
			<section v-if="editor.summary.value" class="mt-auto text-xs">
				<h3 class="mb-1 text-header-text">State</h3>
				<dl class="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 text-header-text">
					<dt>Islands</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.islandCount }}</dd>
					<dt>Seams</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.seamCount }}</dd>
					<dt>Picked</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.pickedCount }}</dd>
					<dt>Moving</dt>
					<dd class="text-right text-outliner-active-object">
						{{ editor.summary.value.movingCount }}
					</dd>
					<dt>By sticky</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.stickyExtra }}</dd>
					<dt>Overlaps</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.overlaps }}</dd>
					<dt>Off tile</dt>
					<dd class="text-right text-gray-200">{{ editor.summary.value.offTile }}</dd>
				</dl>
			</section>
		</aside>

		<!-- The UV view gets the whole stage. -->
		<EditorWrapper v-if="active === 'uv'" class="relative min-w-0 flex-1">
			<UvCanvas />
			<div class="pointer-events-none absolute bottom-2 left-2 text-xs text-header-text">
				{{ editor.lastAction.value }}
			</div>
		</EditorWrapper>

		<!--
			Never unmounted, only relocated: tearing the viewport down on every tab
			switch means rebuilding the renderer and post-processing chain each time.
			In UV mode it shrinks into an inset floating over the UV view.
		-->
		<div
			class="block-border overflow-hidden rounded"
			:class="
				active === 'uv'
					? 'uv-inset-viewport absolute right-3 bottom-3 z-1 h-44 w-44 shadow-lg'
					: 'min-w-0 flex-1'
			"
		>
			<MxViewport class="h-full w-full border-0" />
		</div>

		<MxSidebar v-if="active === 'layout' && viewportStore.isMounted" :style="sidebarStyle">
			<template #top><DataOutliner /></template>
			<template #bottom><DataProperties /></template>
		</MxSidebar>
	</main>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE variant B — throwaway. See ./README.md.
 *
 * "Workspace tab": UV editing is a mode, not a panel. Tabbing into it hands the
 * whole stage to the UV view and demotes 3D to an inset. The bet is that UV work
 * happens in concentrated bursts, so it deserves focus rather than a permanent
 * slice of the layout — at the cost of losing the outliner while you are in it.
 */
import { computed, ref } from 'vue'
import { useViewportStore } from '@/app/model/viewport'
import { useUvEditor } from './use-uv-editor'
import type { PivotMode, SelectMode, StickyMode } from './uv-edit'

const STEP_ROT = Math.PI / 12
const MODES: SelectMode[] = ['vertex', 'edge', 'face', 'island']
const STICKY: { value: StickyMode; label: string }[] = [
	{ value: 'off', label: 'Off' },
	{ value: 'shared-vertex', label: 'Shared vertex' },
	{ value: 'shared-location', label: 'Shared location' }
]
const PIVOTS: { value: PivotMode; label: string }[] = [
	{ value: 'median', label: 'Median point' },
	{ value: 'cursor', label: '2D cursor' },
	{ value: 'individual', label: 'Individual origins' }
]
const TABS = [
	{ id: 'layout', label: 'Layout', icon: 'ui/viewport' },
	{ id: 'uv', label: 'UV Editing', icon: 'ui/material-data' }
] as const

const viewportStore = useViewportStore()
const editor = useUvEditor()
const active = ref<'layout' | 'uv'>('uv')

const sidebarStyle = { width: `${Math.round(window.innerWidth * 0.22)}px` }

const stickyHint = computed(() => {
	switch (editor.selection.value.sticky) {
		case 'off':
			return 'Moves exactly what you picked. Tears seams freely.'
		case 'shared-vertex':
			return 'Also moves every UV copy of the same mesh vertex. Blender’s default; closes deliberate seams.'
		default:
			return 'Also moves UV vertices already on the same spot. Keeps existing seams intact.'
	}
})

defineExpose({ name: 'Workspace tab' })
</script>

<style>
/*
 * At 176px the viewport's own header, toolbar, nav widget and gizmo are bigger
 * than the render they sit on. They are faded rather than `display: none` so
 * the gizmo's container keeps a non-zero size — it renders into a canvas that
 * is measured from it every frame.
 */
/* `!important` because the dev FPS panel carries its opacity inline. */
.uv-inset-viewport > * > *:not(canvas) {
	opacity: 0 !important;
	pointer-events: none;
}
</style>
