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

## Tests

**Mock only what the test environment cannot run**: the GPU (anything needing a live
`WebGLRenderer`), the network, and the browser's file picker and download. Neighbouring
stores and pure modules run for real. A mocked store answers whatever the test told it
to, so the test ends up checking the mock: the scene store's tests once mocked ten
modules and stayed green with `deleteFromScene` asking about the wrong object. The
scene-copy and scene store tests are the model: real stores, and a save checked by
decoding the bytes with the real project decoder. ESLint rejects a `vi.mock` of a store
or of the project file module. The mocks written before the rule carry an
`eslint-disable-next-line` each, and a directive left with nothing to suppress fails
lint. Review covers what the rule cannot match, such as a pure module mocked by another
path.

**A component test renders its real children and drives them as the user does.** Input
is clicks and typing on elements found by role, label or text; output is the DOM and
emitted events. A stub of a child component or of a reka-ui primitive tests the stub.
Behaviour that needs the real primitives and is awkward to reach in happy-dom belongs in
the Playwright suite, which is why the outliner is covered there. The global `MxTooltip`
stub in `src/app/test/setup.ts` is the one sanctioned exception: reka-ui's hover-and-portal
path is out of happy-dom's reach, so the stub renders the real `MxTooltipBody` inline.
reka-ui's slider thumbs mount hidden and gain `aria-valuenow` a tick later, so find them
with `findBy*`: `getBy*` misses them.

**A test whose name claims a behaviour fails when that behaviour is removed.** Name the
mutation it catches: delete the watcher, ignore the option, check the wrong object. A
commit that adds or strengthens an assertion names, in its message, each such test with
the mutation it was run against and saw fail; reading the test alone cannot tell.
`bun run assertions:staged` lists those tests, and the commit-msg hook rejects a message
that leaves one out. One audit found five tests that stayed green with their behaviour
gone (the World's Surface watcher, icon rendering, the download's MIME type, `crc32`'s
offset, delete's selection check). `bun run test:mutation <file>` runs Stryker on one
source file and lists the mutants its tests leave alive. It only knows its own operator
swaps; `bun run test:mutant <file> <original> <mutated>` makes one by hand (ask the wrong
object, skip a call) and names the tests that kill it. The commit-msg hook checks the
message names the mutations, so review checks only that each new assertion has a
mutation it would fail, not the message. A review finding that a test would stay green
under some change is run through `test:mutant` first and reported with the result.

**Assert the value.** `toBeDefined()`, `toBeTruthy()` and a bare `toHaveBeenCalled()`
pass for any result that exists; pin what the result should be.

**Behaviour that needs a live renderer is covered end-to-end.** The unit setup provides
WebGL 1, and three.js needs WebGL 2, so a `WebGLRenderer` cannot be built under Vitest
(see `src/app/test/setup.ts`): the composer's passes, the controls and the render loop
are tested in Playwright. The composer and controls stores themselves build without a
renderer and run for real, as in the camera store tests; only the composer's `init` and
`renderImage` and the controls' `initControls` need one.
