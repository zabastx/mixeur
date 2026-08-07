<template>
	<EditorWrapper class="grid min-w-0 grid-rows-[auto_1fr_auto]">
		<div
			class="flex flex-wrap items-center gap-2 border-b border-editor-outline bg-viewport-header-bg
				px-1 py-0.5"
		>
			<MxIcon name="editing/uv" class="shrink-0" />

			<!-- One segmented control rather than four separate buttons: the modes
			     are mutually exclusive, and joining them says so. Same shape as
			     the viewport's shading controls, which is the other toggle group
			     of this kind in an editor header. -->
			<div
				class="flex overflow-hidden rounded *:not-last:border-r"
				role="radiogroup"
				aria-label="UV select mode"
			>
				<MxTooltip v-for="mode in MODES" :key="mode.value" :tooltip="mode.tooltip">
					<button
						class="btn rounded-none border-0"
						:class="{ 'bg-ui-radio-inner-selected': uvStore.selection.mode === mode.value }"
						type="button"
						role="radio"
						:aria-checked="uvStore.selection.mode === mode.value"
						:data-testid="`uv-mode-${mode.value}`"
						@click="uvStore.setMode(mode.value)"
					>
						<MxIcon :name="mode.icon" />
					</button>
				</MxTooltip>
			</div>

			<UvStickySelect />
			<MenuBar :items="menuItems" />
			<UvPivotSelect />
		</div>

		<UvCanvas ref="canvasRef" />

		<!--
			The numbers that matter are Picked against Moving: the gap between them
			is the sticky rule at work, which is otherwise invisible until
			something moves unexpectedly.
		-->
		<div
			class="flex flex-wrap items-center gap-x-4 border-t border-editor-outline
				bg-panel-sub-background px-2 py-0.5 text-xs text-header-text"
		>
			<template v-if="uvStore.stats">
				<span>{{ uvStore.stats.islandCount }} islands</span>
				<span>{{ uvStore.stats.seamCount }} seams</span>
				<span>
					{{ uvStore.stats.pickedCount }} picked →
					<span class="text-outliner-active-object">{{ uvStore.stats.movingCount }}</span> moving
					<template v-if="uvStore.stats.stickyCount">
						(+{{ uvStore.stats.stickyCount }} by sticky)
					</template>
				</span>
				<span v-if="uvStore.stats.overlappingPairs" class="text-orange-400">
					{{ uvStore.stats.overlappingPairs }} overlapping
				</span>
				<span v-if="uvStore.stats.offTileCount" class="text-orange-400">
					{{ uvStore.stats.offTileCount }} off tile
				</span>
			</template>
			<span class="ml-auto truncate">{{ uvStore.lastAction || hint }}</span>
		</div>
	</EditorWrapper>
</template>

<script lang="ts" setup>
/**
 * The UV editor pane: header, canvas, status line.
 *
 * It edits the whole selected mesh — see `useUvStore` for why that scope, and
 * what sub-object selection would buy.
 */
import { computed, useTemplateRef } from 'vue'
import type { SelectMode, TransformKind } from '@/shared/lib/uv-layout'
import type { MxTooltipContent } from '@/shared/lib/types'
import type { IMenubarMenu } from '@/shared/ui/MenuBar.vue'
import { useUvStore } from '@/app/model/uv'

interface ModeButton {
	value: SelectMode
	icon: MxIconName
	tooltip: MxTooltipContent
}

/**
 * Laid out like Blender's UV editor header, and the tooltips borrow its shape —
 * mode name, what the mode does, then a dim restatement. The wording is ours,
 * though: Blender's own text advertises simultaneous modes and Ctrl-click
 * expand/contract, neither of which exists here, and a tooltip describing keys
 * that do nothing is worse than none.
 */
const MODES: ModeButton[] = [
	{
		value: 'vertex',
		icon: 'editing/vertex',
		tooltip: {
			title: 'Select Mode: Vertex',
			text: 'Pick single UV vertices. The finest control, and the only mode that can tear a face away from its neighbours.',
			footer: 'Vertex selection mode'
		}
	},
	{
		value: 'edge',
		icon: 'editing/edge',
		tooltip: {
			title: 'Select Mode: Edge',
			text: 'Pick UV edges. Useful for straightening a border or lining two islands up along a shared edge.',
			footer: 'Edge selection mode'
		}
	},
	{
		value: 'face',
		icon: 'editing/face',
		tooltip: {
			title: 'Select Mode: Face',
			text: 'Pick single triangles. A quad is two of them, so drag a box rather than clicking if you want the whole quad.',
			footer: 'Face selection mode'
		}
	},
	{
		value: 'island',
		icon: 'editing/island',
		tooltip: {
			title: 'Select Mode: Island',
			text: 'Pick a whole connected piece of the layout. Usually what you want: islands move without ever distorting a face.',
			footer: 'Island selection mode'
		}
	}
]

const uvStore = useUvStore()

/**
 * The modal transforms live on the canvas, because they are driven by the
 * pointer over it. The menu entries exist so the shortcuts are discoverable,
 * and they invoke exactly the same thing the keys do.
 */
const canvasRef = useTemplateRef('canvasRef')
const transform = (kind: TransformKind) => canvasRef.value?.beginTransform(kind)

const gridEnabled = computed({
	get: () => uvStore.hasGrid,
	set: () => uvStore.toggleGrid()
})

/**
 * Menus, not a rail of buttons. Following the viewport header, which already
 * puts its one-shot commands behind `View`/`Add` and keeps only the controls
 * you change mid-gesture on the bar itself.
 */
const menuItems = computed<IMenubarMenu[]>(() => [
	{
		label: 'Select',
		items: [
			{
				type: 'item',
				key: 'select_all',
				label: 'All',
				onClick: () => uvStore.selectAll()
			},
			{
				type: 'item',
				key: 'select_none',
				label: 'None',
				onClick: () => uvStore.clearSelection()
			}
		]
	},
	{
		label: 'UV',
		items: [
			{
				type: 'sub',
				key: 'transform',
				label: 'Transform',
				items: [
					{
						type: 'item',
						key: 'move',
						label: 'Move',
						shortcut: 'G',
						onClick: () => transform('move')
					},
					{
						type: 'item',
						key: 'rotate',
						label: 'Rotate',
						shortcut: 'R',
						onClick: () => transform('rotate')
					},
					{
						type: 'item',
						key: 'scale',
						label: 'Scale',
						shortcut: 'S',
						onClick: () => transform('scale')
					},
					{
						type: 'item',
						key: 'flip_u',
						label: 'Flip in U',
						onClick: () => uvStore.apply({ scale: [-1, 1] }, 'Flipped in U')
					},
					{
						type: 'item',
						key: 'flip_v',
						label: 'Flip in V',
						onClick: () => uvStore.apply({ scale: [1, -1] }, 'Flipped in V')
					}
				]
			},
			{ type: 'separator', key: 'sep_layout' },
			{
				type: 'item',
				key: 'pack_islands',
				label: 'Pack Islands',
				onClick: () => uvStore.pack()
			},
			{
				type: 'item',
				key: 'weld',
				label: 'Weld Selected',
				onClick: () => uvStore.weld()
			},
			{ type: 'separator', key: 'sep_reset' },
			{
				type: 'checkbox',
				key: 'uv_grid',
				label: 'UV Grid Texture',
				// `MenuBar` writes through `v-model`, so this has to be writable.
				model: gridEnabled
			},
			{
				type: 'item',
				key: 'reset',
				label: 'Reset UVs',
				onClick: () => uvStore.reset()
			}
		]
	}
])

const hint = computed(() =>
	uvStore.status === 'ready'
		? 'G/R/S transform · drag to move · empty space box-selects · middle-drag pans · Alt+click sets the cursor'
		: ''
)
</script>
