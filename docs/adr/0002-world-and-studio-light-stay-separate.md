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
| Source | 8 bundled maps | colour, preset, Poly Haven or an imported file |

Neither is visible in `solid` or `wireframe`. `scene.environment` is a single
slot, so the two can never both be mounted — `setMode` in `shading.ts` picks one
from the table above, alongside the material substitution it already does.

The World also owns `scene.background`, under the same table. Below `rendered`
the viewport keeps its flat `#3D3D3D`, which is editor chrome; at `rendered` the
background becomes whatever the World's Surface is. A new project's World
defaults to that same `#3D3D3D`, so the backdrop looks unchanged until someone
edits it, and projects saved before this feature open with the default rather
than with no World.

Rendered mode does not look *identical*, and cannot: filling the environment
hole is the point. A default World now lights the scene with a flat `#3D3D3D`
where `scene.environment` used to be `null`, so physical materials pick up a
faint even ambient they did not have. The backdrop is what stays the same.

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
and every save would carry it. An imported World persists as a filename and
reopens saying so, with the panel offering the file dialog again; presets and
Poly Haven Worlds persist by reference and restore themselves. Blender has the
same problem and answers it with relative paths, which a browser cannot follow.

## Consequences

`Scene.toJSON()` does not serialize `background` or `environment` — only the
intensities, rotations and fog. The World therefore needs its own block in
`project-file.ts` recording its Source, and that block is the thing to version if
the Source shapes ever change.

Texture lifetime differs by Source, and the World tracks which case it is in
rather than assuming. Presets stay in the bundled cache shared with studio lights
and are never disposed on swap; the map built for a colour Surface is the World's
own and is released when it is replaced. Poly Haven and imported Worlds are
single-reference — the download or the file's textures and the map filtered from
them are all disposed the moment they are replaced, or a session spent browsing
HDRIs leaks GPU memory in proportion to curiosity.

Disposal goes through `disposeEnvMap`, never `envMap.dispose()`. A filtered map
is the texture of a `WebGLRenderTarget` that `PMREMGenerator` hands back, and
disposing the texture alone leaves the target's framebuffer and depth
attachment allocated — invisible in `renderer.info`, and freed only by losing
the context. The targets are kept in a `WeakMap` beside the maps so that no
caller has to carry a second reference to release one properly.

The bytes of an imported World live in the store for the length of the session,
beside the Surface rather than inside it. The Surface is what a project file
records and has to stay serializable, and a `File` put in a reactive object comes
back out as a proxy that `URL.createObjectURL` rejects. Dropping them the moment
another Surface wins is deliberate too: there is no way back to a Surface the
user has left except re-importing, so holding the megabytes buys nothing. A file
that fails to load is dropped on the same rule, which is what makes the panel
say "not loaded" rather than name a file and show nothing.

Reopening a project with an imported World raises a warning toast as well as
marking the row. The tab is not open by default and the loss only shows in
rendered mode, so the panel alone would let a World go missing silently.

A Poly Haven World is recorded by its direct file URL rather than by slug and
resolution. Rebuilding the URL from those two would work today and makes this
codebase the keeper of someone else's naming scheme; the URL is what the API
answered with, and following it needs no second call when a project reopens. The
browser offers 1k, 2k and 4k in Radiance HDR and nothing else: the sizes above
that run to hundreds of megabytes for a backdrop, and at these sizes EXR buys
nothing an HDR at half the bytes does not already give.

`RenderImageModal` builds a fresh `THREE.Scene` per render and copies the World
onto it by hand. `background`, `environment` and `fog` were copied already;
`environmentIntensity`, `backgroundIntensity`, `backgroundBlurriness` and both
rotations were not, so a render came out lit at strength 1 whatever the World
said. Every field a World writes has to be copied there, and a new one is a new
line in that function.

`environment` was once the exception that could not be copied at all. When the
render drew with a second `WebGLRenderer` on its own canvas, the filtered map — a
render target with no pixels outside the GL context that produced it — sampled
black in that other context, and renders came out correctly framed with every
object lit by scene lights alone (issue #29). The render now draws with the
viewport's own renderer into a `WebGLRenderTarget` and reads the pixels back, so
there is no second context and `environment` copies straight across like every
other field. Any future scene render should reuse the viewport renderer for the
same reason, rather than reviving a per-renderer filter.

Its own background colour picker gave way to the World's, leaving only the
transparent toggle, because alpha is a genuinely render-specific choice and a
second place to set a background is how the two drift apart.

## When to revisit

If projects ever hold more than one scene, the datablock question reopens on its
own terms and this ADR's answer no longer applies.
