<template>
	<CheckboxRoot
		v-bind="forwarded"
		class="size-5 rounded border border-ui-option-outline bg-ui-option-inner"
	>
		<CheckboxIndicator
			class="h-full text-xs w-full rounded flex items-center justify-center
				bg-ui-option-inner-selected"
		>
			<MxIcon name="ui/checkmark" />
		</CheckboxIndicator>
	</CheckboxRoot>
</template>

<script lang="ts" setup>
import { useForwardPropsEmits, type CheckboxRootEmits, type CheckboxRootProps } from 'reka-ui'

const props = defineProps<CheckboxRootProps>()
const emits = defineEmits<CheckboxRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>
