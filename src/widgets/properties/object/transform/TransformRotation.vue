<template>
	<div v-if="store.selectedObject" class="flex flex-col items-end gap-0.5">
		<InputField label="Rotation X">
			<InputNumber v-model="rotationX" :format-options="formatOptions" />
		</InputField>
		<InputField label="Y">
			<InputNumber v-model="rotationY" :format-options="formatOptions" />
		</InputField>
		<InputField label="Z">
			<InputNumber v-model="rotationZ" :format-options="formatOptions" />
		</InputField>
	</div>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import type { NumberFieldRootProps } from 'reka-ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

const store = useSelectionStore()
const { selectedObject } = storeToRefs(store)

const rotationX = computed({
	get() {
		if (!selectedObject.value) return 0
		return THREE.MathUtils.radToDeg(selectedObject.value.rotation.x)
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.rotation.x = THREE.MathUtils.degToRad(value)
		store.refresh()
	}
})

const rotationY = computed({
	get() {
		if (!selectedObject.value) return 0
		return THREE.MathUtils.radToDeg(selectedObject.value.rotation.y)
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.rotation.y = THREE.MathUtils.degToRad(value)
		store.refresh()
	}
})

const rotationZ = computed({
	get() {
		if (!selectedObject.value) return 0
		return THREE.MathUtils.radToDeg(selectedObject.value.rotation.z)
	},
	set(value: number) {
		if (!selectedObject.value) return
		selectedObject.value.rotation.z = THREE.MathUtils.degToRad(value)
		store.refresh()
	}
})

const formatOptions: NumberFieldRootProps['formatOptions'] = {
	style: 'unit',
	unitDisplay: 'narrow',
	unit: 'degree'
}
</script>
