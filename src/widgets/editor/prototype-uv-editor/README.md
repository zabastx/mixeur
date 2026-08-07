# PROTOTYPE — UV editor layouts (throwaway)

> Nothing in this folder is production code. It exists so three layouts can be
> compared in the real app, and then two of them get deleted.
>
> Phase 1 (does the model work?) lives in
> [`src/app/model/prototype-uv-editing/`](../../../app/model/prototype-uv-editing/README.md)
> and is already answered. This is phase 2.

## The question

**Where should a UV editor live inside Mixeur, and what should its primary
affordance be?**

Scoped per the phase-1 finding that a UV editor is downstream of sub-object
selection, which Mixeur does not have: **all three variants are object-scoped**.
They show the whole selected mesh's UVs, with no edit mode and no 3D face
selection. That ceiling is part of what is being judged.

## Run it

```bash
bun dev
```

The switcher bar at the bottom of the screen cycles the variants (or `Alt`+`←`/`→`).
It only renders in dev builds.

| URL                                | Variant                               |
| ---------------------------------- | ------------------------------------- |
| `http://localhost:5173/`           | **off** — the app exactly as it ships |
| `http://localhost:5173/?variant=A` | **A** — split viewport                |
| `http://localhost:5173/?variant=B` | **B** — workspace tab                 |
| `http://localhost:5173/?variant=C` | **C** — sidebar dock                  |

Without `?variant=`, `App.vue` renders the untouched layout — the prototype
costs the normal app nothing.

Add a cube, select it, and press **Grid** / **UV grid texture** to put a
labelled UV grid on its material. Then **Pack** — three.js maps every primitive
face to the whole 0–1 tile, so until you pack there is nothing to look at.

## The three bets

Variants disagree about structure, not styling. Each one owns its own `<main>`.

**A — Split viewport.** The 3D view gives up half its width; both views are
permanently on screen with one dense control strip between them. Blender's UV
Editing workspace. _Bet: constant side-by-side feedback is worth the lost
viewport width._

**B — Workspace tab.** UV editing is a mode. Tabbing into it hands the whole
stage to the UV view, demotes 3D to an inset, and gives the controls a labelled
rail with room to explain themselves. _Bet: UV work happens in concentrated
bursts and deserves focus — at the cost of losing the outliner while you are in
it._

**C — Sidebar dock.** UV mapping is a property of the mesh. The 3D view keeps
its full width; the layout arrives as a thumbnail plus a list of islands you
nudge with buttons. Deliberately unfashionable: no dragging, no modes, no pivot
dropdown. _Bet: most UV work in a web editor is coarse — pack, spot an overlap,
shove an island off another — and a list beats a canvas for exactly that, while
costing the layout nothing._

## What is real and what is not

Real: the geometry, the selection, the editing. Variants operate on the actually
selected `THREE.Mesh`, write into `geometry.attributes.uv`, and flag it for
re-upload — the same path the real feature would take. Both views stay in sync
because there is only one buffer.

Not real: no persistence, no undo, no tests, no error handling past what keeps
it runnable. `reset` restores the geometry's original UVs; a reload does the
same.

## Files

| File                                  | Survives?                                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `uv-edit.ts`                          | **Yes** — the pure model validated in phase 1. Lifts to `src/app/model/uv.ts` about as-is. |
| `uv-grid-texture.ts`                  | Maybe — a generated UV grid is useful on its own.                                          |
| `UvCanvas.vue`                        | Partly — the drawing is sound; the component shape is not considered.                      |
| `use-uv-editor.ts`                    | No — prototype glue, module-scoped singleton state.                                        |
| `Variant*.vue`                        | No — two get deleted, one gets rewritten properly.                                         |
| `variant.ts`, `PrototypeSwitcher.vue` | No — scaffolding.                                                                          |

## Removing it

1. Delete this folder.
2. In `src/App.vue`, drop the `useVariant`/`isDev` lines, the three `Variant*`
   branches, and `<PrototypeSwitcher />` — each is marked `PROTOTYPE`.
