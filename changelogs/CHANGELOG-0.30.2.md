# Changelog 0.21.0 – 0.30.2

Archived releases. The current changelog is [CHANGELOG.md](../CHANGELOG.md); earlier releases are in [CHANGELOG-0.20.0.md](CHANGELOG-0.20.0.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.30.2] - 2026-08-08

A maintenance release. Nothing changes in the editor itself — this is dependency updates and build housekeeping.

### Changed

- Updated dependencies, including Three.js to r185 and Vue to 3.5.41
- Three.js r185 moved two of its bundled loaders onto a CDN. Nothing in Mixeur used them, but they were being pulled in anyway through a shared entry point; addons are now imported individually so nothing reaches for the network that did not before
- TypeScript stays on 6.x. The 7.0 rewrite is not yet supported by the type checker, linter and Vue compiler this project builds with

## [0.30.1] - 2026-08-08

### Changed

- Top bar: a rule now separates the menus from the workspace tabs. The menus act on the whole application and the tabs swap the editor area, and they now read as two groups rather than one long row of controls

### Fixed

- UV Editing: the handle between the UV editor and the 3D view can no longer be dragged past the edge of the window. Previously dragging it to the right kept widening the UV editor until the editor overflowed and the page grew a horizontal scrollbar; dragging left had always stopped. Both this handle and the one beside the sidebar now stop while the 3D view still has room to show something
- UV Editing: the Sticky Selection Mode and Pivot menus are now sized like the menus beside them in the same header. Previously they used larger text and padding, so two kinds of menu sitting side by side did not match
- UV Editing: the arrow between the picked and moving counts in the status line now sits on the line with the numbers rather than below it. The arrow character is missing from the font the application loads, so it was being drawn by whatever the system substituted

## [0.30.0] - 2026-08-08

### Added

- UV Editing workspace: a second workspace, reachable from the tabs beside the menus, showing the selected mesh's UV layout drawn over the texture it is actually mapped with. Edits go straight to the mesh, so the 3D view updates as you drag. It edits existing UVs — it does not unwrap, and there is no undo, though Reset UVs restores what the geometry was loaded with
- UV selection by vertex, edge, face or island. Click to select, shift-click to add or remove, drag a box over empty space to sweep up everything inside it. Faces and islands are caught only when the box covers all of their corners, so a box grabs shapes rather than stray points
- Move, rotate and scale the selection with `G`, `R` and `S` — the same keys the 3D viewport uses. `X` and `Y` lock to one axis, click or `Enter` confirms, `Esc` or a right-click puts everything back exactly as it was. The status bar reports the distance, angle or factor as you move
- Sticky selection modes — Disabled, Shared Location, Shared Vertex — deciding what comes along when you move a corner that several faces map separately. Shared Location is the default, as in Blender: welded points stay welded and seams that were cut on purpose stay cut
- Pivot modes for rotate and scale — Bounding Box Center, Median Point, 2D Cursor, Individual Origins. Alt-click in the UV view places the 2D cursor. Individual Origins spins each island in place instead of swinging them around each other
- Pack Islands, which spreads a layout into a grid inside the tile. Freshly added primitives map every face to the whole tile, so their islands arrive stacked exactly on top of each other and this is what makes them editable
- Weld Selected, which closes a seam by collapsing nearly-coincident selected UVs onto one point, and Flip in U / Flip in V
- UV Grid Texture, which puts a lettered checker grid on the mesh so the layout is readable in the viewport, and takes it off again along with any shading mode it had to change to show the map
- A status line reporting islands, seams, and how many UVs you picked against how many will actually move — the gap between those two numbers is the sticky rule at work. It also warns when islands overlap or UVs sit outside the 0–1 tile; both are legal, and both are usually worth knowing about
- The middle mouse button pans the UV view, and the wheel zooms towards the pointer

### Changed

- The top bar now carries workspace tabs, Layout and UV Editing, which swap the whole editor area
- Transform shortcuts in the 3D viewport (`G`, `R`, `S`, the axis keys, and `Esc` to cancel a drag) now only respond while the pointer is over the viewport, which is the rule `Delete` and `Shift+D` already followed. Previously they responded from anywhere in the window, so working in another editor could quietly retune the gizmo behind it
- The status bar's key hints now describe whichever editor the pointer is over, rather than always describing the viewport

## [0.29.2] - 2026-08-07

### Changed

- Viewport: the renderer, post-processing chain, controls, picking, input and render loop are now brought up and torn down as one unit, so a viewport that goes away releases its GPU context, animation loop and event listeners instead of leaving them running for the life of the page. Previously nothing was ever released, and each hot reload during development left another renderer and render loop behind
- Keyboard shortcuts: which shortcuts a keypress reaches is now decided by whether the shortcut is an application one (save, open — these still work while typing) or an editor one (transform tools, view directions, delete — these stay suppressed while typing), rather than by the order the handlers happened to be registered in. Behaviour is unchanged; it is no longer accidental
- Starting scene: the default light, camera and cube are seeded once per project rather than once per viewport, so restarting the viewport no longer adds a second copy of each

### Fixed

- Render Image: a camera moved into a group now still appears in the camera picker. Previously grouping a camera dropped it from the list, and hid the picker entirely when it was the only camera in the scene
- Render camera: deleting a group that contains the render camera now unsets it. Previously the render camera kept pointing at the deleted camera, and switching to the render camera view showed a broken viewport. Opening a project file went through the same path

## [0.29.1] - 2026-08-07

### Added

- Test suite: unit tests (Vitest) and end-to-end tests (Playwright) across chromium, firefox and webkit, with coverage configuration
- Basis transcoder: `public/basis/` now ships the KTX2 transcoder alongside the existing Draco decoders, and an end-to-end test asserts both are being served

### Changed

- Asset loading: one entry point per kind of asset — `loadModel`, `loadTexture`, `loadFont` — each accepting a file or a URL. Format detection, temporary URL cleanup, progress reporting and error handling are handled internally instead of by each caller
- Property panels: light, shadow and material panels now share one field vocabulary and one renderer, so conditional fields and number formatting behave the same in all of them. `showIf` is now `enabledIf`, which disables a field rather than hiding it
- Material surfaces: the Alpha, Environment, Emission, Normal & Bump, Light and Ambient Occlusion groups are defined once instead of being copied into each of the seven surface types. No field was added, dropped or reordered
- Selection: the selected object, the viewport outline and the transform gizmo are now driven from one place, so they can no longer disagree
- Light properties: open and collapsed sections now stay as you left them when switching between lights
- Texture loading: shows an indeterminate progress entry instead of a progress bar frozen at 0%, since image decoding reports no byte counts

### Fixed

- Viewport: clicking empty space now deselects. Previously the outline and gizmo disappeared but the outliner row stayed highlighted and the Properties panel kept editing the old object
- Viewport: deleting a group or parent that contains the selected object now clears the selection, instead of leaving the transform gizmo attached to a deleted object
- Text properties: switching between text objects now updates the panel, which previously kept showing the first object's values. The font is restored along with the rest
- glTF import: files using `KHR_texture_basisu` no longer hang the import modal on a progress bar that never clears — the Basis transcoder they need is now served
- Progress: loading an OBJ with its material library no longer removes the wrong entry from the progress list
- Import: a failed import now reports one error toast instead of two

## [0.29.0] - 2026-06-23

### Added

- Outliner: SkinnedMesh objects now display a dedicated icon in the scene tree
- BVH acceleration: Added object validity check before computing the bounding hierarchy to avoid errors on invalid objects

### Changed

- Selection: `selectObject` now accepts object instances directly in addition to UUIDs, simplifying programmatic selection

## [0.28.0] - 2026-05-20

### Added

- Import objects from Three.js JSON files into the scene
- InputSelect component now allows configuring Select.Portal props

### Changed

- Project file keyboard shortcuts now work from any screen in the editor

### Removed

- RELEASES.md file (deprecated)

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

[0.30.2]: https://github.com/zabastx/mixeur/compare/v0.30.1...v0.30.2
[0.30.1]: https://github.com/zabastx/mixeur/compare/v0.30.0...v0.30.1
[0.30.0]: https://github.com/zabastx/mixeur/compare/v0.29.2...v0.30.0
[0.29.2]: https://github.com/zabastx/mixeur/compare/v0.29.1...v0.29.2
[0.29.1]: https://github.com/zabastx/mixeur/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/zabastx/mixeur/compare/v0.28.0...v0.29.0
[0.28.0]: https://github.com/zabastx/mixeur/compare/v0.27.1...v0.28.0
[0.27.1]: https://github.com/zabastx/mixeur/compare/v0.27.0...v0.27.1
[0.27.0]: https://github.com/zabastx/mixeur/compare/v0.26.0...v0.27.0
[0.26.0]: https://github.com/zabastx/mixeur/compare/v0.25.0...v0.26.0
[0.25.0]: https://github.com/zabastx/mixeur/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/zabastx/mixeur/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/zabastx/mixeur/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/zabastx/mixeur/compare/v0.21.0...v0.22.0
[0.21.0]: https://github.com/zabastx/mixeur/compare/v0.20.0...v0.21.0
