<template>
	<EditorWrapper title="Properties" icon="properties/properties" class="grid grid-rows-[auto_1fr]">
		<Tabs.Root
			v-model="activetab"
			class="grid w-full grow grid-cols-[min-content_1fr] grid-rows-1 overflow-hidden h-full"
			orientation="vertical"
			default-value="object"
		>
			<Tabs.List class="relative flex flex-col gap-0.5 bg-ui-tab-inner pt-1 pl-1">
				<MxTooltip v-for="item in tabs" :key="item.value" :tooltip="{ text: item.title }">
					<Tabs.Trigger
						:value="item.value"
						:data-testid="`properties-tab-${item.value}`"
						class="cursor-pointer rounded-l-sm p-1 text-lg hover:bg-ui-tab-inner-selected
							data-[state='active']:bg-ui-tab-inner-selected"
					>
						<MxIcon :name="item.icon" class="m-auto" />
					</Tabs.Trigger>
				</MxTooltip>
			</Tabs.List>
			<ScrollContainer>
				<Tabs.Content v-for="item in tabs" :key="item.value" :value="item.value" class="p-2 pr-3">
					<component :is="item.content" />
				</Tabs.Content>
			</ScrollContainer>
		</Tabs.Root>
	</EditorWrapper>
</template>

<script lang="ts" setup>
import ObjectProperties from './object/ObjectProperties.vue'
import { Tabs } from 'reka-ui/namespaced'
import { computed, ref, watch, type Component } from 'vue'
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'
import CameraProperties from './camera/CameraProperties.vue'
import MaterialProperties from './material/MaterialProperties.vue'
import { isThreeGeometry } from '@/shared/three/modules/mesh'
import PropertiesGeometry from './geometry/PropertiesGeometry.vue'
import TextDataProperties from './text/TextDataProperties.vue'
import PropertiesLight from './light/PropertiesLight.vue'
import WorldProperties from './world/WorldProperties.vue'

const store = useSelectionStore()

const activetab = ref('object')

watch(
	() => store.selectedObject,
	() => {
		const selected = tabs.value.find((item) => item.value === activetab.value)
		if (selected) return
		activetab.value = tabs.value[0]?.value || 'object'
	}
)

// Scene-level tabs: present whether or not anything is selected, and grouped
// ahead of the object's own tabs the way Blender orders them.
const DEFAULT_TABS: DataTabItem[] = [
	{
		icon: 'properties/camera-properties',
		value: 'viewport-camera',
		content: CameraProperties,
		title: 'Viewport Camera Properties'
	},
	{
		icon: 'properties/world',
		value: 'world',
		content: WorldProperties,
		title: 'World Properties'
	}
]

const tabs = computed<DataTabItem[]>(() => {
	const obj = store.selectedObject
	if (!obj) return DEFAULT_TABS
	const list: DataTabItem[] = [
		...DEFAULT_TABS,
		{
			icon: 'ui/object-data',
			value: 'object',
			content: ObjectProperties,
			title: 'Object Properties'
		}
	]
	if (obj instanceof THREE.Light) {
		list.push({
			icon: 'properties/light-properties',
			content: PropertiesLight,
			title: 'Light Properties',
			value: 'light'
		})
	}
	if (obj instanceof THREE.Mesh) {
		if (obj.geometry instanceof TextGeometry) {
			list.push({
				icon: 'properties/text-properties',
				value: 'textdata',
				content: TextDataProperties,
				title: 'Text Properties'
			})
		}

		if (isThreeGeometry(obj.geometry)) {
			list.push({
				icon: 'properties/geometry-properties',
				value: 'geometry',
				content: PropertiesGeometry,
				title: 'Geometry Properties'
			})
		}

		if ('material' in obj) {
			list.push({
				icon: 'ui/material-data',
				value: 'material',
				content: MaterialProperties,
				title: 'Material Properties'
			})
		}
	}
	return list
})

interface DataTabItem {
	icon: MxIconName
	value: string
	content: Component
	title: string
}
</script>
