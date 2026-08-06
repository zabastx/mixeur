import { acceptHMRUpdate, defineStore } from 'pinia'
import { shallowRef, triggerRef } from 'vue'
import THREE from '@/shared/three'
import { getUserData } from '@/shared/three/utils'
import { useSceneStore } from './scene'
import { useControlsStore } from './controls'
import { useComposerStore } from './composer'

export interface SelectOptions {
	/**
	 * The selection came from a viewport raycast. Raycast hits are filtered by
	 * `userData.isSelectable`; selections made from the outliner are not.
	 */
	fromRaycast?: boolean
}

/**
 * What a selection resolves to. The object the gizmo drives is not always the
 * object the outline draws: picking a light selects the light but outlines its
 * helper, and picking the helper does the same.
 */
interface ResolvedSelection {
	subject: THREE.Object3D
	outline: THREE.Object3D | undefined
}

export const useSelectionStore = defineStore('selection', () => {
	const selectedObject = shallowRef<THREE.Object3D | THREE.Light | THREE.Mesh | null>(null)

	function resolveTarget(target: string | THREE.Object3D) {
		if (typeof target !== 'string') return target
		return useSceneStore().scene.getObjectByProperty('uuid', target)
	}

	function resolveSelection(object: THREE.Object3D): ResolvedSelection {
		// A helper was picked — drive its subject, outline the helper.
		if ('light' in object) return { subject: object.light as THREE.Light, outline: object }
		if ('camera' in object) return { subject: object.camera as THREE.Camera, outline: object }

		// A subject with a helper was picked — outline the helper instead.
		if (object instanceof THREE.Light) {
			return { subject: object, outline: findHelperFor('light', object) }
		}
		if (object instanceof THREE.Camera) {
			return { subject: object, outline: findHelperFor('camera', object) }
		}

		// Part of a helper was picked — promote to the helper itself.
		if (getUserData(object).skipRaycast && object.parent) {
			return resolveSelection(object.parent)
		}

		return { subject: object, outline: object }
	}

	function findHelperFor(property: 'light' | 'camera', subject: THREE.Object3D) {
		return useSceneStore().scene.getObjectByProperty(property, subject)
	}

	/**
	 * Select an object, by uuid or by reference. Attaches the transform controls,
	 * drives the outline, and publishes `selectedObject` — the three always move
	 * together. Passing nothing clears the selection.
	 */
	function select(target?: string | THREE.Object3D | null, options: SelectOptions = {}) {
		if (!target) return clear()

		const object = resolveTarget(target)
		if (!object) return
		if (options.fromRaycast && !getUserData(object).isSelectable) return

		const { transformControls } = useControlsStore()
		const { setOutlineObjects } = useComposerStore()
		const { subject, outline } = resolveSelection(object)

		transformControls?.attach(subject)
		setOutlineObjects(outline ? [outline] : [])
		selectedObject.value = subject
	}

	/** Deselect: no outline, no gizmo, no selected object. */
	function clear() {
		const { transformControls } = useControlsStore()
		const { setOutlineObjects } = useComposerStore()

		transformControls?.detach()
		setOutlineObjects([])
		selectedObject.value = null
	}

	/**
	 * Republish the selection after the selected object was mutated in place.
	 * `selectedObject` is a shallowRef, so Three.js mutations are invisible to
	 * Vue until something tells it otherwise.
	 */
	function refresh() {
		triggerRef(selectedObject)
	}

	return {
		selectedObject,
		select,
		clear,
		refresh
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useSelectionStore, import.meta.hot))
}
