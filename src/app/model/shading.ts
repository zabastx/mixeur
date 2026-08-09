import THREE from '@/shared/three'
import type { LightHelper } from '@/shared/three/modules/light'
import { loadStudioLight } from '@/shared/three/modules/loaders/studio-light'
import { getUserData } from '@/shared/three/utils'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'
import type { MaterialCache, ShadingMode } from './types/shading'
import { useSceneStore } from './scene'
import { useWorldStore } from './world'
import { VIEWPORT_BACKDROP } from './types/world'

const ZERO_ROTATION = new THREE.Euler()

export const useShadingStore = defineStore('shading', () => {
	const solidModeLights = getSolidShadingLights()
	const currentMode = ref<ShadingMode>('solid')
	const studioLight = shallowRef<THREE.Texture | null>(null)

	// The Studio Light's own intensity and rotation, rather than the scene fields
	// it used to write directly. Those fields are shared with the World, and a
	// trip through rendered mode would otherwise overwrite whatever the preview
	// popover had been set to.
	const studioLightIntensity = ref(1)
	const studioLightRotation = ref(new THREE.Euler())
	const materialCache = new Map<string, MaterialCache>()
	const shadingMode = computed(() => currentMode.value)

	let helperObjects: THREE.Object3D[] = []

	/**
	 * Determines if an object should be affected by shading modes.
	 * Only objects explicitly marked as shadable will be affected by shading changes.
	 * Uses userData.isShadable to identify objects that should respond to shading modes.
	 *
	 * @param object - The object to check
	 * @returns True if the object should be shaded, false otherwise
	 */
	function shouldShadeObject(object: THREE.Object3D): boolean {
		// Only objects explicitly marked as shadable will be affected
		return !!getUserData(object).isShadable
	}

	/**
	 * Caches the original materials of all meshes in the scene.
	 * This allows restoring the original materials when switching back to 'rendered' mode.
	 * Only caches materials for objects marked as shadable.
	 */
	function cacheOriginalMaterials() {
		const { scene } = useSceneStore()
		scene.traverse((object) => {
			if (object instanceof THREE.Mesh && object.material && shouldShadeObject(object)) {
				cacheMeshMaterials(object)
			}
		})
	}

	/**
	 * Caches materials for a newly added mesh object.
	 * This should be called whenever new meshes are added to the scene after initialization.
	 * Only caches materials for objects marked as shadable.
	 *
	 * @param object - The mesh object to cache materials for
	 */
	function cacheNewObjectMaterials(object: THREE.Object3D) {
		object.traverse((child) => {
			if (
				child instanceof THREE.Mesh &&
				child.material &&
				!materialCache.has(child.uuid) &&
				shouldShadeObject(child)
			) {
				cacheMeshMaterials(child)
				// Apply current shading mode to the new mesh
				applyModeToMesh(child, currentMode.value)
			}
		})
	}

	/**
	 * Caches materials for a single mesh.
	 *
	 * @param mesh - The mesh to cache materials for
	 */
	function cacheMeshMaterials(mesh: THREE.Mesh) {
		if (!mesh.material) return

		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
		const originalMaterials = materials.map((mat) => mat.clone())
		materialCache.set(mesh.uuid, {
			original: Array.isArray(mesh.material) ? originalMaterials : originalMaterials[0],
			wireframe: createWireframeMaterial(mesh.material),
			solid: createSolidMaterial(mesh.material)
		})
	}

	/**
	 * Sets the shading mode for all meshes in the scene.
	 *
	 * @param mode - The shading mode to apply
	 */
	function setMode(mode: ShadingMode) {
		if (mode === shadingMode.value) return
		currentMode.value = mode
		const { scene, updateScene } = useSceneStore()

		applyEnvironment(mode)

		if (mode === 'rendered') {
			setSceneLightsVisibility(true)
		} else {
			setSceneLightsVisibility(false)
		}

		if (mode === 'export') {
			scene.traverse((object) => {
				if (getUserData(object).isHelper) {
					object.visible = false
					helperObjects.push(object)
				}
			})
			setMode('rendered')
		} else {
			helperObjects.forEach((obj) => {
				obj.visible = true
			})
			helperObjects = []
		}

		scene.traverse((object) => {
			const userData = getUserData(object)
			if (userData.hideInModes?.includes(mode)) {
				object.visible = false
			} else {
				object.visible = userData.userVisible ?? true
			}
			if (object instanceof THREE.Mesh) {
				applyModeToMesh(object, mode)
			}
		})

		updateScene()
	}

	function setStudioLight(light: THREE.Texture) {
		studioLight.value = light
		applyEnvironment(currentMode.value)
	}

	/**
	 * Writes `environment`, `background` and `fog` onto the scene for a shading
	 * mode.
	 *
	 * `scene.environment` is a single slot, so the Studio Light and the World can
	 * never both be mounted — preview shows you the material under known light,
	 * rendered shows you the scene under its own (ADR-0002). Below rendered the
	 * backdrop is editor chrome, not World data, which is why the World's colour
	 * only reaches the viewport once the mode asks for it.
	 */
	function applyEnvironment(mode: ShadingMode) {
		const { scene } = useSceneStore()
		const world = useWorldStore()
		const showsWorld = mode === 'rendered' || mode === 'export'

		scene.environment =
			mode === 'preview' ? studioLight.value : showsWorld ? world.environment : null
		scene.background = showsWorld ? world.background() : new THREE.Color(VIEWPORT_BACKDROP)
		scene.fog = showsWorld ? world.sceneFog() : null

		// One value drives both: a sky brighter than the light it casts is a lie
		// nobody reaches for deliberately. `backgroundIntensity` has no effect
		// until a Surface is a texture, and is written now so it cannot be missed
		// when one is.
		const intensity = showsWorld ? world.strength : studioLightIntensity.value
		scene.environmentIntensity = intensity
		scene.backgroundIntensity = intensity

		// The World has no orientation while its Surface is a flat colour.
		scene.environmentRotation.copy(showsWorld ? ZERO_ROTATION : studioLightRotation.value)
		scene.backgroundRotation.copy(scene.environmentRotation)
	}

	/**
	 * Applies the specified shading mode to a single mesh.
	 *
	 * @param mesh - The mesh to apply the shading mode to
	 * @param mode - The shading mode to apply
	 */
	function applyModeToMesh(mesh: THREE.Mesh, mode: ShadingMode) {
		const cache = materialCache.get(mesh.uuid)
		if (!cache) return

		switch (mode) {
			case 'wireframe':
				mesh.material = cache.wireframe
				break
			case 'solid':
				mesh.material = cache.solid
				break
			case 'preview':
				mesh.material = cache.original
				break
			case 'rendered':
				mesh.material = cache.original
				break
		}
	}

	/**
	 * Creates wireframe materials for the given original materials.
	 * Handles both single materials and material arrays.
	 *
	 * @param original - The original material(s) to base the wireframe on
	 * @returns Wireframe material(s) with the same color and transparency
	 */
	function createWireframeMaterial(original: THREE.Material | THREE.Material[]) {
		if (Array.isArray(original)) {
			return original.map((mat) => createSingleWireframeMaterial(mat))
		}
		return createSingleWireframeMaterial(original)
	}

	/**
	 * Creates a single wireframe material from an original material.
	 * Preserves color, transparency, and opacity properties.
	 *
	 * @param original - The original material
	 * @returns A new MeshBasicMaterial with wireframe enabled
	 */
	function createSingleWireframeMaterial(original: THREE.Material) {
		const wireframeMat = new THREE.MeshBasicMaterial({
			color: 0x000000,
			wireframe: true,
			transparent: original.transparent,
			opacity: original.opacity
		})
		return wireframeMat
	}

	/**
	 * Creates solid materials for the given original materials.
	 * Solid mode uses flat shading with basic Lambertian lighting.
	 *
	 * @param original - The original material(s) to base the solid materials on
	 * @returns Solid material(s) with flat shading
	 */
	function createSolidMaterial(original: THREE.Material | THREE.Material[]) {
		if (Array.isArray(original)) {
			return original.map((mat) => createSingleSolidMaterial(mat))
		}
		return createSingleSolidMaterial(original)
	}

	/**
	 * Creates a single solid material from an original material.
	 * Uses MeshLambertMaterial with flat shading and uniform grey color.
	 * Matches Blender's solid mode behavior where all objects appear grey.
	 *
	 * @param original - The original material
	 * @returns A new MeshLambertMaterial with flat shading and grey color
	 */
	function createSingleSolidMaterial(original: THREE.Material) {
		const solidMat = new THREE.MeshLambertMaterial({
			color: 0xcccccc,
			flatShading: true,
			transparent: original.transparent,
			opacity: original.opacity
		})
		return solidMat
	}

	function init() {
		const { scene } = useSceneStore()
		solidModeLights.forEach((item) => scene?.add(item))
		cacheOriginalMaterials()

		// Editing the World has to reach the viewport without a mode change, and
		// so does dragging the preview popover's sliders. Watched here rather than
		// in the World store because this is where the mode table lives.
		const world = useWorldStore()
		watch(
			[() => world.surface, () => world.strength, () => world.fog, studioLightIntensity],
			() => applyEnvironment(currentMode.value),
			{ deep: true }
		)
		watch(studioLightRotation, () => applyEnvironment(currentMode.value), { deep: true })

		loadStudioLight('forest').then((result) => {
			if (result.ok) setStudioLight(result.value)
		})
		setMode(currentMode.value)
		// `setMode` returns early when the mode is unchanged, so the first paint
		// needs the environment written explicitly.
		applyEnvironment(currentMode.value)
	}

	function setSceneLightsVisibility(val: boolean) {
		const { scene } = useSceneStore()
		scene.traverse((obj: LightHelper | THREE.Object3D) => {
			if ('light' in obj && getUserData(obj).isSceneLight) {
				obj.light.visible = val
			}
		})
	}

	function getMaterialCache(mesh: THREE.Mesh) {
		const cache = materialCache.get(mesh.uuid)
		return cache
	}

	/**
	 * The material a mesh is really shaded with — the cached original, not
	 * `mesh.material`.
	 *
	 * Solid and wireframe substitute a flat material, so anything that reads or
	 * writes `mesh.material` in those modes is looking at a stand-in that the
	 * next mode change will throw away. Callers outside this store cannot know
	 * that, which is why the answer belongs here rather than at each of them.
	 *
	 * Multi-material meshes report their first slot; there is no single answer
	 * for them, and every caller so far wants one.
	 */
	function shadedMaterial(mesh: THREE.Mesh): THREE.Material | undefined {
		const material = materialCache.get(mesh.uuid)?.original ?? mesh.material
		return Array.isArray(material) ? material[0] : material
	}

	function updateMaterial<T extends THREE.Material = THREE.Material, K extends keyof T = keyof T>(
		mesh: THREE.Mesh,
		data: { prop: K; value: T[K] }
	) {
		const cache = materialCache.get(mesh.uuid)
		if (!cache) return
		if (Array.isArray(cache.original)) return

		const originalMaterial = cache.original as unknown as T
		updateMaterialProperty<T>(originalMaterial, data.prop, data.value)
		originalMaterial.needsUpdate = true
	}

	/**
	 * Updates a material property, handling special cases like Color objects.
	 * This ensures proper updates for all property types including Colors, Vectors, etc.
	 */
	function updateMaterialProperty<T extends THREE.Material = THREE.Material>(
		material: T,
		prop: keyof T,
		value: T[typeof prop]
	) {
		const currentValue = material[prop]

		if (currentValue instanceof THREE.Color && value instanceof THREE.Color) {
			currentValue.copy(value)
		} else if (currentValue instanceof THREE.Vector2 && value instanceof THREE.Vector2) {
			currentValue.copy(value)
		} else if (currentValue instanceof THREE.Vector3 && value instanceof THREE.Vector3) {
			currentValue.copy(value)
		} else if (currentValue instanceof THREE.Vector4 && value instanceof THREE.Vector4) {
			currentValue.copy(value)
		} else {
			material[prop] = value
		}
	}

	function changeMaterial(mesh: THREE.Mesh, newMaterial: THREE.Material) {
		const cache = materialCache.get(mesh.uuid)
		if (!cache) return
		cache.original = newMaterial
		applyModeToMesh(mesh, currentMode.value)
	}

	function clearMaterialCache(uuid: string) {
		const cache = materialCache.get(uuid)
		if (!cache) return false

		disposeMaterials(cache.original)
		disposeMaterials(cache.solid)
		disposeMaterials(cache.wireframe)

		function disposeMaterials(materials: THREE.Material | THREE.Material[]) {
			if (Array.isArray(materials)) {
				materials.forEach((mat) => mat.dispose())
			} else {
				materials.dispose()
			}
		}

		return materialCache.delete(uuid)
	}

	return {
		init,
		cacheNewObjectMaterials,
		studioLight,
		studioLightIntensity,
		studioLightRotation,
		setStudioLight,
		setMode,
		shadingMode,
		materialCache,
		getMaterialCache,
		shadedMaterial,
		updateMaterial,
		changeMaterial,
		clearMaterialCache
	}
})

function getSolidShadingLights() {
	// Ambient light for overall illumination
	const ambient = new THREE.AmbientLight(0xffffff, 1)
	ambient.name = 'SolidModeAmbientLight'

	// Main directional light (key light)
	const mainLight = new THREE.DirectionalLight(0xffffff, 0.8)
	mainLight.name = 'SolidModeMainLight'
	mainLight.position.set(5, 5, 5)

	// Fill directional light for softer lighting
	const fillLight = new THREE.DirectionalLight(0xffffff, 0.3)
	fillLight.name = 'SolidModeFillLight'
	fillLight.position.set(-5, -5, -5)

	const lights = [ambient, mainLight, fillLight]

	lights.forEach((item) => {
		const userData = getUserData(item)
		userData.hideInOutliner = true
		userData.isHelper = true
		userData.isSystemObj = true
		userData.hideInModes = ['wireframe', 'preview', 'rendered', 'export']
	})

	return lights
}

if (import.meta.hot) {
	import.meta.hot.accept(acceptHMRUpdate(useShadingStore, import.meta.hot))
}
