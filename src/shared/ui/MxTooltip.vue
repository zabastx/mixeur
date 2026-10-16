<template>
	<TooltipRoot :disabled="tooltipDisabled">
		<TooltipTrigger as-child v-bind="options?.trigger">
			<slot name="default"></slot>
		</TooltipTrigger>
		<TooltipPortal>
			<TooltipContent
				align="start"
				v-bind="options?.content"
				class="flex max-w-xs flex-col gap-1 rounded border border-ui-tooltip-outline
					bg-ui-tooltip-inner p-2 text-tooltip text-ui-tooltip-text z-2000"
			>
				<slot name="content">
					<MxTooltipBody :tooltip />
				</slot>
			</TooltipContent>
		</TooltipPortal>
	</TooltipRoot>
</template>

<script lang="ts" setup>
import {
	TooltipContent,
	TooltipPortal,
	TooltipRoot,
	TooltipTrigger,
	type TooltipContentProps,
	type TooltipTriggerProps
} from 'reka-ui'
import type { MxTooltipContent } from '@/shared/lib/types'

defineProps<{
	tooltipDisabled?: boolean
	tooltip?: MxTooltipContent
	options?: {
		trigger?: TooltipTriggerProps
		content?: TooltipContentProps
	}
}>()
</script>
