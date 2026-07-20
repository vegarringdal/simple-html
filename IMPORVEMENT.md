# Improvements

Log of code fixes/cleanups done outside of feature work.
See `README.md` for the feature TODO list.

## Done

### `columnsCenter` default checked the wrong property
`gridInterface.ts` `__parseConfig()`

Copy-paste bug: the guard checked `columnsPinnedLeft` but assigned `columnsCenter = []`.
A config with `columnsPinnedLeft` set but `columnsCenter` missing would fall through the
guard and then crash in `getCellHeight()` / `.filter()` further down. Now checks the
property it assigns.

### No-op if/else when building `__attributes`
`gridInterface.ts` `__parseConfig()`

Both branches of `if (!this.gridConfig.__attributes[name])` did the same assignment.
Collapsed into a single line.

### Dead `lastLeft` accumulator in vertical scroll handler
`gridFunctions/verticalScrollHandler.ts`

The three width loops (center / pinned left / pinned right) each accumulated a `lastLeft`
that was never read. Replaced the three loops with `.map((c) => c.width)` — 20 lines to 4,
in a function that runs on every vertical scroll event.

### Wrong `e.top` pre-pass before `updateRow`
`gridFunctions/verticalScrollHandler.ts`

`if (e.row) { e.top = rowTops[e.row] }` was wrong in two directions:
* row `0` is falsy, so the first row was skipped
* row `-1` (recycled/hidden row) is truthy, so it set `e.top = rowTops[-1]` = `undefined`

It was also redundant — `updateRow()` assigns `e.top = rowTops[e.row]` itself, correctly
guarded on `e.row !== -1`. Removed the pre-pass.

### Toolchain: eslint + prettier -> biome, ts-node -> tsx

* `.eslintrc.js` and `.prettierrc.json` removed, replaced by `biome.json`.
  Formatter settings carried over 1:1 (4 space indent, single quotes, semicolons,
  no trailing comma, 130 line width). Lint rules carried over: `noExplicitAny` off,
  `noInferrableTypes` off, `noUnusedVariables` warn.
* scripts: `eslint` / `eslint:run:packages` / `prettier:run` -> `lint` / `lint:fix` / `format`
* scripts: `start` / `build:demo` now run through `tsx` instead of `ts-node`

### All dependencies updated and pinned to exact versions

TypeScript held at 6.x by request (7.0.2 is current `latest`).

| package | before | after |
| --- | --- | --- |
| @biomejs/biome | (new) | 2.5.4 |
| @types/node | (new) | 26.1.1 |
| esbuild | 0.24.0 | 0.28.1 |
| esbuild-helpers | 2.0.1 | 2.0.5 |
| lit-html | 3.2.1 | 3.3.3 |
| tsx | (new) | 4.23.1 |
| typedoc | 0.26.10 | 0.28.20 |
| typescript | 5.6.3 | 6.0.3 |
| vitest | 2.1.3 | 4.1.10 |

`packages/grid` runtime dep `lit-html` bumped `^2.6.1` -> `^3.3.3` — kept as a range
rather than pinned, so consumers can dedupe. This is a breaking change for anyone still
on lit-html 2.

### TypeScript 6 config migration

TS6 made `baseUrl` and `moduleResolution: "node"` (node10) hard deprecation errors.

* `moduleResolution` `node` -> `bundler` in `packages/tsconfig.json`, `samples/tsconfig.json`,
  and the inline configs in `config_devserver.ts` / `config_demo_build.ts`
* `baseUrl` removed — `paths` works without it since TS 4.4
* `"types": ["node"]` added to `packages/tsconfig.json`. Dropping `ts-node` removed the
  transitive `@types/node`, which broke the `NodeJS.Timeout` annotations in `grid/grid.ts`.
  See the note below — those annotations should not be there at all.

## Considered, not done

### `largeScroll` dead branch in horizontal scroll handler
`gridFunctions/horizontalScrollHandler.ts`

`largeScroll` is hardcoded to `false` (`// lets disable ctx for now`), which makes the
whole `largeScrollLeftTimer` / `delayScrollRender()` mechanism unreachable. Left in place
— it looks parked rather than abandoned. Decide whether to revive or remove it.

## Candidates / not started

* **`NodeJS.Timeout` in a browser library** — `grid/grid.ts` types its scroll/resize timers as
  `NodeJS.Timeout`, which is why the package needs `@types/node` at all. `ReturnType<typeof setTimeout>`
  is correct here and drops the dependency.
* **~500 biome diagnostics** on the existing code, none applied yet. Bulk is mechanical
  (173 `useImportType`, 75 `organizeImports`, 57 `useTemplate`, 21 `format`). A handful look
  like real defects worth reading individually rather than autofixing:
  `noSwitchDeclarations` (12), `noSelfAssign` (4), `noDoubleEquals` (3),
  `useIterableCallbackReturn` (2), `noImplicitAnyLet` (6).
* **Duplication in hot paths** — `verticalScrollHandler.ts` has three near-identical ~30 line
  blocks for left/middle/right that differ only in cache + widths array. Same shape in
  `horizontalScrollHandler.ts`.
* **Duplicated listener machinery** — `addEventListener` / `removeEventListener` /
  `__callSubscribers` are identical in `Datasource` and `GridInterface`.
* **Linear scans on every scroll event** — `getTopRow()` / `getLeftCol()` scan from index 0
  each time. `scrollTops` / `colLeft` are sorted, so binary search applies. README already
  flags wide reports (200 columns) as a past pain point.
* **Repetitive defaulting** — `__parseConfig()` has ~15 repetitions of the
  `x === null || x === undefined` idiom, plus three copy-pasted attribute-collection loops.
* **Test coverage** — 18 test files, nearly all filter-focused. Grouping / selection / sorting
  have one file each; nothing covers the grid/render layer.
* **lit-html version drift** — `packages/grid/package.json` depends on `^2.6.1`, root
  devDependency is `3.2.1`.
