import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, shallowRef, triggerRef } from 'vue'
import THREE from '@/shared/three'
import { setGridHelper } from '@/shared/three/modules/helpers/grid'
import { disposeModel } from '@/shared/three/modules/core/dispose'
import { getLightHelper, lightHasShadow, type LightHelper } from '@/shared/three/modules/light'
import { exportModel } from '@/shared/three/modules/addons/exporter'
import { getUserData, enableBVH } from '@/shared/three/utils'
import { useShadingStore } from './shading'
import { useRaycastStore } from './raycast'
import { useControlsStore } from './controls'
import { useComposerStore } from './composer'
import { useCameraStore } from './camera'
import { useThreeStore } from './three'
import { downloadFile } from '@/shared/lib/files'
import { useFileDialog, useEventListener } from '@vueuse/core'
import { encodeProject, decodeProject } from '@/shared/lib/project-file'
import { useToast } from '@/shared/lib/toast'
import { MxObjectLoader } from '@/shared/three/modules/loaders/object-loader/MxObjectLoader'
import { TextGeometry } from 'three/examples/jsm/Addons.js'

export const useSceneStore = defineStore('scene', () => {
	const scene = shallowRef(new THREE.Scene())
	const helperScene = shallowRef(new THREE.Scene())
	scene.value.background = new THREE.Color('#3D3D3D')

	const grid = setGridHelper(scene.value)

	const lightHelperObjects = shallowRef<LightHelper[]>([])

	useEventListener(window, 'keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault()
			saveProjectFile()
		}
		if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
			e.preventDefault()
			openProjectFile()
		}
	})

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

		const threeStore = useThreeStore()
		threeStore.selectObject(object.uuid)
		updateScene()
	}

	function cloneObject(uuid: string) {
		const { getMaterialCache } = useShadingStore()
		const object = scene.value.getObjectByProperty('uuid', uuid)
		if (!object) return console.warn('cloneObject: object is undefined')
		const newObj = object.clone()
		newObj.userData.mixeur = structuredClone(getUserData(object))
		if (object instanceof THREE.Mesh && newObj instanceof THREE.Mesh) {
			newObj.material = getMaterialCache(object)?.original
		}
		addObjectToScene(newObj, object.parent)
	}

	function deleteFromScene(uuid: string) {
		const { transformControls } = useControlsStore()
		const { removeFromRaycaster } = useRaycastStore()
		const { clearMaterialCache } = useShadingStore()
		const { removeFromOutline } = useComposerStore()
		const { selectObject, selectedObject } = useThreeStore()

		transformControls?.detach()
		const object = scene.value.getObjectByProperty('uuid', uuid)

		if (!object) return console.warn('deleteFromScene: object is undefined')

		if (selectedObject?.uuid === object.uuid) selectObject()

		const helperUUID = getUserData(object).helperUUID
		if (helperUUID) {
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

		const cameraStore = useCameraStore()
		if (cameraStore.renderCamera?.uuid === object.uuid) {
			cameraStore.renderCamera = null
		}

		removeFromOutline(object.uuid)
		removeFromRaycaster(object.uuid)

		disposeModel(object)
		clearMaterialCache(object.uuid)
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

		const newObj = object.clone()

		if (newObj instanceof THREE.Mesh) {
			const { materialCache } = useShadingStore()
			newObj.material = materialCache.get(object.uuid)?.original
		}

		const json = newObj.toJSON()
		json.object.userData = {}
		const blob = new Blob([JSON.stringify(json)], { type: 'application/json' })
		downloadFile(blob, `${newObj.name || newObj.type}.json`)
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

	function exportScene() {
		const { shadingMode, setMode } = useShadingStore()
		const mode = shadingMode
		setMode('export')
		exportModel(scene.value)
		setMode(mode)
	}

	function saveProjectFile() {
		const toast = useToast()
		try {
			const { materialCache } = useShadingStore()
			const cameraStore = useCameraStore()

			let renderCameraUUID: string | null = null

			const exportScene = new THREE.Scene()

			scene.value.children.forEach((child) => {
				if (getUserData(child).isHelper) return

				const childClone = child.clone()

				if (child.uuid === cameraStore.renderCamera?.uuid) {
					renderCameraUUID = childClone.uuid
				}

				if (childClone instanceof THREE.Mesh) {
					const cachedMaterials = materialCache.get(child.uuid)
					if (childClone.geometry instanceof TextGeometry) {
						childClone.geometry.userData = getUserData(child).text ?? {}
					}

					childClone.material = cachedMaterials?.original
				}

				exportScene.add(childClone)
			})

			const data = {
				scene: exportScene.toJSON(),
				renderCameraUUID
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

					toast.add({
						type: 'success',
						message: 'Project loaded successfully'
					})
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
		addGroup,
		moveObjectToTarget,
		addObjectToScene,
		cloneObject,
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
