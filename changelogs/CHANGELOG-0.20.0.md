# Changelog 0.1.0 – 0.20.0

Archived releases. The current changelog is [CHANGELOG.md](../CHANGELOG.md); later releases are in [CHANGELOG-0.30.2.md](CHANGELOG-0.30.2.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.20.0] - 2026-04-28

### Added

- InputSelect: Added optional icons for select options
- Viewport toolbar: added transform orientation selector (World/Local) with dedicated icons
- Transform controls: Ctrl-key snapping
- Material properties: Enviroment map settings
- Material properties: vector2 inputs

### Changed

- Material properties: change number input steps

### Fixed

- Object properties: fixed transform settings sync with transform controls
- Object properties: fixed visibility settings sync
- Raycast: filter selectable objects during intersection

## [0.19.0] - 2026-04-25

### Added

- Object cloning functionality
- Support for environment maps in texture input

### Changed

- Custom context menu: added icon and shortcut support, updated styling
- Material properties: group alpha properties into a dedicated section
- Mesh: changed default material to Standard Material with double side

### Fixed

- Raycast: prevent raycasting on non visible objects

## [0.18.1] - 2026-04-24

### Changed

- Refactor store: Extract raycasting logic into dedicated store (`raycast.ts`)
- Refactor store: Replace event-based communication with direct function calls
- Refactor store: Centralize `outlinePassRef` access to composer store
- Refactor store: Obtain scene from three store instead of parameter
- Refactor store: Move controls store initialization to function scope
- Refactor store: Update `addGroup` function
- Refactor store: Change `deleteFromScene` to accept uuid instead of object

### Fixed

- Update scene after moving object to group

## [0.18.0] - 2026-04-23

### Added

- Preferences modal with theme customization (colors, roundness) via CSS custom properties

### Changed

- Number field styling: Refactored CSS variables
- Input Select styling: Refactored CSS variables
- Component folder structure

### Fixed

- `ViewportShadingControls`: Fixed tooltip `options` prop usage to properly pass reka-ui content configuration
- Modals/popover incorrect overlap
- Number Input styling
- Color input transparency display
- Fixed outliner is not being updated on moving object to a group

## [0.17.1] - 2026-04-22

### Fixed

- PWA registration/update

## [0.17.0] - 2026-04-22

### Added

- Spinner component
- Geometry Properties panel: New properties panel for editing mesh geometry parameters

### Changed

- Shading store: Refactored material cache to explicitly store wireframe and solid materials
- Camera store: Renamed `switchViewportCamera()` to `toggleViewportCamera()` for clarity
- CameraProperties: Changed to local computed `currentViewportCamera` derived from store
- CameraProperties: Accordion now defaults to open on Lens section

## [0.16.0] - 2026-04-18

### Added

- New `MxPopover` component: Reusable popover wrapper component
- `loadWorldTexture`: added caching
- Studio lighting: environment map texture previews (city, courtyard, forest, interior, night, studio, sunrise, sunset)
- Viewport shading settings: popover menu for preview shading mode with studio light selection, rotation, and strength controls

### Changed

- Consolidated three store scene addition methods into single `addObjectToScene` function
- `InputColor` component now uses `MxPopover`
- Replaced separate `scene:lightAdded`/`scene:modelAdded` events with single `scene:objectAdded` event
- Updates `scene:objectDeleted` event payload to use `null` instead of `THREE.Object3D`
- Migrated from native DOM event listeners to custom `listenCustomEvent` utility
- Added proper event listener cleanup via `disposeEvents` function for HMR support
- Changed `ref` to `reactive` in render image settings
- Refactored shading store
- shadingStore: expose `enviromentMap`
- `loadEXR`: improved type definitions and error handling

### Fixed

- Fixed camera helper visibility state on creation
- Fixed render camera toggle icon on/off state in viewport navigation widget
- Fixed popover text color and prevent auto-focus
- Fixed environment map not being aplied if in preview shading mode

## [0.15.0] - 2026-04-16

### Added

- Camera view toggle: New button in viewport navigation for toggling between viewport camera and render camera

### Changed

- Render Image: Removed unused `skipPreview` parameter; preview now always displays after rendering
- Viewport: Fixed template ref usage - now correctly passes template ref object instead of ref value
- Viewport: Changed error display from `v-show` to `v-if` for proper conditional rendering
- Three store: Removed async from `initScene()` - no longer needs to be async
- Three store: Refactored light helper handling to support lights without helpers gracefully
- Three store: Simplified `deleteFromScene()` to use consistent helperUUID approach for all object types

### Fixed

- Render Image: Always update preview image data after render completes
- disposeModel: Fixed shadow map disposal crash when deleting lights by unwrapping Vue reactivity proxy with toRaw()

## [0.14.0] - 2026-04-15

### Added

- New `camera` store: Dedicated camera state management separated from three store
  - New `useCameraStore` with viewport cameras (perspective/orthographic) management
  - New `switchViewportCamera()` function for toggling between camera types
  - New `renderCamera` and `renderCameraList` for render camera selection
  - Camera switching now preserves position, quaternion, and scale
- New `addCameraToScene()` function in three store for adding cameras to scene
- New scene events: `scene:objectDeleted`, `scene:lightAdded`, `scene:modelAdded`
- New `emitCustomEvent` and `listenCustomEvent` utilities in `src/utils/events.ts`

### Changed

- Refactored camera management from three store to dedicated camera store
  - Moved `activeCamera`, `viewportCameraType`, `switchViewportCamera` to camera store
  - Camera store now creates and manages viewport cameras directly
  - `selectObject` now handles Camera selection with CameraHelper support
- `disposeModel()`: Extended geometry disposal to all Object3D types (not just Mesh)
  - Now handles CameraHelper, LineSegments, Points, Sprites, and other non-Mesh objects
  - Added SkinnedMesh skeleton disposal
  - Refactored material disposal into separate `disposeMaterial()` helper function
- App store: Updated to use camera store for viewport camera operations
- Light helper objects now tracked for proper cleanup on deletion
- Object visibility changes now propagate to helper objects via `helperUUID`

## [0.13.0] - 2026-04-12

### Added

- Shading mode visibility controls: Objects can now be hidden per shading mode using `hideInModes` property
  - New `userVisible` tracks user's visibility preference separately from actual Three.js visibility
  - New `hideInOutliner` hides objects like grid helpers from the outliner
  - New `shading:modeChange` event dispatched when mode changes
  - Outliner visibility toggle now properly respects shading mode
- Material preview mode renamed to 'preview' for consistency with shading UI
- Text objects now store text value in `userData.text.textValue` for property panel access
- Composer store now exposes `rendererRef` for external renderer access
- New `src/store/types/shading.ts` with ShadingMode type and MaterialCache interface
- New `src/events.d.ts` with global type declarations for shading events
- Three.js utilities: Refactored `enableBVH` and `disposeBVH` to new `src/three/utils.ts` module
- New `src/three/utils.ts` module exports: `getUserData`, `enableBVH`, `disposeBVH`
- New `MxObjectUserData` type with structured `mixeur` property for Mixeur-specific metadata

### Changed

- userData now uses `mixeur` namespace to prevent conflicts with external Three.js libraries
  - `getUserData()` now returns `obj.userData.mixeur` instead of direct `obj.userData`
  - All components and stores updated to use the new namespace
  - Safely initializes `userData` if undefined
- Shading mode `materialPreview` renamed to `preview` for consistency
- Default camera position moved from (4,4,4) to (8,8,8) for better initial view
- Shadow map type changed from PCFSoftShadowMap to PCFShadowMap
- THREE.Cache enabled for improved performance
- Light helpers now have proper display names (e.g., "Point Light" instead of "point")
- Grid and axes helpers hidden from outliner with `hideInOutliner: true`
- TextDataProperties accordion now defaults to open with `['text']`

## [0.12.1] - 2026-04-10

### Added

- Splash screen: Added loading screen with logo and animated loader
- Color picker transparency
  - When enabled, displays alpha field and uses hex8 color strings (e.g., `#ff000080`)
  - When disabled, uses standard hex6 strings for simpler color values
- Icon types generation: New build-time system to generate TypeScript types for SVG icons
  - New `plugins/icon-types-generator.ts` script scans `src/assets/icons/` and generates type definitions
  - New `plugins/run-gen.ts` entry point for running the generator
  - New `types:generate` npm script to auto-generate icon type definitions
  - Workflow integration: GitHub Actions now run `types:generate` before type checking
- Bone icon for skeletal animation support
- Arrow icons (arrow-down, arrow-right) for UI navigation

### Changed

- MxIcon: Refactored to use raw SVG import for improved performance
- Vite config: Added icons chunk for code splitting
- `type-check` script renamed to `types:check` for consistency
- `types:generate` now runs before `types:check` in CI pipelines
- tsconfig.node.json: Added `plugins/*` to file matching patterns
- Node imports: Updated to use explicit `node:` protocol prefix (`node:fs`, `node:path`)
- Shading icons renamed for consistency (shading-preview → preview, shading-rendered → rendered, shading-solid → solid, shading-wireframe → wireframe)
- Updated outliner and viewport components
- Updated ModalImportScene to use dynamic imports for GLTF, FBX, OBJ, MTL loaders
- Refactored ModalModelsLibrary to import GLTF directly
- Simplified environment.ts to use loadEXR instead of EXRLoader directly

### Removed

- Unused getfile.ts composable
- modelLoader module
- importModel function from three store

## [0.12.0] - 2026-04-02

### Added

- Material properties: New declarative field-based configuration system for material properties
  - New `MaterialInputFields` component renders form fields from typed configuration arrays
  - New `useMeshMaterial` composable for material property access and updates
  - Support for 6 material types: Physical, Standard, Phong, Toon, Lambert, and Normal
  - Added `NormalMaterial` surface type for displaying normal vectors as RGB colors
  - Material tooltips: Comprehensive tooltips for all material properties
  - Displacement section: Displacement map, scale, and bias controls
  - Settings section: Side, shadow side, blending, depth function, fog, dithering, vertex colors, precision
- New group icon: Added `group-new.svg` icon for outliner add group action

### Changed

- Material properties: Major refactor from per-material Vue components to declarative field-based system
  - Removed 9 separate material surface component files (MatSurfaceDiffuse, MatSurfaceGlossy, MatSurfacePrincipled, MatSurfaceToon, and 5 utility components)
  - New `sections/` directory structure for material property sections (Surface, Displacement, Settings)
  - New `materials/` subdirectory for per-material-type field configurations
  - All material types now share the same accordion structure and input components
- DataOutlinerItem: Improved hover effects with brightness filter and cursor pointer
- DataOutlinerItem: Added `text-icon-object` class for consistent icon color
- SVG icon fill: Changed from hardcoded `#fff` to `currentColor` for dynamic color control via CSS theming (45 icon files across base, file, light, mesh, misc, outliner, properties, shading, ui, and view categories)
- MTL loader: Texture names now prefixed with property key and material name for better identification (e.g., `color_MyMaterial`)
- InputTexture: Changed `overflow-hidden text-ellipsis` to Tailwind `truncate` class; changed `||` to `??` for nullish coalescing

### Fixed

- MTL loader: Added `mtl.preload()` call before accessing materials to ensure proper initialization

## [0.11.2] - 2026-04-01

### Added

- Input components: Added `disabled` prop support across InputField, InputNumber, InputTexture, and related components
- InputSelect: Added tooltip support for individual options
- MxTooltip: Added `whitespace-pre-line` CSS for multi-line tooltip text rendering
- InputField: Proper `<label>` element with `useId()` for improved accessibility

### Changed

- MxAccordionItem: Improved header styling with hover brightness effect; reorganized padding from header to trigger; added conditional left padding for nested items
- InputTexture: Close button now uses MxIcon component instead of text "x"
- InputNumber: Drag cursor only shows when not disabled
- Shading store: Renamed `getMaterial` to `getMaterialCache` for clearer API semantics; added TypeScript generics to `updateMaterial` and `updateMaterialProperty` functions for improved type safety on material property updates

## [0.11.1] - 2026-03-30

### Fixed

- Import Scene: GLB file URIs now properly extracted from binary chunks instead of returning empty array

## [0.11.0] - 2026-03-30

### Added

- MxDialog: Added `icon` prop to display icon in dialog header
- Close icon: New close button SVG icon for dialog headers
- Import Scene Modal: New unified interface for importing 3D model files with support for:
  - Multi-format support: glTF/GLB, OBJ, and FBX files
  - Automatic format detection via magic bytes and content analysis
  - Asset management panel for textures, materials (.mtl), and binary (.bin) files
  - Auto-fill functionality to automatically match required assets by filename
  - Material settings panel for OBJ imports (side, wrapping, RGB normalization, transparency)
  - Proper blob URL cleanup with try-finally to prevent memory leaks
  - Error handling with toast notifications for failed imports
  - End-to-end tests for GLB, OBJ, and FBX file imports with asset management
  - Additional tests: modal close, multiple file upload, manual asset mapping
- Model format loaders: Added support for additional 3D model formats
  - GLTF/GLB loader with Draco, KTX2, and Meshopt compression support
  - MTL (Material Template Library) loader for associated materials
  - OBJ loader for legacy model support
  - FBX (Filmbox) loader for common 3D format support
  - All loaders include URL modifier support and proper error handling with toast notifications
- Input field tooltip indicators: Added question mark icon to labeled inputs with tooltips
- Tooltip layering: Added z-index to ensure tooltip content renders above other elements

### Changed

- MxDialog: Redesigned header with integrated close button for consistent modal styling
- Import Scene Modal: Renamed title from "Import Model" to "File Browser"
- Asset Browser modals: Unified titles to "Asset Browser" across Models and Texture libraries
- Render Image: Quality input changed from slider to number input for precision
- About Modal: Simplified branding from "Vue Mixeur" to "Mixeur"
- Dependency updates: Updated all dependencies to latest compatible versions
- MenuBar CSS refactoring: Moved menubar utility classes from `utils.css` to `components.css`, renamed classes for consistency (`.trigger` → `.menubar-trigger`, `.item` → `.menubar-item`), and replaced hardcoded colors with design token variables from the theme
- CSS improvements: Refactored button hover states to use more specific selectors (`not-disabled:hover`) instead of global `button:hover`
- Button variants: Added `.btn--highlight` variant with blue background for emphasized actions
- CSS cleanup: Removed unused tailwind-scrollbar plugin from main CSS
- InputSelect component refactored to use generics for improved type safety
- Simplified type annotations in camera-related components
- EXR loader refactored to move loader instantiation inside the function and added JSDoc documentation
- Removed manual icon chunking from Vite build configuration
- Self-hosted Inter font: Switched from external CDN (`rsms.me`) to local font files

### Fixed

- InputTexture memory leak: Added URL.revokeObjectURL() to release blob URL after texture loading
- InputSelect text overflow: Added truncate class to prevent long text from overflowing the select trigger

## [0.10.0] - 2026-03-22

### Added

- EXR texture support: Added ability to load EXR (OpenEXR) texture files in the texture input component
  - New `loadEXR` function in `src/three/modules/loaders/exr.ts`
  - Support for EXR files in both file dialog and texture library
  - Progress tracking for large EXR files
  - Proper error handling with toast notifications
  - Blob URL cleanup after loading

### Changed

- Improved texture management: Added proper texture disposal when replacing existing textures from the library
- Semantic naming: Renamed `removeMap` to `reset` for clearer function purpose

## [0.9.3] - 2026-03-19

### Fixed

- Correct bytesToSize handling of zero bytes

## [0.9.2] - 2026-03-18

### Fixed

- Use lightHasShadow type guard in component and dispose

## [0.9.1] - 2026-03-17

### Fixed

- PWA update notification and handling

## [0.9.0] - 2026-03-17

### Added

- Horizontal drag support to number input
- PWA support for offline capabilities

### Changed

- Replace usePointer with Pointer Lock API for better control handling
- Update dependencies to latest versions
- Extract lightHasShadow type guard and add RectAreaLight support
- Use useKeyModifier and dolly camera navigation
- Remove ts-ignore comments from store modules

### Fixed

- Transform controls initialized after event listeners

[0.20.0]: https://github.com/zabastx/mixeur/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/zabastx/mixeur/compare/v0.18.1...v0.19.0
[0.18.1]: https://github.com/zabastx/mixeur/compare/v0.18.0...v0.18.1
[0.18.0]: https://github.com/zabastx/mixeur/compare/v0.17.0...v0.18.0
[0.17.0]: https://github.com/zabastx/mixeur/compare/v0.16.0...v0.17.0
[0.16.0]: https://github.com/zabastx/mixeur/compare/v0.14.0...v0.16.0
[0.15.0]: https://github.com/zabastx/mixeur/compare/v0.14.0...v0.15.0
[0.14.0]: https://github.com/zabastx/mixeur/compare/v0.13.0...v0.14.0
[0.13.0]: https://github.com/zabastx/mixeur/compare/v0.12.1...v0.13.0
[0.12.1]: https://github.com/zabastx/mixeur/compare/v0.12.0...v0.12.1
[0.11.2]: https://github.com/zabastx/mixeur/compare/v0.11.1...v0.11.2
[0.11.1]: https://github.com/zabastx/mixeur/compare/v0.11.0...v0.11.1
[0.11.0]: https://github.com/zabastx/mixeur/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/zabastx/mixeur/compare/v0.9.3...v0.10.0
[0.9.3]: https://github.com/zabastx/mixeur/compare/v0.9.2...v0.9.3
[0.9.2]: https://github.com/zabastx/mixeur/compare/v0.9.1...v0.9.2
[0.9.1]: https://github.com/zabastx/mixeur/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/zabastx/mixeur/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/zabastx/mixeur/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/zabastx/mixeur/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/zabastx/mixeur/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/zabastx/mixeur/compare/v0.1.0...v0.5.0
[0.1.0]: https://github.com/zabastx/mixeur/releases/tag/v0.1.0
