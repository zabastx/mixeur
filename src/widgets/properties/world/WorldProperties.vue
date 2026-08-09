<template>
	<MxAccordionRoot collapsible type="multiple" class="space-y-0.5" :default-value="['surface']">
		<MxAccordionItem label="Surface" :item="{ value: 'surface' }">
			<div class="p-1 flex flex-col gap-0.5 items-end">
				<InputField
					label="Surface"
					input-width="150px"
					class="mb-1"
					:tooltip="worldTooltipMap.get('surface')"
					data-testid="world-surface"
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
				<template v-else>
					<InputField
						label="Source"
						input-width="150px"
						:tooltip="worldTooltipMap.get('source')"
						data-testid="world-source"
					>
						<InputSelect
							:model-value="world.surface.source.kind"
							:items="SOURCE_OPTIONS"
							@update:model-value="onSourceKind"
						/>
					</InputField>
					<InputField
						v-if="world.surface.source.kind === 'preset'"
						label="Preset"
						input-width="150px"
						:tooltip="worldTooltipMap.get('preset')"
						data-testid="world-preset"
					>
						<StudioImagePicker
							:name="world.surface.source.name"
							:alt="`${world.surface.source.name} world preset`"
							tooltip-footer="World preset"
							@select="onPreset"
						/>
					</InputField>
					<InputField
						v-else
						label="Image"
						input-width="150px"
						:tooltip="worldTooltipMap.get('hdri')"
						data-testid="world-hdri"
					>
						<button
							type="button"
							class="btn w-full grid grid-cols-[1fr_auto] gap-1 text-left"
							@click="browseHDRIs"
						>
							<span class="truncate" :title="world.surface.source.name">
								{{ world.surface.source.name }}
							</span>
							<span class="opacity-60">{{ world.surface.source.resolution }}</span>
						</button>
					</InputField>
				</template>
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
	DEFAULT_PRESET,
	FOG_KINDS,
	isWorldFogKind,
	isWorldSourceKind,
	isWorldSurfaceKind,
	MAX_BLURRINESS,
	SOURCE_KINDS,
	SURFACE_KINDS,
	type StudioLightName
} from '@/app/model/types/world'
import { isHDRISelection } from '@/widgets/modals/asset-browser/hdri'
import { useModals } from '@/shared/lib/modals'
import { worldTooltipMap } from './tooltips'

const world = useWorldStore()

function onSurfaceKind(val: string | undefined) {
	if (!val || !isWorldSurfaceKind(val)) return
	world.setSurfaceKind(val)
}

/**
 * Switching Source.
 *
 * A preset has a default to fall back on; a Poly Haven World does not, so
 * choosing it opens the browser and the Surface changes only once something
 * comes back. The select reads from the Surface, so cancelling the browser
 * leaves it showing the Source that is really in effect — no state to unwind.
 */
function onSourceKind(val: string | undefined) {
	if (!val || !isWorldSourceKind(val)) return
	if (val === 'preset') return onPreset(DEFAULT_PRESET)
	browseHDRIs()
}

function onPreset(name: StudioLightName) {
	world.setSource({ kind: 'preset', name })
}

const { open: openModal } = useModals()

function browseHDRIs() {
	openModal('hdriLibrary', (selection) => {
		if (!isHDRISelection(selection)) return
		world.setSource({ kind: 'polyhaven', ...selection })
	})
}

function onFogKind(val: string | undefined) {
	if (!val || !isWorldFogKind(val)) return
	world.setFogKind(val)
}

const SURFACE_OPTIONS = Object.entries(SURFACE_KINDS).map(([value, { label }]) => ({
	label,
	value
}))

const SOURCE_OPTIONS = Object.entries(SOURCE_KINDS).map(([value, { label }]) => ({ label, value }))

const FOG_OPTIONS = Object.entries(FOG_KINDS).map(([value, { label }]) => ({ label, value }))
</script>
