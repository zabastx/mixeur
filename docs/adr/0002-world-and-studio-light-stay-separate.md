# World and Studio Light stay separate

Adding a Blender-style World properties tab forced a choice this codebase had
avoided: whether the environment map already in the app is the scene's world, or
something else. **It is something else.** The eight bundled maps are a preview
rig belonging to the editor; the World is scene data that is saved and rendered.
The app now carries two environment concepts on purpose, and `scene.environment`
holds whichever one the current shading mode calls for.

## What each one is

| | Studio Light | World |
| --- | --- | --- |
| Owned by | the editor | the scene |
| Edited from | the Viewport Shading popover | the World properties tab |
| Active in | `preview` | `rendered`, `export` |
| Saved with the project | no | yes |
| Appears in renders | no | yes |
| Source | 8 bundled maps | colour, preset, Poly Haven, or import |

Neither is visible in `solid` or `wireframe`. `scene.environment` is a single
slot, so the two can never both be mounted — `setMode` in `shading.ts` picks one
from the table above, alongside the material substitution it already does.

The World also owns `scene.background`, under the same table. Below `rendered`
the viewport keeps its flat `#3D3D3D`, which is editor chrome; at `rendered` the
background becomes whatever the World's Surface is. A new project's World
defaults to that same `#3D3D3D`, so nothing changes appearance until someone
edits it, and projects saved before this feature open with the default rather
than with no World.

## Why not one concept

Collapsing them was the cheaper option and we rejected it twice over.

**Rendered mode had no environment at all.** Before this, `scene.environment` was
`null` outside `preview` — a physically-based material in rendered mode reflected
nothing and was lit only by scene lights. That hole is the reason to build a
World. Promoting the studio light to fill it would have solved the hole and
destroyed the distinction that makes preview mode useful: preview shows you the
material under known light, rendered shows you the scene under its own.

**One slot, two audiences.** A single environment means either the studio rig
leaks into renders, or the user's chosen HDRI overrides the neutral lighting they
picked to judge a material by. Both are worse than owning two concepts with a
one-line rule separating them.

The cost is real: two HDRIs, two intensities, two rotations, and a distinction
users have to learn. Blender's users already learned it, which is the strongest
evidence it's learnable.

## The naming that came with it

The existing code called the studio maps _world_ maps — `DEFAULT_WORLD_MAPS`,
`loadWorldTexture`, `/textures/world/`. Under this decision that vocabulary
points at the wrong concept, so it was renamed to _studio_, matching Blender's
own term and the popover's existing "Studio lighting setup" tooltip. See
`CONTEXT.md` for the fixed definitions. The eight files still serve both roles —
they are offered in the World tab as presets — but nothing in the code calls a
studio light a world.

## Considered options

**World as an ID datablock**, as in Blender: named, browsable, shareable, with a
selector at the top of the tab. Rejected. Blender's selector exists to serve
files holding several scenes; a project here has exactly one scene, so there is
nothing to share a world with. Inventing a datablock system for a single
singleton would also raise the fair question of why materials aren't datablocks —
and if that system is ever built, materials are where it should start.

**Separate strength for background and lighting.** Three.js exposes
`backgroundIntensity` and `environmentIntensity` independently, so this was free.
Rejected: a sky brighter than the light it casts is a physical lie, and Blender's
single Strength is single because it is one node. Both three.js fields are
written in lockstep from one value. `backgroundBlurriness` is the deliberate
exception — it has no lighting counterpart and exists purely to calm a busy
backdrop.

**Embedding imported HDRIs in the project file.** Rejected. A 4k EXR is 30–80 MB
and every save would carry it. Imported Worlds persist as a filename and reopen
asking to be re-imported; presets and Poly Haven Worlds persist by reference and
restore themselves. Blender has the same problem and answers it with relative
paths, which a browser cannot follow.

## Consequences

`Scene.toJSON()` does not serialize `background` or `environment` — only the
intensities, rotations and fog. The World therefore needs its own block in
`project-file.ts` recording its Source, and that block is the thing to version if
the Source shapes ever change.

Texture lifetime differs by Source. Presets stay in the bundled cache shared with
studio lights and are never disposed on swap; Poly Haven and imported Worlds are
single-reference and disposed the moment they are replaced, or a session spent
browsing HDRIs leaks GPU memory in proportion to curiosity.

`RenderImageModal` builds a fresh `THREE.Scene` per render and copies the World
onto it by hand. `background`, `environment` and `fog` were copied already;
`environmentIntensity`, `backgroundIntensity`, `backgroundBlurriness` and both
rotations were not, so a render came out lit at strength 1 whatever the World
said. Every field a World writes has to be copied there, and a new one is a new
line in that function.

Its own background colour picker gives way to the World's, leaving only the
transparent toggle, because alpha is a genuinely render-specific choice. That
removal lands with the import Source, not with the World itself.

## When to revisit

If projects ever hold more than one scene, the datablock question reopens on its
own terms and this ADR's answer no longer applies.
