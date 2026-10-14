# Mixeur

A browser-based 3D scene editor built on Three.js, following Blender's interaction
model and vocabulary. This glossary fixes the terms where Blender's language, Three.js's
API and this codebase's own history disagree.

## Language

### Scene editing

**Duplicate**:
A new Object hierarchy whose geometry, UV layout, materials and rig can be edited
without changing the original. Existing shared geometry and rig relationships are
preserved within the Duplicate; texture images may be shared with the original.
_Avoid_: Copy, clone, linked duplicate

**UV Grid**:
A temporary checker texture for inspecting a mesh's UV layout, belonging to the editor.
Duplicates and saved or exported scene data use the mesh's underlying texture,
leaving the original's UV Grid display unchanged.
_Avoid_: Material texture, saved texture

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
