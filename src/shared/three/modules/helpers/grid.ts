import THREE from '@/shared/three'
import { InfiniteGridHelper } from './InfiniteGridHelper'
import { getUserData } from '@/shared/three/utils'

export function setGridHelper(scene: THREE.Scene) {
	const grid = new InfiniteGridHelper(1, 10, new THREE.Color(0.48, 0.48, 0.48), 1000)
	grid.renderOrder = -1
	grid.name = 'InfiniteGridHelper'

	const userData = getUserData(grid)
	userData.isHelper = true
	userData.hideInOutliner = true
	userData.isSystemObj = true

	scene.add(grid)

	const axes = getAxes()
	scene.add(axes)
	return grid
}

function getAxes() {
	const axes = new THREE.AxesHelper(1000)
	// eslint-disable-next-line no-restricted-syntax -- an editor helper with no children, never part of the scene's data
	const axesMirror = axes.clone(true)
	axesMirror.rotateY(Math.PI)
	const axesGroup = new THREE.Group()
	axesGroup.add(axes, axesMirror)
	axesGroup.name = 'AxesHelper'

	const userData = getUserData(axesGroup)
	userData.isHelper = true
	userData.hideInOutliner = true
	userData.isSystemObj = true

	axesGroup.children.forEach((child) => {
		child.scale.y = 0
	})
	return axesGroup
}
