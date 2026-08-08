import THREE from '@/shared/three'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js'

const fontLoader = new FontLoader()

export class MxObjectLoader extends THREE.ObjectLoader {
	parseGeometries(json?: (THREE.InstancedBufferGeometry | THREE.BufferGeometry)[]): {
		[key: string]: THREE.InstancedBufferGeometry | THREE.BufferGeometry
	} {
		const textEntries = json?.filter((g) => g.type === 'TextGeometry')
		const otherEntries = json?.filter((g) => g.type !== 'TextGeometry')

		const geometries = super.parseGeometries(otherEntries)

		if (textEntries) {
			for (const entry of textEntries) {
				const { textValue, parameters } = entry.userData
				if (!parameters) continue
				const font = fontLoader.parse(parameters.options.font.data)
				const geometry = new TextGeometry(textValue, { ...parameters.options, font })
				geometry.userData = entry.userData
				geometry.uuid = entry.uuid
				geometries[entry.uuid] = geometry
			}
		}

		return geometries
	}
}
