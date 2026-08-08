<template>
	<!--
		The trigger is a bare button on purpose. `Popover.Trigger` renders
		`as-child`, and wrapping it in `MxTooltip` — itself an `as-child` chain —
		swallows the trigger's click and aria props, so the menu never opens. The
		viewport's shading controls take the same shape for the same reason; the
		heading and the per-item tooltips carry the explanation instead.
	-->
	<MxPopover
		:root="{ open }"
		:content="{ align: 'start', sideOffset: 4 }"
		content-class="p-0.5 text-xs"
		@update:open="open = $event"
	>
		<template #trigger>
			<button
				class="btn flex items-center gap-0.5 px-1"
				type="button"
				:data-testid="`${testid}-trigger`"
				:aria-label="`${heading}: ${current.label}`"
			>
				<MxIcon :name="current.icon" />
				<MxIcon name="ui/arrow-down" class="text-[0.6em]" />
			</button>
		</template>

		<template #content>
			<!--
				`menubar-item` rather than a private set of paddings: this is a menu of
				the same kind the top bar and the UV header's own `MenuBar` drop down,
				and it should be sized by the same rule they are.
			-->
			<div class="flex min-w-[200px] flex-col gap-1" role="radiogroup">
				<span class="pt-0.5 pr-1 pb-1 pl-2.5 text-ui-menu-bg-text">{{ heading }}</span>
				<MxTooltip
					v-for="option in options"
					:key="option.value"
					:options="{ content: { side: 'right', sideOffset: 12 } }"
					:tooltip="{ text: option.description }"
				>
					<button
						class="menubar-item w-full cursor-pointer text-left text-ui-menu-item-text"
						:class="
							model === option.value
								? 'bg-ui-menu-item-inner-selected text-ui-menu-item-text-selected'
								: 'hover:bg-ui-menu-outline'
						"
						type="button"
						role="radio"
						:aria-checked="model === option.value"
						:data-testid="`${testid}-${option.value}`"
						@click="select(option.value)"
					>
						<MxIcon :name="option.icon" class="shrink-0" />
						{{ option.label }}
					</button>
				</MxTooltip>
			</div>
		</template>
	</MxPopover>
</template>

<script lang="ts">
export interface UvModeOption<T> {
	value: T
	label: string
	icon: MxIconName
	description: string
}
</script>

<script lang="ts" setup generic="T extends string">
/**
 * One of the UV header's mode dropdowns: an icon trigger showing the current
 * choice, over a radio list of the alternatives.
 *
 * Each option carries a description rather than relying on its name, because
 * these are the settings that decide what a drag actually does — see the option
 * lists in `UvEditor` for what each one means.
 */
import { computed, ref } from 'vue'

const { options } = defineProps<{
	/** Names the group, and heads the menu. Also the aria-label's prefix. */
	heading: string
	/** Prefix for the trigger's and each option's `data-testid`. */
	testid: string
	options: UvModeOption<T>[]
}>()

const model = defineModel<T>({ required: true })
const open = ref(false)

const current = computed(() => options.find((option) => option.value === model.value) ?? options[0])

function select(value: T) {
	model.value = value
	open.value = false
}
</script>
