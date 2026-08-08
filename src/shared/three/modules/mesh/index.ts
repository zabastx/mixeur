import THREE from '@/shared/three'

export * from './uv-grid'

const meshCountMap = new Map<GeometryTypes, number>([
	['plane', 0],
	['cube', 0],
	['circle', 0],
	['sphere', 0],
	['icosphere', 0],
	['cylinder', 0],
	['cone', 0],
	['torus', 0]
])

export function createMesh(type: GeometryTypes) {
	let geometry: THREE.BufferGeometry
	switch (type) {
		case 'plane':
			geometry = new THREE.PlaneGeometry()
			break
		case 'cube':
			geometry = new THREE.BoxGeometry()
			break
		case 'circle':
			geometry = new THREE.CircleGeometry()
			break
		case 'sphere':
			geometry = new THREE.SphereGeometry()
			break
		case 'icosphere':
			geometry = new THREE.IcosahedronGeometry()
			break
		case 'cylinder':
			geometry = new THREE.CylinderGeometry()
			break
		case 'cone':
			geometry = new THREE.ConeGeometry()
			break
		case 'torus':
			geometry = new THREE.TorusGeometry()
			break
		default:
			throw new Error(`Unsupported geometry type: ${type}`)
	}
	geometry.setAttribute('uv1', geometry.attributes.uv)
	const material = new THREE.MeshStandardMaterial()
	material.side = THREE.DoubleSide
	const mesh = new THREE.Mesh(geometry, material)
	meshCountMap.set(type, (meshCountMap.get(type) ?? 0) + 1)
	const count = meshCountMap.get(type) ?? 0
	mesh.name = `${type}.${count.toString().padStart(3, '0')}`
	return mesh
}

export function isThreeGeometry(geometry: THREE.BufferGeometry) {
	return (
		geometry instanceof THREE.BoxGeometry ||
		geometry instanceof THREE.PlaneGeometry ||
		geometry instanceof THREE.CircleGeometry ||
		geometry instanceof THREE.SphereGeometry ||
		geometry instanceof THREE.IcosahedronGeometry ||
		geometry instanceof THREE.CylinderGeometry ||
		geometry instanceof THREE.ConeGeometry ||
		geometry instanceof THREE.TorusGeometry
	)
}

export type GeometryTypes =
	| 'plane'
	| 'cube'
	| 'circle'
	| 'sphere'
	| 'icosphere'
	| 'cylinder'
	| 'cone'
	| 'torus'
