<template>
	<EditorWrapper class="grid min-w-0 grid-rows-[auto_1fr_auto]">
		<!-- A thin header for the settings that change constantly; everything
		     else lives in the rail. -->
		<div
			class="flex items-center gap-2 border-b border-editor-outline bg-viewport-header-bg px-1
				py-0.5"
		>
			<MxIcon name="ui/material-data" class="shrink-0" />

			<!-- One segmented control rather than four separate buttons: the modes
			     are mutually exclusive, and joining them says so. -->
			<div
				class="flex divide-x divide-ui-radio-outline overflow-hidden rounded border
					border-ui-radio-outline"
				role="radiogroup"
				aria-label="UV select mode"
			>
				<MxTooltip v-for="mode in MODES" :key="mode.value" :tooltip="mode.tooltip">
					<button
						class="cursor-pointer px-2 py-1 text-base"
						:class="
							uvStore.selection.mode === mode.value
								? 'btn--highlight text-white'
								: 'bg-ui-radio-inner hover:brightness-125'
						"
						role="radio"
						:aria-checked="uvStore.selection.mode === mode.value"
						:data-testid="`uv-mode-${mode.value}`"
						@click="uvStore.setMode(mode.value)"
					>
						<MxIcon :name="mode.icon" />
					</button>
				</MxTooltip>
			</div>

			<div class="ml-auto flex gap-0.5">
				<button class="btn text-xs" @click="uvStore.selectAll()">All</button>
				<button class="btn text-xs" @click="uvStore.clearSelection()">None</button>
			</div>
		</div>

		<div class="grid min-h-0 grid-cols-[auto_1fr]">
			<UvToolRail />
			<UvCanvas />
		</div>

		<div
			class="truncate border-t border-editor-outline bg-panel-sub-background px-2 py-0.5 text-xs
				text-header-text"
		>
			{{ uvStore.lastAction || hint }}
		</div>
	</EditorWrapper>
</template>

<script lang="ts" setup>
/**
 * The UV editor pane: header, tool rail, canvas, status line.
 *
 * It edits the whole selected mesh — see `useUvStore` for why that scope, and
 * what sub-object selection would buy.
 */
import { computed } from 'vue'
import type { SelectMode } from '@/shared/lib/uv-layout'
import type { MxTooltipContent } from '@/shared/lib/types'
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

const hint = computed(() =>
	uvStore.status === 'ready'
		? 'Drag to move · drag empty space to box-select · Shift extends · Alt+click sets the 2D cursor'
		: ''
)
</script>
