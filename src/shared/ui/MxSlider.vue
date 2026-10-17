<template>
	<SliderRoot
		v-model="model"
		class="w-full h-5 block relative border-ui-slider-outline"
		:class="{ 'not-last:border-b': group }"
		v-bind="$props.root"
	>
		<SliderTrack class="h-full bg-ui-slider-inner block" v-bind="$props.track">
			<SliderRange class="bg-ui-slider-item absolute h-full" v-bind="$props.range" />
			<slot></slot>
		</SliderTrack>
		<SliderThumb v-for="(_, index) in model" :key="index" v-bind="$props.thumb" />
	</SliderRoot>
</template>

<script lang="ts" setup>
import type { SliderRangeProps, SliderRootProps, SliderThumbProps, SliderTrackProps } from 'reka-ui'

defineProps<{
	root?: SliderRootProps
	track?: SliderTrackProps
	range?: SliderRangeProps
	thumb?: SliderThumbProps
	group?: boolean
}>()

const model = defineModel<number[]>({ required: true })
</script>
