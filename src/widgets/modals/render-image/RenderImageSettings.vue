<template>
	<div class="flex flex-col gap-1 p-2">
		<InputField label="Preset" label-width="125px">
			<InputSelect v-model="settings.preset" :items="resolutionOptions" />
		</InputField>

		<template v-if="settings.preset === 'custom'">
			<InputField label="Width" label-width="125px">
				<InputNumber
					v-model="model.width"
					:min="100"
					:max="8192"
					:format-options="{ maximumFractionDigits: 0, useGrouping: false }"
				/>
			</InputField>
			<InputField label="Height" label-width="125px">
				<InputNumber
					v-model="model.height"
					:min="100"
					:max="8192"
					:format-options="{ maximumFractionDigits: 0, useGrouping: false }"
				/>
			</InputField>
		</template>

		<InputField label="Format" label-width="125px">
			<InputSelect v-model="model.selectedFormat" :items="FORMAT_PRESETS" />
		</InputField>

		<InputField v-if="model.selectedFormat !== 'png'" label="Quality" label-width="125px">
			<InputNumber
				v-model="model.quality"
				:min="0"
				:max="100"
				:format-options="{ maximumFractionDigits: 0 }"
			/>
		</InputField>
		<InputField
			v-if="model.selectedFormat !== 'jpeg'"
			label="Background"
			label-width="125px"
			:tooltip="{
				text: `Render the world behind the scene. Turn it off for a transparent image`,
				footer: 'The world itself is set in World properties'
			}"
		>
			<InputCheckbox v-model="model.background" />
		</InputField>
	</div>
</template>

<script lang="ts" setup>
import { reactive, watch } from 'vue'

const RESOLUTION_PRESETS = [
	{ value: '480p', label: '480p (854x480)', width: 854, height: 480 },
	{ value: '720p', label: '720p (1280x720)', width: 1280, height: 720 },
	{ value: '1080p', label: '1080p (1920x1080)', width: 1920, height: 1080 },
	{ value: '1440p', label: '1440p (2560x1440)', width: 2560, height: 1440 },
	{ value: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 },
	{ value: 'custom', label: 'Custom' }
] as const

const resolutionOptions = RESOLUTION_PRESETS.map(({ label, value }) => ({ label, value }))

const FORMAT_PRESETS = [
	{ value: 'png', label: 'PNG' },
	{ value: 'jpeg', label: 'JPEG' },
	{ value: 'webp', label: 'WebP' }
] as const

type RenderPreset = (typeof RESOLUTION_PRESETS)[number]
type FormatPreset = (typeof FORMAT_PRESETS)[number]

const model = defineModel<RenderSettings>({ required: true })

const settings = reactive<{
	preset: RenderPreset['value']
}>({
	preset: '1080p'
})

watch(
	() => settings.preset,
	(newPreset) => {
		const data = RESOLUTION_PRESETS.find(({ value }) => value === newPreset)
		if (!data) return
		if (data.value !== 'custom') {
			const { width, height } = data
			model.value.width = width
			model.value.height = height
		}
	},
	{ immediate: true }
)

watch(
	() => model.value.selectedFormat,
	(val) => {
		if (val === 'jpeg') model.value.background = true
	}
)

export interface RenderSettings {
	width: number
	height: number
	selectedFormat: FormatPreset['value']
	quality: number
	/**
	 * Whether the World is drawn behind the render. Off gives a transparent
	 * image; what the background *is* belongs to the World, not to one render.
	 */
	background: boolean
}
</script>
