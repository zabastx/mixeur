<template>
	<span v-if="tooltip?.title">{{ tooltip.title }}</span>
	<p v-if="tooltip?.text" class="whitespace-pre-line">{{ tooltip.text }}</p>
	<span v-if="tooltip?.footer" class="text-[0.9em] opacity-50">{{ tooltip.footer }}</span>
</template>

<script lang="ts" setup>
import type { MxTooltipContent } from '@/shared/lib/types'

defineProps<{
	tooltip?: MxTooltipContent
}>()
</script>
