import THREE from '@/shared/three'
import { useEventListener } from '@vueuse/core'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { shallowRef } from 'vue'
import { useControlsStore } from './controls'
import { useCameraStore } from './camera'
import { useSelectionStore } from './selection'
import { getUserData } from '@/shared/three/utils'

export const useRaycastStore = defineStore('raycast', () => {
	const raycastObjects = shallowRef<THREE.Object3D[]>([])

	/**
	 * Bind viewport picking to `canvas`.
	 *
	 * Both listeners are reactive effects, so the caller's effect scope releases
	 * them — there is nothing for this to hand back.
	 */
	function init(canvas: HTMLCanvasElement) {
		const raycaster = new THREE.Raycaster()
		const pointer = new THREE.Vector2()
		raycaster.firstHitOnly = true

		const { wasDragging } = storeToRefs(useControlsStore())
		const { activeCamera } = storeToRefs(useCameraStore())

		useEventListener(canvas, 'pointermove', (e) => {
			const target = e.target as HTMLElement
			if (!target) return
			pointer.x = (e.offsetX / target.clientWidth) * 2 - 1
			pointer.y = -(e.offsetY / target.clientHeight) * 2 + 1
		})

		useEventListener(canvas, 'click', () => {
			// Prevents deselection when using transform controls
			if (wasDragging.value) return (wasDragging.value = false)

			raycaster.setFromCamera(pointer, activeCamera.value)

			const objects = raycastObjects.value.filter(
				(obj) => obj.visible && getUserData(obj).isSelectable
			)

			const intersects = raycaster.intersectObjects(objects, true)

			const selectionStore = useSelectionStore()

			if (!intersects[0]) return selectionStore.clear()

			selectionStore.select(intersects[0].object, { fromRaycast: true })
		})
	}

	function removeFromRaycaster(uuid: string) {
		const idx = raycastObjects.value.findIndex((obj) => obj.uuid === uuid)
		if (idx >= 0) {
			raycastObjects.value.splice(idx, 1)
		}
	}

	function addToRaycaster(obj: THREE.Object3D) {
		raycastObjects.value.push(obj)
	}

	return { init, addToRaycaster, removeFromRaycaster }
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useRaycastStore, import.meta.hot))
}
