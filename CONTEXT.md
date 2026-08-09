# Mixeur

A browser-based 3D scene editor built on Three.js, following Blender's interaction
model and vocabulary. This glossary fixes the terms where Blender's language, Three.js's
API and this codebase's own history disagree.

## Language

### Environment and lighting

**World**:
The scene's own environment — the surface behind and around everything, and the light
it casts. Scene data: it is saved with the project and it appears in renders.
_Avoid_: Environment, background, sky

**Studio Light**:
A fixed lighting rig used to preview materials in the viewport. Belongs to the editor,
not the scene: it is never saved and never rendered.
_Avoid_: World map, environment map, HDRI

**Surface**:
What the World is made of — either a flat colour or an equirectangular image, never
both. The equivalent of Blender's Background shader node, minus the node graph.
_Avoid_: Sky, backdrop

**Strength**:
How brightly the Surface both appears and lights the scene. One value: the visible
Surface and the light it casts cannot disagree.
_Avoid_: Intensity, exposure

**World Preset**:
One of the images bundled with the app, selectable as a World Surface. The same files
also serve as Studio Lights; the two roles are distinct even though the pixels are shared.
_Avoid_: Default world, built-in HDRI

**Source**:
Where a World's Surface image came from — a World Preset, Poly Haven, or a file the user
imported. Determines whether the Surface can be restored when a project is reopened.
_Avoid_: Origin, provider
