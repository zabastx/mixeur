<template>
	<MxAccordionRoot collapsible type="multiple" :default-value="['text']">
		<MxAccordionItem label="Text" :item="{ value: 'text' }">
			<div class="flex flex-col items-end gap-1 text-xs p-1 pr-2">
				<InputField label="Text">
					<input v-model="textData.text" type="text" class="input w-[150px]" />
				</InputField>
				<InputField label="Font">
					<InputSelect
						v-model="textData.font"
						class="w-[150px]"
						:items="defaultFontsList"
						placeholder="Select font"
					/>
				</InputField>
				<InputField label="Size">
					<InputNumber v-model="textData.size" :step="0.1" class="w-[150px]" />
				</InputField>
				<InputField label="Depth">
					<InputNumber v-model="textData.depth" :step="0.1" class="w-[150px]" />
				</InputField>
				<InputField label="Bevel enabled">
					<div class="w-[150px]">
						<InputCheckbox v-model="textData.bevelEnabled" />
					</div>
				</InputField>
				<template v-if="textData.bevelEnabled">
					<InputField label="Bevel size">
						<InputNumber v-model="textData.bevelSize" class="w-[150px]" :step="0.1" />
					</InputField>
					<InputField label="Bevel thickness">
						<InputNumber v-model="textData.bevelThickness" class="w-[150px]" :step="0.1" />
					</InputField>
					<InputField label="Bevel offset">
						<InputNumber v-model="textData.bevelOffset" class="w-[150px]" :step="0.1" />
					</InputField>
					<InputField label="Bevel segments">
						<InputNumber
							v-model="textData.bevelSegments"
							class="w-[150px]"
							:format-options="{ maximumFractionDigits: 0 }"
						/>
					</InputField>
				</template>
				<button type="button" class="btn text-sm" @click="onApply">Apply</button>
			</div>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { defaultFontsList, loadFont } from '@/shared/three/modules/loaders/font'
import { createTextGeometry } from '@/shared/three/modules/text'
import { enableBVH, getUserData } from '@/shared/three/utils'
import { TextGeometry } from 'three/examples/jsm/Addons.js'
import { reactive, watch } from 'vue'

const store = useSelectionStore()

const textData = reactive({
	text: '',
	font: undefined as string | undefined,
	depth: 1,
	size: 2,
	bevelEnabled: false,
	bevelSize: 8,
	bevelThickness: 10,
	bevelOffset: 0,
	bevelSegments: 3
})

// The properties panel keys its tab content by tab value, so this panel is not
// remounted when the selection changes — the draft has to be resynced by hand.
watch(() => store.selectedObject, setCurrentTextData, { immediate: true })

async function onApply() {
	if (!textData.text || !textData.font) return
	const obj = store.selectedObject
	if (obj && obj instanceof THREE.Mesh && obj.geometry instanceof TextGeometry) {
		const font = await loadFont(textData.font)
		if (!font) return

		obj.geometry.dispose()

		const newGeometry = createTextGeometry({
			text: textData.text,
			params: {
				font,
				size: textData.size,
				depth: textData.depth,
				bevelEnabled: textData.bevelEnabled,
				bevelOffset: textData.bevelOffset,
				bevelSegments: textData.bevelSegments,
				bevelSize: textData.bevelSize,
				bevelThickness: textData.bevelThickness
			}
		})

		obj.geometry = newGeometry

		getUserData(obj).text = {
			textValue: textData.text,
			parameters: newGeometry.parameters
		}

		enableBVH(obj)
	}
}

function getCurrentTextData() {
	const obj = store.selectedObject
	if (obj && obj instanceof THREE.Mesh && obj.geometry instanceof TextGeometry) {
		const options = obj.geometry.parameters.options
		const font = defaultFontsList.find(
			(item) =>
				item.value === options.font.data.original_font_information.postscript_name?.toLowerCase()
		)
		const { bevelThickness, bevelSize, bevelEnabled, depth, size, bevelOffset, bevelSegments } =
			options
		return {
			text: getUserData(obj).text?.textValue,
			font,
			geometry: { bevelEnabled, bevelSize, bevelThickness, depth, size, bevelOffset, bevelSegments }
		}
	}
	return null
}

function setCurrentTextData() {
	const data = getCurrentTextData()
	if (!data) return
	textData.text = data.text ?? ''
	textData.font = data.font?.value
	textData.depth = data.geometry.depth ?? 1
	textData.size = data.geometry.size ?? 2
	textData.bevelEnabled = data.geometry.bevelEnabled ?? false
	textData.bevelSize = data.geometry.bevelSize ?? 8
	textData.bevelThickness = data.geometry.bevelThickness ?? 10
	textData.bevelOffset = data.geometry.bevelOffset ?? 0
	textData.bevelSegments = data.geometry.bevelSegments ?? 3
}
</script>
