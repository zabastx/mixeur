<template>
	<MxAccordionRoot collapsible type="multiple" :default-value="['light']">
		<MxAccordionItem v-if="light" label="Light" :item="{ value: 'light' }">
			<div class="text-xs flex flex-col items-end gap-0.5 p-2">
				<FieldList
					:fields="getLightFields(light)"
					:target="lightTarget"
					:tooltips="lightTooltipMap"
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
				<FieldList
					:fields="lightShadowFields"
					:target="shadowTarget"
					:tooltips="lightShadowTooltipMap"
				/>
			</div>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import { createObjectTarget } from '@/shared/lib/field-descriptor'
import THREE from '@/shared/three'
import { lightHasShadow } from '@/shared/three/modules/light'
import { storeToRefs } from 'pinia'
import { computed, triggerRef } from 'vue'
import { getLightFields, lightShadowFields } from './fields'
import { lightShadowTooltipMap, lightTooltipMap } from './tooltips'

const selectionStore = useSelectionStore()
const { selectedObject } = storeToRefs(selectionStore)

const light = computed<THREE.Light | null>(() => {
	if (selectedObject.value) {
		const obj = selectedObject.value as THREE.Light
		return obj
	}
	return null
})

// Both targets resolve the selection on every access, so switching lights needs
// no remount to clear the previous one's values.
const lightTarget = createObjectTarget(light)
const shadowTarget = createObjectTarget<THREE.LightShadow>(() =>
	light.value && lightHasShadow(light.value) ? light.value.shadow : null
)

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
