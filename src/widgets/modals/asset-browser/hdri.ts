/**
 * Turning Poly Haven's HDRI file listing into the handful of choices this app
 * actually offers.
 *
 * Poly Haven publishes every HDRI at six resolutions in two formats. The
 * browser offers three of them in one format, and the reasons are in the
 * constants below. Kept apart from the browser component so the rules are
 * readable and testable without mounting a modal.
 */

import type { HDRIFiles } from './types/polyhaven'

/**
 * The resolutions offered, smallest first.
 *
 * 8k and 16k exist upstream and are 100–350 MB apiece. A World is a backdrop
 * and the light it casts, neither of which repays that download over a browser
 * connection, and offering it would be the easiest way to hang a session.
 */
export const HDRI_RESOLUTIONS = ['1k', '2k', '4k'] as const

export type HDRIResolution = (typeof HDRI_RESOLUTIONS)[number]

/**
 * The one picked when a World is chosen without touching the resolution.
 *
 * A few megabytes: large enough that the backdrop is not visibly soft, small
 * enough that browsing several in a row stays quick.
 */
export const DEFAULT_HDRI_RESOLUTION: HDRIResolution = '2k'

/**
 * The format asked for.
 *
 * Radiance HDR over EXR: at these resolutions the two look the same behind a
 * scene, and the HDR is roughly half the bytes. `HDRLoader` reads it.
 */
const HDRI_FORMAT = 'hdr'

/**
 * One downloadable HDRI: which asset, at which resolution, and where its bytes
 * are.
 *
 * This is what the browser hands its caller, and — bar the display name — what
 * a `.mixeur` file records so the World can fetch itself again on reopening.
 */
export interface HDRISelection {
	/** Poly Haven's slug, which is also what their API is queried by. */
	id: string
	/** Display name, for a panel that has to say which HDRI this is. */
	name: string
	resolution: HDRIResolution
	/** Direct link to the file — no API call needed to follow it. */
	url: string
	/** Bytes, so a download can be sized before it starts. */
	size: number
}

/** One resolution on offer for an asset, before the asset's name is attached. */
export type HDRIOption = Pick<HDRISelection, 'resolution' | 'url' | 'size'>

/**
 * The resolutions of one HDRI this app will download, smallest first.
 *
 * Silent about everything else in the payload: backplates, tonemapped previews
 * and the sizes above 4k are all things the browser has no control for.
 */
export function hdriOptions(files: HDRIFiles): HDRIOption[] {
	const byResolution = files?.hdri ?? {}

	return HDRI_RESOLUTIONS.flatMap((resolution) => {
		const file = byResolution[resolution]?.[HDRI_FORMAT]
		if (!file) return []
		return [{ resolution, url: file.url, size: file.size }]
	})
}

/**
 * Whether a value is a complete {@link HDRISelection}.
 *
 * The browser reaches its caller through the modal registry, which is typed
 * `unknown` because one callback slot serves every dialog. This is where that
 * `unknown` is turned back into something a World can be built from.
 */
export function isHDRISelection(value: unknown): value is HDRISelection {
	if (typeof value !== 'object' || value === null) return false

	const candidate = value as Record<string, unknown>
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.name === 'string' &&
		isHDRIResolution(candidate.resolution) &&
		typeof candidate.url === 'string' &&
		typeof candidate.size === 'number'
	)
}

function isHDRIResolution(value: unknown): value is HDRIResolution {
	return HDRI_RESOLUTIONS.some((resolution) => resolution === value)
}
