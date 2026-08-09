<!--
	The swatch's edge is drawn in the surrounding text colour rather than a theme
	outline token, because the swatch shows an arbitrary colour on an arbitrary
	background and any fixed token eventually matches one of them. `ui-menu-outline`
	is `#3d3d3d`, which is exactly the properties panel and exactly the World's
	default colour — a colour input holding either looked like an empty row.
	`currentColor` contrasts with whatever the panel is, in any theme.
-->
<template>
	<MxPopover>
		<template #trigger>
			<div
				class="inline-grid rounded grid-cols-2 grid-rows-1 w-full checkerboard h-full
					overflow-hidden border border-current/30"
				:style="{ '--color-value': displayColor, '--alpha': modelAlpha }"
			>
				<div class="bg-(--color-value)"></div>
				<div class="bg-(--color-value) opacity-(--alpha)"></div>
			</div>
		</template>
		<template #content>
			<ColorPicker v-model="modelHex" v-model:alpha="modelAlpha" :transparency />
		</template>
	</MxPopover>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

const { transparency } = defineProps<{
	transparency?: boolean
}>()

const modelHex = defineModel<string>('hex', { required: true })
const modelAlpha = defineModel<number>('alpha')

const displayColor = computed(() => {
	if (!transparency) return modelHex.value
	if (modelHex.value.length === 9) {
		return modelHex.value.slice(0, 7)
	}
	return modelHex.value
})
</script>
