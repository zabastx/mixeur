<template>
	<MxAccordionRoot collapsible type="multiple" class="space-y-0.5" :default-value="['surface']">
		<MxAccordionItem label="Surface" :item="{ value: 'surface' }">
			<div class="p-1 flex flex-col gap-0.5 items-end">
				<InputField
					label="Surface"
					input-width="150px"
					class="mb-1"
					:tooltip="worldTooltipMap.get('surface')"
				>
					<InputSelect
						:model-value="world.surface.kind"
						:items="SURFACE_OPTIONS"
						@update:model-value="onSurfaceKind"
					/>
				</InputField>
				<InputField
					v-if="world.surface.kind === 'color'"
					label="Color"
					input-width="150px"
					:tooltip="worldTooltipMap.get('color')"
					data-testid="world-color"
				>
					<InputColor v-model:hex="world.surface.color" />
				</InputField>
				<InputField
					v-else
					label="Environment"
					input-width="150px"
					:tooltip="worldTooltipMap.get('preset')"
				>
					<WorldSurfacePreset :name="world.surface.source.name" @select="world.setPreset" />
				</InputField>
				<InputField label="Strength" input-width="150px" :tooltip="worldTooltipMap.get('strength')">
					<InputNumber v-model="world.strength" :min="0" :step="0.01" />
				</InputField>
				<template v-if="world.surface.kind === 'texture'">
					<InputField
						label="Blurriness"
						input-width="150px"
						:tooltip="worldTooltipMap.get('blurriness')"
					>
						<InputNumber v-model="world.blurriness" :min="0" :max="MAX_BLURRINESS" :step="0.005" />
					</InputField>
					<InputField
						label="Rotation"
						input-width="150px"
						class="mt-1"
						:tooltip="worldTooltipMap.get('rotation')"
					>
						<InputEuler v-model="world.rotation" :min="-180" :max="180" />
					</InputField>
				</template>
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
import {
	FOG_KINDS,
	isWorldFogKind,
	isWorldSurfaceKind,
	SURFACE_KINDS
} from '@/app/model/types/world'
import WorldSurfacePreset from './WorldSurfacePreset.vue'
import { worldTooltipMap } from './tooltips'

const world = useWorldStore()

function onSurfaceKind(val: string | undefined) {
	if (!val || !isWorldSurfaceKind(val)) return
	world.setSurfaceKind(val)
}

function onFogKind(val: string | undefined) {
	if (!val || !isWorldFogKind(val)) return
	world.setFogKind(val)
}

/**
 * Three.js accepts blurriness up to 1, but the whole usable range is at the
 * bottom of it. Any value above zero makes the renderer swap the backdrop for a
 * PMREM version of itself (`WebGLBackground`), and that ladder is roughness
 * shaped: around 0.2 the sky is a flat wash indistinguishable from a colour
 * Surface, which is what a colour Surface is for. Capping here spends the
 * control's whole travel on values that still look like somewhere.
 */
const MAX_BLURRINESS = 0.2

const SURFACE_OPTIONS = Object.entries(SURFACE_KINDS).map(([value, { label }]) => ({
	label,
	value
}))

const FOG_OPTIONS = Object.entries(FOG_KINDS).map(([value, { label }]) => ({ label, value }))
</script>
