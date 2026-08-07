# PROTOTYPE — UV editing (throwaway)

> Nothing in this folder is production code. It exists to answer one question and
> then be deleted from `main`, surviving only on its own branch as a primary source.

## The question

**Can Mixeur edit a mesh's UVs the way Blender does — and what is a "UV selection"
actually made of?**

The interesting part was never "can you drag a point on a canvas". It is that a
mesh vertex owns *one to many* UV coordinates, so "select this corner and move it"
has three defensible answers, and the wrong default is how a UV editor ends up
feeling possessed.

Scope deliberately excluded unwrapping: the prototype edits UVs that already exist.

## Run it

Double-click [`uv-editing-prototype.html`](./uv-editing-prototype.html). No install,
no server, no build. It is one self-contained file.

To regenerate the embedded geometry (it is inlined into the HTML, so the file stays
double-clickable):

```bash
bun src/app/model/prototype-uv-editing/generate-geometry.mjs
```

## What it contains

- A **UV canvas** — click / shift-click / box-drag to select, drag to move, over a
  generated UV-grid texture with its wrap repeats shown faintly.
- A **3D preview** in raw WebGL2, textured from the very buffer being edited. Faces
  whose UVs are selected glow orange; hidden faces are dimmed.
- A **state panel** that reports the numbers the question turns on — above all
  *"vertices a transform moves"* versus *"picked UV vertices"*.
- **Free play** buttons and **five guided walkthroughs**.

The one part meant to survive is the module marked `LIFTABLE MODULE` in the HTML —
`uvEdit`. It is pure (no DOM, no THREE), takes the plain arrays off a
`BufferGeometry`, and would lift into `src/app/model/uv.ts` roughly as-is.

## Findings

1. **Feasible, and cheap.** Topology (islands, seams, split vertices) is union-find
   over the index buffer. Transforms are one function. Live 3D sync is
   `attribute.needsUpdate = true`. The whole liftable module is ~350 lines with no
   dependency and no solver.

2. **`sticky` is the decision, not the feature.** Picking one cube corner moves
   1, 3, or 1 UV vertices depending on the mode. Blender defaults to *shared
   vertex*, which drags every UV copy of a mesh vertex along and quietly destroys
   deliberate seams. **Recommendation: default to `shared-location`** — Mixeur's
   meshes arrive already unwrapped, so their seams are intentional and should
   survive being touched.

3. **Three.js primitives arrive fully overlapped.** A fresh `BoxGeometry` reports
   **15 overlapping island pairs** — all six faces mapped to the entire 0–1 tile.
   So "edit existing UVs" is not actually a viable smallest slice: a grid pack
   (`packIslands`, ~25 lines, no solver) is required before there is anything
   legible to edit.

4. **Seams are already there and are worth drawing.** Every imported mesh carries
   them; welding one shut visibly destroys the unwrap. Rendering them red costs
   ~20 lines and heads off the whole "why did my texture smear" class of bug.

5. **Pivot mode cannot be retrofitted.** Rotating two islands has two right answers
   (median vs individual origins). It is ~15 lines up front and invasive later.

6. **The real dependency: a UV editor is downstream of sub-object selection.**
   Blender only shows the UVs of faces selected in edit mode. Mixeur has no edit
   mode — [`selection.ts`](../selection.ts) selects whole `Object3D`s. Without face
   selection a UV editor stays usable only on low-poly meshes. Note that the
   visibility filter has to run *after* the sticky expansion, not before.

## Verdict

Yes, and the modelling is not the hard part. The open decision is item 6 — whether
to build 3D face selection first, or ship a UV editor scoped to "the whole selected
object" and accept the ceiling.
