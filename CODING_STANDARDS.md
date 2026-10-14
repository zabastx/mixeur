# Coding standards

Judgement calls for review. Anything a linter or the type-checker can enforce lives in
`eslint.config.ts` and the tsconfigs instead.

## Scene graph

**Pick objects out of the scene by walking the whole tree.** A filter on a
`userData.mixeur` flag (`isHelper`, `isRenderCamera`, `hideInOutliner`, `isSystemObj`…)
traverses every descendant rather than iterating `scene.children`. The outliner
re-parents freely and Duplicate places copies (and their helpers) beside the original,
so any flagged object can sit at any depth. A top-level-only filter has been written four
times: the render camera list (since fixed), `clearScene`, the outliner's root filter
and the render's helper filter (since fixed). Iterating `children` is right when the hierarchy itself is the
subject, as in the outliner tree rendering one level at a time.
