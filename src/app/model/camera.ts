import THREE from '@/shared/three'
import { createCamera } from '@/shared/three/modules/camera/create'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import { useSceneStore } from './scene'
import { getUserData } from '@/shared/three/utils'
import { onKeyDown } from '@/shared/lib/keyboard'
import { useComposerStore } from './composer'

export const useCameraStore = defineStore('camera', () => {
	const viewportCameras = {
		perspective: createCamera({
			type: 'Perspective',
			fov: 39.6,
			near: 0.1,
			far: 1000,
			name: 'Perspective Viewport Camera'
		}),
		orthographic: createCamera({
			type: 'Orthographic',
			near: -1000,
			far: 1000,
			name: 'Orthographic Viewport Camera'
		})
	} as const

	const viewportCameraType = ref<keyof typeof viewportCameras>('perspective')

	const activeCamera = ref<THREE.PerspectiveCamera | THREE.OrthographicCamera>(
		viewportCameras[viewportCameraType.value]
	)

	const renderCamera = shallowRef<THREE.Camera | null>(null)

	// Cameras can be re-parented into groups, so the list has to walk the whole
	// tree rather than the scene's top-level children. Mirrors `sceneGroups`.
	const renderCameraList = computed<THREE.Camera[]>(() => {
		const sceneStore = useSceneStore()
		const cameras: THREE.Camera[] = []
		sceneStore.sceneChildren.forEach((item) => {
			item.traverse((obj) => {
				if (obj instanceof THREE.Camera && getUserData(obj).isRenderCamera) cameras.push(obj)
			})
		})
		return cameras
	})

	watch(viewportCameraType, (newVal, oldVal) => {
		viewportCameras[newVal].position.copy(viewportCameras[oldVal].position)
		viewportCameras[newVal].quaternion.copy(viewportCameras[oldVal].quaternion)
		viewportCameras[newVal].scale.copy(viewportCameras[oldVal].scale)
		if (renderCamera.value?.uuid !== activeCamera.value.uuid) {
			activeCamera.value = viewportCameras[newVal]
		}
	})

	activeCamera.value.position.set(8, 8, 8)
	activeCamera.value.lookAt(0, 0, 0)

	// Registered in the store body, so it is released with the camera store
	// rather than with the viewport — which camera is active is scene state and
	// survives a viewport remount.
	onKeyDown('editor', (e) => {
		switch (e.code) {
			case 'Numpad5': // Perspective / Orthographic camera toggle
				e.preventDefault()
				toggleViewportCamera()
				break

			case 'Numpad0': // Render / Viewport camera toggle
				e.preventDefault()
				toggleCameraView()
				break
		}
	})

	function toggleViewportCamera() {
		if (viewportCameraType.value === 'orthographic') {
			viewportCameraType.value = 'perspective'
		} else {
			viewportCameraType.value = 'orthographic'
		}
	}

	function setRenderCamera(uuid: string) {
		const { scene } = useSceneStore()
		const camera = scene.getObjectByProperty('uuid', uuid)
		if (!(camera instanceof THREE.Camera))
			return console.warn('setRenderCamera: object is not a camera')
		renderCamera.value = camera
	}

	function toggleCameraView() {
		if (!renderCamera.value || renderCamera.value.uuid === activeCamera.value.uuid) {
			activeCamera.value = viewportCameras[viewportCameraType.value]
		} else {
			activeCamera.value = renderCamera.value as THREE.PerspectiveCamera | THREE.OrthographicCamera
		}
		const composerStore = useComposerStore()
		composerStore.needsResize = true
	}

	return {
		activeCamera,
		toggleViewportCamera,
		viewportCameraType,
		renderCamera,
		setRenderCamera,
		renderCameraList,
		toggleCameraView,
		viewportCameras
	}
})
