import { movingVerts } from './selection'
import { singlePivot } from './transform'
import type { UvLayout, UvPoint, UvSelection, UvTransform } from './types'

/**
 * A modal transform: press a key, move the mouse, click to confirm. Blender's
 * G, R and S, and the reason its UV editor needs no on-canvas handles — the
 * pointer *is* the handle, so nothing occludes the texture you are judging.
 */
export type TransformKind = 'move' | 'rotate' | 'scale'

/** A modal transform locked to one axis, or free. Blender's X and Y. */
export type TransformAxis = 'u' | 'v' | null

/**
 * How far from the origin the pointer must be before a rotate or scale can be
 * measured from it — in UV units, so 2% of the tile.
 *
 * A modal that starts on top of the pivot has no angle and no radius to measure
 * against, and no amount of pointer travel afterwards fixes it: the reference
 * itself is the degenerate thing. Callers re-seed the reference until it is at
 * least this far out.
 */
export const MIN_REFERENCE = 0.02

/**
 * The one point a modal rotate or scale measures the mouse against.
 *
 * Not the same thing as the transform's pivot: `individual` gives every island
 * its own centre, and the mouse has only one angle to report, so it falls back
 * to the median the way Blender's header readout does.
 */
export function transformOrigin(
	layout: UvLayout,
	uv: ArrayLike<number>,
	selection: UvSelection
): UvPoint {
	// Answered before the selection is gathered: the cursor is the one pivot
	// that does not depend on what is selected, and gathering costs real time on
	// a dense mesh.
	if (selection.pivot === 'cursor') return selection.cursor
	return singlePivot(uv, movingVerts(layout, uv, selection), selection)
}

/**
 * What the pointer travelling from `from` to `to` means for the given kind.
 *
 * The result is always measured from where the modal *started*, never from the
 * previous frame, so it is applied to the buffer captured at that moment. A
 * per-frame delta would accumulate rounding and make cancelling inexact.
 */
export function modalTransform(
	kind: TransformKind,
	from: UvPoint,
	to: UvPoint,
	origin: UvPoint,
	axis: TransformAxis = null
): { transform: UvTransform; label: string } {
	if (kind === 'move') {
		const du = axis === 'v' ? 0 : to[0] - from[0]
		const dv = axis === 'u' ? 0 : to[1] - from[1]
		return {
			transform: { translate: [du, dv] },
			label: `Move U ${du.toFixed(4)} V ${dv.toFixed(4)}${along(axis)}`
		}
	}

	if (kind === 'rotate') {
		// Rotation has no axis to lock to in a plane, so `axis` is ignored.
		//
		// Wrapped into (-180°, 180°], which is also the reach of one modal: the
		// difference of two `atan2` readings carries no winding, so going further
		// would come out the other side rather than keep turning. Every rotation
		// a UV layout wants is inside that, and a bigger one is two modals.
		const angle = wrap(
			Math.atan2(to[1] - origin[1], to[0] - origin[0]) -
				Math.atan2(from[1] - origin[1], from[0] - origin[0])
		)
		return {
			transform: { rotate: angle },
			label: `Rotate ${((angle * 180) / Math.PI).toFixed(1)}°`
		}
	}

	const start = Math.hypot(from[0] - origin[0], from[1] - origin[1])
	const now = Math.hypot(to[0] - origin[0], to[1] - origin[1])
	// Degenerate references are the caller's to avoid, but a public pure
	// function will not divide by one.
	const factor = start < 1e-6 ? 1 : now / start
	return {
		transform: { scale: [axis === 'v' ? 1 : factor, axis === 'u' ? 1 : factor] },
		label: `Scale ${factor.toFixed(3)}${along(axis)}`
	}
}

const along = (axis: TransformAxis) => (axis ? ` — along ${axis.toUpperCase()}` : '')

/** Into (-π, π]. */
const wrap = (angle: number) => angle - Math.PI * 2 * Math.round(angle / (Math.PI * 2))
