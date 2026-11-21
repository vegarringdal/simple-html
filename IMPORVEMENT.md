# Improvements

Log of code fixes/cleanups done outside of feature work.
Open items are at the bottom, under *Candidates / not started*.
The v6 plan (breaking changes allowed, documentation included) is in `V6_PLAN.md`.

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
* **the paste and clear row menu entries have the same text** - both read
  `Cell (selected rows)`. They sit under separate `Paste:` / `Clear:` section headings, which
  tells a user which is which, but a test has to pick by section rather than by text.
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

**No longer applies:** the flatten (below) put `dist/` back in `.gitignore` and dropped it
from git, and `build:all` is now `build`, so there is no committed build output to keep
clean. The `!**/dist` exclusion is still in `biome.json`.

### Flattened the workspace into a single package

The repo was a one-package npm workspace (`packages/grid`). Since releases now happen by
installing straight from a git branch rather than `npm publish`, the workspace layer was
pure overhead and is gone.

* `packages/grid/src` -> `src` via `git mv`. `packages/grid/dist` was deleted from git rather
  than moved, and `dist/` went into `.gitignore`.
  **Note:** with `dist` not committed and no `prepare` script, installing straight from a
  git branch now gets a package without `dist`, while `main` points at `dist/index.js`. The
  tgz that `npm run build` writes to `./build` (see below) is what installs a working package.
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

**Update:** a demo build is back, for github pages only - see *Demo published to gh-pages*.

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

### Demo shell: scrollbars styled like the grid's
`samples/demo/index.css`

The sidebar nav, the "How to use" code panel and the activity log all scroll, but had no
scrollbar styling, so they got the browser default (wide, light track, arrow buttons) -
which stood out badly against the dark sidebar and next to the grid's thin flat scrollers.

One shared rule now covers the three scrolling areas, mirroring what `grid.css` does for
the grid's own scrollers: `scrollbar-color` + `scrollbar-width: thin` for the standard
properties, and the `::-webkit-scrollbar` thumb/track fallbacks (10px, inset shadow) for
browsers without them. The rule reads two variables, `--demo-scroll-thumb` and
`--demo-scroll-track`, so each area sets the pair that fits its background:

* `body` / `body.dark` - the grid's own light/dark thumb and track colours, so the log
  above the grid matches it in both themes
* `.sidebar` - always dark, uses the sidebar's own hover/border greys
* `.code-panel` - always dark, uses the panel's summary/border colours

### Bug sweep: every high and medium finding from a full code review

A review of the whole of `src` (datasource, grid render/lifecycle, interaction + date picker)
found about 35 real bugs. All high and medium ones are fixed here, each with a regression test
that fails on the old code. Low ones are listed under *Candidates*.

500 -> 634 tests. Statement coverage 44% -> 66% (`src/datasource` 89%, `src/grid` core 80%,
`src/grid/gridFunctions` 55%, `src/date` 0% -> 56%).

#### Behaviour changes - decided, worth knowing

* **a filter group without `logicalOperator` is AND**, as `FilterArgument` documents. The code
  ran it as OR.
* **empty groups and incomplete conditions are ignored** - no attribute, no operator, or a date
  condition without a value. They never restrict rows. Before, an empty OR group removed every
  row ("Clear Filter" on a column could leave one behind), and a missing operator fell back to
  `>=`.
* **group or condition**: `type` decides when it is set, otherwise a `filterArguments` array
  makes it a group - as documented. `logicalOperator` alone does not.
* **blanks** (null, undefined, `''`, invalid Date) **sort first ascending, last descending**.
  0 and false are real values. Grouping keys values the same way the sort compares them.
* **date filters on a date only format match on the day**, a format with time (`*THHMMSS`)
  still compares the time. Storage is unchanged: a date set in a cell keeps its time.
  The date formatters declare it with a static `includesTime`, the `ValueFormater` with an
  optional `dateIncludesTime(attribute)`. A custom formater without it keeps comparing with time.
* **blank dates never match a date comparison** (=, <, >, <=, >= and the operators mapped onto
  them), only NOT_EQUAL_TO and IS_BLANK. They used to count as 1970-01-01. Number filters are
  unchanged - 0 and blank are deliberately the same thing there.
* **group header rows can not be selected**, so Clear/Paste can no longer write onto them
* **typing in a header filter only replaces that column's top level conditions** - ranges,
  nested groups and other columns are kept. An OR root is kept whole: AND(header condition, OR
  group). "Is Blank" and row menu "Add to filter" do the same.
* **the value list (excel style) is built from what every *other* filter lets through**, so
  values the column excluded itself stay listed, unchecked
* a group chip dropped on a column does nothing; grouping on an already grouped column is a no-op
* `Grid` public fields: `resizeInit` removed, `resizeObserver` and `scrollListenersAbort` added

#### Datasource

* **sort** - `obj[attr] || ''` made 0/null/false all `''`, and a `typeof v1 === 'string' &&
  typeof v1 === 'string'` typo made the comparator disagree with itself. Numbers with 0/null and
  negatives sorted wrong, and grouping then showed the same group twice. New `compareAscending`
  and `isBlank.ts`.
* `markForDeletion(null, true)` spliced inside `forEach`, skipping every other new row
* a key of `0` was replaced with a generated key (falsy check)
* `clearMarkedForDeletion` left the rows on screen
* `addNewEmpty` while grouped put the row outside every group, it vanished on expand/collapse
* `IN` - the AND path compared raw numbers to a stringified list (never matched), the OR path
  gave up on the whole group at an `IN` without a list
* the first ctrl/shift click on a fresh datasource selected nothing
* `getFilterTree` turned an empty group into a condition without operator, which crashed the footer

#### Grid lifecycle and layout

* **the footer crashed on a half built filter** ("add condition" / "add sub group" in the
  editor, then apply) and took the rest of `rebuild()` with it. Now shown as `?`.
* **every grid stayed in memory**: the document click listener was never removed, the
  ResizeObserver never disconnected, timers never cleared. The dropdown grid sample makes one
  grid per click.
* column chooser "Close" left `columnChooserMenu` set, so removing the grid threw and skipped
  the rest of the cleanup
* moving the element in the dom, or `connectInterface` twice, duplicated the dom and dropped the
  datasource subscription
* datasource events between `connectInterface` and the append crashed, and so did removing a
  grid that never got an interface
* a grid created hidden (0x0) got no center columns - the first ResizeObserver callback was
  always skipped, and for a hidden grid that is the one fired when it is shown
* center columns under 50px were left blank (slot count was `width / 50`). It now counts how
  many of the narrowest columns fit, and releasing a column resize rebuilds.
* header too short with `hideFilter` + `cellHeaderLabelHeight`
* `saveConfig`/`loadConfig` passed the datasource's own sort/filter objects around, so a later
  shift+click sort changed the saved config (and `initConfig`). `structuredClone` both ways,
  which keeps Dates.

#### Interaction and date picker

* header filter typing dropped the upper bound of a range on another column, every nested
  group after the first, and an OR root entirely
* drag/drop: a stacked cell dropped above its partner lost the partner; a group chip dropped on
  a column removed or duplicated a column; grouping twice on one column
* value list: a second uncheck brought back the values excluded the first time
* "Is Blank" on an OR root widened the filter, and left the header text showing
* filter editor dates went through `toSource` (current time), so EQUAL never matched - now
  `toFilter`, like the header
* "Clear (selected rows)" ignored per-row readonly
* "Add to filter" turned an OR root into AND, and blanked header inputs whose conditions it kept
* header text survived for columns not listed in `attributes` (it cleared `attributes`, not
  `__attributes`) and came back on the next header edit
* key navigation crashed at section edges (`columnsCenter` read in the left pinned branch, an
  empty center section), and the filter row could never move into left pinned. One
  `nextSection` helper handles leaving a section now.
* date picker: `rowHeight`/`monthWidth`/`monthMargin` all read `weekStart`; a sunday start was
  impossible (`weekStart || 1`); it opened on today instead of the cell's date (`toSource` of a
  Date is null - a Date is now passed as is, a string still goes through `toSource`); the
  minute down arrow wrapped at 23; the days before the 1st were off by one with a sunday start

#### Existing test changed

`filter_dates_time.test.ts` "date filter missing filer to use greater than or equal to" is now
"date filter missing operator is ignored" - it pinned the old `>=` fallback.

### Demo published to gh-pages

`.github/workflows/demo.yml` (new), `scripts/buildDemo.js` (new), `package.json`, `.gitignore`,
`biome.json`

Every push to `v6_maybe` builds the samples app and force pushes it to the `gh-pages` branch, so
the branch can be tried in a browser at https://airemote.github.io/simple-html/ (the fork).

* `npm run build:demo` - one plain esbuild pass over `samples/demo` into `dist_demo`
  (gitignored, excluded from biome): minified js + sourcemap, the css esbuild collects from the
  app's imports, an `index.html`, and `.nojekyll`. Same entry and tsconfig `paths` as the dev
  server, without `esbuild-helpers` - there is nothing to serve or watch.
* paths in the html are relative, a project site is served from `/<repo>/`, not `/`
* the script tag is `defer` - the app appends itself to `document.body` the moment it runs
* `gh-pages` only holds the latest build: a fresh single commit, force pushed
* the workflow does not run the tests, a failing test should not stop a branch from being tried
* can also be run by hand from the Actions tab (`workflow_dispatch`)

One time setup on github, not in code:
* a fork has Actions turned off until they are enabled on its Actions tab
* after the first run created the branch: Settings -> Pages -> Source "Deploy from a branch",
  `gh-pages`, `/ (root)`

### v6 phase 0 - foundations

`V6_PLAN.md` items 1-4. What users see is in `CHANGELOG.md`, what they change in `MIGRATION.md`.

#### Strict mode

`strict: true` everywhere a compiler config is declared (`tsconfig.json`, `samples/`,
`tsconfig-typedoc.json`, `scripts/build.js`, `config_devserver.ts`). 558 errors to 0.

* **Two root-cause types first** took it to 322: `ParsedGridConfig` (the config after
  `__parseConfig()`, every default filled - `columnsPinnedLeft/Right` alone were 59 errors) and
  `DataEntity` (a data row always has its `__controller`, 46 errors). Fixing those at every use
  site instead would have been hundreds of `!`.
* the rest was done per folder: datasource, grid, date + samples
* about 50 `!` were added in source. Each one is either a field that is always set before use or
  a use site with the reason next to it. biome's `noNonNullAssertion` warns on all of them, as
  a warning - that is the list to come back to.
* 5 of the `!` only work around `ValueFormatter`'s parameter types (`type: DataTypes`,
  `attribute: string`, while the grid passes an optional type and, for a new filter editor
  condition, no attribute). Left for `V6_PLAN.md` item 7, which replaces that interface.

It found 12 real bugs, listed under *Fixes found by turning on strict mode* in the changelog.
Each has a test that fails on the old code: `datasource/__tests__/strictModeFindings.test.ts`,
`grid/__tests__/strictModeFindings.test.ts`, and the date picker ones in
`date/__tests__/datePicker.test.ts`.

Kept as found, not bugs worth a change:
* `renderRowCell` had `if (value === null && value === undefined)`, never true. Removed as dead
  code rather than "fixed" to `||` - that would change what null cells pass to the formatter.
* `horizontalScrollHandler` runs `renderCell` on the header's resize handle too (with `celno`
  NaN). Does nothing visible.

#### Public vs internal

* `stripInternal` in the build: `@internal` members are left out of the published `.d.ts`.
  Most `__` methods already had the tag, it just never did anything.
* **checked with a consumer**: a small file using the public API, compiled against `dist` with
  `strict` and `skipLibCheck: false` (every emitted `.d.ts` is checked). It caught three types
  that were stripped but still used by public signatures (`OPERATORS`, `EntityHandler`,
  `DataEntity`). Kept as `npm run check:typings` (`scripts/typings-consumer/`) - run it after any
  change to exports.
* typedoc's "X is referenced by Y but not included in the documentation" warnings are the list
  of types a public signature uses but the package did not export. With `./src/index.ts` as the
  only entry (the internal files were listed as entry points to silence exactly those warnings)
  there were 13; all fixed by exporting the type, narrowing the signature, or making the member
  internal.
* the three identical `callable` listener types are one exported `Listener`

**Found on the way:** a listener is only kept if it *returns something truthy*. One that
returns nothing - the obvious way to write it - is removed after the first event. Documented on
`Listener` for now, `V6_PLAN.md` item 13 (typed events with an unsubscribe function) removes it.

#### Package

* `exports` map: `.`, `./grid.css`, `./date.css`, `./package.json`
* `prepare` runs the build, so a git branch install gets a `dist`. The tgz moved out of
  `npm run build` into `npm run build:tgz` - `npm pack` runs `prepare`, so building inside the
  build would have packed recursively.
* `src/**/__tests__` left out of the tarball
* `skipTsErrors: [2307]` removed from the build - it hid "module not found" errors

#### Renames

`Formater` -> `Formatter` (and file names), and the public typos. Internal typos went in the
same pass: `creatElement`, `RIGH_PINNED_COLTYPE`, `clickListner`, `exspandedGroups`,
`lastKeyKodeUsed`, `deSelect`, `toggelDark*` in the samples. `selectSizeHeight` stayed - it
really is a height.

### v6 phase 1 - datasource

`V6_PLAN.md` items 5-14, design in its *Phase 1 design* section. Done in steps, each one updates
the grid, tests, samples and `MIGRATION.md`.

#### Step 1 - typed events (item 13)

* one `Emitter` (`src/emitter.ts`) for the datasource, grid interface and date interface, with an
  event map type each (`DatasourceEvents`, `GridEvents`, `DateEvents`), so `on()` is typed and
  returns its own unsubscribe function
* the "return true to keep listening" rule is gone - found in phase 0, a listener returning nothing
  was dropped after its first event. Two handlers in the codebase relied on being dropped that way
  (`contextmenuDate`, grid01's `grid-connected`); both are harmless now, checked.
* `selectionChange`, `currentEntity`, `gridConnected` -> kebab case like every other event
* the grid interface subscribes to its datasource per event and keeps the unsubscribe functions
  for disconnect. The tests count live subscriptions with a spy on `datasource.on`: once no grid
  is connected the handlers do nothing, so a missed unsubscribe would not show through `rebuild`.
* `filter-operator-change` handed out the internal `Grid` (`ctx`) and `rebuildHeaderColumns` to
  call with it. Replaced by a `rebuildHeader()` closure, rather than silencing typedoc's "not
  exported" warning for `Grid`.

#### Step 2 - group rows are their own type (item 9)

* `GroupRow` (exported) no longer extends `Entity`, `isGroupRow()` replaces every `.__group` check
* `Entity` gets `__group?: never`. Without it the index signature (`[key: string]: any`) made a
  `GroupRow` assignable to `Entity`, so `markForDeletion(groupRow)` still compiled.
* `getRows()` / `getRows(true)` / `getRow()` are typed by what they return, with overloads
* `currentEntity` really can be a group row: keyboard navigation into the header filter row calls
  `setRowAsCurrentEntity(0)`, which is a group row when grouped. Typed as the union rather than
  changing what the user sees.
* `cell-header-focus` `rowData` is `getRow(0)` - a group row, `undefined` with no rows, and stale
  after a filter (the header is not re-rendered). Typed honestly, see *Candidates*.

#### Step 3 - fields and formatters (items 5, 6, 7, 14)

* `new Datasource({ key, fields, formatters, selectionMode, container })`. The type of a field
  lives in one place now: the grid's `Attribute.type`, `setDates()` and the v5 `includesTime` flag
  are gone, the grid asks `getField()` / `getFormatter()`.
* `date` compares and sorts on the day, `datetime` with time
* `Formatter` is `format` / `parse` / `parseFilter?` / `placeholder?`. The six v5 methods were
  three really: `fromSourceDisplay` and `fromSourceGrouping` only ever called `fromSource` in the
  built-ins, and `isFilter` was never used.
* the grid has two small helpers that hold the rules in one place: `getCellType()` (the field's
  type, or the per-row type from `dynamicCellTypeColumn`) and `getColumnLabel()`
  (`Attribute.label || field label || name`)
* the grid only ever calls `parse` / `parseFilter` with text - a stored Date or number is
  formatted first
* fixed while porting: the comma formatter threw on null, `*THHMMSS` filter boundaries had random
  milliseconds, a `Date` given to parse came back as null. The last one also fixed changing the
  operator of a date header filter, which used to drop the filter.
* text fields show `0` and `false` (v5: blank). Without it 0 grouped with the blanks while sorting
  put it among the numbers.

#### Step 4 - one filter format (items 8, 10)

* `FilterExpression = FilterGroup | FilterCondition`, built with `and()` / `or()` / `where()`.
  `valueField` compares to another field. `type`, `logicalOperator: 'NONE'`, `attributeType`,
  `valueType` and `filterArguments` are gone - the type comes from `fields` only.
* a single condition as the whole filter works everywhere now. In v5 the filter ran it, but
  `getFilterString()`, `getFilterTree()`, the footer and "Is Blank" ignored or dropped it.
* the filter editor works on drafts (`Partial<FilterCondition>`) and drops the incomplete ones
  when it applies, with the same `isIgnoredCondition()` the filter uses at runtime - so
  `getFilter()` and a saved config never hold half-built conditions. The open dialog keeps them.
* `filter(null)` clears (v5 re-ran the current filter); "Clear Filter" and "Is Blank" build a new
  filter instead of changing the current object in place; IN no longer rewrites its `value`
* "0 is blank" for number fields kept as it is, documented on `FilterOperator`
* a v5 saved filter is ignored without throwing; `MIGRATION.md` has a small `fromV5()` converter

#### Step 5 - change tracking and options objects (items 11, 12)

* `getChanges()` is typed (`Changes<T>`), leaves out fields edited back to their original value,
  and returns plain copies instead of a JSON round trip - a Date stays a Date
* edit tracking compares with the field type: `date` on the day, everything else to the second
  (not the millisecond - the datetime formatter's `parse` stamps the current milliseconds, so
  re-typing the same value would count as an edit). A time-only change on a `datetime` is an edit.
* the type reaches the row's `EntityHandler` through its container: every datasource adds its
  field types to the container it uses, read at edit time. Two datasources on one container
  that disagree about a field's type throw, like a key mismatch.
* no positional booleans in the `Datasource` / `DataContainer` API: options objects, and
  `markAllForDeletion()` / `removeAllData()` / `getDataRows()` for what used to be a flag
* **an old call throws** (`assertOptions`). TypeScript catches `setData(rows, true)`, plain
  JavaScript would have replaced the rows instead of adding them - a silent data change.
* `DataContainer.lenght()` -> `length()`

Phase 1 is complete with this step: 500 tests at the start of v6, 884 now.

### v6 phase 2 - grid interface and config

`V6_PLAN.md` items 15-20, design in its *Phase 2 design* section.

#### Step 1 - columns, layout and state (items 15, 16)

* `columns` (options per field, keyed) + `layout` (`left` / `center` / `right`, each column a
  `{ fields, width }`) replace `attributes` + `columnsPinnedLeft/Center/Right`. A field in the
  layout without a `columns` entry gets the defaults - no more `__attributes` split, which is
  where the v5 "header text survives for unlisted columns" bug came from.
* `placeHolder*` -> `placeholder*`, `Attribute` -> `ColumnConfig`, `Columns` -> `LayoutColumn`
* `getState()` / `setState(partial)` / `resetState()` + `initialState` replace the four
  save/load methods. The state is what the user changes: layout, sort, group, expanded groups,
  filter, header filters (value and picked operator). `getState()` hands out copies.
* the operator picked in a header filter menu is state now, and no longer overwrites the
  column's `operator` (that is the operator a header filter starts with)
* fixed: a header filter of `false` (boolean) or `0` (number) showed as empty - read with `||`
* clearing the sort (empty sort in `setState` / `resetState`) puts the rows back in their own
  order; v5 left them sorted
* options are not state, so changing one at runtime needs a new interface for now - `updateConfig`
  comes in step 2

#### Step 2 - setup, callbacks, runtime config, method names (items 17, 18, 20)

* `createGrid(host, { config, datasource })` and `destroy()`. `destroy()` cleans up every listener
  and observer, also after the host already left the page.
* `isReadonly(row, field, readonlyByConfig)` / `cellClass(row, field)` in the config replace
  `readonlySetter` / `cellAppendClassSetter`
* `updateConfig(partial)` changes options at runtime, one rebuild. The row menu's "Use dimmed
  values" goes through it too - otherwise the next `updateConfig` undid the toggle.
* `refresh()` / `rebuild()` / `getLayoutFields()` / `getHiddenFields()` replace
  `triggerScrollEvent` / `triggerRebuild` / `getAttributeColumns(bool)` / `getOptionalAttributes`
* fixed: the per-cell background class was glued to `simple-html-readonly` /
  `simple-html-mandatory` without a space, so neither class worked on those cells
* fixed: `disableResizeEvent()` / `enableResizeEvent()` did the opposite of their names
* note: `grid-connected` fires inside `createGrid()`, before anyone can subscribe

#### Step 3 - menus as data (item 19)

* the row, header and filter menus are lists of entries (`MenuItem` / `MenuSection` /
  `MenuSeparator` / `MenuBlock`) drawn by one renderer (`showMenu.ts`) with the old markup and
  css classes. `GridConfig.menus.row/header/filter(defaults, context)` can hide, reorder or add.
* every built-in entry has a stable id, listed in the exported `MENU_IDS` (its order is the
  default order). Phase 3's texts map keys on these ids.
* the filter menu's value list (search, checkboxes, Run Search) is one `MenuBlock`: it can be
  hidden or moved, not rebuilt from items, and it redraws only itself while the user types
* `openMenu(at, entries)` / `closeMenu()` replace the four `contextMenu*` methods; an element
  placed in a menu (the dropdown grid sample) is a block entry
* fixed: a menu opened from a click handler closed straight away (the same click reached the
  document), and a click inside a block closed the menu - the dropdown grid's filter only
  worked from the keyboard
* header and filter menus open above the cell when there is no room below, like the row menu;
  every menu shifts left when it would stick out on the right

Phase 2 is complete with this step: 1012 tests.

### v6 docs - the demo is the docs site

* the samples app is the docs site: Guides (`guides/NN-slug.md`, rendered with `marked` at build
  time), Samples, and API pages built from typedoc's model, all in the demo shell, published to
  gh-pages by the existing workflow. Hash routes `#guide/..`, `#sample/..`, `#api/..`; old
  `#<sampleId>` links still work.
* guides link the way they would on GitHub (`04-datasource.md#selection`), the build turns them
  into site links
* a ```` ```sample <id> ```` block in a guide embeds the running sample with its source
* samples show their real source file (`?raw` import through an esbuild plugin); the hand copied
  `code` strings, which could drift from what ran, are gone
* `npm run check:docs`: typedoc validation as errors (including "not documented"), every
  ```` ```ts ```` block in the guides and every `@example` compiled against `dist` (241 blocks),
  every sample id and guide link resolved. A prelude declares `datasource`, `gridInterface` and
  `host` as globals so examples stay short.
* `.github/workflows/checks.yml` runs typecheck, tests, lint, check:typings and check:docs on
  push and pull requests, one job each; the demo deploy does not wait for it
* `.claude` excluded from biome - `.claude/settings.json` is tracked and its formatting was the one
  lint error left
* 11 guides, JSDoc on every public export (158 undocumented -> 0), 107 `@sample` links, README
  rewritten
* `docs/` is gitignored (typedoc output), so the site build code lives in `scripts/site`

Writing the guides against the real code found mismatches - fixed next, see the step after this.

### v6 - fixes found while writing the docs

Writing the guides against the real code (every example compiled) found these:

* the grid set its own `selectionMode` (default 'multiple') on the datasource on every rebuild, so
  the datasource's `selectionMode` was silently overridden. `GridConfig.selectionMode` is gone, the
  datasource owns it.
* `setData()` defaults to `refilter: true` - new rows no longer bypass a filter that is set
* grouping: rows are always sorted by the group fields first (`setGrouping()` + `filter()` built
  duplicate groups); `removeGroup()` matches by field (a copy removed nothing but still sent
  events); `expandGroup(id)` expands the groups above it too
* `currentEntity` is cleared when `setData()` replaces the row it pointed at
* `selectAll()` does nothing outside 'multiple' mode
* the date picker's `setSelected(dates)` showed nothing selected - days matched on the timestamp
* `datePickerConfig` is `Partial<IDateConfig>`, `mandatoryOnlyIfEmpty` (read nowhere) is removed
* leftover debug `console.log`s removed
* site: links from a guide to `MIGRATION.md` etc. go to GitHub (they 404'd on the site), and
  `check:docs` checks the file and the heading; the demo theme's row state colours never applied
  (the `row-is-*` class is on the parent, the selector assumed the same element)
* documented, not changed: the text header filter matches the whole text (EQUAL) - the filtering
  guide shows a contains search per column; an emptied number cell stores 0

### v6 phase 2b - save workflow, validation, config as JSON

Asked for in review after phase 2: the user stores grid and datasource configuration in a backend.

#### Formatter ids and grid hooks (items 43, 44)

* `registerFormatter(id, formatter)`; fields and the per-type defaults name formatters by id.
  The built-ins are registered under ids (`'numberDot'`, `'dateYYYYMMDD'` ...). The datasource
  looks the ids up once, when it is made.
* `isReadonly` / `cellClass` / `menus` moved out of `GridConfig` into `GridHooks`, given next to
  the config (`createGrid(host, { config, datasource, hooks })`), changed with `updateHooks()`
* a hook left in a config throws, naming it - otherwise plain js would get a hook that silently
  never runs. So does a formatter object where an id goes.
* the config, a `getState()` result and the `fields` + `formatters` options survive a JSON round
  trip - tested by building a grid from the copy and comparing state, rows and markup. A type
  level check in `consumer.ts` fails if a function ever gets into `GridConfig` / `GridState`.
* a Date in a saved filter comes back from JSON as text and stays text; a `date` / `datetime`
  field reads it as the same moment, a field without that type compares text - written down in
  the state guide

#### Delete is a tag, and the save workflow (items 45, 46)

* `unmarkForDeletion()` / `unmarkAllForDeletion()` undo a delete. A new row marked for deletion
  stays in the data (it used to be removed, so it could not be undone); while marked it is in none
  of the `getChanges()` lists - there is nothing to send for it.
* `acceptChanges({ rows?, newKeys? })` after a successful save: deleted rows go, new rows become
  ordinary rows, edits become the originals, row errors clear. One rebuild.
* `newKeys` maps the temporary key of a new row (as sent in `getChanges()`) to the server's key.
  Keys compare as text, so a map built from JSON works; every key is checked before anything
  changes - a map the wrong way round throws instead of quietly doing nothing.
* `hasChanges()` for an "unsaved changes" indicator
* row menu "Delete:" with `row.delete.rows` / `row.delete.undo`. A row the `isReadonly` hook makes
  readonly for every field can not be deleted; an undo always works.
* the samples delete by tagging; `removeData()` is shown as the untracked case. A "Saving" sample
  does the whole round trip with a fake server that assigns ids.
* the demo's light theme had no row state css at all - deleted rows were not struck through

#### Validation (item 47)

* `registerValidator(id, validator)`; rules live on the field as JSON
  (`validate: ['required', { id: 'min', value: 0 }]`), checked when the datasource is made like
  formatter ids. Built-ins `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`; default
  messages have ids (`VALIDATION_MESSAGES`) for phase 3's texts map.
* `required` fails on 0 - an emptied number cell stores 0, so otherwise `required` could never
  fail from the grid, and it is the "0 is blank" rule again. The guide shows a validator for a
  number where 0 is a real value.
* a field is validated when edited (also re-checking the row's other fields that have an error,
  so a rule across fields clears); `validate(rows?)` checks everything before a save. Loaded and
  new rows are not validated on their own - a new row would be all errors before anyone typed.
* errors show on the cell (`simple-html-cell-error`, tooltip) and the row selector; server errors
  (`setErrors()`) stay apart but show there too - v5 never showed them at all
* `ColumnConfig.mandatory` -> the `required` rule, same stripes; a config that still has
  `mandatory` throws (a stored config would otherwise silently stop enforcing it)
* fixed with it: six methods that remove rows left `currentEntity` and/or the selection on the
  removed rows; all go through one helper now

Phase 2b is complete with this step: 1211 tests.

### v6 phase 3 - UI

`V6_PLAN.md` items 21-25.

#### Step 1 - every text replaceable (item 21)

* 190 text ids, `TEXTS` (English defaults), `setTexts()` for the page and `GridConfig.texts` per grid;
  grid texts -> page texts -> defaults. The datasource's texts (validation messages, the filter
  string, the blank group) use the page texts - a datasource has no grid, and validation runs in the
  container, which datasources can share.
* ids by area (`row.*`, `filter.values.*`, `filterEditor.*`, `footer.*`, `datePicker.*` ...); menu
  entries keep their `MENU_IDS` id, a tooltip is `<id>.tooltip`; templates with `{name}`
* month and day names are texts too (`IDateConfig.monthHeader` / `weekHeader` are gone), so one
  `setTexts()` translates every grid's date picker
* coverage is tested three ways: every id documented in the texts guide; a scan of every template
  in src for literal English; and a render of every menu, dialog, footer state and the date picker
  with each text replaced by `«id»`, failing on any visible letter outside «» or an id never shown
* also: a v5 option in a grid config throws now (`V5_CONFIG_OPTIONS` / `V5_COLUMN_OPTIONS`), not only
  `mandatory` - `tooltipText` from a stored config would otherwise silently fall back to English

#### Step 2 - menus on popover, the filter editor a dialog, pointer events (items 23, 24)

* menus are `popover="manual"`: top layer, no z-index games. Not `auto`: on macOS/Linux the
  `contextmenu` event fires on press, and the release outside the menu would light-dismiss a
  right-click menu the moment it opened. The grid keeps its own closing (outside click, scroll, one at
  a time, grid removed).
* the filter editor is a modal `<dialog>` (it already blocked the grid with a grey layer, now the
  keyboard can't reach the grid either); Esc closes it, focus goes in and back. It is rendered again in
  the same dialog instead of thrown away per edit, so position, size and focus stay.
* a menu opens inside the closest dialog/popover of the element it opens from - everything outside a
  modal dialog is inert, so the editor's pickers have to be inside it
* column drag/drop and resizing use pointer events (`followPointer.ts`): mouse, pen and touch. Mouse
  and pen drag after 5px of movement (v5: after a 200ms hold); touch drags after holding still 200ms, a
  swipe scrolls. pointercancel ends cleanly, a cancelled resize restores the width.
* fixed: menus were off by the page scroll on a scrolled page; the drag ghost was too; a label
  dropped on another grid's panel grouped its own grid
* happy-dom has no popover and only attribute-level dialog support - a small `showPopover` stub is
  loaded for every test (`vitest.config.ts`). What the browser does (top layer, inert, focus, Esc,
  capture retargeting) is checked against the spec by reading, not in a browser.

#### Real-browser check of step 2

happy-dom can't show the top layer, inert, focus or pointer capture, so step 2 was checked in headless
Chromium (playwright, a scratch script outside the repo) against the built docs site: the row menu and
the filter menu open as popovers, sized and on screen, and close on Esc and an outside click; Advanced
Filter opens a modal dialog that covers the grid, it moves by its title bar and closes on Esc; a column
resizes with the mouse; a label dropped on the panel groups on it; a click on a label sorts; no errors
in the console. All passed. Found and fixed:

* one column had two names: the header, column chooser and attribute menu prettified a field name
  (`First Name`), the footer filter, filter editor, group chip, drag ghost and copied table did not
  (`first_name`). `getColumnLabel()` lost its `pretty` flag and always prettifies the fallback. Test:
  the group chip shows the header's label (failed before), and the footer/filter editor tests now
  expect the label.
* the docs site (and the dev server) had no favicon, every page load logged a 404. An inline svg icon.

#### Step 3 - theming (item 25)

* every colour is a variable (17 were written in the css: scrollbar shadows, the readonly/required
  stripes, menu/dialog/tooltip shadows, the backdrop, the warning/danger reds), names kept, light
  colours unchanged - screenshots before/after in Chromium are pixel-identical except focused elements
* dark mode is `light-dark()` in each variable, so the grid follows the page's `color-scheme`. Set it
  on :root/body: menus, tooltips and the filter editor live on the body. The demo's hand-made dark
  overrides (DARK_WIDGET_CSS) are gone, its toggle sets `body.dark { color-scheme: dark }`. Dark
  colours from the demo's, lightened where contrast was under 4.5:1 (secondary text, errors, rows)
* focus: one generic `:focus-visible` inset outline (inset, the cells are in overflow-hidden parents);
  a checkbox cell puts it on the cell with `:has()`. The old dashed `:focus` border is gone
* fixed: the resize handle (z-index 8) sat under the filter input (z-index 1000) in the column's
  stacking context, only the top half could be grabbed - now 1001, drop zones 1002. The global
  `input { z-index; pointer-events }` rule is scoped to the grid
* "two stacked .simple-html-label elements": not a bug - the label cell and its inner text div share
  the class name, a click lands in the right cell. Left as is
* `src/__tests__/theme.test.ts` reads the css: no literal colour outside the theme rules, every var()
  defined, every light value the pre-v6 colour, the input < resize handle < drop zone order
* not done (kept light pixel-identical): a few light colours under AA (secondary text 3.0:1, week
  numbers 3.4:1, row numbers at 50% opacity); the date picker's generic class names (`.main`, `.side`
  ...) clash with page css (the demo's `.main`)

#### Step 4 - accessibility (item 22)

* a new element `.simple-html-grid-aria` is the grid (role grid, treegrid while grouped - aria-level /
  aria-expanded are not allowed on rows of a plain grid). Not the host element: the panel and footer
  buttons would be inside the grid, which may only own rows. Its children are the two header rows; it
  `aria-owns` the body rows in row order
* a row of the grid is five row elements (group, selector, left, middle, right) from a pool reused on
  scroll, so dom order is not row order. The selector's row element is the row and owns the group
  cell and the column elements of the three sections in column order; the others are role none.
  aria-owns re-parents without moving dom nodes (moving them would blur a focused input). Chrome's
  real tree (CDP getFullAXTree) honours it; playwright's ariaSnapshot does not reorder by aria-owns
* aria-rowindex / aria-colindex / counts include the rows and columns not in the dom; a stacked
  column is one column per field. `updateAriaGrid` runs after the scroll handlers re-render, and only
  writes attributes that changed
* fixed a keyboard trap: Tab on the last cell / Shift+Tab on the first filter never left the grid. At
  those ends the focus goes to an empty tabindex=-1 element at the grid's end/start and the browser's
  Tab (not cancelled) goes on from there (`tabExit.ts`)
* column headers: tabindex -1, Enter/Space sorts, Alt+ArrowUp from a filter reaches them. Group
  toggle, chip remove and footer chips are buttons. Footer count is role status
* tests: `accessibility.test.ts` (43); `a11y-check.js` in Chromium, 32 checks (structure and order
  after scrolling both ways, sort, grouping, selection, Tab out). Tests that found rows by
  aria-rowindex use new helpers
* limits (in the guide): Chrome only, no screen reader tried; not the APG roving-tabindex keyboard
  (every input is a Tab stop, Alt+arrows between cells, no Home/End/PageUp/PageDown); only rendered
  rows are in the dom; menus and the date picker are mouse-only; aria-sort on the first sort only

### v6 phase 4 - scroll handlers (item 26)

* measured first (Chromium, 100 000 rows x 305 columns, JS time in the scroll listeners): the linear
  scan was not the cost (0.17 ms per event at the end of 100 000 rows). Vertical: re-rendering every
  cell of every row on screen on every event (~3.7 of ~6 ms) and the forced layout of setting
  scrollTop on the sections. Horizontal: the rows x columns loop, header columns placed once per row
* binary search (`firstIndexAtOrAfter`), one pool assignment (`assignPool`), one path for left /
  middle / right (`pinnedSection`): the vertical handler went from ~270 to ~130 lines. Horizontal
  -20-30%, vertical about the same
* the horizontal `largeScroll` was dead code (hardcoded false): removed. The vertical one is live and
  useful (a scrollbar drag would render all rows on every event): kept, and fixed - it compared with
  the first jump's position and hid the rows again, so they came back after ~330 ms instead of 150
* fixed: a viewport shorter than the last row / a middle section narrower than its last column showed
  nothing at the end (the scan returned 0 for "not found", the binary search returns the length)
* checks: 30 new tests; Chromium scroll check (50: pinned sections in sync, rows touch and fill,
  columns line up with the header, values right, aria indexes consecutive) on the demo samples and a
  bench grid; accessibility tree after scrolling (12)
* left for item 36: render only the rows that got a new row on a vertical scroll (about half the
  vertical time) - today any scroll also shows values changed from code without refresh()

### v6 phase 5 - editing

#### Undo and redo (item 28)

* the history is in the DataContainer (`src/datasource/history.ts`), so datasources on one container
  share it; the proxy's `onEdit` now passes the old value and every change is recorded as
  `{ row, field, before, after }` (field null: the deletion mark)
* steps: one synchronous run of code is one step (closed in a microtask), so a paste or clear over many
  rows is one Ctrl+Z. The grid writes every keystroke to the row (`@input`), so its writes go through
  `history.typing()`: keystrokes in the same cell join one step until the focus leaves it; typed back to
  the start value the step is dropped. A write that changes nothing (`isSameValue` with the field type)
  is not recorded
* undo/redo write through the proxy with recording off, so `__edited`, row state and validation follow
  as for an edit; the grid re-renders on `history-changed` undo/redo (not on edit: that would rewrite the
  input being typed in)
* Ctrl+Z while the cell's own typing is the top step is left to the browser's input undo - its input
  event writes back into the same step
* cleared by setData (replace), removeAllData, resetData, acceptChanges; removeData /
  clearMarkedForDeletion / replace drop the removed rows' changes (a step never writes into a row that
  is gone). New rows are not in the history
* `resetRows` keeps new rows (values as added): a revert is undoable, and undo never re-adds a row
* tests: 50 datasource + 20 grid; Chromium check 22/22 (typing undo vs history undo, delete, paste over
  3 rows, checkbox, menu entries)
* the scratchpad was partly wiped by a Claude Code restart; the browser check scripts were rebuilt from
  the session transcripts. Worth keeping real-browser checks in the repo (needs playwright as a dev
  dependency) - see candidates

#### Edited cells and the row state (items 27, 29)

* the row number shows one icon (inline svg, 10px in a 14px slot): deleted > error > new/edited; the
  state is the first tooltip line and a visually hidden span for screen readers ("2 Edited, Error:
  Age: Must be at least 18" in Chrome's tree). Deleted rows' cells are struck through - before, a
  deleted row looked like any other
* the edited marker is an element of its own (clip-path makes only the triangle hit), aria-hidden;
  click -> `resetField()` (one undo step), its mousedown cancelled so the focus stays. It and the row
  icon update while typing without rendering the input again. Not on new rows
* changed rows only is a flag on the datasource ANDed in the filter run, not a `where('__rowState')`
  condition in the user's filter: that would show as "__rowState is not blank", the filter editor has
  no such field, and replace/setState would drop or wrap it. The flag is not in the grid state
  (changes are not either)
* checks: tests for marker, status, precedence, options, changed-only with filters/grouping/setData;
  Chromium `status-check.js` 27/27 and the other four checks
* left: the error colour is 2.8:1 on a selected row's number (pre-v6 light value, kept); other samples
  (saving, validation, column-layout, grid01) still have their own RS column; the marker has no
  keyboard path (Ctrl+Z and the row menu do)

#### Multiline text (item 30)

* an `<input type=text>` strips line breaks from its value (HTML value sanitization), and the grid
  wrote the input back on every keystroke: editing a cell with a line break dropped them. A multiline
  cell's input is now readonly (still focusable, Tab / Alt+arrows / Shift+F10 work) and its @input /
  @change return early; a test fails without that guard
* the editor is a `popover="manual"` over the cell (`popoverParent`, so it works in a dialog), one at a
  time (`ctx.textEditor`); opening a menu or the filter editor, a click outside (on mousedown, focus
  left where the click put it), scrolling, `destroy()` all save it. It listens to the two scrollers
  only: the browser scrolls the row views itself when a half-hidden cell takes focus, and listening to
  them closed a fast double click
* a typed character opens the editor and is added at the end - one key must not wipe a long note
* saving writes `formatter.parse(text)` once, only when the text changed: one undo step; a CR LF value
  from a server that is not edited stays CR LF
* checks: 35 tests; Chromium `multiline-check.js` 62/62 (every key and click path, the edges, dark)
* left: scrolling a container around the grid (not the page) does not close the editor; the row menu's
  tab-separated copy does not quote a value with line breaks (as before)

### v6 phase 7 - live data (items 36, 37, 38 data)

* reactive cells: the container sends `rows-changed` once per run of code (microtask) with the rows a
  field, a deletion mark, a server error or a conflict changed on; the grid renders those on screen in
  one animation frame (`renderChangedRows.ts`). So the vertical scroll renders only the rows that got
  another row: 6.4 -> 2.3 ms per one-row step on the wide bench (the cost left from phase 4)
* the cell input the user typed in is never rendered while focused (element based, survives rows
  moving under it); `History.editingCell()` is that cell, and `startEditing()` lets an editor of its own
  claim it - the multiline editor does now (without it, a merge while the editor was open wrote the
  server value and the save overwrote it silently; test fails without the fix)
* upsert: one Map by key, values written through the proxy with recording off then made the original
  (not edited, validated, in rows-changed); an edited field keeps the user's value and gets the server's
  as its original - a conflict when it differs from both the user's value and where the edit started;
  the undo history is rebased so undoing goes to the server's value, not the stale original
* removeMissing keeps rows with local changes in a `{ field: null, remote: 'removed' }` conflict;
  'local' remembers the choice so the next poll does not raise it again
* a values-only upsert sends no collection-changed and causes no rebuild; with rows added/removed the
  grid does a light update (sizes, footer, rows on screen) that keeps the focused input
* proxy get fast path (names not starting with `__` go straight to the row): sort 52 -> 44 ms
* fixed: `setData(rows, { add: true })` with 300 000 rows overflowed the stack (`push(...rows)`)
* checks: 121 tests; Chromium live-check 19/19 and the other eight scripts
* the guides no longer say to `refresh()` after edits from code or `setErrors()`; `refresh()`'s JSDoc
  says what it is for now (hooks reading outside state)
* left: skip filter/sort/group in upsert when no field they use changed (sorted 102 ms, grouped
  171 ms on 100 000 rows); a change from code (not upsert) to the cell being typed in is not a
  conflict - the typed text is written back on blur; the 38 UI (highlight, conflict look)

### v6 phase 8 - more

#### CSV export (item 41)

* pure core `src/grid/csv.ts` (RFC 4180 quoting, CRLF, BOM, formula escaping), the grid side in
  `gridCsv.ts`: rows from `getDataRows()` (filtered + sorted, grouped order, collapsed groups
  included) or `getSelectedRows()`; fields from the layout; labels with `getColumnLabel()` and values
  formatted as `renderRowCell` does (`getCellType` per row for `dynamicCellTypeColumn`,
  `numberOverride`). `getColumnLabel` / `getCellType` only read `ctx.gridInterface`, so they take
  `Pick<Grid, 'gridInterface'>` and export works without a connected grid
* formula escaping is by value, not by field type: the number formatter writes the text `'-1+1'` back
  as it is (`parseFloat` reads -1), and `dynamicCellTypeColumn` changes the type per row
* the download is a detached `<a download>` (not in the page: an open modal dialog would make it inert),
  the object url revoked after 40s (revoking at once can stop the download)
* tests 35 + 42; Chromium export check 18/18 (the downloaded file: BOM, CRLF, labels, escaping, `;`,
  selected rows, raw values, follows a sort)
* row menu: an **Export:** section at the end (CSV, all rows / CSV, selected rows), in readonly grids
  too; the guide shows how to give it `;` through the menus hook
* left: the formatted-value code is in
  gridCsv.ts and renderRowCell.ts - one helper later; `rows: 'selected'` leaves out selected rows
  hidden by the filter or a collapsed group, like every row-menu action on selected rows

### Docs site: light mode is light everywhere

* the sidebar and the code panels (the sample source, the guides' code blocks, the API signatures)
  were dark in both themes: their colours were written for dark only. Every colour of
  `samples/demo/index.css` is now a `light-dark()` token on `:root` (like grid.css), and `body.dark`
  only sets `color-scheme: dark`. Light code uses GitHub's light colours, dark keeps One Dark
* without a choice made with the button, the site starts in the OS theme (`prefers-color-scheme`)
* `samples/demo/__tests__/theme.test.ts` guards it: no colour outside the :root tokens (but the
  scrollbar shadow and two translucent sample backgrounds), every token light-dark(), body.dark only
  the color-scheme, the OS default and the stored choice. Screenshots light/dark in Chromium

### Row menu: undo a cell edit and a row's edits (user request)

* the user missed "undo a cell edit / undo row edit" in the row menu: the entries existed (Revert cell,
  Revert rows) but only for an editable grid (the screenshot was a readonly grid - paste, clear and
  delete were missing too), at the bottom of the menu, and "Revert rows" works on the *selected* rows
  only - a click in a cell does not select its row, so the row right clicked could not be reverted
* now: the Edit: section is first in the menu; *Undo last change* (Ctrl+Z), *Redo* (Ctrl+Y), *Undo
  cell edit*, *Undo row edits* (new `row.edit.revertRow`: the row right clicked, no selection needed,
  one undo step, takes a deletion mark off), *Undo row edits (selected rows)*
* tests: the order, the row entry (values, mark, one undo step, greyed out on an unchanged row), no
  section in a readonly grid

### Menus stay in the window (user report: the row menu is too tall)

* `placeMenu` (showMenu.ts): below the point, else above, else beside the point (right, else left),
  moved up as little as the window allows; taller than the window: max-height and scroll (only then -
  the scroll box would clip the shadow); 4px from every edge. The menu is measured at the window's top
  left: placed near the right edge first, an absolutely placed popover shrinks to the room left and
  wraps, then grew past the edge when moved left
* checked in Chromium at 480x611, 1280x400 and 1280x800 (`menu-place-check.js`): the whole menu inside
  the window in every case; tests for each placement rule

### Header filter placeholders by type (user request)

* an empty text / number header filter showed 🔍; a date one shows its format (YYYY-MM-DD). Now text
  shows `Text`, number `Number` (texts `filter.placeholder.*`, translated in the Norwegian sample);
  the column's `placeholderFilter` and the formatter's `placeholder` come first, boolean stays a
  checkbox. Checked in Chromium light and dark

### Aggregates (item 40)

* `datasource.aggregate()` (src/datasource/aggregate.ts): sum/avg/min/max over finite numbers only,
  count of non-blanks; Neumaier-compensated sum; cached per group row (WeakMap) and per filtered list,
  keyed by a per-field change count the container bumps on every set - an edit of a field nobody
  aggregates recomputes nothing. 100 000 rows / 1000 groups x 3 functions: 42 ms cold, 0.3 ms kept
* the group row draws its aggregates in its own element, with three section containers that copy the
  body's geometry (pinned borders, stacked lines), the middle one following the horizontal scroll via
  `--simple-html-grid-scroll-left` - so renderRowCell / pinnedSection stay untouched. The name stays at
  the left over the first columns (an aggregate there is covered on screen, read by screen readers)
* totals row: under the horizontal scrollbar, over the footer; the grid owns it as its last aria row
* fixed in passing: the row menu summary (max of negatives 0, min skipped 0, avg rounded and counting
  blanks); totals not updated by the frame that renders every row after the typed-in cell is left
* merged with the v6_maybe work done meanwhile (texts and the texts guide: both sides kept). The
  texts-in-the-grid test opens every part of the grid; it timed out at vitest's 5s on a loaded machine
  (2.6s idle): its describe has 30s now
* checks: 64 tests; Chromium aggregate-check 27/27 and the other ten scripts on the merged build
* left: a value too wide for its column ends in an ellipsis with the label first - drop the label
  before cutting the value; min/max of dates; totals cells not on the Tab path

### v6 phase 6 - cell ranges and the clipboard (items 32, 33)

* a range is `{ fromRow, fromField, toRow, toField }` - displayed row indexes and field names (JSON,
  readable); cleared whenever the displayed rows or the layout's fields change. A stacked field is a
  column of its own (getLayoutFields order, like CSV and aria-colindex); the empty cells under a short
  column belong to the field above, so a range draws as a rectangle
* a drag inside one cell stays the input's text selection; once on another cell it is a range. The
  input's selection could not be stopped by user-select, pointer capture or preventDefault in Chrome -
  collapsing it in a requestAnimationFrame after each move works without flicker
* keys: Alt+Shift+arrows (plain/Shift arrows stay the input's), Esc clears; typing in a cell or moving
  the focus clears the ranges (so Backspace never empties a range by surprise)
* copy/paste listen on the document (Chrome sends a focused checkbox's clipboard events to the body),
  each grid acts only with the focus in its own cell; TSV through csv.ts with a tab, Excel quoting on
  paste; one value fills the ranges, a block is written once from the top left, readonly skipped, one
  undo step; the row menu's copy listener moved to the capture phase so a range copy can not overwrite
  "Copy: Cell Value" (its test fails without that)
* checks: 110 + 11 tests; Chromium range-check 60/60, and the other eleven scripts on the merged build
* merged with v6_maybe (one conflict: the delete ids' neighbours in rowMenuDelete.test.ts)
* left: Cut (Ctrl+X) of a range; real Excel / Sheets interop untested (format checked only); after the
  wheel takes the focus from a cell, Ctrl+C/V go to the page

### The wheel over the grid kept scrolling the page (user report)

* the wheel listener set the body scroller's scrollTop but did not cancel the event, so the browser
  scrolled the page too (the rows' views are overflow hidden, the page was the next thing to scroll);
  it read the non-standard `wheelDeltaY` (none in Firefox) and ignored a trackpad's deltaX
* now: cancelled (but Ctrl+wheel - zoom, pinch - is left to the browser), `deltaX`/`deltaY` with
  line/page modes turned into px, left/right scrolls the middle columns. happy-dom's WheelEvent is a
  UIEvent without modifier keys: the tests set them on the event
* Chromium `wheel-check.js` on a guide page with a live grid: the grid scrolls, the page does not -
  also at the grid's last row - and the page scrolls outside the grid

### Excel export (user request: "Excel, not CSV"; frozen header, autofilter, flat list)

* no dependency: `zip.ts` (APPNOTE local headers, central directory, CRC-32, deflate-raw through
  CompressionStream - stored when it is missing), `xlsx.ts` (the six SpreadsheetML parts from plain
  inputs), `gridExcel.ts` (rows and fields as the CSV export picks them). 10 000 rows x 8 columns:
  441 KB deflated (4.6 MB stored)
* typed cells: numbers as numbers (General - the formatters show full precision), dates as serials
  from the local day (1900 system, its leap-year bug), `dd\.mm\.yyyy` for the DDMMYYYY formatters,
  booleans, inline strings; widths from the grid's px by ECMA-376's Calibri 11 rule
* always: the header bold and frozen, an autofilter over every row, a flat list (no group rows,
  outline or totals) - the user's rules
* checked: 2115 tests; Chromium downloads (buttons and row menu, grouped, aggregates sample) read
  with python zipfile (CRCs), xml.etree and openpyxl - types, frozen pane, autofilter, widths, values
  equal to the CSV of the same rows. Real Excel / LibreOffice not available to try
* live-check.js failed 2 of 19 once on a loaded machine and passed twice after: its conflict steps
  race the sample's timer - candidate below

### Date picker redesign, no rounded buttons (user request)

* flat and square, the grid's font; one header line « ‹ Month Year › »; today and the selected day
  look different; square steppers and an equal-width button bar; other-month days and week numbers
  were too light (1.3:1 / 3.4:1) - darker now; contrast measured in Chromium (30/30)
* every border-radius in grid.css / date.css is 0 (buttons, chips, the filter editor, the tooltip)
* the generic class names (`.main`, `.year`, `.icon` ...) picked up page css (the docs site's `.main`
  boxed the month name): prefixed
* merged cleanly with v6_maybe; all checks and eleven browser scripts on the merged build
* left: changing the hour jumps the view back to the picked date's month; a day of the month before
  or after is picked but not shown as selected; Firefox number spinners hidden by
  `appearance: textfield`, checked in Chromium only

### Plan: custom cell rendering (item 39, user question: switch to Solid 2.0?)

* `custom_render.md`: why the core stays on lit-html (JSX cells would serve Solid apps only, Babel
  in the build, signals do not fit the pooled cells), and a renderer hook instead -
  `registerCellRenderer(id, (host) => ({ update, destroy }))`, `ColumnConfig.renderer`; the cell
  template, the lifecycle across scrolling and rebuilds, what keeps working, steps, tests, docs
* plan only, no code yet

### The clipboard: every range, the column headers (user report)

* "copy only copies part, not both ranges": several ranges copied the last one (Excel refuses them).
  Now one table: the union of the ranges' rows (grid order) x fields (layout order), empty where no
  range covers a cell - side by side is one wide table, stacked one long table
* "pasting into Word needs the headers": every copy of more than one cell has a header line of the
  labels, in the TSV and as `<thead>` in the html (Word reads the html); `copyHeaders: false` turns it
  off. A single cell stays a value. The row menu's Column / Row copies use the same code (its html was
  not escaped, its text had no header, its values were ISO / raw instead of what the cells show)
* paste: a first line that is all column labels of the grid is left out, so copy -> paste back works
  (also into other columns); a data line that is all labels is left out too - rare, undoable
* done myself while the agent for it was stopped by the usage limit (it had changed one file in its
  worktree; that worktree is dropped)
* the docs site test (renders every guide) timed out at vitest's 5s at load 9-12 while other work ran
  tests: its describe has 30s, as the texts test
* checks: tests updated (header lines, the union, no last-range rule) and new (union side by side /
  stacked, copyHeaders false, header skip, round trip, row menu Column/Row/Cell Value); Chromium
  copy-check 8/8 (the real clipboard's text and html), range-check updated for the header (60/60)

### Fit and reset sizes like Excel; the multiline tooltip (user requests)

* tooltip: the first `multilineTooltipLines` (5) lines, then "… N more lines" (one hidden line is
  shown instead, so N is always 2+); each line cut at 100 characters; the edited marker cuts the same
* columns: `fitColumns(fields?, { rows? })` measures what the cells show (formatted, widest line of a
  multiline text, the bold label + room for the sort icon), filtered rows only; measuring 100 000
  texts took ~540 ms per field, so the 20 longest by character count are measured. `resetColumnWidths()`
  to the resetState() widths. Double-click on the resize handle - it needed a fix: a press that did not
  move rebuilt the header, so the second click hit a new handle
* rows: heights in lines, by `String(row.__KEY)` (every row has a key), not in the state (generated keys
  mean nothing saved); added where `__dataSourceUpdated` builds scrollTops/scrollHeights, so every
  section follows. In a taller row the input stays (focus, keys, overlay, ranges, menus work as they
  did) and the other lines of a multiline cell are an aria-hidden div under the transparent input
* merged with v6_maybe (the Size: menu next to the Excel export entries; two imports): 2188 tests,
  fourteen browser scripts on the merged build (size-check 46/46, copy, ranges, scroll...)
* left: a row's height is lost when `acceptChanges({ newKeys })` gives it its server key; fitting a
  row while its focus button shows resets the input's right offset; keyboard moves into a very tall row
  scroll in steps of two default rows; the header label room is a fixed 50px

### Aggregates v2: lines, several per column, the header menu (user requests)

* "put the sum/type on the other side" - each line is the label at the left, the value at the right
  (flex; the label shrinks first, then the value ends in an ellipsis), so labels and numbers line up
* "force the row 1x higher so the grouping text can't block aggregates" and "sum and avg needs 3 rows":
  a group row with aggregates is the name's line + a line per function of the column that has the most
  (`aggregateRowHeights`, one function where __parseConfig builds the heights). A stacked column's
  lines are its fields' functions from the top, with the field label (`Avg Age`) so they say which
* "right click a column label to add avg, sum, count" - the header menu's Aggregate: toggles (sum, avg,
  min, max on number fields, count everywhere, the totals row); they change `GridState.aggregates` /
  `totalsRow`, so the user's choice is saved with the state and resetState() goes back to the config's.
  updateConfig() keeps a totals row the user turned on unless it is given totalsRow
* a11y: one gridcell per field (its first line, aria-label of all lines), the others aria-hidden
* done myself (the agent for it stopped at the usage limit before changing anything), after the fit
  sizes merge, so the group-row height and the data-row heights did not collide
* checks: 41 aggregates tests (state, menu, lines, a11y), every suite; Chromium aggregate-check updated
  for the taller rows and extended with v2 checks (32/32: nothing under the name, label left / value
  right, Min from the header menu adds a line), the other twelve scripts, excel-check (its group step
  reads the groups from the API now) and openpyxl on the six files

### Docs site: the work in progress page and the build line (user request)

* the sidebar's header says what the site is built from: `v6_maybe @ <commit>` linked to the commit on
  github, its date, "local changes" for a local build of files not all committed. In the github action
  its variables say it (GITHUB_REF_NAME, GITHUB_SHA: the action checks out the commit alone); a user or
  token in the remote's url is left out (the page is public)
* "Status: Work in progress" first in the sidebar (the start page stays the first guide): the plan's
  "Now:" line, its open `[ ]` items by phase (an item moved elsewhere left out), and the "Candidates /
  not started" section of this file - made when the site is built (`docs:status`,
  scripts/site/status.js), so it is never behind
* tests: status.test.ts (the plan parsing, the section, the links, the remote url, git and the action's
  variables, no git), site.test.ts (the build line and the page in the built site)

### Group rows: a +/- box and the lines of the levels (user request)

* the user: "the + and - looks not very nice, should be more typical + - with border, and the line for
  grouping should go all the way down"
* renderRowGroup.ts: the toggle is an 11px svg box (frame + sign, crisp at 1x: half pixel coordinates),
  centered in the 15px column of its level; `.simple-html-grid-group-levels` (the lines of the groups the
  row is in) and `.simple-html-grid-group-line` (an expanded group's line from the middle of the name
  line down; the box's fill covers its top) are in the row's full height container, so they go through
  the aggregate lines too
* grid.css: the lines are one background gradient, a 1px line in the middle of each 15px column; the data
  rows' grouping column (`.simple-html-grid-grouping-row`) has it over all levels, no bottom border and
  no inset shadow any more, so the lines read as one. `GROUP_LEVEL_WIDTH` (getGroupingWidth.ts) replaces
  the 15 in the code; grid.css has it too (said in both)
* new `--simple-html-grid-group-line-color` instead of reusing the unused `--simple-html-grid-grouping-border`:
  the old dark sample (grid01) sets that one to the row background's dark, the lines would vanish there
* tests: groupRowLook.test.ts (the box's sign collapsed/expanded, the lines' elements, widths and places by
  level, after a collapse, the data rows' column per level, with aggregates the lines in the full height
  container). Browser: group-look.js / group-look2.js screenshots at 3x, light and dark: two levels, a
  group's end, a collapsed group, a row with aggregates

### Live data: the flash of a merge, the look of a conflict (item 38)

* `GridConfig.mergeHighlight` (default on, harmless without upsert: no merge times): showCellMerged.ts
  puts `simple-html-cell-merged` on the cell element when it is rendered in the second after the merge
  (`getMergedAt`), the css fades a `::before` tint out over 1s (`::after` is the range's). A new merge
  of a cell that still has the class flips `data-merged-again`: an animation of another name starts it
  again, no forced reflow (a merge of many cells would force one per cell)
* the conflict marker is the edited marker with a class (showCellEdited.ts): shown with or without
  `editedMarker`, the user has to choose; in a conflict the field's original is the server's value, so
  the marker's click (`resetField`) is `resolveConflict(row, field, 'remote')`. No new subscription:
  a conflict that comes or goes already puts its row in `rows-changed`
* the row number: `rowStatusIcon(state, hasError, hasConflict)`, the arrows icon, the conflict lines in
  the tooltip and the screen reader's text (renderRowSelector.ts)
* the conflict colour is violet: at least 3:1 to the rows, the row numbers and the selected rows, under
  an error's tint too (light `#6d28d9`, dark `#ddd6fe` - the first picks `#7c3aed` / `#c4b5fd` were
  2.8:1 under the tint)
* tests: mergeLook.test.ts (the flash: which cells, not for a value sent unchanged or set from code,
  gone after the second, started again, off; the conflict: marker, tooltip, classes, the row number
  and its screen reader text, a row removed on the server, without editedMarker, the click, keep mine,
  readonly; the icon order); texts.test.ts shows the four new texts on a keyed grid of its own.
  Browser: live-check.js (26/26: the flash's class and animation, the conflict look, keep mine, the
  marker's click, the button) and screenshots light and dark
* not done: "Keep mine" / "Take server's" in the row menu - the menus are being reorganized into
  submenus, they go in after that

### The summary of the selected cells in the footer (item 35)

* selectionSummary.ts: the rectangle around the ranges cell by cell, a cell counted when it is in a
  range (overlaps once), data rows only; count = not blank (isBlank: null, undefined, '', an invalid
  date), numbers = finite numbers of `type: 'number'` fields. A million cells (Ctrl+A on 100 000 rows of
  10 fields) is some ms
* rebuildFooter.ts: `renderFooter()` split from `rebuildFooter()` (which also renders the totals row),
  called on `__setRanges` and after values changed (renderChangedRows, both paths) when there are ranges.
  The summary is absolute at the right: on the count's line, or with a filter on the chips' line; the
  chips collapse to one box when their rectangle reaches under it (left of it and right edge past its
  left - false in happy-dom, where every rect is the same)
* formatted with the formatter of the first number field in layout order, rounded to 2 decimals like the
  row menu summary was; mixed number fields with different formatters show the first one's format
* not a live region: a drag changes it at every cell, a screen reader would talk all the time. A group
  named "Selected cells"
* tests: selectionSummary.test.ts (none / one cell, the count of every type, numbers of number fields
  only, 0 and false, overlapping ranges, the formatter's field, group rows, the footer's items, title and
  name, clearRanges, an edit, the config's texts). Browser:
  .claude/browser-checks/scripts/footer-summary-check.js 11/11 (the numbers against the datasource, a
  drag, an edit, two ranges, one cell, clear of the filter chips), screenshots light and dark
* left: the row menu's Summary goes when the menus' submenus are merged (that work is in another
  worktree)
* the browser checks moved: the machine rebooted and /tmp went with the scratchpad's scripts, playwright
  and Chromium. They are in `.claude/browser-checks/` now (git-excluded, not committed): new scripts
  are written there

### Find in the grid: Ctrl+F, the matches marked, next / previous (item 42)

* findMatches.ts (no dom): the displayed rows (`getRows()`, group rows skipped - so not the rows of a
  collapsed group) x the layout fields (`getLayoutFields()`), the text by `cellTextOf` (formatter,
  `numberOverride`, `dynamicCellTypeColumn`), `toLowerCase().includes()`, boolean cells skipped (a
  checkbox shows no text), the whole text of a multiline cell. `matchAtOrAfter`: the anchor itself while it
  matches (by row object + field, so a sort keeps it), else the first match after its row (looked up
  again, or the row it was at when filtered out), wrapping to 0
* findBar.ts: the bar is `ctx.findBar`, made on the first open, the first child of the grid element
  (absolute, top right, z-index 2000 over the cell inputs' 1000; 25px - over the default panel). lit
  render of input / `role="status"` count / three `<button>`s, `role="search"` on the bar. Keys:
  Ctrl+F / Cmd+F and F3 on a keydown listener of the grid element (createDom, aborted with the scroll
  listeners), Enter on the input, Esc on the bar. The letter by `key`, by `code === 'KeyF'` only when
  the key is no Latin letter (Cyrillic): Dvorak's F is where it types f
* the search waits FIND_DELAY_MS (150) after the last key and after the last change of the data; Enter
  in that time runs it and shows the first match (it does not skip it). `find()` runs at once (returns
  the count). Matches are looked up per cell through `Map<row object, Set<field>>`, not by row index: a
  render between a sort and the search marks the right cells
* the classes are set in renderRowCell (showCellFind, next to showCellRange) and on the cells on screen
  when the matches change (`forEachCellOnScreen`, split from renderRangeClasses in rangeSelection.ts)
* following the data: `findDataChanged()` from `Grid.rebuild()` (filter, sort, group, expand,
  collapse, rows set, layout, updateConfig, setState, resize), `updateAfterMerge()` (an upsert) and
  `rows-changed` (values from code, the user, undo). Not on `current-entity` / `selection-change`: they
  re-render, they change no text. It never scrolls for a change of the data
* scrolling: `scrollCellIntoView` (rangeSelection.ts) got a `middle` option - out of view, the row / the
  middle column in the middle of the view, a column wider than the view at its start - and returns
  whether it scrolled; then `triggerScrollEvent` renders at once (a jump of more than 500px would else
  wait 150ms for the scrolling to stop, and Esc could not focus the cell)
* Esc / the close button: when the focus was in the bar - the current match's cell gets the focus
  (`focusCellInput`, exported) and its row is made current (as Alt+arrows to another row does); without
  a match the cell Ctrl+F came from (by row object, scrolled back), else the header filter / column header
  it came from. The buttons cancel their mousedown: the focus stays in the input
* the wheel and a swipe took the focus to the hidden focus input (for the cell being edited): not when
  the find bar has it (addScrollEventListeners.ts) - Enter after the wheel goes on finding
* the bar is closed in `disconnectElement` (its timer), without moving the focus
* a narrow grid: the input shrinks to 40px and the count gives way (ellipsis) before the buttons - a
  grid of 144px still shows ↑ ↓ ✕. Without a panel (`panelHeight: 0`) the bar covers the right end of
  the labels row (25px), never the rows
* decisions: the current match is not the current row while stepping (a detail form bound to
  `current-entity` would load on every Enter) - only on Esc. `find()` does not move the focus,
  `openFind()` does (for the "Find…" menu entry to come). No option to turn Ctrl+F off. The tint of the
  other matches is under 3:1 to the rows (a highlighter's), the current match's line is 3:1+
* colours: match yellow / amber, current orange + a 2px inset line (box-shadow, with an error's border
  inside it); in a range both tints (two gradients). Contrast checked: text 4.98+ over every tint, row
  colour, selected row, range and error tint; the line 3.25+ (light and dark, computed and read from the
  pixels in the browser)
* texts `find.label`, `find.placeholder`, `find.count`, `find.none`, `find.previous` / `.next` / `.close`
  and their `.tooltip`; the texts test opens the bar with and without matches
* tests: find.test.ts (43: formatted text, case, empty, order across pinned/stacked, checkbox, multiline,
  numberOverride, filter / collapsed groups, the anchor after a sort and a filter, the API and the event,
  scrolling down / sideways / a wide column, classes on reused cells, Ctrl+F in / outside / with Shift or
  Alt / Cyrillic / Dvorak / already canceled, typing and the delay, Enter / Shift+Enter / F3, F3 in a cell,
  Esc and the focus, the buttons, following a filter / sort / edit / layout, aria, texts, the wheel).
  Browser: `.claude/browser-checks/scripts/find-check.js` 41/41 (in this worktree), screenshots
  light and dark
* left: a "Find…" entry in the row menu (after the menus' submenus are merged); Cmd+G / Ctrl+G; match
  case / whole word

### Fill down: Ctrl+D and the fill handle (item 34)

* fillDown.ts: `fillDown(gridInterface, active)` - each range's top row into the rows under it
  (rangeBlock: data rows only), a one-row range or the focused cell alone from the data row above (as
  Excel). Values copied raw, a Date as a new Date (two rows must not share one object), through the
  proxy: validated, edited marks, rows-changed, one run of code = one undo step; `endTyping()` first so
  the typed cell is written and rendered like a paste
* Ctrl+D / Cmd+D (`fillDownKey`, in the cell's keydown after the range keys); not with Shift/Alt, not in
  a readonly grid - there it is the browser's bookmark key
* the fill handle: one element per grid (WeakMap), moved by showCellRange into the cell at the last
  range's bottom right corner on screen - for a field with empty cells under it (a column next to it
  stacks more fields) the last empty one, where the range's line turns. Its pointerdown stops the
  body's range press, keeps the focus, follows the pointer (followPointer, cellPointAt from
  rangeSelection now exported), grows the range down only, scrolls down past the rows' bottom; let go
  `fillRows()` repeats the range's rows over the new ones; cancel puts the ranges back. bodyCellOf leaves
  the handle out like the edited marker
* tests: fillDown.test.ts (the range, readonly column, dates copied, undo, one row / one cell from above,
  the first row, Cmd, Ctrl+Shift and a readonly grid left alone, group rows, the API, the handle's cell,
  a stacked layout, readonly, fillRows repeating + undo). Browser: .claude/browser-checks/scripts/fill-check.js
  12/12 (Ctrl+D with a readonly column, default prevented, Ctrl+Z, the handle at the line's corner and
  hit by the pointer, a drag of two rows, the handle at the new corner, the focus kept, Esc), light and
  dark screenshots
* not done: a "Fill down" entry in the row menu (after the menus' submenus merge); fill up/right; series
  (1, 2, 3 ...) - the handle copies

### Menus: submenus, shorter, the keyboard (user request)

* the user: "our menus is pretty big ... organized better so it uses less height, can expand to the
  right, many more sub menus". Done in a worktree by an agent, merged here
* showMenu.ts: `MenuSubmenu` entries render as an item with a chevron; a submenu is its own
  `popover="manual"` placed beside its item by the placeMenu rules (right, flipped left, over the menu
  when neither fits, moved up, scrolling); one open per level, hover opens after 150ms (moving to it
  diagonally does not open the others), ArrowRight/Enter/Space/click open it, ArrowLeft/Esc close it
* keyboard per the APG menu pattern: roving tabindex, arrows wrap, Home/End, first letter, disabled
  items focusable but not activated (APG), Tab closes and returns the focus - except in the filter
  menu, where Tab goes into the value list. The last input (key or pointer, capture listeners) decides
  whether a menu takes the focus: Shift+F10 sends a contextmenu event with `button: -1` in Chromium
* the default trees: row menu 762px / 38 rows -> 285px / 14, header 485px / 24 -> 145px / 7, filter
  menu 537 -> 437px (the value list stays inline). Section ids that became submenus kept their ids;
  `header.column.pin` (not `header.pin`) so a filter on `header.column` still hides that part
* the row menu's Summary is removed with the merge (item 35): its regression tests (negative max, 0 as
  min, average not rounded and without blanks, two decimals) now run on the footer summary
* tests: gridMenus.test.ts 68 -> 106 (trees, the hook on nested entries, submenus open/close/hover with
  fake timers/diagonal/nesting, placement, every key, roles); helpers `menuEntry(id)` (opens the
  submenus on the way), `menuTreeIds`, `openMenus`. Browser: .claude/browser-checks/scripts/
  submenu-check.js 37/37 and menus-regression-check.js 25/25, screenshots in shots/submenu and
  shots/menus-regression
* known: the menus' box-shadow never shows (`.simple-html-grid { overflow: hidden }` clips it on the
  popover); the top-level menu has no name; the filter editor's pickers, the column chooser and the date
  picker are still mouse-only

### The row menu's undo entries in a submenu (user request)

* the user, after the submenus: "maybe undo/redo should be own section too". The five entries
  (undo, redo, undo cell edit, undo row edits for the row and the selected rows) are the submenu
  `row.edit` "Undo / Redo ›", first in the menu - the id the old section header had, so a hook filtering on
  `row.edit` hides the lot as before. The line under them (`row.edit.separator`, new in the submenu work)
  is gone. Hidden in a readonly grid with its entries
* the row menu is 9 rows (38 before the submenus); Shift+F10 focuses Undo / Redo ›, ArrowRight goes into
  it and its first item (greyed out with nothing to undo, still focusable)
* tests: undoRedo.test.ts (the entries through the submenu, the submenu first), gridMenus.test.ts (the
  top level, Shift+F10 then ArrowRight / Esc); browser submenu-check.js 38/38 (copy before:
  submenu-check.js.before-undo-submenu), menus-regression-check.js 25/25

### Lookup columns: a select or a dropdown grid (user request)

* the user: the dropdown grid "should look nicer, maybe api also should be better here, so we can with
  setting set something like this, by linking a gridinterface. And maybe we should have option for
  selects too, based on linked in gridInterface/or datasource". Done in a worktree by an agent (paused
  once by the account's usage limit and a reboot), merged here
* `registerLookup(id, lookup)` like registerFormatter: the config stays JSON, `editor.lookup` names the
  id; a grid resolves its lookups when it is made and on `updateConfig({ columns })`. Labels follow the
  lookup's datasource (rows loaded later re-render the cells). Values matched with `===`: a lookup
  column is a text or number field
* a linked GridInterface is connected to the dropdown while it is open, disconnected on close, and
  `resetState()` each time; one already shown in a grid on the page throws (it would take that grid's
  datasource away). A dropdown grid made from a datasource is destroyed on close; it filters and sorts
  its datasource, so the guide says to give a lookup one of its own
* the cell is a readonly input with the label, `aria-haspopup` listbox/grid; while the list is open the
  cell counts as being edited (`startEditing`), so an `upsert()` of that field is a conflict
* sorting on labels needed a small internal datasource hook (`Sort.setSortValue`, `__setSortValue`):
  the label first, the value on ties, so groups stay whole; `destroy()` takes it back
* the select shows 500 options at most: opening a 10 000 option list took 191ms with all rendered, 14ms
  with 500 (median of 5 in Chrome)
* tests: lookups.test.ts (80), sortValue.test.ts (4), a lookup case in gridExcel.test.ts, texts.test.ts
  opens a select. Browser: .claude/browser-checks/scripts/lookup-check.js 55/55 (light and dark, the
  a11y tree, a small window, the dropdown grid sample) and lookup-timing.js
* known: the cell's accessible name includes the button ("Norway Open the list"); the dropdown grid
  leaves its last filter on the lookup datasource until the next open clears it; the value list, group
  rows and the filter text show values, not labels

### The filter menu's value list and the filter editor redone (user request)

* the user, with two dark screenshots: "this menu and filter editor needs some improvements". Before /
  after screenshots, light and dark, 2x: `.claude/browser-checks/shots/filter-ui/` (`before-*`, `after-*`)
* **the value list** (contextmenuFilter.ts `valueListBlock`, grid.css `.simple-html-grid-value-*`): no
  "Search:" header; a framed search box (placeholder "Search values", text from the left, full width);
  a quiet line "10 values" (it counted the values, the text said rows; `filter.values.rowsFound.one`
  for one), the cut-off warning in its place; the list in a framed box: "Select all" its header with a
  line under it, a tri-state checkbox (`.indeterminate`: the browser exposes it as mixed, checked in
  Chrome's accessibility tree - no aria-checked, ARIA in HTML forbids it on a native checkbox), each
  value a `<label>` around its checkbox (the row is the click, the label the name), the value with an
  ellipsis and its whole text as a tooltip when cut off, its count right-aligned and quiet (70% of the
  text colour, 4.5:1), "Blank" in italics; the values scroll in a box of 242px, the menu 220-320px
  wide; Cancel and Apply (`<button>`s, Apply filled). The blue "Select all" in the screenshot was
  the hover, not a state; it is lit only under the pointer or the keyboard now, as a menu item
* "Select all" was its own flag, set to checked when the menu opened - also when the column had values
  filtered away. It is worked out from the checked values now: checked / mixed / unchecked, a click
  on mixed or unchecked checks all, on checked unchecks all; disabled when the search finds nothing
* keyboard: Tab from the menu's items into the search box, the checkboxes, Cancel, Apply (native
  buttons: Enter and Space are the browser's); ArrowDown / ArrowUp between the search box and the
  checkboxes; Enter in the search box or on a checkbox applies (not while composing). The menu
  opened from the keyboard keeps the focus on its first item (the APG menu pattern, as the other
  menus): one Tab gets to the search box
* the menus' dashed separators were dots in the middle (`width: 0`, auto side margins in a flex
  column): lines across the menu now, every menu
* **the filter editor** (renderFilterEditor.ts, grid.css `.filter-editor-*`): the nested groups ran
  past the dialog's right edge (full width plus their indent); now a group is a bracket - a line down
  its left, its body indented, `min-width: 0` all the way down - nothing outside the dialog at 650px,
  at 480, at its smallest (360) and with 7 levels (rects compared in Chromium)
* a condition is one row: [Field ▾] [Operator ▾] [value] [⇄] [trash]; the pickers are `<button>`s
  framed as selects with a chevron, the placeholder quiet ("Field", "Operator", "Column"), named for a
  screen reader `Field: Country` (`filterEditor.label.*`); the value takes the room left, IN / NOT_IN a
  textarea, IS_BLANK / IS_NOT_BLANK no input (they take no value; the model keeps what it had); the
  row wraps when narrow (value to the next line, then the operator)
* a group's header: AND / OR as two buttons (`aria-pressed`, the one in use filled), "+ Condition",
  "+ Group" (new ids `filterEditor.addCondition`, `filterEditor.addSubGroup`), then wrap (brackets
  icon) and delete as icon buttons named by their tooltips; the icons are new square-cap svgs. The
  empty root says "No conditions: every row is shown" (`filterEditor.empty`)
* the dialog is as high as what is in it (`height: auto`, max the window, the groups scroll), kept in
  the window when it grows (moved up); min 360 x 200 (was 460 x 240, more than a phone). Footer:
  Cancel, Apply, Apply & close (primary), in the order shown - the Tab order (it was row-reverse)
* the field and operator pickers are menus of the grid now (`gridInterface.openMenu` -> showMenu):
  the keyboard of the menus (arrows, letters, Enter), the picked one with a ✓, the focus back on the
  picker; the field picker has a sticky search box (hides the fields with `hidden`; showMenu's
  `menuItems` passes hidden items by), opened from the keyboard the focus is in it, ArrowDown to the
  fields, Enter picks the first shown; the fields by their labels. Its search no longer stays from
  the last time (a module variable shared by every grid)
* the focus: Chrome 131 gives a modal dialog's focus to its first button, not to the dialog with
  `autofocus` (the scroll area had it before, it was focusable): renderFilterEditor focuses the dialog
  after showModal(). A deleted condition's focused button gone: the focus to the dialog, not the body
* the dialog is named by its title (`aria-labelledby`); the ✕ is a `<button>`
* texts (English, the Norwegian sample with them): `filter.values.search` Search: -> Search values (the
  box's name now), `searchPlaceholder` type to search -> Search values, `availableOnly` Filter Available
  -> Only values in filtered rows, `rowsFound` {count} rows found -> {count} values, `truncated` Showing
  only first {max} ! -> Only the first {max} values are shown, `selectAll` Select All -> Select all,
  `run` Run Search -> Apply; `filterEditor.operatorAnd/Or.tooltip` without "Click for OR/AND",
  `label.field/operator/value` Query Field: / Operator: / Filter value: -> Field / Operator / Value,
  `pickAttribute/pickOperator/pickValueAttribute` Click me to select ... -> Field / Operator / Column,
  `filterAndClose` Filter & Close -> Apply & close, `filterOnly` Filter Only -> Apply, `closeButton`
  Close -> Cancel, `fieldMenu.search` search -> Search fields. New: `filter.values.rowsFound.one`,
  `filter.values.cancel`, `filterEditor.addCondition`, `filterEditor.addSubGroup`, `filterEditor.empty`
* variables: `--simple-html-grid-accent-color` / `-accent-font-color` (Apply, the AND/OR in use, the
  value list's checkboxes; 4.5:1 text, 3:1 to the menus) and `--simple-html-grid-control-border-color`
  (frames of the search boxes, pickers, inputs, buttons: 3:1, WCAG 1.4.11). guides/13-theming.md
* tests: filterEditor.test.ts +25 (one row, names, placeholders, IN / blank / column, icon names,
  delete and the focus, AND/OR pressed, the header, + Group in the bracket, wrap, the hint, the Tab
  order, both pickers from the keyboard and the mouse, kept in the window), filterContextMenu.test.ts
  +16 (what it shows, counts, cut off, tooltip, the option, tri-state, Cancel, Enter, arrows); the
  existing ones moved to the new structure and texts (gridMenus, filterEditorApply, fieldsInGrid,
  texts: `notes` gives a list of one value, "clear all" the hint). Browser:
  `.claude/browser-checks/scripts/filter-ui-check.js` 111/111 (117 with the Filter submenu below),
  `filter-ui-shots.js` for the screenshots;
  on the merge with v6_maybe (657e5bc: the Undo / Redo submenu, Find, lookups) also
  menus-regression-check.js 25/25, submenu-check.js 38/38, lookup-check.js 55/55, find-check.js 41/41
* the menus' known list above: the filter editor's pickers work from the keyboard now
* not done: the checkboxes are the browser's (`accent-color`): Chrome draws them with slightly rounded
  corners - square ones would need checkboxes drawn by the grid; a new condition does not take the
  focus (it stays on "+ Condition"); the picker buttons have no `aria-expanded`

### The filter menu's entries in a submenu Filter (user request)

* the user, with a screenshot of the header filter menu: "filter can be own section, section, then
  operator/clear, advanced goes under it" - as the row menu's Undo / Redo: a submenu. The filter menu
  is Filter ›, then the value list (the main tool, in the menu). In Filter ›: Operator ›, Blank ›,
  Clear Filter, Clear All Filters, a line, Advanced Filter…
* the submenu is `filter.filter` (the old section id, removed with the submenus, back with a meaning),
  text "Filter" (Norwegian "Filter"). Every entry kept its id: `filter.operator` is in `filter.filter`
  without its start - the ids stay the same between versions; a hook hiding `filter.filter` hides the
  operators too. The line between clear and blank (`filter.filter.blankSeparator`) is gone, the one
  over Advanced Filter… (`filter.filter.advancedSeparator`) stays
* a number, date or boolean column has no value list: its filter menu is Filter › alone
* keyboard: Shift+F10 on a header filter focuses Filter ›, ArrowRight goes in (Operator ›), again into
  the operators; Tab from Filter › goes on into the value list as before
* MENU_IDS.filter in tree order, the trees and id tables in gridMenus.ts and guides/10-menus.md, the
  texts guide, guides/06-filtering.md and the operator sample's text
* tests: gridMenus.test.ts (the top level, what is in Filter › and the ✓ a level deeper, the ids of a
  submenu, a hook hiding `filter.filter`, Shift+F10 / ArrowRight / Esc / Tab); the tests that click
  entries in it open the submenus on the way (menuEntry). Browser: filter-ui-check.js (Shift+F10,
  ArrowRight twice, ArrowLeft back, Tab into the value list; screenshot after-filter-submenu-open-*),
  menus-regression-check.js and submenu-check.js open Filter › first now (copies of the scripts before:
  `*.before-filter-submenu`). submenu-check's bottom edge case runs in a window 850 high: the Filter
  submenu is short, at 900 it fits under its item and is not moved up; it checks the operator submenu
  in it too. Counts: vitest 2455, filter-ui-check 117/117, menus-regression-check 25/25,
  submenu-check 40/40, lookup-check 55/55, find-check 41/41

### The flaky date picker test (a candidate)

* `datePickerCell.test.ts` "a click in the picker not to close it, a click outside to close it" failed
  about once in ten full runs on a loaded machine. The cell opens its picker in a timer after the click
  (renderRowCell), and opening sets the timer that ends `menuJustOpened` (showMenu.ts) - a click outside
  before it is taken for the click that opened the menu. The test's fixed `sleep(20)` could run before
  that second timer when the first ran late. `openPicker()` now waits for the picker (`vi.waitFor`), then
  one task more: a timer set after the reset timer runs after it. Same 0ms delay, insertion order

### Custom cells: a renderer of your own per column (item 39, steps 1 and 2 of custom_render.md)

* the plan is custom_render.md (no Solid in the core: a renderer hook any tool can use). Done in a worktree
  by an agent; its open questions as proposed: `ColumnConfig.renderer` (an id), an unknown id throws a
  `TypeError` at createGrid / `updateConfig()`, `update()` on every render, step 2 with the text editor
* cellRendererRegistry.ts: `registerCellRenderer(id, renderer)`, the types `CellRenderer` (host ->
  instance), `CellRendererInstance` (`update`, `destroy?`, `edit?`), `CellRenderContext` (row, field,
  value, text of the formatter with numberOverride, type, readonly, rowIndex, gridInterface). The config
  check is `assertRenderers` in gridInterface.ts, next to the aggregates'; a renderer and a lookup
  `editor` on one column throw (a lookup column draws its own cell: label input and its button)
* customCell.ts: the template (the dimmed div and the host div, `cellpos-` class, `tabindex="0"`, no
  aria-label), the lifecycle - `cell.$renderer = { id, instance, host }` (@internal on HTMLCellElement):
  same id and host -> update(), another id -> destroy, host emptied, mount; `releaseRenderer` before the
  checkbox / input / empty templates (renderRowCell.ts, 3 lines), `releaseAllRenderers` in rebuildRows,
  rebuildRowColumns and disconnectElement. A group row calls nothing. A destroy() that throws does not
  leave it mounted
* the host's handlers are the input's without the typing: ranges, Delete, Ctrl+D, undo/redo, Tab and
  Alt+arrows from anywhere in the cell; on the host itself (not the renderer's content) the plain arrows
  navigate (a div has no caret, and the browser would scroll), Space is prevented, Enter/F2/a character
  edit. `focusin`/`focusout` with relatedTarget: moving from the host into the renderer's content is no new
  `cell-row-focus`. The right click's skip of the focus (the row menu keeps the ranges) as in the input
* rangeSelection.ts: `focusedCell` also finds a custom cell (`input: null`) - copy, paste, fill down,
  Find's Esc and the range drag work there; `focusCellInput` focuses the host. rangeClipboard.ts: one
  value pasted on a host is written by the grid (as for a checkbox)
* step 2: textEditor.ts got `singleLine` - an `<input>`, Enter saves, the text `cell.editor.hint`; a text of
  several lines gets the multiline editor (read-only in a readonly cell, as a multiline cell). A click on a
  date cell opens the date picker (as the default cell), a double click there does not open the editor.
  A boolean has none. Deviation from the plan: `CellRendererInstance.edit?(typed)` - a renderer that edits
  itself (the sample's select) gets Enter/F2/typing/double click instead of the grid's editor; without it
  Enter on the select's cell would open a text editor over the select
* css: the host fills the cell (absolute, flex, centered on the line, the input's padding and font,
  z-index 1000 as the input: under the markers and the fill handle), struck through in a deleted row; the
  focus ring is the generic `:focus-visible` rule
* docs: guides/21-custom-cells.md (plain DOM and lit-html typechecked; React 18/19 `createRoot` and Solid
  2.0 `render` from `@solidjs/web`, `createSignal`/`Show` from `solid-js` - checked on react.dev and
  docs.solidjs.com), links from 05, 08, 12, 14, 17; check:docs maps `lit-html` to its typings for that.
  Sample custom-cells (badge, lit-html progress bar, link, a select with edit(), a date with its weekday;
  a wrapper counts the renderers; 10 000 rows). Typings consumer example
* tests: customCell.test.ts (39: registry, config checks, the host, the context, readonly from grid /
  column / hook, 1000 rows scrolled twice with the mounts at the pool, horizontal scroll to another
  renderer in the same host / the same renderer kept / no renderer, rebuild, updateConfig, destroy(),
  removed and put back, group rows, a value from code in the next frame, a write as an edit with one undo
  step, Ctrl+Z, deleted rows, arrows / Alt+arrows / Tab, keys on the content, focus events, click, row
  menu, Space, errors / range / fill handle / Find, copy / paste / Delete, Ctrl+D, Find's Esc, the editor
  of one line and the multiline one, Esc / Tab, readonly / allowPasteClearOnly / boolean, the date picker,
  edit()); texts.test.ts opens the editor of one line. Browser:
  .claude/browser-checks/scripts/custom-cells-check.js in the worktree 39/39 (light and dark: focus ring,
  arrows, copy, the editor, an error, the date picker, the select + undo, the a11y tree - the cell a
  gridcell named by the content, the host a focusable generic node with the content as its name - and
  10 000 rows: 115 renderers in use for 189 cell elements, no mount the second time), screenshots in
  .claude/browser-checks/shots/custom-cells
* left (custom_render.md "later"): `focusButton` and `placeholderRow` on a custom cell, a `measure()` for
  fitColumns, renderers for group rows / totals / headers, a renderer per row

### Find: "Filter rows" (user request)

* the user, on Find (item 42): "maybe control+f should have option to also filter rows...". Done in a
  worktree by an agent, merged with v6_maybe twice on the way (the filter menu / editor redo, custom cells)
* a toggle in the find bar (findBar.ts): a `<button aria-pressed>` with a funnel (inline svg,
  `aria-hidden`), after the count and before ↑ ↓ ✕ - one Tab from the input. Pressed: filled with
  `--simple-html-grid-accent-color` as the filter editor's AND / OR in use. State `bar.filterRows` (the
  toggle) and `bar.rowFilter` (the text and the layout fields the rows are filtered with, null while every
  row is shown)
* the datasource got an internal hook, not a public API: `__setRowFilter(keep | null)` (set without
  running, as `setFilter()`), applied in `__internalUpdate` after the filter and after changed-only, as
  `filterChangedOnly()` is. So setData, upsert, reloadDatasource, removeData, filterChangedOnly ... apply it,
  sort / group do not run it, an edit does not, and getFilter() / getFilterString() / the filter tree /
  GridState know nothing of it. Public was not worth it: the grid would own it anyway (the footer chip,
  Clear, closing), and a predicate of the app's would need a second layer to not fight the grid's
* the rows match exactly as the cells are marked: findMatches.ts got `cellShowsText` (one cell test, used
  by findMatches and the new `findRowFilter`), so the formatter, numberOverride, dynamic cell types, lookup
  labels, custom cells (their formatter's text) and the checkbox rule are shared. The predicate is made
  again on every search (fresh fields and formatters), the rows are filtered again only when the text or
  the layout fields changed (`filterRows()` in runFind, before the matches are found: they are found in
  the rows shown). Filtering rebuilds the grid, which schedules a search; runFind clears that timer
* closing turns it off (closeFind: `bar.filterRows = false`, every row back before the focus goes to the
  match - looked up again by its row object). `disconnectElement` now closes the bar after
  `__disconnectGrid()`, so un-filtering does not rebuild a grid leaving the page; `connectGridInterface`
  with another interface closes it too (the old datasource would keep the filter). An empty text shows
  every row, the toggle stays on
* the footer: a chip `Find: {text}` (`footer.findFilter`, the text the rows are filtered with - while
  typing the one before), after "Changed rows only", ANDed with the filter's chips; ellipsis + tooltip for
  a long text. The footer's Clear / Clear All Filters (clearAllColumnFilters) turn it off and keep the bar
  open with its matches - decided so Clear means "every row" and nothing more
* API: `find(text, { filterRows })` (left out: as it is; a boolean throws via assertOptions),
  `FindResult.filterRows`, sent with `find-change`. No setter of its own: `find(getFind().text, { filterRows })`
* no shortcut: Alt+R types `®` with Option on a Mac, and is "regular expression" in VS Code's find widget;
  Tab from the input, Space / Enter, Shift+Tab back
* texts `find.filterRows`, `find.filterRows.tooltip`, `footer.findFilter` (+ Norwegian in the translation
  sample); guides 19 (a section), 06, 12, 13, 14; the find sample's description and a button
* tests: rowFilter.test.ts (15, the datasource: set without running, AND with filter and changed-only,
  not in the filter / string / tree, sort keeps, groups and their counts, aggregates, setData / add /
  refilter false, upsert, edit, reload / remove, addNewEmpty, selection and current row as a filter);
  find.test.ts 43 -> 62 (the toggle, rows = marked rows for a date / decimal comma / multiline / checkbox,
  numberOverride, a lookup label, a custom cell, on top of filter + changed-only + not in the state,
  setData / upsert / sort, an edit, typing and the debounce, a layout change, groups, ranges / selection /
  current row compared with an equal filter, Esc / ✕ / closeFind / leaving the page / another interface,
  the chip and Clear, the API and the event, texts); texts.test.ts shows the chip. Browser:
  find-check.js 68/68 (in the worktree's .claude/browser-checks/scripts, the copy before:
  find-check.js.before-filter-rows), screenshots in .claude/browser-checks/shots/find-filter
* known: the bar needs about 148px now (four buttons): in a grid of 144px the ✕ is cut by a few px. A
  datasource in two grids: both show the filtered rows, the chip is in one footer

### Row classes: the rowClass hook (a candidate; the rest of plan item 39's conditional formatting)

* `GridHooks.rowClass(row, rowIndex)` returns class names (space separated) or null. rowClass.ts
  `showRowClass()` puts them on a row element and takes off the ones it had (a WeakMap per element: the
  elements are reused), called from renderRow (verticalScrollHandler.ts: a row scrolled in, refresh())
  for the selector and pinned sections - not the group section's row elements - and from
  renderChangedRows for the rows whose values changed, so the classes follow edits, pastes, upserts and
  undo in the next frame. A group row gets none and the hook is not called for it
* the row element is behind the cells (their inputs are transparent): a background on it shows. The guide
  and the sample give it with the even/odd class (`.simple-html-grid-row-even.late`), which leaves a
  selected row its colour and beats the grid's row colours
* tests: rowClass.test.ts (every section, an edit, a sort reusing the elements, group rows, updateHooks
  on/change/off, the grid's classes kept), createGrid.test.ts (a config with rowClass throws). Browser:
  .claude/browser-checks/scripts/row-class-check.js 7/7 (the cell-styling sample: marked rows in every
  section, tint and italics, an edit, removal, light and dark)

### Candidates checked (2026-11-21)

* "Candidates / not started" was written over months, and much of v6 fixed its entries without saying so
  there. Every entry checked against the code (read, a vitest probe for the ones that run); the list is
  rewritten below, grouped, with what is still open
* fixed already, removed:
  - ee9dabf (phase 1 step 5): the duplicated writes in the set trap of `entityHandler.ts`;
    `getChanges()` listing props edited back; a time only change (a `datetime` compares to the second, a
    `date` the day on purpose); `selectAll()` sends `selection-change` only where it selects ('multiple'),
    `deselectAll({ notify: true })` sends it, documented
  - fb04b08: the duplicated listener machinery (the shared `Emitter`, plan item 13); dim repeated values
    compared `fromSource` (the formatter's text now). f477943: it dims the row below again after an edit
  - f804378: the repetitive defaulting of `__parseConfig()` and its three attribute loops (`withDefaults()`,
    `columns` + `layout`); a layout column without `fields` is left out, no crash (was: without `rows`)
  - 2a2bf39 (phase 4): the linear scans on every scroll event and the three copied blocks of each scroll
    handler (`firstIndexAtOrAfter`, `assignPool`, `pinnedSection`)
  - 2409775 (the date picker's redesign): its generic class names (`.main`, `.year` ...), its week numbers
    under AA (5.3:1 now)
  - 2f98d20, 3047150: menus mouse only (the keyboard of the menus); the row menu summary's min / max / avg
    (it is gone, the footer summary 6ab6019 replaced it - its numbers are right)
  - 1fcc41d (phase 6): the row menu copy's `null` / `undefined`, blank 0 and unescaped html
  - 4453919 (texts by id): menu labels built when the menu opens, the value list's texts without ids
  - 9ca89f9: the wheel's `wheelDeltaY` (standard deltas; the touch part is still open)
  - 6316517: the `@example` blocks with an undeclared `datasource` (check:docs declares it)
  - 26a60a0: `autoResizeColumns`' date placeholder measuring (`fitColumns()` measures what cells show)
  - c4ba65b: `guides/05-editing.md` "Showing the row state" uses `light-dark()`
  - done separately: row classes from a function (the `rowClass` hook). Gone: live-check.js, which raced
    the live sample's timer (lost with the other early scripts, see the browser checks below)
* not bugs, documented, removed: the column chooser lists every field ever in the layout - on purpose, a
  column taken out can be put back (`__parseConfig`, guides/02); an `openMenu()` menu's context has no
  field, row or cell (`menu: 'custom'`, `MenuContext`); `cell-header-focus` sends the first displayed
  row, not a row of the header (gridEvents, guides/09, MIGRATION) - only its staleness was a bug
* `@types/node` kept: happy-dom (the tests' dom) depends on it, and the typecheck loads it through
  vitest's types even with `"types": []` (82 of its files). Dropping our devDependency would leave the
  same package installed, unpinned
* fixed now, each with a test that fails before:
  - the value list put a `false` (a text field with booleans) under "Blank" - a truthy check - and the
    `IN` it applied keys it as `FALSE`, so "Blank" left those rows out. `isInListBlank()` (filter.ts) is
    the one test of both: null, undefined, `''` and 0, as `IS_BLANK`; a false is a value of its own
  - a date picked in a header filter's date picker was stored as text (its TODO wrote the text over the
    `Date` filterCallback stored), a typed one as a `Date`: `getState().headerFilters` differed. The picker
    also opened on the text the cell had when rendered (empty: today), not the date typed since
  - `cell-header-focus` and the header / filter menus' `context.row` had the first displayed row of when
    the header was rendered: stale after a filter (the header is not rendered again). Read when it
    happens; the `rowData` parameter of renderHeaderLabel / renderHeaderFilter / contextmenuLabel /
    contextmenuFilter is gone
  - `__groupLvl` of the data rows: one grouping level gave it to the first row of each group only, and
    removing the grouping left it. Every row grouped gets the number of levels, 0 again once the rows are
    shown ungrouped (`Grouping.resetLevels()`, once, every row of the datasource), a new row has 0. One
    value per row still: a container shared by two datasources has the last one's
  - `getRow(n)` is typed `EntityUnion<T> | GroupRow | undefined`: nothing in src, the samples or the docs
    needed a change (every caller checks or casts); the typings consumer checks it
  - `getFilterTree()`: a group node's `logicalOperator` is `group`, the filter's name (`FilterGroupNode`,
    new in v6)
  - a click on a group row's row selector in the 'single' or 'none' selection mode sent `selection-change`
    with nothing selected (`selectRowRange`)
  - dim repeated values compared the formatter's text, not what the cell shows: a blank shown as 0
    (`numberOverride`) was not dimmed under another. `cellTextOf()` now, as renderRowCell (a lookup's
    label too)
  - the docs site's copy button: without `navigator.clipboard` (plain http off localhost) it threw, a
    refusal was an unhandled rejection - it says "copy failed"
* left for the keyboard work (cellRowKeyNavigationCellRowHandler.ts): moving into the header filter row
  makes row 0 current, see the candidate
* tests: dropDownFilterData (+2), datePickerCell (+3), groupRows grid (+1) and datasource (+4), gridMenus
  (+1), selectionGroupRows (+2), dimRepeatedValues (+2), the docs site (+1); the tree tests use `group`;
  the typings consumer. vitest 2534 -> 2550 (126 files). Browser: .claude/browser-checks/scripts/
  candidates-check.js 9/9 (the basic grid's date filter picker, the copy button allowed and refused),
  filter-ui-check 117/117, find-check 68/68, lookup-check 55/55, menus-regression-check 25/25

### The filter editor kept the header filters it did not change (a candidate)

* Apply emptied every header filter cell (`__clearHeaderFilterValues`), also of the columns whose
  conditions it kept: the rows stayed filtered by them, the headers showed nothing, and the next header
  edit replaced the column's conditions from an empty cell. Now `__clearChangedHeaderFilters(before,
  after)` empties only the cells whose column's conditions changed - the ones a header filter owns, its
  top level conditions of an AND root or the root condition (`columnConditions`, filterCallback.ts,
  the mirror of filterWithoutColumn), compared field, operator, valueField and value (a date by its time,
  a list by its items: `sameConditions`)
* tests: filterEditorApply.test.ts +2 (a kept column keeps its text and state, a changed one is emptied;
  a removed condition empties its header) - both fail with the old line
* with it, a second candidate: the dev samples' dark toggles (`samples/grid01/toggleDarkGrid.ts`,
  `samples/date01/toggleDarkDate.ts`) injected a block of v5 style dark colours; every colour of
  grid.css and date.css is `light-dark()` now, so they switch the page's `color-scheme`

### The filter menu's value list shows what the cells show (a candidate, with the lookup columns)

* the candidate "The value list shows raw values": a text field's list had its values upper cased, not
  a formatter's text, and a lookup column listed its codes (`NO`) where the cells show `Norway`. Done in
  a worktree by an agent
* the list (dropDownFilterData.ts, rewritten) is of **entries**: the text the column's cells show
  (`cellTextOf`, as Find, fit widths and dim repeated values: the formatter's text, a lookup's label), the
  values behind it and their number of rows. The text of a value is read once (its first row). Sorted with
  `localeCompare` (it was the character codes: capitals first), Blank first
* **grouping**: values shown the same are one entry, their counts added (two values a formatter shows as
  `1234`, two codes with one label). Values are keyed first by what `IN` compares them as (`inListKey`,
  filter.ts, now shared with `IN` itself): values `IN` can not tell apart are never split over two entries.
  So texts that differ in case only (`Oslo`, `OSLO`) are one entry, the first row's text
* **the upper casing** was there because `IN` compares ignoring case: the upper cased raw value was the
  one key of every spelling. Dropped from what is shown (the cells' text), kept as the key - the reason
  is still there
* **Apply** builds the filter of the values behind the checked entries, through filterCallback as the
  header filter (the column's own conditions replaced, the header cell emptied): the shorter of `IN` of
  the checked values or `NOT_IN` of the unchecked ones, as before (`'NULL'` for Blank). A normal filter:
  the footer, `getFilterString()`, the filter editor, the state. A lookup's label search in its header
  filter makes the same `IN` (a test checks it)
* **the search** searches the texts. With a search, Apply was `CONTAINS search` + the IN / NOT_IN; a
  CONTAINS compares the values, not the texts (a lookup's `nor` never matched `NO`): now an `IN` of the
  values the search found and are checked. The other side: when the search finds more than 100 texts,
  the ones past the cap are not in it (the list says it is cut off; type more). filterCallback lost its
  `filterArrayAndValue` parameter (only the list used it). Blank is not listed with a search - it has no
  text, and with the CONTAINS it never mattered
* **the cap**: the first 100 texts in order (it was the first 100 values found in the rows, then sorted);
  the counts are complete for every value now, still only shown when nothing is cut off
* **a lookup on a number field** gets a value list: its cells show text labels. A number field without a
  lookup still has none. `numberOverride` changes nothing in the list, as on a lookup column's cells
* **`IN` on a number field**: the row's number is compared as the formatter shows it, a number in the list
  was compared as `String(n)` - `[1.5]` never found the `1,5` of numberComma, `[2]` never a 2 shown as
  `2.00`. A number in the list is formatted too now (filter.ts `inListKeys`); text in the list is as
  before. This also fixed the lookup header filter's `IN` on a number field with such a formatter. The
  keys of a list are made once per condition and filter run (a WeakMap), not for every row
* **the footer's chip** shows a lookup column's labels: `getFilterTree(label, formatterOf)` takes a
  formatter per field (new, optional; it formats the `IN` / `NOT_IN` values too, not `'NULL'`), the
  footer passes the lookup columns' formatters - `Country in Norway`. `getFilterString()`, the filter
  editor (it edits the values) and the state have the values
* `false` stays a value of its own, 0 stays under Blank in a text field, a value whose cell shows no text
  is under Blank too (with its value in the IN). "Only values in filtered rows", Select all, the counts,
  Cancel / Apply and the keyboard are as they were; a grouped grid lists its data rows
* docs: guides/06-filtering.md (the value list, IN on a number field, `getFilterTree`'s formatter, the
  footer), 20-lookups.md (the limit gone: the value list and the chip show labels), 10-menus, 12-texts
  (`filter.values` for a lookup column too), the Formatter doc, ColumnConfig.editor, the lookups sample's
  text. No new texts
* tests: dropDownFilterData.test.ts rewritten (26: texts of a formatter and a lookup on a text and a
  number field, grouping and counts, case, order, Blank, false, the cap, search, checked, grouped),
  filterContextMenu.test.ts +11 (Apply of a lookup: NOT_IN of the code, the chip, the state, reopened;
  search and Enter: IN; the same IN as the header filter; a number lookup; a formatter; case; Blank; the
  cap and the search; nothing checked; grouped) and the texts as the cells show them, filterIn.test.ts +4
  (numbers formatted, a list changed between runs), filterString.test.ts +3 (formatterOf), lookups.test.ts
  +1 (the chip of a header filter), gridMenus / rowStatus moved to the shown texts. vitest 2583 (126 files)
* browser (Chromium, dist_demo on 8093): `.claude/browser-checks/scripts/value-list-check.js` 51/51 (the
  lookups sample: labels, counts, search by label, Enter's IN, the rows, the chip, reopened, a number
  lookup's NOT_IN and chip; the custom formatter sample: NORWAY as a NOT_IN of Norway, phone searched
  without spaces, IN of the values with spaces; light and dark, screenshots `shots/value-list/`),
  filter-ui-check.js 117/117 (its value texts compared ignoring case: it expected upper case),
  lookup-check.js 55/55, find-check.js 68/68, menus-regression-check.js 25/25
* not done: the group rows of a lookup column still show the value (documented in the lookups guide);
  the filter editor shows the values

### Sorting with a collator that calls different strings equal (a candidate)

* with `setLocaleCompare(code, { sensitivity: 'base' })` the collator calls 'a' and 'A' equal, and the sort
  turned its 0 into 1 both ways round: an inconsistent comparator, so their order was the order they came
  in - and grouping, which puts equal values next to each other, could split one value into two groups.
  Now different strings the collator calls equal are put by their code points: a consistent order,
  'A' before 'a'. Still not 0: grouping keys a group by its own text, and only equal ones may be one group
* tests: simpleSorting.test.ts +3 (the same order from three input orders, descending the reverse, one
  group per value) - all three fail with the old line

### Light mode text contrast to WCAG AA (a candidate)

* the light colours were kept as they were before v6 (theme.test.ts pins them), and two were under AA's
  4.5:1 for text: the secondary text `--simple-html-grid-sec-font-color` #979494 (placeholders, search
  boxes, the AND/OR between the filter chips) 3.0:1 on white and 2.8:1 on the panel, and the row numbers
  at 50% opacity 2.9:1 (2.5:1 on a selected row). Now #6b6b6b (5.3:1 on white, 4.9:1 on the panel) and
  80% (5.0:1 at the lowest, a selected row; 5.5:1 and up in dark). The test keeps pinning the rest, this
  one with the reason. A disabled menu item stays at 50%: WCAG leaves out disabled controls
* the header filters' placeholders ("Text", "Number", "YYYY-MM-DD") were also at 20% opacity, about
  1.3:1 - the rule is gone, they are the secondary text like every placeholder of the grid (Chrome's own
  placeholder grey is about the same)

### Formatter.formatForEdit: the plain value while a cell is edited (user request)

* the user: "in edit mode value converter should show real values, not formatted" - a money cell showed
  '25 008.76' while typed in. v5 had a text for the edit input (`fromSource`) apart from the display
  one; v6 had one `format` for both (a candidate)
* `Formatter.formatForEdit?(value)`: renderRowCell shows it while the cell is edited - `cell.$focused`
  (the focus handler sets it and renders the cell) and the cell can be typed in (not readonly, multiline,
  a lookup's label, allowPasteClearOnly) - else `format`; the blur renders the cell again when the
  formatter has one, so it shows `format`. The editor over a cell (textEditor.ts, custom cells) starts
  from it too. The built-in formatters need none (no thousands separators); the money formatters of the
  formatters and aggregates samples and the guide's examples have one
* tests: formatForEdit.test.ts (formatted, plain while focused, formatted after; typed over and stored;
  a blank; a readonly grid; without formatForEdit as before). Browser: format-for-edit-check.js

### The keyboard of a spreadsheet: jump keys, undo goes to the change, Mac hints, Tab stops (user request)

* the user: "the most capable grid" - the keys Excel / Google Sheets users expect, without breaking the
  typing in the cells (always text inputs). Done in a worktree, merged with v6_maybe on the way (rowClass,
  the candidates triage, the filter editor's header filters)
* **the keys that jump** (new jumpKeys.ts, the row steps in rowSteps.ts): Ctrl+Home / Ctrl+End (Cmd too)
  the first cell of the first row / the last cell of the last row; Alt+Home / Alt+End the ends of the row;
  PageUp / PageDown a page of rows in the same column, the rows scrolling as far (the cell stays where it
  was on screen; down and up again the same row: `pageIndex`, "the furthest start within a page", at least
  one row - a row taller than a page is no wall); Alt+PageUp / Alt+PageDown a page of middle columns
  (in a pinned column the middle scrolls, the focus stays); Ctrl+ArrowUp / Ctrl+ArrowDown the edge of the
  data as Excel (`edgeRow`: isBlank - 0 and false are values, group rows skipped and no blank). Group rows
  skipped as the arrows skip them (`dataRowNear`). The first / last cell are in the order of Tab
  (`rowPlaces` = getLayoutFields' order); Ctrl+Home / End and Alt+Home / End also scroll the middle
  columns to their start / end. Focusing is synchronous: `goToCell` scrolls (row, middle column), renders
  now (triggerScrollEvent - a far jump would else hide the rows until the scrolling stops) and focuses the
  input / custom host found by the `$` fields of the shown cells (`cellpos-` classes of hidden row
  elements are stale), then makes the row current
* **decisions**: Home / End stay the caret's - the cells are always "being edited", and in edit mode
  Excel and Sheets move the caret too; Alt is already the grid's key (Alt+arrows), so Alt+Home / Alt+End.
  "Home at the start of the text moves to the first cell" was rejected: a habitual double press jumps
  away. Ctrl+Home / End do what Home / End do in a one line input, so the grid takes them. Ctrl+ArrowLeft
  / Right stay the input's word moves; Ctrl+ArrowUp / Down do nothing in a one line input (Cmd+Up / Down
  = Cmd+Left / Right on a Mac, where Ctrl+Up / Down are Mission Control), so they are the edge of the data
  vertically only. Ctrl+PageUp / Down left to the browser (tabs). A custom cell: on its host only, a
  control in it keeps its own PageDown
* **with Shift** each key moves the end of the last range where the key without Shift moves the focus
  (consistent with Alt+Shift+arrows): Shift+PageUp / PageDown, Ctrl+Shift+Home / End, Alt+Shift+Home / End,
  Ctrl+Shift+ArrowUp / Down - not Alt+Shift+PageUp / Down. `extendRange` (rangeSelection.ts, also behind
  Alt+Shift+arrows now) renders after its scroll, and when the cell with the focus scrolled away
  (`keepFocusInRange`: its element shows another row, or was hidden and lost the focus) the focus goes to
  the active cell if on screen, else the end of the range, with `rangeGesture` set so the ranges stay -
  found in Chromium: after Ctrl+Shift+End the focus was on the body, Ctrl+C copied nothing
* **from the header**: a header filter has Ctrl+Home / End, Alt+Home / End (the first / last filter,
  `focusFilter`) and PageDown (the cell under it in the last row on screen as a whole); a column header and
  the button of a group row Ctrl+Home / End (`gridCornerKey`)
* **undo goes to the change**: `undoRedoInGrid` (undoRedoKey.ts) for Ctrl+Z / Ctrl+Y and the row menu's
  Undo / Redo: the changes of the step are read before (`History.nextChanges(action)`, internal), and the
  first change whose row is displayed gets the focus (`goToCell`, in the middle of the view when it was out
  of it), its row current. A deletion mark or a field not in the layout: the row, in the column of the cell
  the key / menu was in. No row displayed: the focus stays. `datasource.undo()` from code does not move it
* **Mac hints**: keyText.ts - `isMacPlatform()` reads `navigator.userAgentData.platform` (Chromium, `macOS`)
  else `navigator.platform` (`MacIntel` on every Mac, `iPhone`, `iPad`), each time (testable with a mocked
  getter); `keyText(ctx, id)` picks `<id>.mac`. New texts `row.edit.undo.hint.mac` `⌘Z`,
  `row.edit.redo.hint.mac` `⇧⌘Z`, `find.previous.tooltip.mac` `Previous match (⇧Enter)`,
  `cell.multiline.hint.mac` `⌘Enter to save, Esc to cancel` (+ Norwegian, guide 12). Text ids of their own
  rather than rewriting "Ctrl+" in a text: a translation keeps control, and redo is another key on a Mac.
  Cmd+Shift+Z, Cmd+Y and Cmd+Z were accepted already
* **Tab stops** (tabExit.ts), the grid's Tab is "every cell, in the order shown" (a form, not the APG's one
  stop - kept, documented): a group row is one stop, its button (`tabGroupStop` from the edge cells and the
  last filter, `groupRowTab` on the button: the next / previous row, the filters, out of the grid); after
  the last row the footer's Clear and filter chips while the rows are filtered (`tabPastRows`), Tab past
  them leaves the grid, Shift+Tab on the first goes back to the last row (`addFooterKeys`, one listener on
  the footer element; none with `footerHeight: 0`). Alt+arrows, Enter and the jump keys still skip group
  rows. The date picker stays for the mouse: its days have no keys, taking the focus into it would trap a
  keyboard user in a calendar that can not pick a day (documented, a candidate)
* **the header filter row made row 0 current** (a candidate): moving into the filters (Alt+ArrowUp,
  Shift+Tab, Alt+ArrowLeft) no longer calls `setRowAsCurrentEntity` - the group row above when grouped.
  groupRows.test.ts changed on purpose (the current row stays, + one for Alt+ArrowLeft / Shift+Tab)
* **keys swallowed after a move** (a candidate): `waitForFocusTrigger` (since b6d5094, "fix issue when
  holding tab in") was one module flag of each key handler: 100ms after Tab / Enter / an Alt+arrow every
  key reaching the handlers of every grid was canceled. Its reason: the focus moves 100ms later (the rows
  scroll and render first), a held key repeats from the cell being left - Tab would be the browser's own,
  an Alt+arrow would go from the old cell again. Now `ctx.focusMovePending` (per grid, both handlers share
  it, `focusInAMoment`) and `focusMoveKey` cancels only Tab, Enter, Alt+arrows (and a key the cell overrides),
  a typed character, Backspace and Delete (they would land in the cell being left); Esc (a menu closes),
  Ctrl+C, Home ... pass, and so do the other grids' keys
* tests: jumpKeys.test.ts (32: every key, the caret kept for Home / End / Shift+Home / Ctrl+Left, off
  screen rows, pinned sections, a column of two fields, group rows, a tall row, the edge of the data,
  Shift with ranges and the focus moving to the end + copy, a checkbox, a custom cell's host and control,
  a pending Alt+arrow, a filter, a column header, a group button); accessibility.test.ts (+10, the Tab stops
  of the group rows and the footer; one test changed on purpose: Tab from the last data row before a
  collapsed group goes to its button); keyNavigation.test.ts (+6, the keys while a move is on its way, two
  grids, Esc closes a menu); undoRedo.test.ts (+13, the focus after undo / redo / the menu, a deletion
  mark, a hidden field, a filtered out row, code; the Mac hints, the platform detection, Cmd keys, the
  multiline hint and the find tooltip); texts.test.ts (the `.mac` texts shown with a mocked Mac);
  groupRows.test.ts (1 changed, +1)
* browser (Chromium 1148, scrollbars shown - headless hides them and the middle scroller is then 10px
  taller than the rows, a last row looked cut): keyboard-check.js 52/52 in the worktree's
  .claude/browser-checks/scripts (the caret, Ctrl+End to row 500 and back, PageDown scrolling with the cell
  in place, Alt+Home / End, Ctrl+Arrow, Shift ranges and the focus at the end, undo off screen and the row
  menu's, a filter's keys, the footer's Tab stops, pinned sections, the group buttons, Mac hints and Cmd
  keys with a mocked platform, the keys during a move); find 68/68, fill 12/12, submenu 40/40,
  menus-regression 25/25, lookup 55/55, custom cells 39/39. Screenshots in .claude/browser-checks/shots/keyboard

### Docs site: the full grid sample, folding groups, folded sources (user requests)

* the user: "a full grid sample, where we can add 5k rows with a button, and 50 columns, so it can be
  really tested, where it uses most of the full section, not large code/source parts. Even add an edit
  mode"; "demo should have sub sections expand/collapse also, and should always start collapsed"; "source
  sections should be collapsed by default always"
* samples/demo/samples/fullGrid.ts: 50 fields (id and company pinned left, total and approved pinned
  right; a lookup column, a badge renderer, a money formatter with formatForEdit, validation, multiline
  notes, 12 months and 9 kpis, aggregates), seeded rows so every load is the same, buttons for 5 000 /
  50 000 more rows, remove all, editing on / off (`updateConfig({ readonly })`), grouping, totals row,
  undo / redo, the changes. `DemoSample.fullPage` makes its grid at least the window less 190px high
* the sidebar: a group of a section is a `<details>` of its own (`.nav-subsection`, its title the
  `.nav-group` summary); every part starts folded, `show()` unfolds the parts around the page's link. A
  part opened for a page stays open when another page is shown (one visit). Every source panel starts
  folded (`sourcePanel`)
* browser: .claude/browser-checks/scripts/full-grid-check.js 11/11 (the sidebar folded but the way to the
  page, a guide's sources folded, a group folding with a click, the grid most of the window with 50
  columns and 5 000 rows, 5 000 more, the last row and the far right, editing off, grouping, light and
  dark)

### Delete on a row number marks rows for deletion (user request)

* the user: "maybe if grid have focus and we click delete it should mark rows for delete?". Delete in a
  cell is the input's own key (the character after the caret) or empties a range of cells, so it can
  not be that. As a spreadsheet's row header: a click on a row number selects the row (as before) and
  now also puts the focus on the number (the gridcell has `tabindex="-1"`, not a stop of Tab); there
  Delete or Backspace marks the selected rows - the number's row alone when it is not selected - and
  Ctrl+Z / Ctrl+Y on the number undo / redo (`undoRedoInGrid`). Not with Ctrl / Alt / Cmd, not in a
  readonly grid, not on a group row
* deleteRows.ts: `rowsToMark` / `rowsToUnmark` / `isLockedByHook` moved out of contextmenuRow.ts (the row
  menu's Delete › uses them), `rowNumberKeydown`
* tests: rowNumberDelete.test.ts (the click's focus and selection, the selected rows marked and the undo,
  Backspace on an unselected row, a locked row, readonly and modifiers, Delete in a cell, a group row).
  Browser: row-delete-check.js

### The row menu: entries of a selection greyed out, the cell right clicked too (user request)

* the user: "clear row cell menu, we could have current cell, clear cell selected rows, but to be disabled
  if no row is selected, should be like that with all options needing selected rows/columns etc"
* contextmenuRow.ts: the entries of a selection are `disabled` instead of `visible` - Copy's Column, Row,
  Row (selected rows/col) with no row selected, Range without a range; Paste and Clear (selected rows)
  and range; Delete's Rows (nothing to mark) and Undo (no selected row marked); Size's Fit row height
  (selected rows). Paste › and Clear › show in every editable grid (`visible: editable`) and got an entry
  for the cell right clicked (`row.paste.current`, `row.clear.current` - `pasteIntoCells` / `clearRows`
  take the rows), greyed out when that cell is readonly; Delete › got "Row" (`row.delete.row`). The
  labels stay "Paste cell" / "Clear cell": in the two submenus a bare "Cell (selected rows)" read the same
  for a screen reader (accessibility.test.ts pins it)
* tests updated on purpose (the old "left out" rules): gridMenus.test.ts (+1: every selection entry greyed
  without one, usable with one), rangeClipboard.test.ts, rowMenuDelete.test.ts (+1 Row), rowHeights.test.ts.
  Browser: menus-regression 25/25, submenu 40/40, row-delete 6/6, a screenshot of Clear ›

## Considered, not done

## Candidates / not started

Checked against the code on 2026-11-21: what was fixed is in *Candidates checked (2026-11-21)* above.

### Bugs

* **The column chooser and a finger or a drag**: its items have `touch-action: none` (for the drag), so a
  finger can not scroll a long chooser by them; the ghost of a dragged column is on the body, under the
  chooser (top layer)
* **Touch scrolling** reads `scrollTop` from the synced view (it may lag a move) and never stops the page
  from scrolling along

### Accessibility

* **Keyboard**: the days of the date picker and the column chooser are for the mouse (the picker's
  buttons and hour / minute fields can be reached, a date can be typed); the picker opened from a cell is
  put at the end of the body, no key opens it and it does not take the focus - worth doing together with
  keys for its days; the two scrollbar elements are unnamed stops of Tab in Chrome; Shift+Tab into the
  grid from after it lands on the last input in the dom (a cell of a row rendered at the bottom of the
  view), not the last row or the footer; no Shift+Space / Ctrl+Space (a row, a column), no Ctrl+Left /
  Ctrl+Right to the edge of the data sideways (they are the input's word), no Alt+Shift+PageUp / PageDown;
  the treegrid's ArrowRight / ArrowLeft on a group row
* **Tab, Enter and Alt+arrows move the focus 100ms later** (the rows scroll first, the cell is found by its
  `cellpos-` class once rendered): the jump keys move it at once (scroll, render, focus - goToCell in
  jumpKeys.ts); the old handlers could do the same and drop `focusMovePending`
* **`grid.label`** defaults to `Grid`, read as "Grid grid"; a better default needs the app's context
* **Only Chrome's accessibility tree** was tried: Firefox, Safari (weaker `aria-owns`) and real screen
  readers (NVDA, JAWS, VoiceOver) not

### Code quality

* **Class names**: the label cell and its inner text div share the class `simple-html-label` (so does the
  inner div of a column-selector cell): `simple-html-label-text` for the inner ones would make selectors
  exact - a css change for apps that style them

### Tooling

* **Real-browser checks in the repo**: the Chromium checks live in `.claude/browser-checks/` (git
  excluded, local only): custom cells, fill, the filter UI, find, the footer summary, lookups, menus,
  submenus, row classes, the candidates. The first ones (check.js, undo, a11y, live, range, aggregate ...)
  were lost with a reboot; a new live check should wait for the sample's timer instead of a fixed delay
  (live-check.js raced it under load). Moving them to `scripts/browser/` with playwright as a dev
  dependency would make them a CI job; the Chromium download hangs on this dev machine
* **Test coverage**: 126 test files, 2550 tests, 91% of the statements: `src/datasource` 96%, `src/grid`
  98%, `src/grid/gridFunctions` 88%, `src/date` 85% (its templates 89%). Thinnest: the key handlers of the
  header filter row (40%) and of the rows (59%), renderHeaderFilter (62%), fillDown (60%, the fill handle's
  drag is in fill-check.js), contextmenuLabel (67%), the date picker's day.ts (78%)

### Features

* **Custom cells, the plan's "later"**: `focusButton` and `placeholderRow` on a custom cell, a `measure()`
  for `fitColumns()`, renderers for group rows, the totals row and header labels
* **Formatters are fixed when the datasource is made**: there is no setter to switch a field's formatter
