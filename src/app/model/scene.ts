import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef, triggerRef } from 'vue'
import THREE from '@/shared/three'
import { setGridHelper } from '@/shared/three/modules/helpers/grid'
import { disposeModel } from '@/shared/three/modules/core/dispose'
import {
	createLight,
	getLightHelper,
	lightHasShadow,
	type LightHelper
} from '@/shared/three/modules/light'
import { createMesh } from '@/shared/three/modules/mesh'
import { createCamera } from '@/shared/three/modules/camera/create'
import { exportModel } from '@/shared/three/modules/addons/exporter'
import { getUserData, enableBVH, isWithin } from '@/shared/three/utils'
import { useShadingStore } from './shading'
import { useWorldStore } from './world'
import { VIEWPORT_BACKDROP } from './types/world'
import { useRaycastStore } from './raycast'
import { useSelectionStore } from './selection'
import { useComposerStore } from './composer'
import { useCameraStore } from './camera'
import { useUvStore } from './uv'
import { useUvGridStore } from './uv-grid'
import { duplicateObject as createDuplicate, snapshotObject, snapshotScene } from './scene-copy'
import { downloadFile } from '@/shared/lib/files'
import { useFileDialog } from '@vueuse/core'
import { encodeProject, decodeProject } from '@/shared/lib/project-file'
import { useToast } from '@/shared/lib/toast'
import { MxObjectLoader } from '@/shared/three/modules/loaders/object-loader/MxObjectLoader'

export const useSceneStore = defineStore('scene', () => {
	const scene = shallowRef(new THREE.Scene())
	const helperScene = shallowRef(new THREE.Scene())
	// Editor chrome until a shading mode asks for the World's own backdrop; see
	// `applyWorldAndStudioLight` in `shading.ts`.
	scene.value.background = new THREE.Color(VIEWPORT_BACKDROP)

	const grid = setGridHelper(scene.value)

	const lightHelperObjects = shallowRef<LightHelper[]>([])

	const sceneChildren = computed(() => scene.value.children)

	const sceneGroups = computed<THREE.Object3D[]>(() => {
		const groups: THREE.Object3D[] = []
		sceneChildren.value.forEach((item) => {
			item.traverse((obj) => {
				const isGroup = obj instanceof THREE.Group || obj instanceof THREE.Scene
				const userData = getUserData(obj)
				if (isGroup && !userData.hideInOutliner) groups.push(obj)
			})
		})
		return groups
	})

	function updateScene() {
		triggerRef(sceneChildren)
	}

	let seeded = false

	/**
	 * Put the starting light, camera and cube into an empty project.
	 *
	 * Guarded rather than idempotent by construction: a viewport can be mounted
	 * more than once over the life of the page, and the second mount must not
	 * drop another copy of these into a scene the user has been editing.
	 */
	function seedDefaultScene() {
		if (seeded) return
		seeded = true

		const pointLight = createLight({ type: 'point' })
		pointLight.power = 1000
		pointLight.position.set(4, 5, 1)

		addObjectToScene(pointLight)

		const camera = createCamera({
			type: 'Perspective',
			name: 'Camera',
			near: 0.1,
			far: 1000,
			fov: 39.6
		})

		camera.position.set(-4, 4, 6)
		camera.lookAt(0, 0, 0)

		addObjectToScene(camera)
		useCameraStore().setRenderCamera(camera.uuid)

		addObjectToScene(createMesh('cube'))
	}

	function addGroup() {
		const group = new THREE.Group()
		group.name = 'Group'
		const userData = getUserData(group)
		userData.userVisible = group.visible
		group.castShadow = true
		group.receiveShadow = true
		scene.value.add(group)
		updateScene()
		return group
	}

	function moveObjectToTarget(objUUID: string, targetUUID: string) {
		const target = scene.value.getObjectByProperty('uuid', targetUUID)
		const object = scene.value.getObjectByProperty('uuid', objUUID)
		if (!target || !object) return
		if (object.parent?.uuid === target.uuid) return
		target.add(object)
		updateScene()
	}

	function addObjectToScene(object: THREE.Object3D, parent?: THREE.Object3D | null) {
		const helpers: THREE.Object3D[] = []
		const { addToRaycaster } = useRaycastStore()
		const { shadingMode, cacheNewObjectMaterials } = useShadingStore()

		object.traverse((obj) => {
			const userData = getUserData(obj)
			userData.userVisible = obj.visible

			if ('material' in obj) {
				userData.isShadable = true
				const material = obj.material as THREE.Material | THREE.Material[]
				if (Array.isArray(material)) material.forEach((mat) => (mat.dithering = true))
				else material.dithering = true

				obj.castShadow = true
				obj.receiveShadow = true
			}

			if (obj instanceof THREE.Light) {
				const helper = getLightHelper(obj)
				userData.hideInModes = ['wireframe', 'solid', 'preview']
				userData.isSceneLight = true

				if (lightHasShadow(obj)) {
					obj.castShadow = true
				}

				if (!helper) return

				if (shadingMode !== 'rendered') {
					helper.light.visible = false
				}

				helpers.push(helper)
				lightHelperObjects.value.push(helper)
				addToRaycaster(helper)
				return
			}

			if (obj instanceof THREE.Camera) {
				const helper = new THREE.CameraHelper(obj)

				helper.name = `${obj.name} Helper`

				const helperUserData = getUserData(helper)

				helperUserData.isSelectable = true
				helperUserData.isHelper = true
				helperUserData.hideInOutliner = true

				userData.helperUUID = helper.uuid
				userData.isRenderCamera = true

				helpers.push(helper)
				addToRaycaster(helper)
				return
			}

			userData.isSelectable = true
			addToRaycaster(obj)
		})

		enableBVH(object)

		if (parent) {
			parent.add(object)
			helpers.forEach((obj) => parent.add(obj))
		} else {
			scene.value.add(object)
			helpers.forEach((obj) => scene.value.add(obj))
		}

		cacheNewObjectMaterials(object)

		useSelectionStore().select(object)
		updateScene()
	}

	function duplicateObject(uuid: string) {
		const object = scene.value.getObjectByProperty('uuid', uuid)
		if (!object) return console.warn('duplicateObject: object is undefined')
		try {
			const newObj = createDuplicate(object)
			addObjectToScene(newObj, object.parent)
		} catch (error) {
			useToast().add({
				type: 'error',
				title: 'Cannot duplicate this object',
				message: (error as Error).message
			})
		}
	}

	function deleteFromScene(uuid: string) {
		const { removeFromRaycaster } = useRaycastStore()
		const { clearMaterialCache } = useShadingStore()
		const { removeFromOutline } = useComposerStore()
		const selectionStore = useSelectionStore()

		const object = scene.value.getObjectByProperty('uuid', uuid)

		if (!object) return console.warn('deleteFromScene: object is undefined')

		// Deleting a subtree takes its descendants with it, so the selection has to
		// go if it lives anywhere inside the object being removed.
		if (selectionStore.isSelectedWithin(object)) selectionStore.clear()

		const removedObjects: THREE.Object3D[] = []
		object.traverse((child) => removedObjects.push(child))
		for (const removed of removedObjects) {
			const helperUUID = getUserData(removed).helperUUID
			if (!helperUUID) continue
			const helper = scene.value.getObjectByProperty('uuid', helperUUID)
			if (helper) {
				removeFromOutline(helper.uuid)
				removeFromRaycaster(helper.uuid)
				disposeModel(helper)
				const idx = lightHelperObjects.value.findIndex((item) => item.uuid === helperUUID)
				if (idx >= 0) {
					lightHelperObjects.value.splice(idx, 1)
				}
			}
		}

		// Same containment rule as the selection above: the render camera goes with
		// the subtree whether it is the deleted object or lives anywhere beneath it.
		const cameraStore = useCameraStore()
		if (isWithin(cameraStore.renderCamera, object)) {
			cameraStore.renderCamera = null
		}

		// Traversed, because a deleted group takes its meshes with it and each of
		const uvStore = useUvStore()
		const uvGridStore = useUvGridStore()
		for (const child of removedObjects) {
			removeFromOutline(child.uuid)
			removeFromRaycaster(child.uuid)
			uvStore.forget(child.uuid)
			uvGridStore.forget(child.uuid)
		}

		disposeModel(object)
		for (const child of removedObjects) clearMaterialCache(child.uuid)
		updateScene()
	}

	function objectVisibilityUpdate(uuid: string, val: boolean) {
		const { shadingMode } = useShadingStore()
		const obj = scene.value.getObjectByProperty('uuid', uuid)

		if (obj) {
			const userData = getUserData(obj)
			userData.userVisible = val
			if (userData.helperUUID) objectVisibilityUpdate(userData.helperUUID, val)
			if (!userData.hideInModes?.includes(shadingMode)) {
				obj.visible = val
			}
			updateScene()
		}
	}

	function objectToJSON(uuid: string) {
		const object = scene.value.getObjectByProperty('uuid', uuid)
		if (!object) return

		const { object: clone, missingBones } = snapshotObject(object)

		// Nothing of this export would survive being read back: it is one object,
		// and the bones posing it are not in it. Refused rather than written, which
		// is the whole difference from the scene-wide saves, where the rigs that do
		// come out whole are still worth writing.
		if (missingBones.length > 0) {
			const mesh = missingBones[0].name || 'This skinned mesh'
			useToast().add({
				type: 'error',
				title: 'Cannot export this object on its own',
				message: `${mesh} is posed by bones outside it. Export the object holding those bones instead.`
			})
			return
		}

		const json = clone.toJSON()
		json.object.userData = {}
		const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
		downloadFile(blob, `${clone.name || clone.type}.json`)
	}

	async function importJSON(data: string | Record<string, unknown>) {
		const toast = useToast()

		try {
			const json = typeof data === 'string' ? JSON.parse(data) : data

			const loader = new MxObjectLoader()
			const loadedObject = await loader.parseAsync(json)

			addObjectToScene(loadedObject)
		} catch (err) {
			const error = err as Error
			toast.add({
				type: 'error',
				title: error.name,
				message: error.message
			})
			console.error('importJSON error:', error)
		}
	}

	async function exportScene() {
		const toast = useToast()
		try {
			const { scene: exportScene, missingBones } = snapshotScene(scene.value, {
				keep: (object) =>
					!(object instanceof THREE.Light) ||
					object instanceof THREE.PointLight ||
					object instanceof THREE.DirectionalLight ||
					object instanceof THREE.SpotLight
			})
			if (missingBones.length > 0) {
				toast.add({
					type: 'warning',
					title: 'A rig will not survive this export',
					message: `${missingBones[0].name || 'A skinned mesh'} is posed by bones this export leaves out. Move it and those bones under the same object.`
				})
			}
			await exportModel(exportScene)
		} catch (error) {
			const err = error as Error
			console.error('Export error:', err.message)
			toast.add({ type: 'error', title: 'Failed to export scene', message: err.message })
		}
	}

	function saveProjectFile() {
		const toast = useToast()
		try {
			const cameraStore = useCameraStore()

			// Cloned across the scene in one pass rather than per child: the outliner
			// can re-parent a skinned mesh away from the bones posing it, and only a
			// pass that sees every kept child at once can bind the two back together.
			const {
				scene: exportScene,
				renderCameraUUID,
				missingBones
			} = snapshotScene(scene.value, { renderCamera: cameraStore.renderCamera })

			// Saved anyway: one stranded rig is not worth losing the project over,
			// and the rest of the file is sound. Said out loud because that rig will
			// come back collapsed and nothing else would explain why.
			if (missingBones.length > 0) {
				toast.add({
					type: 'warning',
					title: 'A rig will not survive this save',
					message: `${missingBones[0].name || 'A skinned mesh'} is posed by bones the project does not save. Move it and those bones under the same object.`
				})
			}

			const data = {
				scene: exportScene.toJSON(),
				renderCameraUUID,
				world: useWorldStore().snapshot()
			}

			const binaryData = encodeProject(data)
			const buffer = binaryData.buffer.slice(
				binaryData.byteOffset,
				binaryData.byteOffset + binaryData.byteLength
			) as ArrayBuffer
			downloadFile(buffer, 'project.mixeur', { mimeType: 'application/octet-stream' })
		} catch (err) {
			const error = err as Error
			toast.add({
				type: 'error',
				message: 'Failed to export project'
			})
			console.error('Export error:', error)
		}
	}

	async function openProjectFile(): Promise<boolean> {
		const toast = useToast()
		const { open, onChange } = useFileDialog({
			accept: '.mixeur',
			multiple: false
		})

		return new Promise((resolve) => {
			onChange(async (val) => {
				if (!val) {
					resolve(false)
					return
				}

				try {
					const file = Array.from(val)[0]
					const buffer = await file.arrayBuffer()
					const project = decodeProject(buffer)

					const loader = new MxObjectLoader()
					const loadedScene = await loader.parseAsync(project.data.scene)

					if (!(loadedScene instanceof THREE.Scene)) {
						throw new Error('Invalid scene data in project file')
					}

					clearScene()

					loadedScene.traverse((obj) => {
						const userData = getUserData(obj)
						obj.visible = userData.userVisible ?? true
						if (obj instanceof THREE.SpotLight || obj instanceof THREE.DirectionalLight) {
							const target = obj.children.find((child) => getUserData(child).isLightTarget)
							if (target) obj.target = target
						}
					})

					loadedScene.children.map((child) => child).forEach((obj) => addObjectToScene(obj))

					const { setRenderCamera } = useCameraStore()

					if (project.data.renderCameraUUID) {
						setRenderCamera(project.data.renderCameraUUID)
					}

					// Undefined for files written before the World existed; `restore`
					// falls back to the default rather than leaving the last project's
					// World behind.
					const world = useWorldStore()
					world.restore(project.data.world)

					toast.add({
						type: 'success',
						message: 'Project loaded successfully'
					})

					// An imported World is saved as a filename and nothing else, so a
					// reopened project has a World it cannot show. Said out loud here:
					// otherwise the only sign is a backdrop that has quietly gone, and
					// only in rendered mode, on a tab nobody has any reason to open.
					if (world.needsReimport) {
						toast.add({
							type: 'warning',
							title: 'World image not loaded',
							message: `Re-import it from World properties`
						})
					}
					resolve(true)
				} catch (err) {
					const error = err as Error
					let message = 'Failed to load project'
					if (error.message.includes('corrupted')) {
						message = 'Failed to load project: file is corrupted'
					} else if (error.message.includes('Incompatible')) {
						message = error.message
					} else if (error.message.includes('Invalid project file')) {
						message = 'Invalid project file'
					}
					toast.add({
						type: 'error',
						message
					})
					console.error('Load error:', error)
					resolve(false)
				}
			})
			open()
		})
	}

	function clearScene() {
		const idsToDelete: string[] = []

		scene.value.children.forEach((child) => {
			if (getUserData(child).isSystemObj) return
			idsToDelete.push(child.uuid)
		})

		idsToDelete.forEach((uuid) => deleteFromScene(uuid))
	}

	return {
		scene,
		helperScene,
		sceneChildren,
		sceneGroups,
		grid,
		lightHelperObjects,
		updateScene,
		seedDefaultScene,
		addGroup,
		moveObjectToTarget,
		addObjectToScene,
		duplicateObject,
		deleteFromScene,
		objectVisibilityUpdate,
		objectToJSON,
		exportScene,
		clearScene,
		saveProjectFile,
		openProjectFile,
		importJSON
	}
})

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useSceneStore, import.meta.hot))
}
