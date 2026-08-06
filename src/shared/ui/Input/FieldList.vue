<template>
	<InputField
		v-for="field in fields"
		:key="field.prop"
		v-slot="{ id, disabled }"
		input-width="150px"
		label-width="auto"
		:label="field.label"
		:disabled="!isEnabled(field)"
		:tooltip="field.tooltip ?? tooltips?.get(field.prop)"
	>
		<InputColor
			v-if="field.type === 'color'"
			:disabled
			:hex="getValue(field.type, field.prop)"
			@update:hex="setValue(field.type, field.prop, $event)"
		/>
		<InputTexture
			v-else-if="field.type === 'map'"
			:disabled
			:model-value="getValue(field.type, field.prop)"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<InputTexture
			v-else-if="field.type === 'envMap'"
			:disabled
			is-env-map
			:model-value="getValue(field.type, field.prop)"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<InputNumber
			v-else-if="field.type === 'number' || field.type === 'angle'"
			:disabled
			:model-value="getValue(field.type, field.prop)"
			:min="field.min"
			:max="field.max"
			:step="field.step"
			:format-options="fieldFormatOptions(field.type, field.formatOptions)"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<InputVector2
			v-else-if="field.type === 'vector2'"
			:disabled
			:min="field.min"
			:max="field.max"
			:step="field.step"
			:model-value="getValue(field.type, field.prop)"
			:format-options="fieldFormatOptions(field.type, field.formatOptions)"
			@update:model-value="setValue(field.type, field.prop, $event as THREE.Vector2)"
		/>
		<InputEuler
			v-else-if="field.type === 'euler'"
			:disabled
			:model-value="getValue(field.type, field.prop)"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<InputCheckbox
			v-else-if="field.type === 'checkbox'"
			:id
			:disabled
			:model-value="getValue(field.type, field.prop)"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<InputSelect
			v-else-if="field.type === 'select'"
			:disabled
			:model-value="getValue(field.type, field.prop)"
			:items="field.options"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
		<MxSlider
			v-else-if="field.type === 'range'"
			:disabled
			:model-value="getValue(field.type, field.prop)"
			:root="{
				min: field.min,
				max: field.max,
				step: field.step
			}"
			@update:model-value="setValue(field.type, field.prop, $event)"
		/>
	</InputField>
</template>

<script lang="ts" setup generic="T">
import { fieldFormatOptions, useFields } from '@/shared/lib/field-descriptor'
import type { FieldDescriptor, FieldTarget } from '@/shared/lib/field-descriptor'
import type { MxTooltipContent } from '@/shared/lib/types'
import type THREE from '@/shared/three'

const props = defineProps<{
	fields: FieldDescriptor<T>[]
	target: FieldTarget<T>
	/** Fallback tooltips keyed by property name, used when a field declares none. */
	tooltips?: ReadonlyMap<string, MxTooltipContent>
}>()

const { getValue, setValue, isEnabled } = useFields<T>(() => props.target)
</script>
