<template>
	<div class="pl-1 py-1 pr-3 flex flex-col items-end gap-1">
		<MaterialInputFields :fields-list="surfaceFields" />
	</div>
	<MxAccordionRoot collapsible type="multiple">
		<MxAccordionItem
			v-for="group in fieldGroups"
			:key="group.value"
			:label="group.label"
			:item="{ value: group.value }"
			nested
		>
			<div class="pl-1 py-1 pr-3 flex flex-col items-end gap-1">
				<MaterialInputFields :fields-list="group.fields" />
			</div>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup generic="Mat extends THREE.Material">
import type THREE from '@/shared/three'
import type { FieldDescriptor, FieldGroup } from '@/shared/lib/field-descriptor'

defineProps<{
	/** Fields shown above the groups, without an accordion of their own. */
	surfaceFields: FieldDescriptor<Mat>[]
	fieldGroups: FieldGroup<Mat>[]
}>()
</script>
