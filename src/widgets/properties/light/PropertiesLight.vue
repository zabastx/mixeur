<template>
	<MxAccordionRoot :key collapsible type="multiple" :default-value="['light']">
		<MxAccordionItem v-if="light" label="Light" :item="{ value: 'light' }">
			<div class="text-xs flex flex-col items-end gap-0.5 p-2">
				<ObjectInputFields
					:fields-list="getLightFields(light)"
					:object="light"
					:tooltip-map="lightTooltipMap"
				/>
			</div>
		</MxAccordionItem>
		<MxAccordionItem
			v-if="light && lightHasShadow(light)"
			v-model="castShadow"
			:item="{ value: 'shadow' }"
			label="Shadow"
			class="w-full mt-1"
			show-checkbox
		>
			<div class="text-xs flex flex-col items-end gap-0.5 p-2">
				<ObjectInputFields
					:fields-list="lightShadowFields"
					:object="light.shadow"
					:tooltip-map="lightShadowTooltipMap"
				/>
			</div>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { lightHasShadow } from '@/shared/three/modules/light'
import { storeToRefs } from 'pinia'
import { computed, ref, triggerRef, watch } from 'vue'
import { getLightFields, lightShadowFields } from './fields'
import { lightShadowTooltipMap, lightTooltipMap } from './tooltips'

const selectionStore = useSelectionStore()
const { selectedObject } = storeToRefs(selectionStore)

const key = ref(0)

watch(selectedObject, () => key.value++)

const light = computed<THREE.Light | null>(() => {
	if (selectedObject.value) {
		const obj = selectedObject.value as THREE.Light
		return obj
	}
	return null
})

const castShadow = computed<boolean>({
	set(val) {
		if (!light.value) return
		light.value.castShadow = val
		triggerRef(light)
	},
	get() {
		return !!light.value?.castShadow
	}
})
</script>
