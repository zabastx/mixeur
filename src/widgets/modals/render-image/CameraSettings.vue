<template>
	<div class="flex flex-col gap-1 p-2">
		<InputField label="Camera" label-width="125px">
			<InputSelect
				:items="renderCameraOptions"
				:model-value="renderCamera?.uuid"
				@update:model-value="onCameraChange"
			/>
		</InputField>
		<template v-if="renderCamera">
			<InputField v-if="'fov' in renderCamera" label="FOV" label-width="125px">
				<InputNumber
					:model-value="getValue('number', 'fov')"
					:format-options="{ unit: 'degree', unitDisplay: 'narrow', style: 'unit' }"
					:max="180"
					:min="1"
					@update:model-value="setLens('fov', $event)"
				/>
			</InputField>
			<InputField label="Clip Start" label-width="125px">
				<InputNumber
					:model-value="getValue('number', 'near')"
					:step="1"
					:format-options="{ minimumFractionDigits: 1 }"
					@update:model-value="setLens('near', $event)"
				/>
			</InputField>
			<InputField label="Clip End" label-width="125px">
				<InputNumber
					:model-value="getValue('number', 'far')"
					:step="1"
					:format-options="{ minimumFractionDigits: 1 }"
					@update:model-value="setLens('far', $event)"
				/>
			</InputField>
			<InputField label="Zoom" label-width="125px">
				<InputNumber
					:model-value="getValue('number', 'zoom')"
					:step="0.1"
					:format-options="{ minimumFractionDigits: 2 }"
					@update:model-value="setLens('zoom', $event)"
				/>
			</InputField>
		</template>
	</div>
</template>

<script lang="ts" setup>
import { useCameraStore } from '@/app/model/camera'
import { createObjectTarget, useFields, type ObjectProp } from '@/shared/lib/field-descriptor'
import type THREE from '@/shared/three'
import { computed } from 'vue'

const cameraStore = useCameraStore()

const renderCamera = computed(() => {
	return cameraStore.renderCamera as THREE.PerspectiveCamera | THREE.OrthographicCamera | null
})

/** What the panel edits: a perspective camera's lens, with `fov` absent on an orthographic one. */
type CameraLens = Partial<Pick<THREE.PerspectiveCamera, 'fov'>> &
	Pick<THREE.PerspectiveCamera, 'near' | 'far' | 'zoom' | 'updateProjectionMatrix'>

// Resolved on every access, so the fields follow the Render Camera as the
// dropdown changes it. The projection is rebuilt on each write, so a viewport
// looking through the camera shows the edit without waiting for a resize.
const { getValue, setValue } = useFields(
	createObjectTarget<CameraLens>(renderCamera, {
		afterWrite: (camera) => camera.updateProjectionMatrix()
	})
)

/** A cleared field emits `undefined`, which would leave the projection NaN; keep the old value. */
function setLens(prop: ObjectProp<CameraLens>, value: number | undefined) {
	if (value === undefined) return
	setValue('number', prop, value)
}

const renderCameraOptions = computed(() =>
	cameraStore.renderCameraList.map((cam) => ({
		value: cam.uuid,
		label: cam.name
	}))
)

function onCameraChange(uuid?: string) {
	if (!uuid) return
	cameraStore.setRenderCamera(uuid)
}
</script>
