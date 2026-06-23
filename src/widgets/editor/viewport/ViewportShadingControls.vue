<template>
	<div class="flex rounded overflow-hidden *:not-last:border-r">
		<MxTooltip
			v-for="btn in buttons"
			:key="btn.name"
			:options="{ content: { align: 'start', side: 'bottom', alignOffset: -10, sideOffset: 10 } }"
		>
			<button
				class="btn border-0 rounded-none"
				:class="{
					'bg-ui-radio-inner-selected': btn.name === shadingStore.shadingMode
				}"
				type="button"
				:data-testid="`shading-btn-${btn.name}`"
				:data-active="btn.name === shadingStore.shadingMode"
				@click="shadingStore.setMode(btn.name)"
			>
				<MxIcon :name="btn.icon" />
			</button>
			<template #content>
				<!-- eslint-disable vue/no-v-html -->
				<span v-html="btn.tooltip.title"></span>
				<!-- eslint-enable -->
				<p class="mt-1">Method to display/shade objects in the 3D View</p>
				<span class="text-[.9em] opacity-50">{{ btn.tooltip.footer }}</span>
			</template>
		</MxTooltip>
		<MxPopover :arrow="{ width: 20, height: 10 }" show-arrow>
			<template #trigger>
				<button
					type="button"
					:disabled="!settingsComponent"
					class="btn border-0 rounded-none text-xs bg-ui-menu-inner"
				>
					<MxIcon name="ui/arrow-down" />
				</button>
			</template>
			<template #content>
				<component :is="settingsComponent" />
			</template>
		</MxPopover>
	</div>
</template>

<script lang="ts" setup>
import type { ShadingMode } from '@/app/model/types/shading'
import { useShadingStore } from '@/app/model/shading'
import { computed, type Component } from 'vue'
import ShadingControlsSettingsPreview from './shading-controls/ShadingControlsSettingsPreview.vue'
import type { MxTooltipContent } from '@/shared/lib/types'

const shadingStore = useShadingStore()

const SETTINGS_COMPONENTS: Record<Exclude<ShadingMode, 'export'>, Component | null> = {
	wireframe: null,
	solid: null,
	preview: ShadingControlsSettingsPreview,
	rendered: null
} as const

const settingsComponent = computed(() => {
	if (shadingStore.shadingMode === 'export') return null
	return SETTINGS_COMPONENTS[shadingStore.shadingMode]
})

const buttons: ShadingControlsElement[] = [
	{
		name: 'wireframe',
		icon: 'shading/wireframe',
		tooltip: {
			title: 'Viewport Shading: <em>Wireframe</em>',
			footer: 'Display only edges of geometry without surface shading'
		}
	},
	{
		name: 'solid',
		icon: 'shading/solid',
		tooltip: {
			title: 'Viewport Shading: <em>Solid</em>',
			footer: 'Display objects with flat lighting and basic surface shading'
		}
	},
	{
		name: 'preview',
		icon: 'shading/preview',
		tooltip: {
			title: 'Viewport Shading: <em>Material Preview</em>',
			footer: 'Preview materials using predefined environment lights'
		}
	},
	{
		name: 'rendered',
		icon: 'shading/rendered',
		tooltip: {
			title: 'Viewport Shading: <em>Rendered</em>',
			footer: 'Preview the final scene using the active render engine'
		}
	}
] as const

interface ShadingControlsElement {
	name: ShadingMode
	icon: MxIconName
	tooltip: Partial<MxTooltipContent>
}
</script>

<style scoped>
@reference 'tailwindcss/theme';

:deep(em) {
	@apply text-[#4772B3] not-italic;
}
</style>
