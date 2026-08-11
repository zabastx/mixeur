# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Rendering an image is much faster. A render used to build a second renderer from scratch every time, which meant re-uploading every texture and recompiling every shader before it could start drawing; it now draws with the one the viewport is already using, so a render that took several seconds takes a fraction of one
- Asking for a render larger than the graphics card can hold now scales it down to a size the card supports, keeps its proportions and tells you which size it used, and the saved file is named for the size actually rendered rather than the one asked for. Nothing checked the request against the hardware before, and where that ceiling sits varies by machine

### Fixed

- Saving a project while the viewport was in wireframe or solid shading wrote those stand-in materials into the file in place of the real ones. Only objects sitting directly in the scene kept theirs, and an imported model arrives as a group with its meshes inside it, so its materials were the ones lost — the project reopened flat grey or black wireframe with no way back to the originals. Exporting an object to JSON had the same hole in it
- A project whose render camera sat inside a group reopened with no camera set to render. Cameras can be moved into groups like anything else, but only the ones at the top level of the scene were noted down when the project was saved
- Rendering image after image in one sitting could leave the viewport blank. Every render claimed a graphics context of its own, and a browser keeps only so many per page — around sixteen in Chrome — before quietly dropping the oldest, which was the viewport's. Renders share the viewport's context now, so there is none left to run out of

## [0.31.0] - 2026-08-09

### Added

- World properties tab: the scene's own environment — the surface behind and around everything, and the light it casts. It is saved with the project and it appears in renders, which is what makes it a different thing from the studio light in the viewport shading popover. That one shows you a material under known light and never reaches a render; this one is the scene's own sky
- The world's surface is either a flat colour or an image, never both, and a single Strength says how brightly it both appears and lights the scene. There is deliberately no way to make the sky brighter than the light it casts
- A world image comes from one of three places: the eight images bundled with the app, Poly Haven's HDRI library, or a file of your own. The first two are saved by reference and restore themselves when the project is reopened
- Poly Haven HDRIs, browsable beside the existing texture and model libraries, offered at 1k, 2k or 4k with the download size shown before you commit to it. 2k unless you say otherwise: large enough not to look soft, small enough to browse several in a row
- An imported world is saved by filename and nothing else — a 4k EXR runs to tens of megabytes and every save would carry it — so reopening that project marks the image as not loaded and offers to take the file again
- Blurriness, which softens the visible backdrop without dimming or softening the light it casts. Small values go a long way, and the control stops where the sky becomes a flat wash, which is what a colour surface is already for
- Rotation, which turns the world around the scene, moving the backdrop and the light it casts together
- Fog, either linear between two distances or exponential thickening with depth, in a colour of your choosing
- Rendered shading mode now has an environment at all. Previously a physically based material there reflected nothing and was lit only by the scene's own lights, and filling that hole is the reason the world exists

### Changed

- Rendered and exported views now show the world behind the scene rather than the flat viewport grey, which stays as the backdrop in the other shading modes because it is editor furniture rather than part of the scene. A new project's world is that same grey, so nothing looks different until you edit it, and a project saved before this feature opens with it. Renders do not look identical to before and cannot: a scene lit by its own environment is the point
- Render Image no longer has a background colour of its own. What the background is belongs to the world now, so the two cannot disagree; the toggle that leaves it out for a transparent image stays, because whether to draw a background at all is a genuinely per-render choice
- The three asset browsers — models, textures and HDRIs — now share one layout, so picking an HDRI works the way picking a texture already did

### Fixed

- Asset browser: clicking one asset and then quickly another could import the second one's details against the first one's file, depending on which request answered first. The browser now follows the row you clicked rather than whichever answer arrived last
- Colour swatches holding a colour close to the panel behind them looked like empty rows — the world's own default grey was exactly such a colour. A swatch edge is now drawn in the surrounding text colour, so it reads against any panel and any contents

## Older versions

Released versions are archived once the current file grows past a `0.x0` boundary:

- [0.21.0 – 0.30.2](changelogs/CHANGELOG-0.30.2.md)
- [0.1.0 – 0.20.0](changelogs/CHANGELOG-0.20.0.md)

[Unreleased]: https://github.com/zabastx/mixeur/compare/v0.31.0...HEAD
[0.31.0]: https://github.com/zabastx/mixeur/compare/v0.30.2...v0.31.0
