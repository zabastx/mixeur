import { useShadingStore } from '@/app/model/shading'
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { computed, triggerRef } from 'vue'
import type { FieldValueMap, MaterialProp, MeshMaterials } from './utils/types'
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

	function updateMaterialProp(data: { prop: MaterialProp<T>; value: T[MaterialProp<T>] }) {
		if (!mesh.value) return
		shadingStore.updateMaterial<T>(mesh.value, data)
		triggerRef(material)
	}

	function getMaterialProp<PropVal>(prop: MaterialProp<T>) {
		if (!material.value) return
		return material.value[prop as MaterialProp<MeshMaterials>] as PropVal
	}

	function changeMaterial(newMaterial: THREE.Material) {
		if (!mesh.value) return
		shadingStore.changeMaterial(mesh.value, newMaterial)
		triggerRef(mesh)
	}

	function getPropValue<TType extends keyof FieldValueMap>(
		type: TType,
		prop: MaterialProp<T>
	): FieldValueMap[TType] {
		switch (type) {
			case 'color':
				return `#${getMaterialProp<THREE.Color>(prop)?.getHexString() ?? '000000'}` as FieldValueMap[TType]
			case 'angle':
				return THREE.MathUtils.radToDeg(getMaterialProp<number>(prop) ?? 0) as FieldValueMap[TType]
			default:
				return getMaterialProp(prop) as FieldValueMap[TType]
		}
	}

	function setPropValue<TType extends keyof FieldValueMap>(
		type: TType,
		prop: MaterialProp<T>,
		value: FieldValueMap[TType]
	) {
		switch (type) {
			case 'color':
				updateMaterialProp({ prop, value: new THREE.Color(value as string) as T[MaterialProp<T>] })
				break
			case 'angle':
				updateMaterialProp({
					prop,
					value: THREE.MathUtils.degToRad((value as number) ?? 0) as T[MaterialProp<T>]
				})
				break
			case 'range':
				updateMaterialProp({
					prop,
					value: new THREE.Vector2().fromArray(value as number[]) as T[MaterialProp<T>]
				})
				break
			case 'map': {
				if (prop === 'gradientMap' && value instanceof THREE.Texture) {
					value.magFilter = THREE.NearestFilter
					value.minFilter = THREE.NearestFilter
				}
				updateMaterialProp({ prop, value: value as unknown as T[MaterialProp<T>] })
				break
			}
			default:
				updateMaterialProp({ prop, value: value as unknown as T[MaterialProp<T>] })
				break
		}
		triggerRef(material)
	}

	return {
		mesh,
		material,
		changeMaterial,
		getPropValue,
		setPropValue,
		getMaterialProp
	}
}
