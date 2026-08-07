import type { GizmoOptions } from 'three-viewport-gizmo'

/**
 * The element the gizmo renders into. `ViewportGizmo` takes a selector rather
 * than an element, so the viewport markup and this config have to agree on one
 * class name — hence the shared constant.
 */
export const GIZMO_CONTAINER_CLASS = 'gizmo-wrapper'

export function getGizmoConfig(): GizmoOptions {
	const rootStyle = getComputedStyle(document.documentElement)
	const colorX = rootStyle.getPropertyValue('--color-axis-x') || undefined
	const colorY = rootStyle.getPropertyValue('--color-axis-y') || undefined
	const colorZ = rootStyle.getPropertyValue('--color-axis-z') || undefined

	return {
		container: `.${GIZMO_CONTAINER_CLASS}`,
		className: 'gizmo',
		size: 100,
		placement: 'top-right',
		lineWidth: 3,
		resolution: 128,
		x: {
			color: colorX,
			hover: {
				labelColor: '#fff',
				color: colorX
			}
		},
		y: {
			color: colorY,
			hover: {
				labelColor: '#fff',
				color: colorY
			}
		},
		z: {
			color: colorZ,
			hover: {
				labelColor: '#fff',
				color: colorZ
			}
		}
	}
}
