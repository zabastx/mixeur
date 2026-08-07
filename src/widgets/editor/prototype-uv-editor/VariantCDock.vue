<template>
	<main class="grid min-h-0 flex-1 grid-cols-(--dock-cols) bg-editor-border p-1 select-none">
		<!-- The 3D view keeps its full width; nothing is taken from it. -->
		<MxViewport class="block-border" />

		<div ref="divider" class="divider w-1 cursor-col-resize"></div>

		<!-- Outliner and Properties both stay: the bet is that UV editing costs
		     the layout nothing, and hiding what it displaces would rig that. -->
		<div class="grid min-h-0 grid-rows-(--dock-rows) rounded">
			<DataOutliner />
			<div class="h-1"></div>
			<DataProperties />
			<div class="h-1"></div>

			<!--
				Five rows, not four: EditorWrapper contributes its own title row. Every
				row but the list is `auto`, and the list gets `minmax(0,1fr)` so it can
				actually shrink — a bare `1fr` refuses to go below its content and the
				table gets squeezed out of the panel entirely.
			-->
			<EditorWrapper
				title="UV Map"
				icon="ui/material-data"
				class="grid grid-rows-[auto_auto_auto_minmax(0,1fr)_auto]"
			>
				<!-- A thumbnail, not a workspace: the canvas is here to confirm what
				     the list is talking about, not to be dragged in. Fixed height, so
				     a wider sidebar does not eat the list. -->
				<div class="relative h-44 w-full border-y border-editor-outline">
					<UvCanvas :span="1.25" :show-repeats="false" />
				</div>

				<div class="flex items-center gap-1 p-1">
					<button class="btn grow text-xs" @click="editor.pack()">Pack</button>
					<button class="btn grow text-xs" @click="editor.reset()">Reset</button>
					<button
						class="btn grow text-xs"
						:class="{ 'btn--highlight': editor.hasGrid.value }"
						@click="editor.toggleGrid()"
					>
						Grid
					</button>
				</div>

				<!-- The primary affordance: pick an island from a list, nudge it with
				     numbers. No dragging, no modes, no pivot dropdown. -->
				<ScrollContainer>
					<table class="w-full text-xs">
						<thead class="sticky top-0 bg-panel-header text-header-text">
							<tr>
								<th class="px-1.5 py-1 text-left font-normal">Island</th>
								<th class="px-1 py-1 text-right font-normal">Faces</th>
								<th class="px-1 py-1 text-right font-normal">U</th>
								<th class="py-1 pr-4 pl-1 text-right font-normal">V</th>
							</tr>
						</thead>
						<tbody>
							<tr
								v-for="row in islands"
								:key="row.id"
								class="cursor-pointer even:bg-outliner-alternate-rows"
								:class="{ 'bg-outliner-active-highlight': selectedIsland === row.id }"
								@click="selectIsland(row.id)"
							>
								<td class="px-1.5 py-0.5">
									<span
										class="mr-1 inline-block h-2 w-2 rounded-full align-middle"
										:style="{ background: row.overlapping ? '#ff5a50' : '#67c37b' }"
									></span>
									{{ row.id }}
								</td>
								<td class="px-1 py-0.5 text-right text-header-text">{{ row.faces }}</td>
								<td class="px-1 py-0.5 text-right">{{ row.u }}</td>
								<td class="py-0.5 pr-4 pl-1 text-right">{{ row.v }}</td>
							</tr>
						</tbody>
					</table>
					<p v-if="!islands.length" class="p-2 text-xs text-header-text">
						Select a mesh with UVs to list its islands.
					</p>
				</ScrollContainer>

				<div class="border-t border-editor-outline p-1.5">
					<div v-if="selectedIsland !== null" class="flex flex-col gap-1">
						<div class="grid grid-cols-4 gap-1">
							<button class="btn text-xs" @click="nudge(-STEP, 0)">← U</button>
							<button class="btn text-xs" @click="nudge(STEP, 0)">U →</button>
							<button class="btn text-xs" @click="nudge(0, STEP)">↑ V</button>
							<button class="btn text-xs" @click="nudge(0, -STEP)">↓ V</button>
						</div>
						<div class="grid grid-cols-4 gap-1">
							<button class="btn text-xs" @click="spin(STEP_ROT)">⟲</button>
							<button class="btn text-xs" @click="spin(-STEP_ROT)">⟳</button>
							<button class="btn text-xs" @click="resize(1.1)">＋</button>
							<button class="btn text-xs" @click="resize(1 / 1.1)">−</button>
						</div>
					</div>
					<p v-else class="text-xs text-header-text">Pick an island to move it.</p>
					<p class="mt-1 truncate text-[10px] text-header-text">{{ editor.lastAction.value }}</p>
				</div>
			</EditorWrapper>
		</div>
	</main>
</template>

<script lang="ts" setup>
/**
 * PROTOTYPE variant C — throwaway. See ./README.md.
 *
 * "Sidebar dock": UV mapping is treated as a property of the mesh rather than a
 * workspace. The 3D view keeps its full width; the UV layout arrives as a
 * thumbnail plus a list of islands you nudge with buttons.
 *
 * The bet being tested is deliberately unfashionable: that most UV work in a
 * web editor is coarse — pack, spot an overlap, shove an island off another —
 * and that a list beats a canvas for exactly that, while costing no layout.
 * If it feels cramped, that is the finding.
 */
import { computed, ref, useTemplateRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useUvEditor } from './use-uv-editor'
import * as uvEdit from './uv-edit'

const STEP = 0.05
const STEP_ROT = Math.PI / 12

const editor = useUvEditor()
const selectedIsland = ref<number | null>(null)

const divider = useTemplateRef('divider')
const rightWidth = ref(Math.max(300, window.innerWidth * 0.24))

useEventListener(divider, 'pointerdown', (e: PointerEvent) => {
	const startX = e.clientX
	const startWidth = rightWidth.value
	const move = (ev: PointerEvent) => {
		rightWidth.value = Math.max(260, startWidth + (startX - ev.clientX))
	}
	const cancel = useEventListener(window, 'pointermove', move)
	useEventListener(window, 'pointerup', cancel)
})

const islands = computed(() => {
	void editor.version.value
	const model = editor.model.value
	const uv = editor.currentUv()
	if (!model || !uv) return []
	const boxes = model.vertsOfIsland.map((verts) => uvEdit.bboxOf(uv, verts))
	return boxes.map((b, id) => ({
		id,
		faces: model.facesOfIsland[id].length,
		u: ((b.u0 + b.u1) / 2).toFixed(3),
		v: ((b.v0 + b.v1) / 2).toFixed(3),
		overlapping: boxes.some((o, j) => j !== id && overlaps(b, o))
	}))
})

function overlaps(a: uvEdit.Rect, b: uvEdit.Rect) {
	return a.u0 < b.u1 - 1e-6 && b.u0 < a.u1 - 1e-6 && a.v0 < b.v1 - 1e-6 && b.v0 < a.v1 - 1e-6
}

function selectIsland(id: number) {
	selectedIsland.value = id
	const sel = editor.selection.value
	sel.mode = 'island'
	sel.pivot = 'individual'
	sel.ids = new Set([id])
	editor.touch(`Island ${id} selected`)
}

// A different mesh means the old island numbers mean nothing.
watch(editor.model, () => (selectedIsland.value = null))

const nudge = (du: number, dv: number) => editor.apply({ translate: [du, dv] }, 'Moved island')
const spin = (angle: number) => editor.apply({ rotate: angle }, 'Rotated island')
const resize = (factor: number) => editor.apply({ scale: [factor, factor] }, 'Scaled island')

defineExpose({ name: 'Sidebar dock' })
</script>

<style scoped>
main {
	--dock-cols: 1fr min-content v-bind(rightWidth + 'px');
	/* outliner · gap · properties · gap · uv map */
	--dock-rows: minmax(120px, 1fr) min-content minmax(140px, 1fr) min-content minmax(0, 1.5fr);
}
</style>
