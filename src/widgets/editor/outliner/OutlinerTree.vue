<template>
	<TreeRoot
		v-model="model"
		v-model:expanded="expandedRef"
		:items
		:get-key="getItemKey"
		selection-behavior="replace"
	>
		<OutlinerTreeVirtualizer
			v-slot="{ item }"
			:text-content="getItemTextContent"
			:estimate-size="24"
		>
			<MxContextMenu :items="contextMenuItems" @update:open="onToggleContext($event, item._id)">
				<TreeItem
					v-slot="{ isExpanded, isSelected, handleToggle }"
					v-bind="item.bind"
					class="w-full"
					@toggle.prevent
				>
					<div
						class="relative flex items-center gap-1 pr-5 hover:bg-outliner-active-highlight group
							w-full h-6"
						data-testid="outliner-item"
						:data-uuid="item.value.uuid"
						:data-selected="isSelected"
						:style="{ paddingLeft: `${item.level * 1.25}rem` }"
						:class="{
							'bg-outliner-active-highlight text-outliner-active-object': isSelected
						}"
					>
						<button
							v-if="item.hasChildren"
							type="button"
							data-toggle
							class="text-base inline-flex items-center justify-center cursor-pointer
								hover:brightness-125 size-4"
							@click.stop="handleToggle"
						>
							<MxIcon :name="isExpanded ? 'ui/arrow-down' : 'ui/arrow-right'" />
						</button>
						<MxIcon
							:name="
								item.value.isCamera
									? 'outliner/camera-obj'
									: outlinerIconsMap.get(item.value.type) || 'outliner/empty'
							"
							class="shrink-0 text-icon-object text-base"
						/>
						<span class="truncate text-sm">{{ item.value.name }}</span>
						<button
							v-if="item.value.isCamera"
							type="button"
							class="p-0.5 hover:brightness-125 rounded border-ui-radio-outline cursor-pointer ml-5"
							:class="{
								'border bg-ui-radio-inner': renderCameraId === item.value.uuid
							}"
							@click.stop="$emit('setActiveCamera', item.value.uuid)"
						>
							<MxIcon name="outliner/camera" class="shrink-0 text-icon-object-data text-base" />
						</button>
						<div class="contents" @click.stop>
							<CheckboxRoot
								:model-value="item.value.userData.userVisible"
								class="ml-auto"
								data-testid="visibility-toggle"
								@update:model-value="sceneStore.objectVisibilityUpdate(item.value.uuid, !!$event)"
							>
								<MxIcon
									class="cursor-pointer"
									:name="
										item.value.userData.userVisible
											? 'outliner/visibility-visible'
											: 'outliner/visibility-hidden'
									"
								/>
							</CheckboxRoot>
						</div>
					</div>
				</TreeItem>
			</MxContextMenu>
		</OutlinerTreeVirtualizer>
	</TreeRoot>
</template>

<script lang="ts" setup>
import { useSceneStore } from '@/app/model/scene'
import { outlinerIconsMap } from './icons-map'
import { computed, ref } from 'vue'
import type { MxContextMenuItem } from '@/shared/ui/MxContextMenu.vue'
import type { OutlinerItem } from './types'

const sceneStore = useSceneStore()

const expandedRef = ref()

defineProps<{
	items: OutlinerItem[]
	renderCameraId?: string
}>()

defineEmits<{
	setActiveCamera: [uuid: string]
}>()

const model = defineModel<OutlinerItem>()

const currentContextTarget = ref<string | null>(null)

function getItemKey(item: OutlinerItem) {
	return item.uuid
}

function getItemTextContent(item: OutlinerItem) {
	return item.name
}

function onToggleContext(val: boolean, uuid: string) {
	if (!val) return (currentContextTarget.value = null)
	currentContextTarget.value = uuid
}

const groupOptions = computed<MxContextMenuItem[]>(() => {
	if (!currentContextTarget.value) return []
	const uuid = currentContextTarget.value
	const items: MxContextMenuItem[] = sceneStore.sceneGroups.map((group) => ({
		type: 'item',
		key: group.uuid,
		label: group.name,
		onSelect() {
			sceneStore.moveObjectToTarget(uuid, group.uuid)
		}
	}))

	return items
})

const contextMenuItems = computed<MxContextMenuItem[]>(() => {
	if (!currentContextTarget.value) return []
	const uuid = currentContextTarget.value
	const items: MxContextMenuItem[] = [
		{
			key: 'movetogroup',
			label: 'Move to',
			submenu: [
				{
					key: 'sceneroot',
					label: 'Scene',
					icon: 'ui/collection',
					onSelect() {
						sceneStore.moveObjectToTarget(uuid, sceneStore.scene.uuid)
					}
				},
				{
					key: 'newgroup',
					label: 'New Group',
					icon: 'outliner/group-new',
					onSelect() {
						const group = sceneStore.addGroup()
						sceneStore.moveObjectToTarget(uuid, group.uuid)
					}
				},
				...groupOptions.value
			]
		},
		{
			key: 'duplicate',
			label: 'Duplicate Object',
			shortcut: 'Shift + D',
			onSelect() {
				sceneStore.cloneObject(uuid)
			}
		},
		{
			key: 'tojson',
			label: 'Save to JSON',
			onSelect() {
				sceneStore.objectToJSON(uuid)
			}
		},
		{
			key: 'delete',
			label: 'Delete',
			shortcut: 'Del',
			onSelect() {
				sceneStore.deleteFromScene(uuid)
			}
		}
	]
	return items
})
</script>
