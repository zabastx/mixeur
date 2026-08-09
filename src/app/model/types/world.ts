/**
 * The World: the scene's own environment — the surface behind and around
 * everything, and the light it casts. Distinct from the Studio Light, which is
 * the editor's material-preview rig. See ADR-0002 and CONTEXT.md.
 */

/**
 * What the World is made of. A colour or an image, never both — the equivalent
 * of Blender's Background shader node minus the node graph.
 *
 * Image-backed Surfaces arrive with the Sources that produce them (presets,
 * Poly Haven, import).
 */
export type WorldSurface = { kind: 'color'; color: string }

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
 * The World as written into a `.mixeur` file.
 *
 * `Scene.toJSON()` serializes neither `background` nor `environment`, so the
 * World cannot ride along with the scene and needs its own block. Absent on
 * files saved before the World existed — readers must default rather than fail.
 */
export interface WorldSnapshot {
	surface: WorldSurface
	strength: number
	fog: WorldFog
}

/**
 * The backdrop shown below `rendered` — editor chrome, not World data. It is
 * also the default World colour, so a new project looks exactly like one from
 * before the World existed until someone edits it.
 */
export const VIEWPORT_BACKDROP = '#3D3D3D'
