# Mixeur

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Vue](https://img.shields.io/badge/Vue-3.5.41-4FC08D.svg)](https://vuejs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-0.185.1-049EF4.svg)](https://threejs.org/)

A Blender-like web-based 3D editor built with Vue.js and Three.js. Mixeur provides an interface for 3D modeling, object manipulation, and scene management directly in the browser.

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
- **HDR Environment Maps**: 8 built-in environments (city, courtyard, forest, interior, night, studio, sunrise, sunset)
- **Image Rendering**: Export scenes to PNG, JPEG, or WebP with custom resolution and optional transparent background

### Content Creation

- **Primitive Meshes**: Planes, cubes, circles, spheres, icospheres, cylinders, cones, and torus shapes with parameter editing
- **Text Objects**: 3D text with 6 built-in fonts, customizable size, depth, and material
- **Lighting System**: Point, directional, spot, and rectarea lights with color, intensity, distance, and shadow settings
- **Material Editor**: Six material types (Physical, Standard, Phong, Toon, Lambert, Normal) with real-time property editing

### Asset Management

- **Model Import**: GLTF/GLB (with Draco and KTX2 support), OBJ (with MTL), and FBX formats
- **Model Export**: Export scenes to GLB format excluding helper objects
- **Models Library**: Browse and import free CC0 3D models from Poly Haven with category filtering and resolution selection
- **Texture Library**: Import textures by type (AO, diffuse, normal, roughness, etc.) for material assignment

### Scene Management

- **Outliner**: Hierarchical tree view with visibility toggles and group detection
- **Properties**: Edit transforms, geometry parameters, materials, lights, and camera properties
- **Project Files**: Save and load scenes in `.mixeur` format using MessagePack serialization

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
