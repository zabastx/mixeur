/** UV coordinates closer than this count as the same point. */
export const SAME_SPOT = 1e-4

/**
 * A UV coordinate reduced to the cell it falls in, so two coordinates within
 * `SAME_SPOT` compare equal.
 *
 * Shared rather than declared where it is used, because the two callers have to
 * agree: `createUvLayout` decides with it whether two faces meet along a mesh
 * edge or tear apart at a seam, and sticky selection decides with it which UV
 * vertices sit on top of each other. A layout that called an edge continuous
 * while selection called its ends different spots would be quietly incoherent.
 */
export const quantize = (n: number) => Math.round(n / SAME_SPOT)
