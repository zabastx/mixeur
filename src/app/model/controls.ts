import { ViewportGizmo } from 'three-viewport-gizmo'
import { acceptHMRUpdate, defineStore, storeToRefs } from 'pinia'
import { ref, shallowRef, watch } from 'vue'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls, type TransformControlsMode } from 'three/examples/jsm/Addons.js'
import THREE from '@/shared/three'
import { useComposerStore } from './composer'
import { useSelectionStore } from './selection'
import { useCameraStore } from './camera'
import { useInputStore } from './input'
import { MathUtils } from 'three'
import { createTeardown, type Teardown } from '@/shared/lib/teardown'
import { onKeyDown } from '@/shared/lib/keyboard'
import {
	defaultKeymaps,
	keyCodeToTransformMode,
	keyCodeToTransformAxis,
	keyCodeToViewDirection
} from '@/app/config/keymaps'
import { getGizmoConfig } from '../config/gizmo'

export const useControlsStore = defineStore('controls', () => {
	const controls = shallowRef<OrbitControls>()
	const gizmo = shallowRef<ViewportGizmo>()
	const transformControls = shallowRef<TransformControls>()
	const currentTransformMode = ref<TransformControlsMode>('translate')

	const isTransformDrag = ref(false)

	watch(currentTransformMode, (val) => {
		if (!transformControls.value) {
			console.warn('Cannot set transform mode: controls not initialized')
			return
		}
		transformControls.value.setMode(val)
	})

	const wasDragging = ref(false)

	/**
	 * Attach the orbit, transform and gizmo controls to the current renderer,
	 * and return the release that detaches them again.
	 *
	 * Watchers and key handlers registered along the way are left to the
	 * caller's effect scope; `dispose` covers the Three.js objects and the
	 * helper this adds to `helperScene`, which outlives the viewport.
	 */
	function initControls(helperScene: THREE.Scene) {
		const teardown = createTeardown()

		setTransformControls(helperScene, teardown)
		setOrbitControls(teardown)

		return {
			dispose() {
				teardown.run()
				// Cleared after the releases have run, not as one of them: a
				// release that read these would find them already gone.
				controls.value = undefined
				gizmo.value = undefined
				transformControls.value = undefined
			}
		}
	}

	function setOrbitControls(teardown: Teardown) {
		const cameraStore = useCameraStore()
		const { activeCamera } = storeToRefs(cameraStore)
		const { rendererRef } = useComposerStore()

		if (!rendererRef) return console.warn('setOrbitControls: renderer is undefined')

		// Releases below close over locals rather than the store refs, so they
		// hold what they were given no matter what else teardown has already run.
		const orbitControls = new OrbitControls(activeCamera.value, rendererRef.domElement)
		teardown.add(() => orbitControls.dispose())
		controls.value = orbitControls
		controls.value.enablePan = true
		controls.value.screenSpacePanning = true
		controls.value.enableZoom = false
		controls.value.mouseButtons = {
			LEFT: null,
			MIDDLE: THREE.MOUSE.ROTATE,
			RIGHT: null
		}
		controls.value.touches = {
			ONE: THREE.TOUCH.ROTATE,
			TWO: THREE.TOUCH.PAN
		}

		const viewportGizmo = new ViewportGizmo(activeCamera.value, rendererRef, getGizmoConfig())
		teardown.add(() => viewportGizmo.dispose())
		gizmo.value = viewportGizmo
		viewportGizmo.attachControls(orbitControls)
		teardown.add(() => viewportGizmo.detachControls())

		const { viewportCameras } = cameraStore

		watch(activeCamera, (newCamera) => {
			if (!controls.value || !gizmo.value) return
			gizmo.value.camera = newCamera

			if (
				newCamera.uuid !== viewportCameras.perspective.uuid &&
				newCamera.uuid !== viewportCameras.orthographic.uuid
			) {
				controls.value.enabled = false
			} else {
				controls.value.enabled = true
				controls.value.object = newCamera
			}
		})

		onKeyDown('editor', (e) => {
			const viewDir = keyCodeToViewDirection[e.code]
			if (viewDir) {
				e.preventDefault()
				switch (viewDir) {
					case 'front':
						setView({ z: 1, invert: e.ctrlKey })
						break
					case 'right':
						setView({ x: 1, invert: e.ctrlKey })
						break
					case 'top':
						setView({ y: 1, invert: e.ctrlKey })
						break
				}
			}
		})
	}

	function setTransformControls(helperScene: THREE.Scene, teardown: Teardown) {
		const cameraStore = useCameraStore()
		const { activeCamera } = storeToRefs(cameraStore)
		const { rendererRef } = useComposerStore()

		if (!rendererRef) return console.warn('setTransformControls: renderer is undefined')

		// As in `setOrbitControls`, the releases close over this local rather than
		// the store ref, so they cannot be defeated by the ref being cleared.
		const transform = new TransformControls(activeCamera.value, rendererRef.domElement)
		teardown.add(() => {
			transform.detach()
			// Also disposes the helper root returned by `getHelper`.
			transform.dispose()
		})
		transformControls.value = transform
		transform.setMode(currentTransformMode.value)
		const transformHelper = transform.getHelper()
		transformHelper.name = 'TransformHelper'

		// `helperScene` belongs to the scene store and outlives the viewport, so
		// a helper left behind here would stack up one per mount.
		helperScene.add(transformHelper)
		teardown.add(() => helperScene.remove(transformHelper))

		watch(activeCamera, (newCamera) => {
			if (!transformControls.value) return
			transformControls.value.camera = newCamera
		})

		const selectionStore = useSelectionStore()
		const inputStore = useInputStore()
		const { isCtrlDown } = storeToRefs(inputStore)

		watch(isCtrlDown, (newVal) => {
			if (newVal) {
				transformControls.value?.setTranslationSnap(1)
				transformControls.value?.setRotationSnap(MathUtils.degToRad(5))
				transformControls.value?.setScaleSnap(1)
			} else {
				transformControls.value?.setTranslationSnap(null)
				transformControls.value?.setRotationSnap(null)
				transformControls.value?.setScaleSnap(null)
			}
		})

		const stateBeforeDrag = {
			position: new THREE.Vector3(),
			quaternion: new THREE.Quaternion(),
			scale: new THREE.Vector3()
		}

		const onObjectChange = () => selectionStore.refresh()

		const onDraggingChanged = (e: { value: unknown }) => {
			if (e.value && transformControls.value) {
				const { position, quaternion, scale } = transformControls.value.object
				stateBeforeDrag.position.copy(position)
				stateBeforeDrag.quaternion.copy(quaternion)
				stateBeforeDrag.scale.copy(scale)
			}
			isTransformDrag.value = !!e.value
			wasDragging.value = !e.value
		}

		transform.addEventListener('objectChange', onObjectChange)
		transform.addEventListener('dragging-changed', onDraggingChanged)
		teardown.add(() => {
			transform.removeEventListener('objectChange', onObjectChange)
			transform.removeEventListener('dragging-changed', onDraggingChanged)
		})

		onKeyDown('editor', (e) => {
			if (!transformControls.value) return
			// G, R and S belong to whichever editor the pointer is over — the UV
			// editor binds the same keys — so the gizmo only answers over the
			// viewport, the rule `Delete` and `Shift+D` already follow.
			if (!inputStore.pointerOnCanvas) return

			const mode = keyCodeToTransformMode[e.code]
			const axis = keyCodeToTransformAxis[e.code]

			if (mode) {
				e.preventDefault()
				currentTransformMode.value = mode
				return
			}

			if (axis) {
				e.preventDefault()
				const axisMap: Record<string, typeof transformControls.value.axis> = {
					x: 'X',
					y: 'Y',
					z: 'Z',
					clear: 'XYZE'
				}
				transformControls.value.axis = axisMap[axis]
				return
			}

			if (e.code === defaultKeymaps.transform.cancel) {
				e.preventDefault()
				if (!isTransformDrag.value) return
				const { position, quaternion, scale } = transformControls.value.object
				position.copy(stateBeforeDrag.position)
				quaternion.copy(stateBeforeDrag.quaternion)
				scale.copy(stateBeforeDrag.scale)
				transformControls.value.pointerUp(null)
				selectionStore.refresh()
			}
		})
	}

	function setView({
		x = 0,
		y = 0,
		z = 0,
		invert = false
	}: {
		x?: number
		y?: number
		z?: number
		invert?: boolean
	}) {
		const { activeCamera } = useCameraStore()
		const { controls } = useControlsStore()

		if (!controls || !activeCamera) return
		const dir = invert ? -1 : 1
		const distance = activeCamera.position.distanceTo(controls.target)
		const newPos = new THREE.Vector3(x * dir, y * dir, z * dir).multiplyScalar(distance)
		activeCamera.position.copy(controls.target).add(newPos)
		activeCamera.up.set(0, 1, 0)
		activeCamera.lookAt(controls.target)
		controls.update()
	}

	return {
		controls,
		gizmo,
		transformControls,
		initControls,
		currentTransformMode,
		wasDragging,
		isTransformDrag
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useControlsStore, import.meta.hot))
}
