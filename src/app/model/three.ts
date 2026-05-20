import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { ref, shallowRef, type ShallowRef } from 'vue'
import THREE from '@/shared/three'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/Addons.js'
import { useStats } from '@/shared/three/modules/extras/stats'
import { useShadingStore } from './shading'
import { useComposerStore } from './composer'
import { useCameraStore } from './camera'
import { useControlsStore } from './controls'
import { useRaycastStore } from './raycast'
import { usePreferencesStore } from './preferences'
import { getUserData } from '@/shared/three/utils'
import { useSceneStore } from './scene'

export const useThreeStore = defineStore('three', () => {
	const isInitiated = ref(false)

	const selectedObject = shallowRef<THREE.Object3D | THREE.Light | THREE.Mesh | null>(null)

	function selectObject(target?: string | THREE.Object3D, raycasted?: boolean) {
		if (!target) return (selectedObject.value = null)

		const sceneStore = useSceneStore()
		const { transformControls } = useControlsStore()
		const { setOutlineObjects } = useComposerStore()

		const object =
			typeof target === 'string' ? sceneStore.scene.getObjectByProperty('uuid', target) : target

		if (!object || (raycasted && !getUserData(object).isSelectable)) return

		if (object instanceof THREE.Light) {
			transformControls?.attach(object)
			selectedObject.value = object
			const helper = sceneStore.scene.getObjectByProperty('light', object)
			if (helper) {
				setOutlineObjects([helper])
			}
			return
		}

		if (object instanceof THREE.Camera) {
			transformControls?.attach(object)
			selectedObject.value = object
			const helper = sceneStore.scene.getObjectByProperty('camera', object)
			if (helper) {
				setOutlineObjects([helper])
			}
			return
		}

		if ('light' in object) {
			const light = object.light as THREE.Light
			transformControls?.attach(light)
			setOutlineObjects([object])
			selectedObject.value = light
			return
		}

		if ('camera' in object) {
			const camera = object.camera as THREE.Camera
			transformControls?.attach(camera)
			setOutlineObjects([object])
			selectedObject.value = camera
			return
		}

		transformControls?.attach(object)
		setOutlineObjects([object])
		selectedObject.value = object
	}

	const { setFPSCounter, monitor, updateMonitor } = useStats()

	function initScene(canvasRef: ShallowRef<HTMLCanvasElement | null>) {
		if (!canvasRef.value) return

		const sceneStore = useSceneStore()
		const shadingStore = useShadingStore()
		const { initTheme } = usePreferencesStore()
		const controlsStore = useControlsStore()
		const composerStore = useComposerStore()
		const { gizmo, controls } = storeToRefs(controlsStore)

		initTheme()

		const canvas = canvasRef.value

		shadingStore.init()
		RectAreaLightUniformsLib.init()

		if (import.meta.env.DEV) setFPSCounter(canvas.parentElement)

		const { activeCamera } = storeToRefs(useCameraStore())

		if (!(activeCamera.value instanceof THREE.PerspectiveCamera)) return
		activeCamera.value.aspect = canvas.clientWidth / canvas.clientHeight

		const { composer, handleResize, renderer } = composerStore.init({
			camera: activeCamera,
			canvas,
			gizmo,
			scene: sceneStore.scene as THREE.Scene
		})

		controlsStore.initControls(sceneStore.helperScene as THREE.Scene)

		const raycastStore = useRaycastStore()
		raycastStore.init(canvasRef)

		const targetFPS = 30
		const frameDelay = 1000 / targetFPS
		let lastFrameTime = 0

		const timer = new THREE.Timer()
		renderer.setAnimationLoop(render)

		isInitiated.value = true

		function render(currentTime: number) {
			const deltaTime = currentTime - lastFrameTime
			if (deltaTime < frameDelay) return
			lastFrameTime = currentTime - (deltaTime % frameDelay)
			timer.update()
			const delta = timer.getDelta()

			handleResize()

			sceneStore.grid.update(activeCamera.value)
			controls.value?.update(delta)
			sceneStore.lightHelperObjects.forEach((item) => {
				if ('update' in item) item.update()
			})
			composer.render(delta)
			gizmo.value?.render()
			renderer.clearDepth()
			renderer.render(sceneStore.helperScene, activeCamera.value)

			updateMonitor(renderer)
		}
	}

	return {
		initScene,
		selectedObject,
		selectObject,
		monitor,
		isInitiated
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useThreeStore, import.meta.hot))
}
