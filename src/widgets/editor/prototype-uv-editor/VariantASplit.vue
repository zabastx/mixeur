<template>
	<main class="grid min-h-0 flex-1 grid-cols-(--split-cols) bg-editor-border p-1 select-none">
		<MxViewport class="block-border" />

		<div ref="divider" class="divider w-1 cursor-col-resize"></div>

		<EditorWrapper class="grid grid-rows-[auto_1fr_auto]">
			<!-- One dense strip, sized like the viewport header it sits beside. -->
			<div class="flex flex-wrap items-center gap-2 bg-viewport-header-bg p-1">
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

				<label class="flex items-center gap-1 text-xs text-header-text">
					Sticky
					<select v-model="editor.selection.value.sticky" class="input w-28 text-xs">
						<option value="off">Off</option>
						<option value="shared-vertex">Shared vertex</option>
						<option value="shared-location">Shared location</option>
					</select>
				</label>

				<label class="flex items-center gap-1 text-xs text-header-text">
					Pivot
					<select v-model="editor.selection.value.pivot" class="input w-24 text-xs">
						<option value="median">Median</option>
						<option value="cursor">2D cursor</option>
						<option value="individual">Individual</option>
					</select>
				</label>

				<div class="ml-auto flex gap-0.5">
					<button class="btn text-xs" @click="editor.selectAll()">All</button>
					<button class="btn text-xs" @click="editor.clearSelection()">None</button>
					<button class="btn text-xs" @click="editor.pack()">Pack</button>
					<button class="btn text-xs" @click="editor.weldSelected()">Weld</button>
					<button class="btn text-xs" @click="editor.reset()">Reset</button>
					<button
						class="btn text-xs"
						:class="{ 'btn--highlight': editor.hasGrid.value }"
						@click="editor.toggleGrid()"
					>
						Grid
					</button>
				</div>
			</div>

			<UvCanvas />

			<!-- Both panes are always on screen, so the numbers can stay quiet. -->
			<div
				class="flex flex-wrap items-center gap-x-4 gap-y-0.5 border-t border-editor-outline
					bg-panel-sub-background px-2 py-1 text-xs text-header-text"
			>
				<template v-if="editor.summary.value">
					<span>{{ editor.summary.value.islandCount }} islands</span>
					<span>{{ editor.summary.value.seamCount }} seams</span>
					<span :class="{ 'text-outliner-active-object': editor.summary.value.movingCount > 0 }">
						{{ editor.summary.value.movingCount }} moving
						<template v-if="editor.summary.value.stickyExtra > 0">
							(+{{ editor.summary.value.stickyExtra }} sticky)
						</template>
					</span>
					<span v-if="editor.summary.value.overlaps" class="text-orange-400">
						{{ editor.summary.value.overlaps }} overlapping pairs
					</span>
					<span v-if="editor.summary.value.offTile" class="text-orange-400">
						{{ editor.summary.value.offTile }} off-tile
					</span>
				</template>
				<span class="ml-auto truncate">{{ editor.lastAction.value }}</span>
			</div>
		</EditorWrapper>

		<div class="divider w-1 cursor-col-resize"></div>

		<MxSidebar v-if="viewportStore.isMounted">
			<template #top><DataOutliner /></template>
			<template #bottom><DataProperties /></template>
		</MxSidebar>
	</main>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE variant A — throwaway. See ./README.md.
 *
 * "Split viewport": the 3D view gives up half its width to the UV view, both
 * permanently on screen. This is Blender's UV Editing workspace, and the bet is
 * that constant side-by-side feedback is worth the lost viewport width.
 */
import { ref, useTemplateRef } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useViewportStore } from '@/app/model/viewport'
import { useUvEditor } from './use-uv-editor'
import type { SelectMode } from './uv-edit'

const MODES: SelectMode[] = ['vertex', 'edge', 'face', 'island']

const viewportStore = useViewportStore()
const editor = useUvEditor()

const divider = useTemplateRef('divider')
const uvWidth = ref(Math.min(560, window.innerWidth * 0.3))
const rightWidth = ref(window.innerWidth * 0.22)

useEventListener(divider, 'pointerdown', (e: PointerEvent) => {
	const startX = e.clientX
	const startWidth = uvWidth.value
	const move = (ev: PointerEvent) => {
		uvWidth.value = Math.max(220, startWidth + (startX - ev.clientX))
	}
	const cancel = useEventListener(window, 'pointermove', move)
	useEventListener(window, 'pointerup', cancel)
})

defineExpose({ name: 'Split viewport' })
</script>

<style scoped>
main {
	--split-cols: 1fr min-content v-bind(uvWidth + 'px') min-content v-bind(rightWidth + 'px');
}
</style>
