<template>
	<div class="flex flex-col items-end gap-0.5">
		<InputField label="Scale X">
			<InputNumber v-model="scaleX" :step="0.01" />
		</InputField>
		<InputField label="Y">
			<InputNumber v-model="scaleY" :step="0.01" />
		</InputField>
		<InputField label="Z">
			<InputNumber v-model="scaleZ" :step="0.01" />
		</InputField>
	</div>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const store = useSelectionStore()
const { selectedObject } = storeToRefs(store)

const scaleX = computed({
	get() {
		return selectedObject.value?.scale.x
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.scale.x = value
		store.refresh()
	}
})

const scaleY = computed({
	get() {
		return selectedObject.value?.scale.y
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.scale.y = value
		store.refresh()
	}
})

const scaleZ = computed({
	get() {
		return selectedObject.value?.scale.z
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.scale.z = value
		store.refresh()
	}
})
</script>
