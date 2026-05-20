# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Import object from Three.js JSON file

## [0.27.1] - 2026-05-19

### Fixed

- Scene export: Ensure active render camera is included in project export
- Scene export: Clone object before exporting to prevent side effects

## [0.27.0] - 2026-05-18

### Added

- Project save/load: New `.mixeur` file format with MessagePack serialization for efficient scene storage
- Project file menu: Added Save and Open menu items to the header menu
- Outliner context menu: Added export object to JSON option
- Text geometry: Added `MxObjectLoader` for parsing TextGeometry in project files
- Scene export: Added object-to-JSON export functionality

### Changed

- Blob utilities: Improved blob handling in downloadFile helper
- Material management: Improved reactivity and simplified material management
- Object metadata: Enhanced metadata system and system object identification
- Object loading: Updated geometry inputs when switching objects
- README: Updated documentation

### Fixed

- Light target: Fixed light target assignment in scene
- Displacement properties: Disabled displacement properties for basic material

## [0.26.0] - 2026-05-11

### Added

- UI: Added `InputText` component with icon support and focus-within styling
- Import scene: Added search filter functionality in import modal
- Accordion: Added search to `MxAccordionItem` component

### Changed

- UI: Replaced native input elements with `InputText` component across the codebase
- Import scene: Updated modal grid layout and component sizing
- UI: Updated input focus state to use `:focus-within` pseudo-class
- UI: Increased tooltip z-index for better visibility
- Material: Fixed typo in MeshBasicMaterial type name

### Tests

- Added unit tests for `InputText` component
- Added test IDs to viewport widgets and modals for E2E testing
- Implemented viewport control E2E tests
- Updated outliner selection tests to use text matching

## [0.25.0] - 2026-05-09

### Added

- Material Properties: added support for Basic Material

### Fixed

- Outliner: fixed content overflow in tree view
- Properties: fixed content overflow in property panels
- InputVector2: restored in-place mutation to preserve material references during updates

## [0.24.0] - 2026-05-06

### Added

- Image rendering: Added fullscreen toggle to rendered image preview
- Image rendering: Added background color support for exported images
- Viewport: Implemented window resize tracking with automatic camera view synchronization
- Rendering: Updated rendering pipeline with SSAA (Super Sample Anti-Aliasing) and OutputPass for better visual quality

### Changed

- Input fields: Enforced TypeScript constraints on Three.js object types for better type safety
- Input fields: Updated InputVector2 to use immutable Vector2 updates
- UI components: Enhanced MxButton with improved tooltip handling and flexible slot rendering
- UI components: Added border to color input trigger for better visibility
- Camera: Switched to reactive state management for camera settings
- Shared utilities: Moved isPerspectiveCamera to types and updated default color value

### Fixed

- Image rendering: Fixed memory leak by properly disposing composer and renderer after rendering
- Shadow maps: Fixed shadow map not updating when changing shadow map size in properties panel
- UI: Fixed window scroll behavior on Chromium-based browsers
- Outliner: Fixed TypeScript types for outliner components

### Removed

- Dependencies: Removed deprecated postprocess module

## [0.23.0] - 2026-05-05

### Added

- Outliner: Added a virtualized tree widget for larger scene hierarchies
- Outliner: Added context menu actions for moving objects to the scene root, existing groups, or a new group
- Outliner: Added object duplication and deletion actions to the context menu
- Outliner: Added render-camera selection directly from camera rows
- Menu bar: Added keyboard shortcut display support
- Input handling: Added a shortcut for toggling toolbar visibility
- InputSelect: Added icon-only display mode
- UI shell: Added reusable `EditorWrapper` component
- Context menu: Added open state change events for consumers

### Changed

- Outliner: Replaced the previous item component architecture with `OutlinerTree` and typed outliner items
- Outliner: Improved tree item styling, indentation, object icons, visibility controls, and selected row styling
- Sidebar: Switched to slot-based content composition for more flexible layout
- Viewport and properties panels: Updated wrappers to use shared editor chrome
- Scene and selection stores: Improved reactivity around scene updates and selected object handling
- Top bar: Simplified status bar visibility state management
- Dependencies: Removed unused `vite-svg-loader`

### Fixed

- Dialog: Prevented select interactions from firing during dialog drag operations

### Tests

- Outliner: Added unit coverage for tree rendering, selection, camera activation, visibility toggles, and context menu actions
- Outliner: Added unit coverage for scene object parsing, hidden object filtering, selected object propagation, and camera event forwarding

## [0.22.0] - 2026-05-03

### Added

- Reusable input fields: New `useInputFields` composable for consistent input behavior

### Changed

- Architecture migration: Migrated to Feature-Sliced Design (FSD) v2.1 for improved code organization
- Store architecture refactor: Split monolithic `three.ts` into focused stores
  - Extracted `input.ts` for keyboard, pointer, and wheel event handling
  - Simplified `app.ts` to only contain UI visibility state
  - Extracted `scene.ts` for object lifecycle (add/delete/clone), groups, and export
  - `three.ts` now only handles selection and render orchestration
  - Moved keybindings to `config/keymaps.ts` for better maintainability
- Light properties: Refactored light property management for better type safety
- Material updates: Improved type safety for material property updates
- Font loading: Encapsulated font loader with toast notification hook

### Fixed

- Shadow assignment: Prevented crash when enabling shadow on lights that don't support it
- Camera view icon: Fixed toggle icon state in viewport widget
- Visibility properties: Fixed toggle synchronization for object visibility
- Text input increments: Refined increment step values for text property inputs

## [0.21.0] - 2026-04-28

### Added

- Transform controls: Axis constraint hotkeys (X, Y, Z, C) for restricting movement to specific axes
- Transform controls: Escape key to cancel drag operation and restore previous transform state
- Transform controls: `isTransformDrag` state for tracking active transform operations
- KeymapInformation: Context-sensitive keyboard hints displayed during transform operations

### Changed

- Hotkey handling: Refactored keyboard event registration from centralized `app.ts` store to dedicated `camera.ts` and `controls.ts` stores
- App store: Renamed `useHotKeys()` to `initListeners()` for clarity
- App store: Removed unused camera and transform mode hotkey handlers (moved to dedicated stores)
- Controls store: Split `setupControls()` into `initControls()`, `setOrbitControls()`, and `setTransformControls()` functions
- Input ignored elements: Added check for input/textarea/select to prevent hotkey conflicts
- KeymapInformation: Icon and text styling adjustments for better layout

### Fixed

- Material Preview settings: fixed broken thumbnail url

[Unreleased]: https://github.com/zabastx/mixeur/compare/v0.27.1...HEAD
[0.27.1]: https://github.com/zabastx/mixeur/compare/v0.27.0...v0.27.1
[0.27.0]: https://github.com/zabastx/mixeur/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/zabastx/mixeur/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/zabastx/mixeur/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/zabastx/mixeur/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/zabastx/mixeur/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/zabastx/mixeur/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/zabastx/mixeur/compare/v0.20.0...v0.21.0
