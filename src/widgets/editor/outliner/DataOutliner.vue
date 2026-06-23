<template>
	<EditorWrapper
		title="Outliner"
		icon="outliner/outliner"
		class="alternate-rows grid grid-rows-[auto_1fr]"
	>
		<template #header>
			<h2 class="flex items-center gap-1 px-1 text-base">
				<MxIcon name="outliner/outliner" /> Outliner
				<MxTooltip :tooltip="{ text: 'Add Group' }">
					<button
						class="btn ml-auto"
						type="button"
						data-testid="outliner-add-group"
						@click="sceneStore.addGroup"
					>
						<MxIcon name="outliner/group-new" />
					</button>
				</MxTooltip>
			</h2>
		</template>
		<ScrollContainer>
			<div class="flex justify-between items-center">
				<h3 class="flex items-center gap-1 px-1"><MxIcon name="ui/collection" /> Scene</h3>
			</div>
			<OutlinerTree
				v-model="selectedObject"
				:items="outlinerItems"
				:render-camera-id="cameraStore.renderCamera?.uuid"
				@set-active-camera="cameraStore.setRenderCamera($event)"
			/>
		</ScrollContainer>
	</EditorWrapper>
</template>

<script lang="ts" setup>
import { useSceneStore } from '@/app/model/scene'
import { getUserData } from '@/shared/three/utils'
import { computed } from 'vue'
import THREE from '@/shared/three'
import { useCameraStore } from '@/app/model/camera'
import { useThreeStore } from '@/app/model/three'
import type { OutlinerItem } from './types'

const sceneStore = useSceneStore()
const cameraStore = useCameraStore()
const threeStore = useThreeStore()

const selectedObject = computed<OutlinerItem | undefined>({
	set(obj) {
		threeStore.selectObject(obj?.uuid)
	},
	get() {
		return threeStore.selectedObject ? parseObject(threeStore.selectedObject) : undefined
	}
})

const outlinerItems = computed(() => {
	return sceneStore.sceneChildren
		.filter((item) => !getUserData(item).hideInOutliner)
		.map(parseObject)
})

function parseObject(obj: THREE.Object3D): OutlinerItem {
	return {
		uuid: obj.uuid,
		type: obj.type,
		name: obj.name || obj.type,
		userData: getUserData(obj),
		isCamera: obj instanceof THREE.Camera,
		children: obj.children.length > 0 ? obj.children.map(parseObject) : undefined
	}
}
</script>
