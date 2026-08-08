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

			<UvModeSelect
				:model-value="uvStore.selection.sticky"
				heading="Sticky Selection Mode"
				testid="uv-sticky"
				:options="STICKY_MODES"
				@update:model-value="setSticky"
			/>
			<MenuBar :items="menuItems" />
			<UvModeSelect
				:model-value="uvStore.selection.pivot"
				heading="Pivot"
				testid="uv-pivot"
				:options="PIVOT_MODES"
				@update:model-value="setPivot"
			/>
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
			<span class="ml-auto truncate">{{ uvStore.lastAction }}</span>
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
import type { PivotMode, SelectMode, StickyMode, TransformKind } from '@/shared/lib/uv-layout'
import type { MxTooltipContent } from '@/shared/lib/types'
import type { IMenubarMenu } from '@/shared/ui/MenuBar.vue'
import type { UvModeOption } from './UvModeSelect.vue'
import { useUvStore } from '@/app/model/uv'
import { useUvGridStore } from '@/app/model/uv-grid'

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

/**
 * What comes along when you move what you picked.
 *
 * The setting the whole editor turns on: a mesh vertex can own several UV
 * vertices, so "move this corner" has three defensible answers. Order and
 * labels follow Blender's, and so does the default — see `createUvSelection`.
 */
const STICKY_MODES: UvModeOption<StickyMode>[] = [
	{
		value: 'off',
		label: 'Disabled',
		icon: 'snapping/sticky-disable',
		description: 'Select only the UVs you pick. Moving them tears the layout freely.'
	},
	{
		value: 'shared-location',
		label: 'Shared Location',
		icon: 'snapping/sticky-loc',
		description:
			'Select UVs that share a mesh vertex and sit at the same location. Welded points stay welded, and seams that were deliberately cut stay cut.'
	},
	{
		value: 'shared-vertex',
		label: 'Shared Vertex',
		icon: 'snapping/sticky-vert',
		description:
			'Select UVs that share a mesh vertex, whether or not they are at the same location. Convenient on an accidental seam, but it will drag a deliberate one shut.'
	}
]

/**
 * What rotations and scales turn around.
 *
 * Rotating two islands at once has two defensible answers — orbit each other,
 * or spin in place — which is why this is a mode rather than a fixed rule, and
 * why it could not be retrofitted once transforms assumed a single centre.
 */
const PIVOT_MODES: UvModeOption<PivotMode>[] = [
	{
		value: 'bounding-box',
		label: 'Bounding Box Center',
		icon: 'editing/pivot-boundbox',
		description: 'Pivot around the centre of the selection’s bounding box.'
	},
	{
		value: 'median',
		label: 'Median Point',
		icon: 'editing/pivot-median',
		description:
			'Pivot around the average of the selected UVs. A dense cluster pulls it, where the bounding box would ignore that.'
	},
	{
		value: 'cursor',
		label: '2D Cursor',
		icon: 'editing/pivot-cursor',
		description: 'Pivot around the 2D cursor. Alt-click in the UV view to place it.'
	},
	{
		value: 'individual',
		label: 'Individual Origins',
		icon: 'editing/pivot-individual',
		description:
			'Pivot around each selected island’s own median point, so islands spin in place instead of orbiting each other.'
	}
]

const uvStore = useUvStore()
const uvGridStore = useUvGridStore()

// Both are plain fields on the selection, so the store only has to be told
// afterwards — `touch` is what gets the canvas to redraw with the new rule.
function setSticky(value: StickyMode) {
	uvStore.selection.sticky = value
	uvStore.touch()
}

function setPivot(value: PivotMode) {
	uvStore.selection.pivot = value
	uvStore.touch()
}

/**
 * The modal transforms live on the canvas, because they are driven by the
 * pointer over it. The menu entries exist so the shortcuts are discoverable,
 * and they invoke exactly the same thing the keys do.
 */
const canvasRef = useTemplateRef('canvasRef')
const transform = (kind: TransformKind) => canvasRef.value?.beginTransform(kind)

const gridEnabled = computed({
	get: () => (uvStore.mesh ? uvGridStore.isApplied(uvStore.mesh.uuid) : false),
	set: () => uvGridStore.toggle(uvStore.mesh)
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
</script>
