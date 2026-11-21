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

## Considered, not done

## Candidates / not started

* **Real-browser checks in the repo**: the Chromium checks (menus/dialog/drag, the accessibility
  tree, undo) live in a scratch folder that a restart can wipe. Moving them to `scripts/browser/` with
  playwright as a dev dependency would make them a CI job. Chromium download hangs on this dev machine.
* **Undo**: the menu hints say Ctrl+Z / Ctrl+Y also on a Mac; after an undo the focus stays in the
  current cell rather than moving to the changed one.
* **From phase 3 (theming, accessibility):**
  - light colours under WCAG AA kept for pixel-identical light mode: secondary text 3.0:1, date week
    numbers 3.4:1, row numbers at 50% opacity 2.9:1, row-state colours under that opacity
  - the date picker's generic class names (`.main`, `.side`, `.year`, `.month`, `.icon`) pick up page
    css (the demo's `.main` colours the month name)
  - the label cell and its inner text div share the class `simple-html-label` (and the column-selector
    cell's inner div too): rename the inner ones (`simple-html-label-text`) to make selectors exact
  - `samples/grid01/toggleDarkGrid.ts`, `samples/date01/toggleDarkDate.ts` still inject v5-style dark
    overrides; `guides/05-editing.md` "Showing the row state" could use `light-dark()`
  - keyboard: menus and the date picker are mouse-only; no Home/End/PageUp/PageDown; group buttons and
    footer chips are not on the Tab path; the date picker opened from a cell is at the end of the body,
    out of Tab reach; the two scrollbar elements are unnamed Tab stops in Chrome
  - `grid.label` default `Grid` reads as "Grid grid"; a better default needs the app's context
  - only tried in Chrome's accessibility tree: Firefox, Safari (weaker aria-owns) and real screen
    readers not tried

* **`@types/node` is no longer needed by any typecheck** — the `NodeJS.Timeout` annotations
  that pulled it in are gone (see *`npm start` typecheck errors fixed*). `tsc` over the root
  tsconfig with `"types": []` is clean across all 168 files it covers, tests included. Node
  APIs are only used by `config_devserver.ts` (excluded, run through `tsx` without a
  typecheck) and the plain js in `scripts/` and `typecheck.js`. Dropping it only loses editor
  types for `process` in `config_devserver.ts`.
* **Duplicated writes in the proxy set trap** — `datasource/entityHandler.ts` assigns
  `this.__currentValues[prop] = value; obj[prop] = value;` twice at the end of `set()`, once
  on each side of the `__edited` update. Harmless but almost certainly a bad merge.
* **Test coverage gaps** — 57 test files (39 datasource, 17 grid, 1 date), 634 tests, 66%
  statement coverage: `src/datasource` 89%, `src/grid` core 80%, `src/grid/gridFunctions` 55%,
  `src/date` 56%. Still thin: the label/operator/custom context menus and the column chooser.
* **Found in v6 phase 1 (not fixed yet)**:
  * moving the focus into the header filter row makes row 0 the current row, also when the grid
    is not grouped
  * `cell-header-focus` sends `getRow(0)` as `rowData` - unrelated to the header, and stale after
    a filter
  * `__groupLvl` on data rows: set by grouping but not used for indentation (that is
    `getGroupingWidth`), only set on the first row of each group with one grouping level, and
    never reset
  * `getRow(n)` out of range returns `undefined`, its type does not say so
  * one `format` for both the cell and its edit input - v5 could differ (`fromSourceDisplay`).
    No built-in used it; an optional `formatForEdit` would bring it back if needed.
  * formatters are fixed when the datasource is made, there is no setter to switch them
  * the value list lists raw values for text fields, and IN on a text field compares raw text
  * `autoResizeColumns`: the "label shorter than the date placeholder" measuring looks backwards
  * three `@example` blocks in `dataSource.ts` use an undeclared `datasource` - they fail once
    examples are typechecked (docs work)
  * the display tree from `getFilterTree()` still says `logicalOperator` where the filter format
    says `group`
  * `deselectAll()` does not send `selection-change` by default (`selectAll()` does, in 'multiple'
    mode); `selectRowRange()` (a group row's selector) sends it in 'single' mode with nothing selected
  * a date picked in a header filter's date picker is stored as text, a typed one as a `Date`
  * the column chooser keeps listing fields that were once in the layout
  * some menu labels are built when the menu opens ("Count: 5", "✓ Use dimmed values") and the
    value list's own texts have no ids yet - phase 3's texts map needs both
  * in an `openMenu` menu the context fields are placeholders (`field: ''`, `rowIndex: -1`)
  * the column-drag ghost lives on the body, so it draws under the top-layer column chooser
  * `touch-action: none` on column chooser items: a finger can not scroll a long chooser by its items
  * touch scrolling: reads `scrollTop` from the synced view (may lag a move), never prevents the page
    from scrolling along, the wheel uses non-standard `wheelDeltaY`
  * key navigation cancels every key briefly after moving, so an Esc in that window does not close
    a menu (the `waitForFocusTrigger` item above)
* **Low severity bugs left from the code review** (high and medium are fixed, see *Bug sweep*):
  * row menu summary - max of negatives shows 0, min skips 0, avg is rounded and counts blanks
  * row menu copy - literal `null`/`undefined` for blanks in text/plain, 0 shown blank in the
    html version, values not html escaped
  * dim repeated values compares `fromSource`, the cell shows `fromSourceDisplay`; ignores
    `numberOverride`; the row below is not re-dimmed after an edit
  * `getChanges().modifiedEntities` still lists props edited back to their original value
  * a time-only change on a date is not tracked as an edit (`entityHandler` compares the day).
    Matters now that a set date keeps its time on purpose.
  * with a collator using `sensitivity: 'base'`, `'a'` vs `'A'` compares as 1 both ways.
    Returning 0 would need grouping to use the collator too, or groups split.
  * `waitForFocusTrigger` swallows every key in every grid for 100ms after Enter / alt+arrow
  * the value list puts `false` under "Blank" (falsy check), the IN filter keys it as `FALSE`
  * the filter editor still blanks header inputs whose conditions it keeps
  * a column config without `rows` crashes `getCellHeight` (malformed config only)
* **Packaging / dev tooling**:
  * demo copy button: `navigator.clipboard` with no catch, throws on plain http off localhost
* **Duplication in hot paths** — `verticalScrollHandler.ts` has three near-identical ~30 line
  blocks for left/middle/right that differ only in cache + widths array. Same shape in
  `horizontalScrollHandler.ts`.
* **Duplicated listener machinery** — `addEventListener` / `removeEventListener` /
  `__callSubscribers` are identical in `Datasource`, `GridInterface` and `DateInterface` apart
  from the field name. They share the `Listener` type now; `V6_PLAN.md` item 13 replaces them.
* **Linear scans on every scroll event** — `getTopRow()` / `getLeftCol()`, local closures in
  `verticalScrollHandler` / `horizontalScrollHandler`, scan from index 0 for the first visible
  row/column on every event. `scrollTops` / `colLeft` are sorted, so binary search applies.
  The old README flagged wide reports (200 columns) as a past pain point.
* **Repetitive defaulting** — `__parseConfig()` has 9 repetitions of the
  `x === null || x === undefined` idiom, plus three copy-pasted attribute-collection loops
  (pinned left / pinned right / center).
