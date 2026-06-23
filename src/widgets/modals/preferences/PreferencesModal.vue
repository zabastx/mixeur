<template>
	<MxDialog
		v-model="isOpen"
		title="Preferences"
		class="w-5xl h-2/3 text-ui-text-text block-border bg-window-bg flex flex-col"
		resize
		:root="{
			modal: false
		}"
		outside-interaction
		icon="misc/preferences"
	>
		<Tabs.Root
			v-model="section"
			class="grid grid-cols-[200px_1fr] gap-2 p-2 overflow-hidden"
			orientation="vertical"
			data-testid="modal-preferences"
		>
			<Tabs.List class="relative text-sm space-y-1">
				<div
					v-for="group in PREFERENCES_GROUPS"
					:key="group.key"
					class="flex flex-col rounded overflow-hidden *:not-last:border-b-[0.5px]
						*:border-ui-radio-outline"
				>
					<Tabs.Trigger
						v-for="item in group.items"
						:key="item.value"
						:value="item.value"
						class="bg-ui-radio-inner data-[state='active']:bg-ui-radio-inner-selected
							data-[state='active']:text-ui-radio-text-selected p-0.5
							data-[state='inactive']:hover:brightness-125"
					>
						{{ item.label }}
					</Tabs.Trigger>
				</div>
			</Tabs.List>
			<ScrollContainer class="pr-3 -mr-1.5">
				<Tabs.Content v-for="item in componentList" :key="item.value" :value="item.value">
					<component :is="item.component" />
				</Tabs.Content>
			</ScrollContainer>
		</Tabs.Root>
	</MxDialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import PreferencesThemes from './sections/PreferencesThemes.vue'
import { Tabs } from 'reka-ui/namespaced'

const isOpen = defineModel<boolean>({ default: false })

const section = ref('themes')

const PREFERENCES_GROUPS = [
	{
		key: 'group_1',
		items: [
			{
				value: 'themes',
				label: 'Themes',
				component: PreferencesThemes
			}
		]
	}
] as const

const componentList = computed(() => PREFERENCES_GROUPS.flatMap((group) => group.items))
</script>
