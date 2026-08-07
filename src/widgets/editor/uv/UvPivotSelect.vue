<template>
	<!-- Bare trigger button: see `UvStickySelect` for why it cannot be wrapped
	     in a tooltip. -->
	<MxPopover
		:root="{ open }"
		:content="{ align: 'start', sideOffset: 4 }"
		@update:open="open = $event"
	>
		<template #trigger>
			<button
				class="btn flex items-center gap-0.5 px-1"
				type="button"
				data-testid="uv-pivot-trigger"
				:aria-label="`Pivot point: ${current.label}`"
			>
				<MxIcon :name="current.icon" />
				<MxIcon name="ui/arrow-down" class="text-[0.6em]" />
			</button>
		</template>

		<template #content>
			<div class="flex min-w-52 flex-col gap-0.5" role="radiogroup">
				<span class="px-2 pt-0.5 pb-1 text-ui-menu-bg-text">Pivot</span>
				<MxTooltip
					v-for="mode in PIVOT_MODES"
					:key="mode.value"
					:options="{ content: { side: 'right', sideOffset: 12 } }"
					:tooltip="{ text: mode.description }"
				>
					<button
						class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-left
							text-ui-menu-item-text"
						:class="
							uvStore.selection.pivot === mode.value
								? 'bg-ui-menu-item-inner-selected text-ui-menu-item-text-selected'
								: 'hover:bg-ui-menu-outline'
						"
						type="button"
						role="radio"
						:aria-checked="uvStore.selection.pivot === mode.value"
						:data-testid="`uv-pivot-${mode.value}`"
						@click="select(mode.value)"
					>
						<MxIcon :name="mode.icon" class="shrink-0" />
						{{ mode.label }}
					</button>
				</MxTooltip>
			</div>
		</template>
	</MxPopover>
</template>

<script lang="ts" setup>
/**
 * What rotations and scales turn around.
 *
 * Rotating two islands at once has two defensible answers — orbit each other,
 * or spin in place — which is why this is a mode rather than a fixed rule, and
 * why it could not be retrofitted once transforms assumed a single centre.
 */
import { computed, ref } from 'vue'
import type { PivotMode } from '@/shared/lib/uv-layout'
import { useUvStore } from '@/app/model/uv'

interface PivotOption {
	value: PivotMode
	label: string
	icon: MxIconName
	description: string
}

const PIVOT_MODES: PivotOption[] = [
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
const open = ref(false)

const current = computed(
	() => PIVOT_MODES.find((mode) => mode.value === uvStore.selection.pivot) ?? PIVOT_MODES[0]
)

function select(mode: PivotMode) {
	uvStore.selection.pivot = mode
	uvStore.touch()
	open.value = false
}
</script>
