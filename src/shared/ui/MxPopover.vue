<template>
	<Popover.Root v-bind="root" @update:open="$emit('update:open', $event)">
		<Popover.Trigger v-bind="trigger" as-child>
			<slot name="trigger"></slot>
		</Popover.Trigger>
		<Popover.Portal v-bind="portal">
			<Popover.Content
				v-bind="content"
				avoid-collisions
				position-strategy="absolute"
				class="bg-ui-menu-bg-inner rounded z-3000 text-ui-menu-bg-text"
				:class="contentClass ?? 'p-2 text-sm'"
				@open-auto-focus.prevent
			>
				<slot name="content"></slot>
				<Popover.Arrow v-if="showArrow" class="fill-ui-menu-bg-inner" v-bind="arrow" />
			</Popover.Content>
		</Popover.Portal>
	</Popover.Root>
</template>

<script lang="ts" setup>
import type {
	PopoverArrowProps,
	PopoverContentProps,
	PopoverPortalProps,
	PopoverRootEmits,
	PopoverRootProps,
	PopoverTriggerProps
} from 'reka-ui'
import { Popover } from 'reka-ui/namespaced'

defineProps<{
	root?: PopoverRootProps
	trigger?: PopoverTriggerProps
	portal?: PopoverPortalProps
	content?: PopoverContentProps
	arrow?: PopoverArrowProps
	showArrow?: boolean
	/**
	 * Replaces the content box's padding and text size — the rest of the chrome
	 * stays. Set it when the popover holds a menu rather than a settings panel:
	 * the two want different metrics, and appending to the defaults would leave
	 * two paddings fighting over which one Tailwind emits last.
	 */
	contentClass?: string
}>()

defineEmits<PopoverRootEmits>()
</script>
