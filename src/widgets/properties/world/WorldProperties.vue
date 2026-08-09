<template>
	<MxAccordionRoot collapsible type="multiple" class="space-y-0.5" :default-value="['surface']">
		<MxAccordionItem label="Surface" :item="{ value: 'surface' }">
			<div class="p-1 flex flex-col gap-0.5 items-end">
				<InputField
					label="Surface"
					input-width="150px"
					class="mb-1"
					:tooltip="worldTooltipMap.get('surface')"
					disabled
				>
					<InputSelect
						:model-value="world.surface.kind"
						:items="SURFACE_OPTIONS"
						:root="{ disabled: true }"
					/>
				</InputField>
				<InputField
					label="Color"
					input-width="150px"
					:tooltip="worldTooltipMap.get('color')"
					data-testid="world-color"
				>
					<InputColor v-model:hex="world.surface.color" />
				</InputField>
				<InputField label="Strength" input-width="150px" :tooltip="worldTooltipMap.get('strength')">
					<InputNumber v-model="world.strength" :min="0" :step="0.01" />
				</InputField>
			</div>
		</MxAccordionItem>
		<MxAccordionItem label="Fog" :item="{ value: 'fog' }">
			<div class="p-1 flex flex-col gap-0.5 items-end">
				<InputField
					label="Type"
					input-width="150px"
					class="mb-1"
					:tooltip="worldTooltipMap.get('fog')"
				>
					<InputSelect
						:model-value="world.fog.kind"
						:items="FOG_OPTIONS"
						@update:model-value="onFogKind"
					/>
				</InputField>
				<template v-if="world.fog.kind !== 'none'">
					<InputField label="Color" input-width="150px" :tooltip="worldTooltipMap.get('fog-color')">
						<InputColor v-model:hex="world.fog.color" />
					</InputField>
					<template v-if="world.fog.kind === 'linear'">
						<InputField
							label="Start"
							input-width="150px"
							:tooltip="worldTooltipMap.get('fog-near')"
						>
							<InputNumber v-model="world.fog.near" :min="0" />
						</InputField>
						<InputField label="End" input-width="150px" :tooltip="worldTooltipMap.get('fog-far')">
							<InputNumber v-model="world.fog.far" :min="0" />
						</InputField>
					</template>
					<InputField
						v-else
						label="Density"
						input-width="150px"
						:tooltip="worldTooltipMap.get('fog-density')"
					>
						<InputNumber v-model="world.fog.density" :min="0" :step="0.001" />
					</InputField>
				</template>
			</div>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import { useWorldStore } from '@/app/model/world'
import { FOG_KINDS, isWorldFogKind } from '@/app/model/types/world'
import { worldTooltipMap } from './tooltips'

const world = useWorldStore()

function onFogKind(val: string | undefined) {
	if (!val || !isWorldFogKind(val)) return
	world.setFogKind(val)
}

// Colour is the only Surface a World can have so far, so the control is shown
// disabled rather than hidden: the choice is the shape of the panel, and an
// empty dropdown that appears later reads as a different panel. The tooltip
// says why it cannot be opened.
const SURFACE_OPTIONS = [{ label: 'Color', value: 'color' }] as const

const FOG_OPTIONS = Object.entries(FOG_KINDS).map(([value, { label }]) => ({ label, value }))
</script>
