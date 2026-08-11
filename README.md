# Mixeur

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue](https://img.shields.io/badge/Vue-3.5.41-4FC08D.svg)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.185.1-049EF4.svg)](https://threejs.org/)

A Blender-like web-based 3D editor built with Vue.js and Three.js. Mixeur provides an interface for 3D modeling, UV editing, object manipulation, and scene management directly in the browser.

## Demo

Try the live demo at [mixeur.zabastx.ru](https://mixeur.zabastx.ru)

## Features

### Object Manipulation

- **Selection & Transformation**: Click to select objects with transform gizmos (move, rotate, scale)
- **BVH Acceleration**: Fast raycasting and collision detection using Bounding Volume Hierarchy
- **Blender-style Controls**: Familiar navigation with viewport gizmo for orientation
- **Properties Panel**: Edit transforms, geometry parameters, materials, lights, and camera properties

### Shading & Rendering

- **Viewport Shading Modes**: Wireframe, solid (flat grey), material preview (with HDRI), and rendered views
- **Studio Light**: 8 built-in environments (city, courtyard, forest, interior, night, studio, sunrise, sunset) lighting the material preview — viewport furniture that never reaches a render
- **Image Rendering**: Export scenes to PNG, JPEG, or WebP from a chosen camera, with optional transparent background. Requests larger than the graphics card supports are scaled to a size it can hold, keeping their proportions

### World

- **Scene Environment**: The scene's own surface and the light it casts — either a flat colour or an image, with a single Strength governing both. Saved with the project and visible in renders, which is what separates it from the studio light above
- **HDRI Library**: Browse Poly Haven's HDRIs at 1k, 2k or 4k with the download size shown up front, pick one of the 8 bundled images, or import your own
- **Blurriness & Rotation**: Soften the visible backdrop without dimming or softening the light it casts, and turn the backdrop and its light together
- **Fog**: Linear between two distances or exponential thickening with depth, in a colour of your choosing

### UV Editing

- **UV Workspace**: A second workspace beside Layout in the top bar, showing the selected mesh's UV layout drawn over the texture it is actually mapped with. Edits go straight to the mesh, so the 3D view updates as you drag
- **Selection**: By vertex, edge, face or island, with shift-click to add or remove and box selection over empty space
- **Transform Tools**: Move, rotate and scale with `G`, `R` and `S`, axis locking with `X` and `Y`, and the same confirm and cancel keys as the viewport
- **Sticky Selection Modes**: Disabled, Shared Location or Shared Vertex, deciding what travels with a corner that several faces map separately
- **Pivot Modes**: Bounding Box Center, Median Point, 2D Cursor or Individual Origins
- **Layout Tools**: Pack Islands, Weld Selected, Flip in U and V, and Reset UVs to restore what the geometry was loaded with
- **UV Grid Texture**: A lettered checker grid on the mesh so the layout is readable in the viewport

### Content Creation

- **Primitive Meshes**: Planes, cubes, circles, spheres, icospheres, cylinders, cones, and torus shapes with parameter editing
- **Text Objects**: 3D text with 6 built-in fonts, customizable size, depth, and material
- **Lighting System**: Point, directional, spot, and rectarea lights with color, intensity, distance, and shadow settings
- **Material Editor**: Seven material types (Physical, Standard, Phong, Toon, Lambert, Normal, Basic) with real-time property editing

### Asset Management

- **Model Import**: GLTF/GLB (with Draco, KTX2 and Meshopt support), OBJ (with MTL), and FBX formats
- **Model Export**: Export scenes to GLB format excluding helper objects
- **Three.js JSON**: Save any object to Three.js JSON from the outliner's context menu, and import one back into the scene
- **Models Library**: Browse and import free CC0 3D models from Poly Haven with category filtering and resolution selection
- **Texture Library**: Import textures by type (AO, diffuse, normal, roughness, etc.) for material assignment
- **HDRI Library**: Browse Poly Haven's HDRIs for the scene's World, sharing the layout of the model and texture browsers

### Scene Management

- **Workspaces**: Layout and UV Editing, swapped from the tabs beside the menus
- **Outliner**: Hierarchical tree view with visibility toggles, and grouping and re-parenting from the context menu
- **Properties**: Edit transforms, geometry parameters, materials, lights, camera, and world properties
- **Project Files**: Save and load scenes in `.mixeur` format using MessagePack serialization, carrying the scene's World with it

## Core Dependencies

- `three`: 3D graphics library
- `three-mesh-bvh`: Bounding Volume Hierarchy for fast raycasting
- `three-viewport-gizmo`: Camera navigation gizmo
- `vue`: Progressive JavaScript framework
- `pinia`: State management for Vue 3
- `@vueuse/core`: Collection of Vue composition utilities
- `@jaames/iro`: Color picker library
- `reka-ui`: Vue component primitives
- `@msgpack/msgpack`: MessagePack serialization for project files

## Credits

- [Three.js](https://threejs.org/) - 3D graphics library
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [Blender](https://www.blender.org/) - Inspiration for UI/UX patterns
- [Poly Haven](https://polyhaven.com/) - Free CC0 3D models, HDRIs, and textures
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) - BVH acceleration
- [three-viewport-gizmo](https://github.com/Fennec-hub/three-viewport-gizmo) - Camera gizmo
- [ui.blender.org/icons](https://ui.blender.org/icons) - Blender Icons

## License

MIT License - Copyright (c) 2026 Danil Popov

See [LICENSE](LICENSE) for more details.
