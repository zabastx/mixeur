<template>
	<!--
		The trigger is a bare button on purpose. `Popover.Trigger` renders
		`as-child`, and wrapping it in `MxTooltip` — itself an `as-child` chain —
		swallows the trigger's click and aria props, so the menu never opens. The
		viewport's shading controls take the same shape for the same reason; the
		menu heading and the per-item tooltips carry the explanation instead.
	-->
	<MxPopover
		:root="{ open }"
		:content="{ align: 'start', sideOffset: 4 }"
		@update:open="open = $event"
	>
		<template #trigger>
			<button
				class="btn flex items-center gap-0.5 px-1"
				type="button"
				data-testid="uv-sticky-trigger"
				:aria-label="`Sticky selection mode: ${current.label}`"
			>
				<MxIcon :name="current.icon" />
				<MxIcon name="ui/arrow-down" class="text-[0.6em]" />
			</button>
		</template>

		<template #content>
			<div class="flex min-w-52 flex-col gap-0.5" role="radiogroup">
				<span class="px-2 pt-0.5 pb-1 text-ui-menu-bg-text">Sticky Selection Mode</span>
				<MxTooltip
					v-for="mode in STICKY_MODES"
					:key="mode.value"
					:options="{ content: { side: 'right', sideOffset: 12 } }"
					:tooltip="{ text: mode.description }"
				>
					<button
						class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-left
							text-ui-menu-item-text"
						:class="
							uvStore.selection.sticky === mode.value
								? 'bg-ui-menu-item-inner-selected text-ui-menu-item-text-selected'
								: 'hover:bg-ui-menu-outline'
						"
						type="button"
						role="radio"
						:aria-checked="uvStore.selection.sticky === mode.value"
						:data-testid="`uv-sticky-${mode.value}`"
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
 * Sticky selection mode, as a header dropdown the way Blender has it.
 *
 * This is the setting the whole editor turns on — a mesh vertex can own several
 * UV vertices, so "move this corner" has three defensible answers — which is
 * why each option carries a tooltip saying what it actually does rather than
 * relying on the name.
 *
 * Order and labels follow Blender's so the two are comparable, but the default
 * does not: see `createUvSelection` for why this ships on Shared Location.
 */
import { computed, ref } from 'vue'
import type { StickyMode } from '@/shared/lib/uv-layout'
import { useUvStore } from '@/app/model/uv'

interface StickyOption {
	value: StickyMode
	label: string
	icon: MxIconName
	description: string
}

const STICKY_MODES: StickyOption[] = [
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

const uvStore = useUvStore()
const open = ref(false)

const current = computed(
	() => STICKY_MODES.find((mode) => mode.value === uvStore.selection.sticky) ?? STICKY_MODES[0]
)

function select(mode: StickyMode) {
	uvStore.selection.sticky = mode
	uvStore.touch()
	open.value = false
}
</script>
