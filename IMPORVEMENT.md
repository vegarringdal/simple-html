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

### Real bugs found by the biome lint pass

These were not style issues — each was a genuine defect surfaced by a lint rule.

* **`row % 0` instead of `row % 2`** — `gridFunctions/renderRowSelector.ts`
  `row % 0` is always `NaN`, and `NaN == 0` is false, so the even/odd striping on the
  current-entity row selector always took the "odd" branch. The `simple-html-label-even`
  class was dead. Found via `noDoubleEquals`.
* **Proxy `set` trap returned a value instead of `true`** — `datasource/entityHandler.ts`
  `return (obj[this.__KEYSTRING] = value)` returns `value`. ES modules are strict mode,
  where a `set` trap returning a falsy value throws `TypeError: 'set' on proxy: trap
  returned falsish`. Setting `__KEY` to `0`, `''` or `null` would crash. Every other path
  in that trap returns `true`. Found via `noAssignInExpressions`.
* **`typecheck` only ever failed on semantic errors** — `typecheck.js`
  The guard used the comma operator, which evaluates to its *last* operand only. So
  `optionsErrors`, `globalErrors` and `syntacticErrors` were computed and thrown away —
  a tsconfig option error could never fail the build. Found via `noCommaOperator`.
  Now `||` across all four.
* **`spawner()` could hang forever** — `scripts/utils.js`
  The promise had a `reject` parameter but no `error` handler, so if a child process
  failed to start (ENOENT etc.) the promise never settled and the build hung with no
  output. Found via `noUnusedFunctionParameters`.

### Biome cleanup applied

~500 diagnostics down to zero.

* Mechanical, applied via `biome check --write` and scoped `--unsafe` runs:
  173 `useImportType`, 75 `organizeImports`, 57 `useTemplate`, 34 `useParseIntRadix`,
  21 `format`, 17 `useOptionalChain`, plus smaller counts of `useLiteralKeys`,
  `noUselessTernary`, `useNodejsImportProtocol`, `noUselessConstructor`.
* `isNaN` -> `Number.isNaN` (8) — checked each call site first. Every argument was
  already `parseFloat(...)` or `Number(...)`, so there is no coercion difference.
* `hasOwnProperty` -> `Object.hasOwn` (2) — needed `lib` bumped `es2021` -> `es2022` in
  `packages/tsconfig.json`. **This raises the runtime floor** to Chrome 93 / Firefox 92 /
  Safari 15.4.
* Dead `x = x` self-assignments removed (4), unused `catch` bindings dropped to
  optional catch binding (3), `let` declarations given explicit types (6).

Two rules were deliberately overridden rather than obeyed:

* `noStaticOnlyClass` **off** — the formatters (`DateFormaterYYYYMMDD`, `NumberFormaterDot`,
  ...) are static-only classes exported as public API. Converting them to plain objects
  would be a breaking change for consumers.
* `noConfusingVoidType` suppressed on `contextMenuCustom` — its `callback` is typed
  `(attribute: string) => boolean | void` on purpose, so callers can return nothing or a
  boolean to close the menu. Biome's suggested `boolean | undefined` would reject every
  void-returning callback.

### ES target raised to es2025

`target` and `lib` set to `es2025` everywhere they were declared, which had drifted apart:

| file | was | now |
| --- | --- | --- |
| `packages/tsconfig.json` | target es2020, lib es2021 | es2025 |
| `samples/tsconfig.json` | target es2018, lib es2021 | es2025 |
| `config_devserver.ts` | target es2018, lib es2021 | es2025 |
| `config_demo_build.ts` | target es2018, lib es2021 | es2025 |
| `scripts/build.js` | target es2018, lib es2021 | es2025 |

`scripts/build.js` is the one that matters for consumers — it emits the published `dist`,
so the package now ships untranspiled es2025. It also still used the deprecated
`moduleResolution: 'node'`, now `bundler`.

### `npm start` typecheck errors fixed (18)

The dev server runs its own typechecker over `samples` + `packages`, which is stricter than
`npm run typecheck` (that one only covers `packages`). It was failing on:

* **`NodeJS.Timeout` in `grid/grid.ts` (3)** — a browser library should not depend on node
  types. Replaced with `ReturnType<typeof setTimeout>`, which also let the temporary
  `"types": ["node"]` come back out of `packages/tsconfig.json`.
* **CSS side-effect imports (5)** — TS6 reports these as TS2882. Added `samples/css.d.ts`
  with `declare module '*.css';`.
* **`process` not found in `config_demo_build.ts` (1)** — it is a node script being pulled
  into a browser typecheck. Added to the `exclude` list, which already had
  `config_devserver.ts`.
* **Unused `@ts-expect-error` (8)** — biome's `noTsIgnore` rewrote `@ts-ignore` to
  `@ts-expect-error`. Since `e` was already `any` there was never an error to suppress, so
  they became errors themselves. Removed.
* **Wrong arity in `samples/grid01/index.ts` (1)** — a `valueFormater.fromSource` override
  called through with 3 args when the signature takes 4, silently dropping `isFilter`.

### Dates never cleared the edited flag

`datasource/entityHandler.ts` `set()`

To decide whether a row is still modified, `set()` normalises both the original and the new
value to midnight and compares them. Both sides were `Date` objects and the comparison was
`===`, which is object identity - two `Date`s holding the same moment are never `===`. So a
date edited back to its original value stayed flagged as edited forever, unlike every other
type, and the row kept showing up in `getChanges()` with nothing actually changed.

Both sides are now normalised with `.getTime()`, so the comparison is between timestamps.

The day-only behaviour is unchanged and now covered: a different *time* on the same day is
still not an edit, a different *day* still is.

### Browser level gui tests - tried with playwright, then removed

A playwright setup was built and working (32 tests against the real sample in chromium:
sorting, label menu, row menu copy, date picker, column resize and reorder), then removed
again. The interactive half of the grid needs real layout and real events, which happy-dom
cannot give, but a browser suite is not worth the weight here - it does not replace the
manual pass anyway, since it checks behaviour and not appearance.

If it is ever revisited, the notes below are what cost the most time to work out.

* the playwright recorder (`playwright codegen`) **does** capture right clicks, but **not**
  drag operations. So menus can be recorded, resize and reorder have to be hand written
  with raw mouse events.
* the recorder toolbar overlays the top of the page, which is exactly where the grid header
  is, so the sample has to be pushed down to record anything in the header.
* happy-dom needs `canvas.getContext('2d').measureText` and element sizes stubbed, since it
  does no layout. See `grid/__tests__/gridTestHelpers.ts`, which is still in use.

#### Behaviour the browser testing turned up

Independent of the tooling, and worth keeping:

* **columns are virtualised horizontally** - a column that is off screen does not exist in
  the dom at all
* **the paste and clear row menu entries differ by one space** - `Cell (sel.rows)` is
  Paste, `Cell (sel. rows)` is Clear. Easy to hit the wrong one, for a test *or* a user.
  Worth renaming.
* **the resize handle spans the full header height but the filter input covers its lower
  half** - only the top part of the handle is actually grabbable
* **two `.simple-html-label` elements are stacked at the same coordinates** in the header,
  so the lower one intercepts clicks aimed at the upper one

### Test suite expanded before touching more code

The point was to have a safety net in place before any larger refactor, so the risky
areas are pinned down first. No existing test was modified or renamed - only new files.

128 tests -> 447 tests. Statement coverage 12.7% -> 40.6%.

| area | before | after |
| --- | --- | --- |
| `src/datasource` | 45.8% | 82.3% |
| `src/grid` (core) | 0% | 56.1% |
| `src/grid/gridFunctions` | 0% | 23.4% |

New test files:

* `datasource/__tests__/entityHandler.test.ts` (30) — proxy edit tracking, `__rowState`
  precedence, `__KEY` handling. Includes a regression test for the falsy `__KEY` crash.
* `datasource/__tests__/dataContainer.test.ts` (34) — change tracking: `getChanges`,
  `markForDeletion`, `resetData`, `resetDataSelection`, `setErrors`, `replace`.
* `datasource/__tests__/filterSortGroupPipeline.test.ts` (18) — filter, sort and grouping
  **combined**. The pre-existing tests only ever exercise one of the three at a time, so
  the `__internalUpdate` path that rebuilds displayed-from-filtered was untested.
* 7 formatter test files (204) — every date/number formatter plus `defaultValueFormater`.
* `grid/__tests__/gridSmoke.test.ts` + `gridRendering.test.ts` (33) — gui tests.

Tooling added: `happy-dom` (gui test environment), `@vitest/coverage-v8`, and a
`test:coverage` script.

#### About the gui tests

happy-dom renders the grid for real, so these assert on behaviour rather than structure:
sorting reorders the rendered values, a filter changes the footer count, grouping inserts
group rows and collapse/expand hides/shows data rows, selection applies the right classes.

Two stubs are needed, both in `grid/__tests__/gridTestHelpers.ts`:
* `stubCanvas()` — the grid measures text via `canvas.getContext('2d').measureText` and
  happy-dom has no canvas.
* `stubElementSizes()` — happy-dom does no layout, so everything reports size 0 and the
  virtual scroller renders nothing.

#### Where more `data-attribute`s would help

Row cells already carry `data-attribute`, which is what makes reading rows back clean.
These still have to be matched on class name or read from the datasource instead:
* group rows — no attribute for group name or level
* footer — the "filtered/total" counts are only available as text
* row selector cells — no marker at all

### Formatter issues found while writing tests (not fixed)

Current behaviour is encoded in the tests, so fixing any of these means updating the
matching test - deliberately, so it stays a visible decision.

* **`numberFormaterComma.ts` `toSource` throws on `null`, `undefined` and numbers.** The
  guard body is a bare `returnValue;` with no `return`, so it falls through to
  `returnValue.includes(',')`. `NumberFormaterDot.toSource` handles all three, so the two
  formatters are **not** interchangeable.
* **Dead null branch in both `fromSource`s** — `parseFloat(null)` is `NaN`, so the value is
  already `''` before the null check. `fromSource(null)` returns `''`, never `null`,
  contradicting the declared `string | null | undefined`.
* **`toFilter` in both `*THHMMSS` formatters stamps `new Date().getMilliseconds()`** while
  zeroing hours/minutes/seconds, giving filter boundaries random milliseconds. The non-`T`
  formatters correctly pass `0`.
* **`toSource`/`toFilter` reject `Date` objects**, returning `null` via the
  `typeof !== 'string'` guard.
* **`fromSource` on an iso date-only string is timezone dependent** — `new Date('2019-01-01')`
  parses as UTC midnight, so west of UTC it formats as the previous day.

### Filter editor: styling, drag, resize and tooltips

`gridFunctions/renderFilterEditor.ts`, `gridFunctions/tooltip.ts`, `grid.css`

* **draggable** by its titlebar, clamped so a bit of it always stays on screen
* **resizable from every edge and corner** - 8 grab areas wired up in js. css `resize`
  only ever offers the bottom right corner, so it is not used. Dragging a west or north
  edge moves left/top as well as the size, otherwise the opposite edge walks across the
  screen. `min-width` 460px / `min-height` 240px so it cannot be collapsed.
* the dialog is rebuilt from scratch on every edit, so position and size are now read off
  the old dialog and reapplied - without that it jumped back to the middle on every click
* the css centering (`top/left: 50%` + `translate(-50%, -50%)`) was replaced by left/top
  set in js, since a transform fights both dragging and resizing
* titlebar got a close X, buttons got hover states, the two "click me to select ..." cells
  got a dashed border so they read as clickable, footer got a separating border
* fixed `padding: px` in `.filter-editor-container`, which was not valid css

#### Tooltips

Every button and icon in the filter editor now carries `data-tooltip`.

* `tooltips` in the grid config turns the **built in** tooltip on and off, default on.
  `data-tooltip` is written either way, so an external tooltip library can be used instead.
  The built in one only renders when the container has `.simple-html-grid-tooltips`.
* `tooltipText` in the grid config overrides individual texts by id
* `TOOLTIPS` is exported from the package so the ids and their defaults can be looked up

Covered by `grid/__tests__/filterEditor.test.ts`.

### Filter context menu: row counts, cursors, button styling

`gridFunctions/dropDownFilterData.ts`, `gridFunctions/contextmenuFilter.ts`, `grid.css`

* **row count per value** in the excel style value list, shown as `VALUE (12)`. Counted for
  every row including the ones past the cap, but only displayed when nothing was cut off -
  a count next to a truncated list would be misleading.
* Blanks are counted too, so the `Blank` entry gets a number as well.

**The "Showing only first 100" warning never worked properly.** It tested
`dataFilterSetFull.size > DROPDOWN_FILTER_MAX_ROWS`, but the cap stops the set at exactly
100, so that could only ever be true when a blank pushed it to 101. A column with 500
distinct values and no blanks silently showed 100 of them with no warning at all. There is
now an explicit `truncated` flag set at the point a value is dropped.

* every clickable thing in a context menu got `cursor: pointer` - menu items, the value
  checkboxes and their labels, and the bottom action button
* the value rows became a real class instead of inline padding, so they can have a hover
  state and ellipsis on long values
* the bottom action button ("Run Search", and "Close" in the column chooser, same class)
  restyled as an actual button - border, radius, margin, hover and a pressed state
* icons using `.simple-html-grid-icon-group-svg` got `cursor: pointer`, which also covers
  the remove grouping X in the top panel

Covered by `grid/__tests__/dropDownFilterData.test.ts`.

### Row menu: filter on the value in the cell

`gridFunctions/contextmenuRow.ts`

New "Filter:" section in the right click menu on a cell:

* **Replace filter (all)** - throws away the current filter, keeps only a condition on this
  cell's value
* **Add to filter (and)** - keeps the current filter and puts this condition **in front** of
  it, joined with AND

Details worth knowing:

* a blank cell filters with `IS_BLANK` rather than `EQUAL ''`, which would match nothing
* the quick filter inputs in the header are cleared when this runs, otherwise they keep
  showing text that no longer matches the filter that is actually applied
* the section is hidden on group rows, they have no value of their own
* it filters on the **source** value, not the displayed one. With a value formater that
  rewrites the display (like the country override in the sample) the filter uses what is
  really in the data.

Covered by `grid/__tests__/rowMenuFilter.test.ts`.

### Dim repeated values

`gridFunctions/isRepeatedValue.ts`, `gridFunctions/renderRowCell.ts`, `gridFunctions/contextmenuRow.ts`

A cell that repeats the value of the row above is dimmed, so only the first row of a run of
equal values reads at full strength. Off by default, toggled with **View: Use dimmed
values** in the row context menu, and `dimRepeatedValues` in the grid config.

* **grouping resets it** - the comparison is against the previous row in the *displayed*
  collection, and a group header sits between two groups, so the first data row of every
  group always shows fully. That falls out of the design rather than needing a special case.
* the comparison is on the **displayed** value, not the raw one. This is a visual feature -
  if a value formater makes two different source values render as the same text they look
  repeated and should dim. The sample rewrites every `country` cell to "Open D" while the
  underlying data differs per row, and comparing raw values left that column undimmed.
  Comparing displayed values also handles dates for free, two Date objects are never `===`.
* the dynamic type column is honoured, same type resolution the cell rendering uses
* blanks are never dimmed, a run of faded empty cells just looks broken
* row indexes are absolute in the displayed collection, not in the recycled dom rows, so it
  stays correct while scrolling

`data-repeated-value="true|false"` is written to every cell input regardless of the setting,
so the dimming can be restyled or replaced without touching the grid.

Covered by `grid/__tests__/dimRepeatedValues.test.ts`.

### Build configs deduplicated

`config_shared.ts` (new), `config_devserver.ts`, `config_demo_build.ts`

The two build configs were the same file with different switches. Everything they agreed on
moved to `config_shared.ts`:

* `TS_CONFIG` - the typechecker options, which were duplicated **word for word**. That is
  why the TypeScript 6 `baseUrl` / `moduleResolution` migration had to be applied twice.
* `INDEX_TEMPLATE` - the html shell
* `clientOptions()` - esbuild options, with `development` picking minify/sourcemap/define
* `DEV_OUTPUT_ROOT` / `DEMO_OUTPUT_ROOT` - where each build writes

The two files are down to what actually differs: the dev server watches, serves on 8080 and
keeps the typechecker running, the demo build does one minified pass and stops.

Output:

* dev server -> `dist_dev/<sample>`, throwaway and gitignored (was `dist`)
* demo build -> `docs/demo`, unchanged, this is what github pages serves

### typedoc-grid was broken

`tsconfig-typedoc.json`, `typedoc.json` (new), `package.json`

`npm run typedoc-grid` failed with 5 errors and generated nothing. It was the last config
the TypeScript 6 migration missed:

* `moduleResolution: node` and `lib: es2021` -> `bundler` / `es2025`, same as everywhere
  else. The old lib is why `Object.hasOwn` in `entityHandler.ts` errored here but nowhere
  else.
* the node build scripts were being pulled into the docs typecheck, so `process` was
  undefined. Added to `exclude`, together with the build output folders.
* the entry list still pointed at `datasource/types.ts`, a file that no longer exists

Then the remaining warnings were cleared:

* the `@param row,` in `dataSource.select` had a comma in the parameter **name**, so typedoc
  could not match it to the argument. The `triggerSelect` argument was undocumented.
* types that back public API but were not in the docs got added as entry points -
  `valueFormater`, `datasourceConfigOptions`, `colType`, `GROUP_COLTYPE`, `dateInterface`
* `typedoc.json` added with `externalSymbolLinkMappings`, so the re-exported lit-html
  `html` / `render` link out to lit.dev instead of warning

Now runs with 0 errors and 0 warnings.

### biome was formatting the built package

`biome.json`

`packages/*/dist` was taken out of `.gitignore` so the package can be installed straight
from a git branch for testing against a real app. Biome uses the ignore file
(`vcs.useIgnoreFile`), so the moment that line went, `biome check --write` started
reformatting the emitted `packages/grid/dist` - 101 files in one run.

`!**/dist` added to `biome.json` `files.includes`, so the exclusion no longer depends on
what happens to be gitignored. Back to 160 files checked.

Anything already in `packages/grid/dist` should be regenerated with `npm run build:all`
before committing, so what is published is what tsc emitted rather than what biome
reformatted.

### Flattened the workspace into a single package

The repo was a one-package npm workspace (`packages/grid`). Since releases now happen by
installing straight from a git branch rather than `npm publish`, the workspace layer was
pure overhead and is gone.

* `packages/grid/src` -> `src`, `packages/grid/dist` -> `dist` (both via `git mv`)
* the two `package.json` files merged into one root manifest named `@simple-html/grid` -
  it carries both the dev tooling and the package identity (`main`/`module`/`typings` ->
  `dist`, `lit-html` as a dependency, repo/bugs/homepage). `workspaces` removed.
* `test` / `test:coverage` / `test:watch` were `npm run ... --workspaces`, now plain
  `vitest` since there is no workspace to fan out to
* `packages/tsconfig.json` -> root `tsconfig.json`, paths `@simple-html/grid` -> `./src`
* `scripts/build.js` and `clean.js` looped over `packages/*`; rewritten to build the single
  `src` -> `dist`. The build scopes itself with `include: ['src']` - `basePath` is now the
  repo root, so without that it dragged the samples and node config scripts into the emit
  and complained they were outside `rootDir`.
* paths repointed in `samples/tsconfig.json`, the sample css imports, `config_shared.ts`,
  `config_devserver.ts` (watch globs), `typecheck.js`, `tsconfig-typedoc.json` and the
  `typedoc-grid` script
* deleted the orphaned `.versionrc.json` - it listed bumpFiles for half a dozen packages
  that never existed, and standard-version was already gone

Gotchas hit on the way, noted so they are not rediscovered:

* the merge dropped `happy-dom` from devDependencies by accident, which took out the 6
  browser-env grid tests with a "failed to start forks worker" rather than a clear error
* the root `tsconfig.json` now covers the whole repo, so the node config scripts have to be
  in `exclude` or `process` is undefined during typecheck
* the first build ran before `include: ['src']` was added and, with `declaration: true`,
  scattered `.d.ts` / `.js` next to every `.ts` in the repo. All cleaned up, the scoped
  build no longer does it.

### Dropped the demo build, merged the dev server config

Demos are run locally now (no github pages build), so `config_demo_build.ts` is gone and
`config_shared.ts` folded back into `config_devserver.ts`. With one consumer left, the
shared abstractions collapsed: no `development` flag, no `outputRoot` parameter, no
`entrySample` vs `outSample` - the dev server is always watched, unminified, dev, output to
`dist_dev`. The `TS_CONFIG` / `INDEX_TEMPLATE` / `clientOptions` indirection is inlined.

* `build:demo` and `clean:dist` scripts removed, `build:all` renamed to `build`
* stale `config_demo_build.ts` / `config_shared.ts` entries dropped from the tsconfig
  excludes

### npm run build now packs a tgz into ./build

`scripts/build.js`, `package.json`

After emitting `dist`, the build wipes and recreates `./build` (gitignored) and runs
`npm pack --pack-destination ./build`, so `./build` always holds exactly the latest
`simple-html-grid-<version>.tgz`.

This surfaced that the package had no `files` allowlist, so `npm pack` was shipping the
whole repo - 570 files, 13 MB, mostly the 11 MB `samples/grid01/dummyData.ts`, plus
`.claude`, `.vscode`, config and scripts. Added `files: ["dist", "src", "README.md",
"LICENSE"]`. The tgz is now 335 kB, and `src` is included so consumers get working
go-to-definition from the `.d.ts.map` files.

The requested `--pack-destination` was `./dist`, changed to `./build`: `dist` is the content
being packed and is wiped at the start of every build, so a tgz there would be packed into
the next tarball and then deleted.

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
* **Duplicated writes in the proxy set trap** — `datasource/entityHandler.ts` assigns
  `this.__currentValues[prop] = value; obj[prop] = value;` twice in a row at the end of
  `set()`. Harmless but almost certainly a bad merge.
* **`src/date` (the date picker) has no tests at all** — 0% coverage. `src/grid/gridFunctions`
  is at 23%; the context menus, drag/drop and key navigation are the largest untested parts.
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
