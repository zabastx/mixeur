<template>
	<div class="text-xs bg-viewport-header-bg p-1">
		<InputField label="Orientation:" :tooltip="{ text: 'Transform controls orientation' }">
			<InputSelect v-model="orientation" :items="orientationOptions" />
		</InputField>
	</div>
</template>

<script lang="ts" setup>
import { useControlsStore } from '@/app/model/controls'
import type { InputSelectOption } from '@/shared/lib/types'
import { storeToRefs } from 'pinia'
import type { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { computed, triggerRef } from 'vue'

const { transformControls } = storeToRefs(useControlsStore())

const orientation = computed<TransformControls['space']>({
	set(val) {
		transformControls.value?.setSpace(val)
		triggerRef(transformControls)
	},
	get() {
		return transformControls.value?.space ?? 'world'
	}
})

const orientationOptions: InputSelectOption<TransformControls['space']>[] = [
	{
		value: 'world',
		label: 'World',
		icon: 'toolbar/space-world'
	},
	{
		value: 'local',
		label: 'Local',
		icon: 'toolbar/space-local'
	}
]
</script>
