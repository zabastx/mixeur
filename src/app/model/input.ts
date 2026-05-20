import { useEventListener, useKeyModifier } from '@vueuse/core'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref, type ShallowRef } from 'vue'
import { useThreeStore } from './three'
import { useSceneStore } from './scene'
import { useControlsStore } from './controls'
import { useCameraStore } from './camera'
import THREE from '@/shared/three'
import { useAppStore } from './app'

export const useInputStore = defineStore('input', () => {
	const isCtrlDown = useKeyModifier('Control')
	const isShiftDown = useKeyModifier('Shift')

	const pointerOnCanvas = ref(false)

	function init(canvas: ShallowRef<HTMLCanvasElement | null>) {
		initPointerEvents(canvas)
		initKeyboardEvents()
		initWheelEvents(canvas)
	}

	function initPointerEvents(canvas: ShallowRef<HTMLCanvasElement | null>) {
		useEventListener(canvas, 'pointerenter', () => (pointerOnCanvas.value = true))
		useEventListener(canvas, 'pointerleave', () => (pointerOnCanvas.value = false))

		useEventListener(canvas, 'pointerdown', (e) => {
			const { controls } = useControlsStore()
			if (e.button === THREE.MOUSE.MIDDLE && controls) {
				controls.screenSpacePanning = !e.ctrlKey
			}
		})
	}

	function initKeyboardEvents() {
		const ignoredElements = ['input', 'textarea', 'select']

		useEventListener(window, 'keydown', (e) => {
			const sceneStore = useSceneStore()
			if ((e.ctrlKey || e.metaKey) && e.key === 's') {
				e.preventDefault()
				sceneStore.saveProjectFile()
			}
			if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
				e.preventDefault()
				sceneStore.openProjectFile()
			}
		})

		useEventListener(window, 'keydown', (e) => {
			const threeStore = useThreeStore()
			const sceneStore = useSceneStore()
			const appStore = useAppStore()

			if (
				e.target instanceof HTMLElement &&
				ignoredElements.includes(e.target.tagName.toLowerCase())
			) {
				e.stopImmediatePropagation()
				return
			}

			if (!pointerOnCanvas.value) return

			switch (e.code) {
				case 'Delete':
					e.preventDefault()
					if (threeStore.selectedObject instanceof THREE.Object3D) {
						sceneStore.deleteFromScene(threeStore.selectedObject.uuid)
					}
					break

				case 'KeyD':
					e.preventDefault()
					if (threeStore.selectedObject instanceof THREE.Object3D && e.shiftKey) {
						sceneStore.cloneObject(threeStore.selectedObject.uuid)
					}
					break

				case 'KeyT':
					e.preventDefault()
					appStore.showToolbar = !appStore.showToolbar
					break
			}
		})
	}

	function initWheelEvents(canvas: ShallowRef<HTMLCanvasElement | null>) {
		useEventListener(canvas, 'wheel', (event) => {
			event.preventDefault()

			const { activeCamera } = useCameraStore()
			const { controls } = useControlsStore()

			if (!controls) return
			const delta = event.deltaY * -0.01
			if (activeCamera instanceof THREE.PerspectiveCamera) {
				let dollyScale = 1.2

				if (isCtrlDown.value) dollyScale = 1.3
				if (isShiftDown.value) dollyScale = 1.05

				if (delta < 0) controls.dollyIn(dollyScale)
				if (delta > 0) controls.dollyOut(dollyScale)
			} else if (activeCamera instanceof THREE.OrthographicCamera) {
				const zoomFactor = 1 + delta * 0.1
				activeCamera.zoom *= zoomFactor
				activeCamera.updateProjectionMatrix()
			}
			controls.update()
		})
	}

	return {
		isCtrlDown,
		isShiftDown,
		pointerOnCanvas,
		init
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useInputStore, import.meta.hot))
}
