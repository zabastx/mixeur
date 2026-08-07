<template>
	<main class="relative flex min-h-0 flex-1 gap-0 bg-editor-border p-1 select-none">
		<!--
			UV on the left, 3D on the right, as Blender lays the workspace out.
			Only present in the UV workspace — in Layout the viewport simply
			reclaims the width.
		-->
		<template v-if="workspace === 'uv'">
			<EditorWrapper
				class="grid min-w-0 shrink-0 grid-rows-[auto_1fr_auto]"
				:style="{ width: `${uvWidth}px` }"
			>
				<!-- A thin header for the things you change constantly. -->
				<div
					class="flex items-center gap-1 border-b border-editor-outline bg-viewport-header-bg px-1
						py-0.5"
				>
					<MxIcon name="ui/material-data" class="shrink-0" />
					<div class="flex gap-0.5">
						<button
							v-for="m in MODES"
							:key="m"
							class="btn px-1.5 text-xs capitalize"
							:class="{ 'btn--highlight': editor.selection.value.mode === m }"
							@click="editor.setMode(m)"
						>
							{{ m }}
						</button>
					</div>
					<div class="ml-auto flex gap-0.5">
						<button class="btn text-xs" @click="editor.selectAll()">All</button>
						<button class="btn text-xs" @click="editor.clearSelection()">None</button>
					</div>
				</div>

				<div class="grid min-h-0 grid-cols-[auto_1fr]">
					<!-- B's rail, kept: in a half-width pane there is still room to say
					     what each control means, and sticky/pivot are exactly the two
					     settings nobody guesses right from an icon. -->
					<aside
						class="flex w-48 shrink-0 flex-col gap-3 overflow-y-auto border-r border-editor-outline
							bg-window-bg p-2"
					>
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
							<div class="grid grid-cols-2 gap-1">
								<button class="btn text-xs" @click="editor.apply({ rotate: STEP_ROT }, 'Rotated')">
									⟲ 15°
								</button>
								<button class="btn text-xs" @click="editor.apply({ rotate: -STEP_ROT }, 'Rotated')">
									⟳ 15°
								</button>
								<button
									class="btn text-xs"
									@click="editor.apply({ scale: [1.1, 1.1] }, 'Scaled up')"
								>
									Scale +
								</button>
								<button
									class="btn text-xs"
									@click="editor.apply({ scale: [1 / 1.1, 1 / 1.1] }, 'Scaled down')"
								>
									Scale −
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

					<!-- Tighter than the default: the pane is tall and narrow, so the
					     tile is sized by its width and needs less margin around it. -->
					<UvCanvas :span="1.45" />
				</div>

				<div
					class="truncate border-t border-editor-outline bg-panel-sub-background px-2 py-0.5 text-xs
						text-header-text"
				>
					{{ editor.lastAction.value }}
				</div>
			</EditorWrapper>

			<div ref="divider" class="divider w-1 shrink-0 cursor-col-resize"></div>
		</template>

		<!-- Never unmounted, only resized: rebuilding the renderer and the
		     post-processing chain on every tab switch is not free. -->
		<MxViewport class="block-border min-w-0 flex-1" />

		<div class="w-1 shrink-0"></div>

		<MxSidebar v-if="viewportStore.isMounted" class="shrink-0" :style="{ width: `${side}px` }">
			<template #top><DataOutliner /></template>
			<template #bottom><DataProperties /></template>
		</MxSidebar>
	</main>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE variant D — throwaway. See ./README.md.
 *
 * The merge the other variants were arguing about: B's workspace tabs (promoted
 * to the top-level header, where Blender keeps them) driving A's permanent
 * split, with B's labelled rail living inside the UV pane.
 *
 * What each parent gave up: B loses the full-stage takeover and the 3D inset —
 * the viewport stays a real viewport. A loses its cramped one-line control
 * strip, and gets back the outliner and properties it had to squeeze.
 */
import { computed, ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useViewportStore } from '@/app/model/viewport'
import { useUvEditor } from './use-uv-editor'
import { workspace } from './workspace'
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

const viewportStore = useViewportStore()
const editor = useUvEditor()

const side = ref(Math.round(window.innerWidth * 0.2))
// Wide enough that the rail plus a square tile both fit without scrolling.
const uvWidth = ref(Math.round(Math.min(760, Math.max(520, window.innerWidth * 0.42))))

const divider = useTemplateRef('divider')
useEventListener(divider, 'pointerdown', (e: PointerEvent) => {
	const startX = e.clientX
	const start = uvWidth.value
	const move = (ev: PointerEvent) => {
		uvWidth.value = Math.max(320, start + (ev.clientX - startX))
	}
	const cancel = useEventListener(window, 'pointermove', move)
	useEventListener(window, 'pointerup', cancel)
})

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

defineExpose({ name: 'Workspace split' })
</script>
