import type THREE from '@/shared/three'
import { MathUtils } from 'three'
import type { FieldDescriptor } from '@/shared/lib/field-descriptor'

const commonFields: FieldDescriptor<THREE.Light>[] = [
	{
		prop: 'color',
		type: 'color',
		label: 'Color'
	},
	{
		prop: 'intensity',
		type: 'number',
		label: 'Intensity, cd',
		min: 0
	}
]

const lightFields: {
	spot: FieldDescriptor<THREE.SpotLight>[]
	point: FieldDescriptor<THREE.PointLight>[]
	rect: FieldDescriptor<THREE.RectAreaLight>[]
} = {
	point: [
		{
			prop: 'power',
			type: 'number',
			label: 'Power, lm',
			min: 0
		},
		{
			prop: 'distance',
			type: 'number',
			label: 'Distance',
			min: 0
		}
	],
	spot: [
		{
			prop: 'power',
			type: 'number',
			label: 'Power, lm',
			min: 0
		},
		{
			prop: 'angle',
			type: 'angle',
			label: 'Angle',
			min: 0,
			max: MathUtils.radToDeg(Math.PI / 2)
		},
		{
			prop: 'distance',
			type: 'number',
			label: 'Distance',
			min: 0
		},
		{
			prop: 'map',
			type: 'map',
			label: 'Map'
		},
		{
			prop: 'penumbra',
			type: 'number',
			label: 'Penumbra',
			min: 0,
			max: 1,
			step: 0.1
		}
	],
	rect: [
		{
			prop: 'power',
			type: 'number',
			label: 'Power, lm',
			min: 0
		},
		{
			prop: 'width',
			type: 'number',
			label: 'Width',
			min: 0
		},
		{
			prop: 'height',
			type: 'number',
			label: 'Height',
			min: 0
		}
	]
}

export const lightShadowFields: FieldDescriptor<THREE.LightShadow>[] = [
	{
		prop: 'bias',
		label: 'Bias',
		type: 'number',
		step: 0.0001,
		formatOptions: {
			maximumFractionDigits: 4,
			minimumFractionDigits: 4
		}
	},
	{
		prop: 'normalBias',
		label: 'Normal Bias',
		type: 'number',
		step: 0.0001,
		formatOptions: {
			maximumFractionDigits: 4,
			minimumFractionDigits: 4
		}
	},
	{
		prop: 'intensity',
		label: 'Intensity',
		type: 'number',
		min: 0,
		max: 1,
		step: 0.01
	},
	{
		prop: 'radius',
		label: 'Radius',
		type: 'number',
		min: 0,
		step: 0.01
	},
	{
		prop: 'mapSize',
		label: 'Map Size',
		type: 'vector2',
		min: 0,
		step: 1,
		formatOptions: {
			maximumFractionDigits: 0
		}
	}
]

export function getLightFields(light: THREE.Light) {
	let arr: FieldDescriptor<THREE.Light>[] = []
	switch (light.type) {
		case 'PointLight':
			arr = lightFields.point as FieldDescriptor<THREE.Light>[]
			break
		case 'SpotLight':
			arr = lightFields.spot as FieldDescriptor<THREE.Light>[]
			break
		case 'RectAreaLight':
			arr = lightFields.rect as FieldDescriptor<THREE.Light>[]
			break
	}

	return commonFields.concat(arr)
}
