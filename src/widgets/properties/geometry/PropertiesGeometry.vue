<template>
	<MxAccordionRoot type="multiple" :default-value="['geometry']">
		<MxAccordionItem v-if="data" label="Geometry" :item="{ value: 'geometry' }">
			<component
				:is="data.component"
				v-if="data.geometry"
				:key="object.uuid"
				:geometry="data.geometry"
				@update:geometry="onUpdateGeometry"
			/>
		</MxAccordionItem>
	</MxAccordionRoot>
</template>

<script lang="ts" setup>
import { useSelectionStore } from '@/app/model/selection'
import THREE from '@/shared/three'
import { computed } from 'vue'
import PropertiesGeometryBox from './PropertiesGeometryBox.vue'
import PropertiesGeometryPlane from './PropertiesGeometryPlane.vue'
import PropertiesGeometryCircle from './PropertiesGeometryCircle.vue'
import PropertiesGeometrySphere from './PropertiesGeometrySphere.vue'
import PropertiesGeometryIcosahedron from './PropertiesGeometryIcosahedron.vue'
import PropertiesGeometryCylinder from './PropertiesGeometryCylinder.vue'
import PropertiesGeometryCone from './PropertiesGeometryCone.vue'
import PropertiesGeometryTorus from './PropertiesGeometryTorus.vue'
import { enableBVH } from '@/shared/three/utils'
import { storeToRefs } from 'pinia'

const { selectedObject } = storeToRefs(useSelectionStore())

const object = computed(() => selectedObject.value as THREE.Mesh)

const data = computed(() => {
	if (!object.value) return null

	let component

	switch (object.value.geometry.type) {
		case 'BoxGeometry':
			component = PropertiesGeometryBox
			break
		case 'PlaneGeometry':
			component = PropertiesGeometryPlane
			break
		case 'CircleGeometry':
			component = PropertiesGeometryCircle
			break
		case 'SphereGeometry':
			component = PropertiesGeometrySphere
			break
		case 'IcosahedronGeometry':
			component = PropertiesGeometryIcosahedron
			break
		case 'CylinderGeometry':
			component = PropertiesGeometryCylinder
			break
		case 'ConeGeometry':
			component = PropertiesGeometryCone
			break
		case 'TorusGeometry':
			component = PropertiesGeometryTorus
			break

		default:
			return null
	}

	return {
		component,
		geometry: object.value.geometry
	}
})

function onUpdateGeometry(newGeometry: THREE.BufferGeometry) {
	if (!object.value) return
	const oldGeometry = object.value.geometry as THREE.BufferGeometry
	object.value.geometry = newGeometry
	enableBVH(object.value)
	oldGeometry.dispose()
}
</script>
