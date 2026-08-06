<template>
	<div v-if="store.selectedObject" class="flex flex-col items-end gap-0.5">
		<InputField label="Location X">
			<InputNumber v-model="positionX" :step="0.01" />
		</InputField>
		<InputField label="Y">
			<InputNumber v-model="positionY" :step="0.01" />
		</InputField>
		<InputField label="Z">
			<InputNumber v-model="positionZ" :step="0.01" />
		</InputField>
	</div>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const store = useSelectionStore()

const { selectedObject } = storeToRefs(store)

const positionX = computed({
	set(val: number) {
		if (!selectedObject.value) return
		selectedObject.value.position.x = val
		store.refresh()
	},
	get() {
		return selectedObject.value?.position.x
	}
})

const positionY = computed({
	set(val: number) {
		if (!selectedObject.value) return
		selectedObject.value.position.y = val
		store.refresh()
	},
	get() {
		return selectedObject.value?.position.y
	}
})

const positionZ = computed({
	set(val: number) {
		if (!selectedObject.value) return
		selectedObject.value.position.z = val
		store.refresh()
	},
	get() {
		return selectedObject.value?.position.z
	}
})
</script>
