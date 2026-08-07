# Scene invalidation stays caller-driven

Vue cannot observe Three.js mutating its own scene graph, so this repo publishes
two invalidation calls that callers invoke by hand after they mutate:
`sceneStore.updateScene()` and `selectionStore.refresh()`. An architecture review
proposed replacing the first with a seam that owns invalidation, on the grounds
that a convention nothing enforces will eventually be forgotten. **We keep the
convention.** An audit of every writer against every reader found no reachable
path where a mutation fails to invalidate, and the one real bug the audit did
turn up was of a kind the proposal would not have caught.

## What the two channels cover

`updateScene()` is `triggerRef(sceneChildren)`. Three projections read through it:

| Projection                                                       | Reads                                                                                                         |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `outlinerItems` (`src/widgets/editor/outliner/DataOutliner.vue`) | `children` recursively, `name`, `type`, `uuid`, `userData.userVisible`, `userData.hideInOutliner`, `isCamera` |
| `sceneGroups` (`src/app/model/scene.ts`)                         | `children` recursively, group-ness, `userData.hideInOutliner`                                                 |
| `renderCameraList` (`src/app/model/camera.ts`)                   | top-level `children`, `userData.isRenderCamera`                                                               |

`selectionStore.refresh()` is `triggerRef(selectedObject)`. Property panels read
through it without knowing they do: `createObjectTarget` resolves its source on
every access, and every panel passes a getter that reads `selectedObject`, so
republishing the selection re-runs those effects and forces a re-read. The
target's private `version` ref is an optimisation on top of that reach, not the
only way in.

Both calls are exported and callable by anything that mutates. Neither is
private, so nothing is walled off from invalidating what it dirtied.

## Why the convention holds today

Seven call sites invoke `updateScene()`: five in `scene.ts`, one in
`shading.ts`, one in `ObjectProperties.vue`. Every writer of a field a
projection reads was traced:

- **`children`** — `addGroup`, `moveObjectToTarget`, `addObjectToScene` and
  `deleteFromScene` all invalidate. `setGridHelper` runs during store
  construction, before a reader exists. `light.add(light.target)` runs inside
  `createLight`, before the light reaches the scene. `helperScene`, the render
  modal's scene and the exporter's scene are not projected.
- **`shading.init()`** adds three lights without invalidating, because
  `setMode(currentMode.value)` returns early on an unchanged mode. Those lights
  carry `hideInOutliner`, `isHelper` and `isSystemObj`, so all three projections
  filter them out. Latent, not live — and it stays latent only as long as those
  flags do.
- **`name`** — written only by `ObjectProperties.vue`, which notifies on
  `@change`. The outliner therefore commits the name on blur or Enter rather
  than per keystroke. This matches Blender and is intended.
- **`userData.userVisible`** — written only by `objectVisibilityUpdate` and
  `addObjectToScene`.
- **`uuid`, `type`, `isCamera`, `userData.hideInOutliner`** — set at
  construction, never mutated afterwards.

## Considered options

**Mutation goes through the store and the store invalidates.** Rejected. It
buys nothing today, and it aims at the wrong failure. The one defect the audit
found — `renderCameraList` filtering top-level children instead of traversing,
so a camera moved into a group vanishes from the list — happened _after_
`moveObjectToTarget` invalidated correctly. The invalidation fired; the
projection was wrong. Owning invalidation does not make a projection read the
right thing.

**Projections observe the scene graph directly**, via Three.js `childadded` /
`childremoved` events or diffing on traversal. Rejected as far more depth than
the problem has. It covers topology only — `name` and `userData` changes emit
nothing — so the caller-driven call would survive anyway, and we would be
maintaining two mechanisms where one currently suffices.

## When to revisit

Command-based undo/redo is planned, covering both graph topology and property
edits. It is the trigger, and it changes the answer for a reason unrelated to
the one the review gave.

An undo stack needs a single point through which every reversible mutation
passes — one `execute`/`undo` choke point. That point, not a mutation seam
retrofitted onto the store, is where invalidation should live: one place instead
of seven, and it arrives with the mutation vocabulary already in hand. Building
the seam beforehand means designing it twice, once blind and once against
undo's real shape.

One gap to design for when that work starts, because it is genuine and current
code does not cover it: `refresh()` republishes the _current_ selection only.
Undoing a property edit on an object that is not selected invalidates nothing,
and the panel will show a stale value the moment that object is selected again.
Reversing property edits needs invalidation addressed at an object, not at the
selection.
