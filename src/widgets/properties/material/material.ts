import { useShadingStore } from '@/app/model/shading'
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { computed, triggerRef } from 'vue'
import type { MeshMaterials } from './utils/types'
import type { FieldTarget, ObjectProp } from '@/shared/lib/field-descriptor'
import { storeToRefs } from 'pinia'

const mesh = computed(() => {
	const { selectedObject } = storeToRefs(useSelectionStore())
	if (selectedObject.value instanceof THREE.Mesh) {
		return selectedObject.value
	}
	return null
})

const material = computed<MeshMaterials | null>(() => {
	const shadingStore = useShadingStore()

	if (mesh.value) {
		const mat = shadingStore.getMaterialCache(mesh.value)?.original
		if (mat instanceof THREE.Material) return mat as MeshMaterials
	}
	return null
})

export function useMeshMaterial<T extends THREE.Material>() {
	const shadingStore = useShadingStore()

	function updateMaterialProp(data: { prop: ObjectProp<T>; value: T[ObjectProp<T>] }) {
		if (!mesh.value) return
		shadingStore.updateMaterial<T>(mesh.value, data)
		triggerRef(material)
	}

	function getMaterialProp(prop: ObjectProp<T>): unknown {
		if (!material.value) return undefined
		return material.value[prop as ObjectProp<MeshMaterials>]
	}

	function changeMaterial(newMaterial: THREE.Material) {
		if (!mesh.value) return
		shadingStore.changeMaterial(mesh.value, newMaterial)
		triggerRef(mesh)
	}

	/**
	 * Field reads and writes for the selected mesh's material. Writes go through
	 * the shading store rather than mutating the material, because the store owns
	 * the original/preview material cache and the `needsUpdate` flag.
	 */
	function createMaterialTarget(): FieldTarget<T> {
		return {
			read(prop) {
				return getMaterialProp(prop)
			},
			write(prop, value) {
				updateMaterialProp({ prop, value: prepare(prop, value) as T[ObjectProp<T>] })
			}
		}
	}

	return {
		mesh,
		material,
		changeMaterial,
		createMaterialTarget
	}
}

/**
 * Material-specific adjustments a value needs before it is stored. A toon
 * gradient ramp has to sample without interpolation, or the bands blur away.
 */
function prepare(prop: string, value: unknown) {
	if (prop === 'gradientMap' && value instanceof THREE.Texture) {
		value.magFilter = THREE.NearestFilter
		value.minFilter = THREE.NearestFilter
	}
	return value
}
