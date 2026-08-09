/**
 * The World: the scene's own environment — the surface behind and around
 * everything, and the light it casts. Distinct from the Studio Light, which is
 * the editor's material-preview rig. See ADR-0002 and CONTEXT.md.
 */

import type { StudioLightName } from '@/shared/three/modules/loaders/studio-light'
import type { HDRISelection } from '@/widgets/modals/asset-browser/hdri'

// A bundled image is named by the file it comes from. The same eight files serve
// as Studio Lights: the pixels are shared, the roles are not — see ADR-0002.
export type { StudioLightName }

/**
 * Where an image Surface came from.
 *
 * Kept apart from the image itself because it is what a project file can
 * record: a texture cannot be serialized, but the answer to "which one was it"
 * can, and that is what lets a World come back when a project is reopened. An
 * imported Source follows, and it is the one that cannot answer — see ADR-0002.
 */
export type WorldSource =
	| { kind: 'preset'; name: StudioLightName }
	/**
	 * A Poly Haven HDRI, recorded exactly as its browser handed it over — the URL
	 * included, so restoring one needs no API call. Spelling the fields out again
	 * here would be a shape that only has to *look* like the browser's to compile,
	 * and would drift the first time one of them gained a field.
	 */
	| ({ kind: 'polyhaven' } & HDRISelection)

export type WorldSourceKind = WorldSource['kind']

/**
 * Every Source and its label.
 *
 * No `create` alongside them, unlike the tables below: only a preset has a
 * default. Choosing Poly Haven opens the HDRI browser, and the Surface changes
 * when something comes back from it — which is also why the World is never in a
 * half-chosen state.
 */
export const SOURCE_KINDS = {
	preset: { label: 'Preset' },
	polyhaven: { label: 'Poly Haven' }
} as const satisfies Record<WorldSourceKind, { label: string }>

export function isWorldSourceKind(value: string): value is WorldSourceKind {
	return value in SOURCE_KINDS
}

/** The preset an image Surface starts on. */
export const DEFAULT_PRESET: StudioLightName = 'forest'

/**
 * What the World is made of. A colour or an image, never both — the equivalent
 * of Blender's Background shader node minus the node graph.
 */
export type WorldSurface =
	{ kind: 'color'; color: string } | { kind: 'texture'; source: WorldSource }

export type WorldSurfaceKind = WorldSurface['kind']

/** Every Surface kind, its label and how to start one. */
export const SURFACE_KINDS = {
	color: {
		label: 'Color',
		create: (): WorldSurface => ({ kind: 'color', color: VIEWPORT_BACKDROP })
	},
	texture: {
		label: 'Image',
		create: (): WorldSurface => ({
			kind: 'texture',
			source: { kind: 'preset', name: DEFAULT_PRESET }
		})
	}
} as const satisfies Record<WorldSurfaceKind, { label: string; create: () => WorldSurface }>

export function isWorldSurfaceKind(value: string): value is WorldSurfaceKind {
	return value in SURFACE_KINDS
}

/**
 * Distance haze. `none` is a member rather than a nullable Surface because the
 * UI switches between three states and the serialized form has to name the one
 * it is in.
 */
export type WorldFog =
	| { kind: 'none' }
	| { kind: 'linear'; color: string; near: number; far: number }
	| { kind: 'exp2'; color: string; density: number }

export type WorldFogKind = WorldFog['kind']

/**
 * Default colour for new fog.
 *
 * Not the backdrop, though fog matching the sky is the physically honest
 * choice: at `VIEWPORT_BACKDROP` the swatch is invisible against the properties
 * panel and the fog is invisible against the default World, so turning fog on
 * appears to do nothing. A mid grey reads as fog in both places, and anyone who
 * wants it to match the sky can say so.
 */
const FOG_COLOR = '#808080'

/**
 * Every fog kind, its label and how to start one.
 *
 * One list rather than a switch in the store and a matching array of options in
 * the panel: those two had to agree about which kinds exist, and nothing made
 * them.
 */
export const FOG_KINDS = {
	none: { label: 'None', create: (): WorldFog => ({ kind: 'none' }) },
	linear: {
		label: 'Linear',
		create: (): WorldFog => ({ kind: 'linear', color: FOG_COLOR, near: 1, far: 100 })
	},
	exp2: {
		label: 'Exponential',
		create: (): WorldFog => ({ kind: 'exp2', color: FOG_COLOR, density: 0.02 })
	}
} as const satisfies Record<WorldFogKind, { label: string; create: () => WorldFog }>

export function isWorldFogKind(value: string): value is WorldFogKind {
	return value in FOG_KINDS
}

/**
 * The World as written into a `.mixeur` file.
 *
 * `Scene.toJSON()` serializes neither `background` nor `environment`, so the
 * World cannot ride along with the scene and needs its own block. Absent on
 * files saved before the World existed — readers must default rather than fail.
 */
export interface WorldSnapshot {
	surface: WorldSurface
	strength: number
	/**
	 * How much the visible Surface is blurred. Affects the backdrop only, never
	 * the light it casts — the one place where showing and lighting are allowed
	 * to disagree, because a soft backdrop is a framing choice with no physical
	 * counterpart.
	 */
	blurriness: number
	/** Euler angles in radians, as a plain triple so it survives serialization. */
	rotation: [number, number, number]
	fog: WorldFog
}

/**
 * The most a Surface may be blurred.
 *
 * Three.js accepts up to 1, but the whole usable range is at the bottom of it:
 * any value above zero makes the renderer swap the backdrop for a PMREM version
 * of itself (`WebGLBackground`), and that ladder is roughness shaped, so around
 * 0.2 the sky is a flat wash indistinguishable from a colour Surface — which is
 * what a colour Surface is for.
 */
export const MAX_BLURRINESS = 0.2

export function clampBlurriness(value: number): number {
	return Math.min(Math.max(value, 0), MAX_BLURRINESS)
}

/**
 * The World a project starts with, and the one a project saved before the World
 * existed loads as.
 */
export function defaultWorld(): WorldSnapshot {
	return {
		surface: SURFACE_KINDS.color.create(),
		strength: 1,
		blurriness: 0,
		rotation: [0, 0, 0],
		fog: { kind: 'none' }
	}
}

/**
 * The backdrop shown below `rendered` — editor chrome, not World data. It is
 * also the default World colour, so a new project looks exactly like one from
 * before the World existed until someone edits it.
 */
export const VIEWPORT_BACKDROP = '#3D3D3D'
