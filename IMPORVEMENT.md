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
* done 2026-11-24: a "Fill down" entry in the row menu (Paste ›); not done (after the menus' submenus merge); fill up/right; series
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

### Filter editor: undo and redo (user request)

* the user: "undo/redo in filter editor would be nice". The editor renders again from its draft on every
  edit; `FilterEditorHistory` (filterEditorHistory.ts) keeps copies of the draft (structuredClone), one
  before each edit, up to 100. Its own small history, not the datasource's. A new one each time the
  editor opens (also `openFilterEditor()` while it is open); Apply leaves it as it is
* a step: an edit (`edit()` in renderFilterEditor: added, deleted, wrapped, AND / OR, a field, operator or
  column picked, value / column switched, clear all, a date picked) unless it changed nothing (compared
  with `sameDraft`: a date by its time, undefined as missing); what is typed in one value input from the
  first key that changes the draft until blur or change (Enter) - typed back to the start, the step is
  dropped. The IN textarea writes the draft on input now too, as the value input does
* the keys (`undoRedoKeydown` on the dialog, `undoRedoAction` of undoRedoKey.ts exported): the editor's
  everywhere in the dialog, also with nothing to undo - Chrome's own undo is the page's, not the input's:
  checked in Chromium 131, Ctrl+Z on a button or in another input undoes the typing of an input and moves
  the focus there. The input's own in a value input typed in since it got the focus (Ctrl+Z until it is
  back where it started, then the editor's; Ctrl+Y stays Chrome's redo), and in the field menu's search
  box while it has text. An open menu closes on undo (its pick would write into the old draft). The grid
  behind is not reached: its undo is in its cells' keydown, the dialog is outside it and modal
* the buttons: ↶ ↷ icons at the left end of the footer (not the title bar: it is the drag handle, and
  they would read as window controls), named Undo / Redo, tooltips with the key - `keyText()`, `⌘Z` /
  `⇧⌘Z` on a Mac - `aria-keyshortcuts`. Greyed out with `aria-disabled`, not `disabled`: Enter on Undo
  until nothing is left keeps the focus there instead of dropping it to the body. Updated by hand after a
  key typed (the editor is not rendered while typing: it would reformat the text)
* the focus: a step keeps the place of its control among the editor's controls; undone the draft is
  rendered as it was, so Ctrl+Z / Ctrl+Y focus the control at that place - the picker, the input, the
  trash can of the condition deleted - or the dialog when there is none. The buttons keep the focus
* texts `filterEditor.undo`, `.undo.tooltip`, `.undo.tooltip.mac`, `.redo`, `.redo.tooltip`,
  `.redo.tooltip.mac` (texts.ts, keyText's MAC_TEXTS, the Norwegian sample, guide 12); guides 06 (a
  section "Undo and redo in the filter editor"), 14 (the keyboard table), 05 (the filter editor has its
  own history)
* tests: filterEditor.test.ts +58 (every kind of step with the buttons and with the keys, a typed value as
  one step, the input's own Ctrl+Z / Ctrl+Y and the editor's after it, the keys canceled with nothing to
  undo, every key (Cmd, Shift, a Russian layout, not AltGr), the search box, a menu closed, the cap, redo
  emptied, aria-disabled, the focus, a new open, the grid's `datasource.undo` never called, the Mac
  tooltips; three tests of the footer and the Tab order updated), filterEditorHistory.test.ts 17 (the
  class, sameDraft), filterEditorApply.test.ts +2 (Apply keeps the history, undo changes the draft only),
  texts.test.ts (the editor opened on a Mac)
* browser: .claude/browser-checks/scripts/filter-editor-undo-check.js 72/72 (light and dark: seven edits
  with real clicks and keys, Ctrl+Z back through them with the focus on each control, Ctrl+Y / Ctrl+Shift+Z
  / Cmd forward, the buttons, Chrome's own undo and redo in a value input, nothing to undo canceled with no
  input event, the search box, the grid's history untouched, Apply, a new open, the accessibility tree,
  the look, ⌘Z on a Mac); filter-ui-check.js 117/117 (its Tab order with Undo and Redo), value-list-check.js
  51/51

### Publishing to GitHub Packages (user request)

* the user: "we should also have a deploy npm package, using github npm packages, and one to create beta
  from any branch. but main release only from main"; and "export to excel needs to work through api too"
  - it does (`getExcel()` / `downloadExcel()`, also without the grid on the page, gridExcel.test.ts pins
  that); the full grid sample got buttons for it, a browser download checked (A1:AX5001, autofilter)
* GitHub Packages takes a package only in the scope of the repository's owner: `@simple-html/grid` is
  published as `@<owner>/simple-html-grid` (lower case), installed under its own name with an npm alias.
  The name, the repository (the workflow's token may only publish to its own) and the version are set in
  the workflow's checkout by scripts/githubPackage.js - never committed. `release`: the default branch only
  (a step fails from another), a final version only, refused when the tag v<version> exists, `latest`, then
  the git tag. `beta`: any branch, `<version>-beta.<slug>.<run>` (a new version every run), npm tag
  `beta-<slug>`. Both run the checks of checks.yml first
* package.json's version 6.0.0 (and the lockfile's root): v6 is the version in the works (CHANGELOG)
* tests: scripts/__tests__/githubPackage.test.ts (the release, the beta, branch slugs, the errors); the
  script run on a copy of package.json. The workflows themselves run on GitHub only

### Multiline rows: the lines a text line apart (user report)

* the user (a screenshot of a note of three lines in a fitted row): "multiline rows have unnormal padding
  between rows, looks just strange". Every line of a taller row was a whole `cellHeight` (22px): 11px text
  22px apart, measured in Chromium 12px of air between the lines - double spaced
* **the design**: a row of `lines` lines is the layout's row (`__columnCells` lines of `cellHeight`, the
  inputs) and `multilineLineHeight` px for each line more (`rowHeightOf`); a cell of `lines` lines is
  `cellHeight` + (lines - 1) x `multilineLineHeight` (`cellHeightOf`). The interface still keeps lines per
  row key (not px), so a row follows a change of either option without fitting again; the stacked fields
  are divided in lines as before (`columnCellLines` unchanged), only the px of a line changed. The row
  heights are not part of the state (they never were): nothing saved changes shape
* **the source of truth**: a new grid option `multilineLineHeight` (default 15, a whole number of 1 or
  more, else a `TypeError` as `multilineTooltipLines`). The js needs the px to place the rows; reading a css
  variable would need a measured element and would go stale - the option is written inline on the lines
  element (`line-height`), as `cellHeight` was. 15 is about 1.35 x the default 11px font; looked at against
  the screenshots, the lines read as a paragraph. A larger font needs a larger value, documented with
  `cellHeight` (guides 02, 05, 13)
* **the first line**: the input's text is in the middle of its first `cellHeight`, so the lines under it
  start at (cellHeight + lineHeight) / 2 (`linesUnderTop`), not at `cellHeight`: the second line is a text
  line under the first, as the third is under the second. At half a px (22 / 15: 18.5) Chromium put the
  second line a px closer than the third (14 / 15 apart, also 30 / 19: 18 / 19); rounded to a whole px it
  is 15 / 15 and 19 / 19 - so it is rounded. The marker of more lines has its middle on the last line's
  (`lastLineMiddle`); the input's padding-bottom is the text lines; the editor's textarea gets the same
  line height (the text looks the same when it opens), the one line editor of a custom cell keeps the css's
* measured (Chromium, the tops of the ink of each line): before 22 / 22 apart, a row of three lines 66px;
  after 15 / 15, the row 52px; the full grid's notes 15 / 15 in 52px; cellHeight 30 15 / 15 in 60px;
  font 14px with `multilineLineHeight: 19` 19 / 19 in 68px; the editor 15 / 15 / 15 / 15
* tests: rowHeights.test.ts changed on purpose to the new heights (every height, top, cell, padding, the
  lines' top and line height, the marker, the grouped tops - the group row of e is now in the viewport) and
  +4 (the option at runtime on the cells, cellHeight 30 / 19, a custom cell's padding, the px helpers, the
  `TypeError`, the heights following both options before the grid is on the page); scrollHandlers.test.ts
  (the fitted heights 52 / 37); multiline.test.ts +1 (the editor's line height), customCell.test.ts (the one
  line editor keeps the css's); configJson.test.ts and the typings consumer have the option
* browser (Chromium 1148, 1300x1400): new `.claude/browser-checks/scripts/multiline-lines-check.js`
  128/128 (light and dark: the multiline sample, every section, the pinned address, a one line cell of the
  row, 10 lines, the marker, the editor, a range and the focus, PageDown / PageUp, stacked fields, cellHeight
  30, a 14px font, the full grid sample); keyboard 52/52, full grid 11/11, find 68/68, fill 12/12, custom
  cells 39/39. Before / after screenshots in .claude/browser-checks/shots/multiline-lines
* worth knowing: the editor's textarea (six lines) is 96px high now, 105px with the css's 1.5 line height
  before; a row fitted before keeps its lines, it is shorter now with the same text shown

### The column numbers: Shift / Ctrl selection and a column menu (user request)

* the user: "column under filter should have context menu, support shift/ctrl like rows. context menu is
  copy column, copy selected columns, copy headers (all header names), copy column header names, copy
  selected header names"
* **the selection** (columnSelection.ts, a pure `clickColumn`): a number is a column of the layout - 1
  based across pinned left, center, pinned right, a column of stacked fields one number (as before, and
  as `getLayoutFields({ selectedOnly })` reads it). A click: that column only; Ctrl/Cmd+click toggles one
  (it was Ctrl only, no Cmd); Shift+click (new) the columns from the anchor - the last click without
  Shift - to it, added to what the anchor's Ctrl+click kept: Shift+click again moves the range, a range
  after Ctrl+clicks adds to them (the row selection drops those on a second Shift+click, and does not take
  Cmd - left as it is, see Candidates)
* **the API**: `getSelectedColumns()`, `selectColumns(numbers)` (a `TypeError` for a number that is no
  column) and the event `column-selection-change` `{ columns, fields }`, sent only on a change. The
  numbers are positions: the selection is cleared when the fields of the layout change (`layoutKey`, as
  the ranges) - it used to stay on the number, another column after a move. Kept on a resize, filter,
  sort, grouping, rebuild. Not state
* **rendering**: a selection change renders the numbers in place (`renderColumnNumbers`) instead of
  rebuilding the header and every row: the number with the focus keeps it
* **the focus and keys** (columnNumbers.ts): the number's cell has `tabindex="-1"`, a click focuses it
  (as the row numbers). Shift+F10 / the menu key: the column menu (the browser's `contextmenu`); Ctrl+C:
  the selected columns (the number's own with none), Esc: none selected (a menu open closes first)
* **the menu** (contextmenuColumn.ts, `MENU_IDS.column`, the hook `menus.column`, `MenuContext.menu`
  `'column'`): `column.copy.column`, `.selectedColumns`, `.namesSeparator`, `.headers`, `.header`,
  `.selectedHeaders` - flat, every entry is a copy. The selected entries are greyed out with none, as the
  row menu's. Columns are copied as the row menu copies rows (`columnsClipboard` -> `rowsClipboard`: tab
  separated text and an html table, the header line with `copyHeaders`), every displayed data row; the
  names are one line, tab separated, no line end and no html (`labelsClipboard`). Texts `column.copy.*`
* **for a screen reader** the numbers were `aria-hidden` ("for the mouse"); with the focus they can not
  be (a focusable element must not be hidden): they are a third header row, a `gridcell` per column at
  its first field's `aria-colindex`, `aria-colspan` over stacked fields, `aria-selected` true / false.
  Cells, not column headers, as the row numbers. `headerRowCount` counts it: every `aria-rowindex` under
  it is one more (the first data row is 4), the totals row too
* docs: guides 17 (Selecting columns, the column menu, the API), 10 (the menu, ids, hook), 12 (texts),
  14 (the header row, the keys, known limits - the tree example taken again from Chrome), 09 (the event);
  the ranges and selection samples; the Norwegian texts
* tests: columnSelection.test.ts (32: clickColumn, real clicks across the sections with Ctrl / Cmd /
  Shift, the look and the focus kept, the API and its TypeError, the event, cleared on a layout change and
  kept on the rest, Ctrl+C / Cmd+C / Esc / Shift+F10, the menu's ids, context, greyed out entries and hook,
  each copy's text and html with and without copyHeaders, a quoted label, stacked columns, group rows and
  a collapsed group). Changed on purpose: accessibility.test.ts (the third header row: every rowindex and
  rowcount +1, the "hidden numbers" test is now the row's test), gridMenus.test.ts (unique ids), texts
  tests (the column menu shown)
* browser (Chromium 1148, 1300x1400): new `.claude/browser-checks/scripts/column-menu-check.js` 81/81
  (light and dark: the clicks, the colour, header and rows lined up, Chrome's accessibility tree of the
  numbers, the menu by mouse, Shift+F10 and the menu key, each copy read back with the clipboard API,
  Ctrl+C, Esc, a layout change); menus regression 25/25, submenu 40/40, keyboard 52/52, full grid 11/11,
  row delete 6/6

### Filters: match case, the operators of each type, BETWEEN (user request)

* the user: "improve Advanced filter to support case sensitive filters? ... Maybe we should be able to set
  supported filter types, so one column is forced to be case sensitive? Some types only should be for text,
  some for numbers and some for dates, atm I think text might have too many"; then: a `BETWEEN` for
  numbers and dates, and the blank rules kept as they are (null, undefined, '' and 0 are blank, a boolean
  null is false). SQL helpers are to be built on the model next: its rules are written down exactly
* **the model** (filterExpression.ts): `FilterCondition.caseSensitive?: boolean`, `where(field, operator,
  value?, { caseSensitive })` (the property only when true, `assertOptions` for a boolean), `BETWEEN`
  (`value: [from, to]`, `where()` throws for anything else), `operatorsFor(type)` - one list per type, the
  grid's only source: text has EQUAL, NOT_EQUAL_TO, CONTAINS, DOES_NOT_CONTAIN, BEGIN_WITH, END_WITH, IN,
  NOT_IN, IS_BLANK, IS_NOT_BLANK; number / date / datetime EQUAL, NOT_EQUAL_TO, <, <=, >, >=, BETWEEN, IN,
  NOT_IN, IS_BLANK, IS_NOT_BLANK; boolean EQUAL, NOT_EQUAL_TO, IS_BLANK, IS_NOT_BLANK
* **the filter** (objectFilter.ts, filter.ts): a text compare of its own (`compareText`): both texts in
  lower case, or as they are with caseSensitive; the wildcards one regex without the `m` flag and with
  `s` - a text of several lines is one text (BEGIN_WITH was "a line starts with", EQUAL with a wildcard
  matched a line, NOT_EQUAL_TO left out a text whose line matched); the text `<` `>` without wildcards
  (with one it was EQUAL). IN / NOT_IN keep the list as it is with caseSensitive on a text field.
  BETWEEN is `>= from` AND `<= to` with each type's rules, a blank end open, from > to no row (as SQL)
* **fixed on the way**: a boolean's NOT_EQUAL_TO was taken as EQUAL - it is "not equal" now, and a blank
  boolean compares as false (EQUAL false finds it, the cell shows it unchecked). A condition with a blank
  value (null, undefined, '', invalid Date) and no valueField is ignored for every type - it was for dates
  only: a text condition without a value compared with the text 'undefined' ('null'), an empty text value
  input of the editor filtered to the empty rows, an empty number one to 0. The editor's empty value input
  is no value now
* **legacy operators**: kept as they filtered (CONTAINS / BEGIN_WITH on a number or date is >=, END_WITH
  <=, DOES_NOT_CONTAIN <; the text `<` `>`; a boolean's others EQUAL), not offered: a saved v5 filter or
  state keeps working, throwing would break restoring a view. The editor shows one and keeps it
* **the grid**: Filter › Operator › offers the column's operators the header input takes (new: Less than,
  Greater than, Between, Does not contain, Begins with, Ends with), "Match case" (`filter.matchCase`, a ✓,
  state `headerFilters[field].caseSensitive`), Blank › and the value list per the column's operators. The
  value list keeps case variants apart while Match case is on, its IN / NOT_IN match case. BETWEEN in the
  header is typed `from..to` (`10..`, `..20`, `10` = 10..10; placeholder `from..to`, the state value
  `[from, to]`). The filter editor: the picker offers the field's operators (a text's before a field is
  picked; a field of another type drops an operator it does not have), "Aa" per text condition
  (aria-pressed, the icon's room kept on the other rows so the rows line up), BETWEEN's From / To inputs.
  The footer: `Age between 10 and 20` (an open end `≥ 10`), "Aa" after a value that matches case;
  getFilterString `<<MATCH_CASE>>` and the value's own case, `'10' <<AND>> '20'`; getFilterTree
  `caseSensitive`, `valueTo`
* **the column options**: `filterOperators` (in the type's order; TypeError for another type's operator, an
  empty list, none for the header input) and `filterCaseSensitive` (the header filter, the value list, the
  row menu's filter and the editor always match case; Match case shown on, greyed out, "(always)"; text
  columns only). `operator` is checked now too: a header operator of the column. assertFilterOptions in
  the constructor and updateConfig. The lookup dropdown grid's CONTAINS default only on its text columns
* texts: `filter.operator.{lessThan,greaterThan,between,doesNotContain,beginWith,endWith}`,
  `filter.matchCase(.hint)`, `filterEditor.label.{from,to}`, `filterEditor.matchCase(.tooltip)`,
  `filterEditor.matchCaseAlways.tooltip`, `filterEditor.operator.BETWEEN`, `footer.betweenAnd`,
  `footer.matchCase(.tooltip)`, `footer.operator.BETWEEN`, `filter.placeholder.between`,
  `filterString.operator.BETWEEN`, `filterString.betweenAnd`, `filterString.matchCase`; the Norwegian sample
* docs: guide 06 (the header filters, Match case, the operators a column offers, the editor, the format and
  what is ignored, Operators rewritten per type with SQL sketches, BETWEEN, IN, case, legacy, the blank
  table), 02, 03, 10, 12, 20; the filtering and operator samples
* tests: filterOperatorsByType.test.ts (60: every operator x type, with and without caseSensitive,
  wildcards, lines, IN and NULL, blanks, BETWEEN ends, legacy, ignored, string / tree, JSON),
  filterCaseAndOperators.test.ts (41: the menus, Match case and its state, the forced column, the value
  list, lookups, filterOperators, the config checks, header BETWEEN, the footer, the editor's toggle,
  pickers and BETWEEN). Changed on purpose: filterEditor (the toggle in a row, the number order), gridMenus
  (the new ids), texts, configJson (the options as JSON), the tree nodes' `caseSensitive`
* browser (Chromium 1148, 1300x1400): new `.claude/browser-checks/scripts/filter-case-check.js` 73/73
  (light and dark); filter-ui 117/117 (two checks follow the change: Match case in Filter ›, the number
  order in the editor), value list 51/51, filter editor undo 72/72, lookups 55/55, find 68/68, menus
  regression 25/25, submenu 40/40

### Touch: swipes with momentum, the long press, menus for a finger (user request)

* the user: "touch support needs to be better". Looked at with Chromium's touch emulation (a phone, 390 x
  844, and a 1300 x 1400 touch screen), the touches sent with CDP `Input.dispatchTouchEvent`: a swipe of
  300px scrolled the rows 435px (it read `scrollTop` from the synced view, a frame behind) and 38px
  sideways, at the first row a swipe down moved neither the grid nor the page, the focus went into the
  grid and out again on every move (28 times in a swipe of 30 moves), no momentum; a long press did
  nothing (Chromium on Linux sends no `contextmenu` for it, nor does Safari on iOS; the click after it
  acted on the cell); the column chooser could not be scrolled by a finger and its dragged field was
  under it
* **swipes** (touchScroll.ts, out of addScrollEventListeners.ts): read from and written to the two
  scrollers themselves. A press until the finger moved `TOUCH_SLOP` (10px), then locked to the axis it
  moved the most on (`lockAxis`, a tie is up/down) and the content follows the finger from that point -
  as Chromium starts its own scroll after its slop, no jump. The focus leaves the cell once a swipe: the
  focused element is blurred (not the old focus + blur of the hidden input on every move: focusing an
  input can show a phone's keyboard). Two fingers end the swipe and are the browser's (a pinch zooms)
* **the page or the grid**: decided when the axis is locked - the grid takes the swipe when it can
  scroll that way and cancels its touchmoves to the end, else nothing is canceled and the page scrolls
  (as a browser's scroll box hands a swipe on at its edge, `overscroll-behavior: auto`). Latched, as a
  browser latches a swipe to one scroller: the page does not take over halfway. The moves before the
  lock are canceled too; checked in Chromium that a canceled touchmove does not keep the browser from
  scrolling the page on the moves after it (and that Chromium sends no touchmove inside its own slop,
  ~38px in the emulation; the pointermoves come)
* **momentum**: the finger's speed over its last 100ms (`fingerVelocity`), then a frame at a time
  (requestAnimationFrame) `distance = v x dt`, `v x 0.998^dt` (iOS's normal deceleration: 1px/ms coasts
  ~500px, ~2s), a frame at most 50ms. Stops below 0.02px/ms, at the end of the rows / columns, on a new
  touch, when the grid is destroyed. The tap that stops it is no tap (its touchend canceled): no cell is
  clicked, as on a phone's lists
* **the long press** (longPress.ts, `addLongPress(root, signal)`, delegated: on the grid element, so the
  cells, labels, filter row and the column numbers - and an app's own `contextmenu` listener - have it;
  one line for an element in a popover of its own): 500ms held within 10px dispatches a `contextmenu`
  PointerEvent (`pointerType: 'touch'`, button 2) on the element the finger went down on, at its point -
  the handlers are the right click's, unchanged. One menu: the browser's own `contextmenu` while the
  timer runs (Android) stops the timer; the browser's after ours, finger still down, is canceled and
  stopped in the capture phase; a handler that sends it on inside ours (the label cell to its label)
  passes. The lift after a long press that opened a menu (the event canceled) is no tap: its touchend is
  canceled - checked in Chromium that this drops the mouse events and the click (else the click closed
  the menu and focused the cell). A long press on an element without a menu (a row number) stays a tap
* **the label**: the 200ms hold makes a drag first; a `contextmenu` on the field during the press (the
  long press at 500ms, a right click during a mouse drag) ends it - no drop, no sort, the ghost gone
* **the column chooser**: its fields `touch-action: pan-y` (a new `touchAction` of dragEvent), so the
  list pans; held still 200ms a field drags and its touchmoves are canceled - the list does not pan under
  it. The ghost of every drag is a `popover="manual"` now, shown after the chooser: the top of the top
  layer, over the chooser and over a dialog the grid is in (on the body it was under both); css resets the
  browser's popover style for it
* **menus**: a finger touching the page outside the open menu closes it on its pointerdown (a swipe and
  a long press have no click). A tap on a submenu item already opened it (mousemove + click of the tap:
  showMenu.ts as it was). `@media (pointer: coarse)`: menu and submenu items, the chooser's fields,
  search and Close, the value list's rows and search, the menus' search, the buttons of the value list
  and the filter editor 36px; the chooser and value lists up to `min(360px, 50vh)`; the filter editor's
  edges 10px and corners 20px (were 5 / 12). `touch-action: manipulation` on the grid: a double tap is
  the cell's dblclick (the multiline and lookup editors), not a zoom
* checked, nothing to change: a tap on a readonly cell focuses an input that is `readOnly` (no keyboard);
  a tap on a row number selects; a tap on a date cell opens the picker; the filter editor moves and
  resizes with a finger (pointer events, `touch-action: none` on its titlebar and handles)
* docs: guide 01 (a Touch section), 10 (With a finger, closing), 02 (the long press on a label, the
  chooser), 14 (the swipe blurs the cell), 17 (a long press is the row menu)
* tests: longPress.test.ts (15: the timing with fake timers, the slop, let go / pointercancel, mouse and
  pen, a second finger, the touchend canceled or not, the browser's contextmenu before / after ours, a
  forwarded one, a removed element, the signal; in a grid the row, filter, column number and header
  menus, the drag ended), touchScroll.test.ts (21: lockAxis, canScroll at the ends and half a px,
  fingerVelocity, momentumStep and the whole coast, a swipe on a grid - lock, axis, the page's at the edge,
  latched, two fingers, the focus once, momentum with faked animation frames, stops at the end, none after
  a still finger, a tap stops it and is no tap, destroy stops it, the header); columnDragDrop.test.ts +2
  (the chooser field pans until held, then its moves are canceled and it drops; contextmenu ends the
  drag) and the ghost is a shown popover; gridMenus.test.ts +2 (a touch outside closes, the chooser's
  pan-y). Changed on purpose: the swipe tests of columnDragDrop / columnResize move twice (the first move
  locks) and give the scrollers room (`stubScrollSize`: happy-dom's scrollHeight is 0, a grid that can not
  scroll leaves the swipe to the page). 2781 -> 2821 tests
* browser (Chromium 1148): new `.claude/browser-checks/scripts/touch-check.js` 61/61 (the phone: swipe,
  axis, page not along, focus once, momentum coasts and stops, a tap stops it without a click, sideways,
  the page at the edge, two fingers zoom; the long press on a cell / label / filter / column number, no
  menu before 500ms or after a move, one menu with the browser's contextmenu before or after ours, no
  focus, no sort, the menu at the finger, submenu and item by taps, a tap outside closes, a row number
  still selects; a touch screen: 36px items, the chooser scrolled, dragged with its ghost on top and
  dropped, the filter editor moved and resized, the date picker, a double tap's editor without zoom, a
  readonly cell; the mouse: 20px items, a held button opens nothing, a right click one menu, a column
  dragged and dropped). The same check on the build before: 11/20 before it stopped (no long press).
  Submenu 40/40, menus regression 25/25, keyboard 52/52, find 68/68, fill 12/12, full grid 11/11,
  column menu 81/81

### CI: a test timeout of 30s

* the checks workflow failed on GitHub (run 45007887955, 3aa7a70): `customCell.test.ts` "one mount per cell
  element: 1000 rows scrolled" timed out at vitest's default 5s. Here the slowest tests take 2-3.3s with two
  workers (texts.test.ts' every-text tests, the docs site's every-guide test, the 1000 rows scrolled); GitHub's
  runners are slower. `testTimeout: 30_000` in vitest.config.ts: room on the runners, a test that hangs still
  stops. All 2922 tests pass with `npx vitest run` as the workflow runs it
* seen too, changed 2026-11-24 (v7): the run warns that actions/checkout@v4 and actions/setup-node@v4 target Node 20,
  which GitHub forces onto Node 24 now (v7 of both is out)

### SQL from the filter: `@simple-html/grid/sql` (user request)

* the user: "we also want helper functions to turn a filter into sql postgres, oracle, sqlite, mssql, so its
  easy for others to do in backend, only where clause. sql injection is important here"
* **the API**: `toSqlWhere(filter, { dialect, columns, timeZone?, dateStorage?, firstParam?, limits? })` ->
  `{ sql, params }`, as proposed. `filter` is `unknown` (JSON from a browser, checked); `columns` is the
  whitelist, `'column'` or `{ column, type, dateStorage?, booleanValues? }`. One function, no builder: the
  options are checked on every call (a typo like `timezone` throws, so a wrong config fails the first
  request, not silently). Placeholders `$1` / `:1` / `?` / `@p1`, names `"x"` / `[x]`
* **a separate entry**: `src/sql.ts` holds the whole public API (types + the function), the code is in
  `src/sql/` (buildWhere, dialects, sqlDates, show) and uses only the datasource's filter rules
  (filterExpression, objectFilter - `rangeOperator` exported @internal for it, isBlank). build.js bundles it
  with esbuild into `dist/sql.mjs` + `dist/sql.cjs` (fails the build if anything else gets in) and copies
  the one-file typings to `sql.d.mts` / `sql.d.cts`; `exports["./sql"]` has `import` / `require`, each with
  its `types`. Proved from `npm pack`: installed into a scratch folder, `node -e "require(...)"`, an ESM
  import, a `.cjs` script that runs the SQL in node:sqlite, and tsc with `node16` (resolves sql.d.mts /
  sql.d.cts; lib es2022 only, no @types/node, skipLibCheck false) and `bundler`. `check:typings` runs
  `scripts/typings-consumer/tsconfig.sql.json` (node16, through the package's own exports) too
* **decisions**:
  * no condition left -> `1=1` (valid after WHERE everywhere); an empty IN -> `1=0`, NOT_IN -> `1=1`. The SQL
    is one term (brackets when it has parts): `AND ${sql}` is safe
  * **two-valued**: each condition decides the null rows itself, `col IS NULL OR ...` / `col IS NOT NULL AND
    ...`, and which one is the grid's answer for a blank row - `objectFilter({ value: null }, ...)`, the
    grid's own code, when the SQL is made. `NOT (sql)` is the other rows exactly (tested on SQLite for every
    filter)
  * **numbers**: the blank-is-0 decided at build time instead of `COALESCE(col, 0)`: the same rows, the
    column's index used. PostgreSQL: a parameter takes the column's type (pg sends text), so a number that is
    not whole is `CAST($n AS numeric)` (`'12.5'` fails on an integer column); whole numbers bare
  * **text**: LOWER both sides (UPPER for IN, as the grid), the database folding both - self-consistent
    (`'Æ'` finds `'Æ'` on SQLite, where JS-folding the value would not). Patterns: LIKE `ESCAPE '!'` on
    PostgreSQL / Oracle (only `%`, `_`, `!` may follow it on Oracle, ORA-01424), GLOB on SQLite (its LIKE can
    not keep case; literals in brackets), LIKE in `Latin1_General_100_BIN2` on SQL Server with bracket escapes
    (`=` ignores trailing spaces and follows the column's collation; nvarchar LIKE counts them;
    `DATALENGTH` for the blank). Oracle never compares with `''`. A number / Date / boolean value on a text
    column throws (the grid would compare numbers; a cast in SQL can fail). Legacy `<` `>` on text in a
    binary collation (`COLLATE "C"`, `BINARY`, BIN2; Oracle's default NLS_COMP=BINARY)
  * **dates**: `timeZone` (IANA, required with a date column) is the user's; a date is a range
    `[start, next)` of the day / second, index-friendly. `dateStorage` says what the column holds: `local`
    (default, the wall clock of timeZone), `utc`, `zoned` (instants: timestamptz, datetimeoffset, TSTZ, ISO
    with Z), `epochSeconds`, `epochMillis`. Parameters are text with an explicit conversion, no session
    setting involved: `CAST($1 AS timestamp|timestamptz)`, `TO_DATE` (not TO_TIMESTAMP: a DATE column
    stays indexed) / `TO_TIMESTAMP_TZ`, `CAST(@p1 AS datetime2(0)|datetimeoffset(0))` with the `T` form
    (DATEFORMAT-proof), `julianday(col) >= julianday(?)` on SQLite (every ISO text form; an expression index
    works). Wall clock <-> instant with `Intl.DateTimeFormat` and JavaScript's rules (`new Date(y, m, d, h)`:
    a skipped time moves on, a repeated one is the first). Date-only text in a comparison is UTC midnight,
    as the grid's `new Date('2026-11-22')`; in an IN list it is that local day (the text the grid shows).
    Years 1000-9998
  * **booleans**: true/false on postgres and mssql, 1/0 on oracle and sqlite, `booleanValues` for `'Y'/'N'`
  * **IN**: 'NULL' / null are the blanks; numbers compare as numbers, dates as days / seconds, booleans
    TRUE/FALSE/NULL. Oracle lists split at 1000; SQL Server matches each text with LIKE (trailing spaces)
  * **valueField**: number (COALESCE 0 both sides), text (EQUAL, NOT_EQUAL_TO, comparisons; a blank is '';
    patterns throw), boolean, date (needs `local`: the day of an instant needs the time zone) / datetime (as
    stored). Different types or storages throw
  * **strict where the grid is lenient**: unknown operator, `'or'`, unknown properties, 'abc' on a number,
    a malformed BETWEEN, non-ISO date text, NUL and lone surrogates -> TypeError. A condition the grid
    ignores (no field / operator / value) is left out, but a field not in `columns` always throws
  * **limits** (RangeError): depth 10, conditions + groups 100, IN list 1000, text 1000, params 2000 (SQL
    Server: 2100 per request). Messages show at most 40 characters of the input
* **the differences from the grid**, documented in the guide's table and tested where they are: non-ASCII
  case (SQLite folds ASCII only), IN on numbers / dates (the grid compares formatted text), a datetime stored
  as an instant in the repeated hour (the SQL takes the first 02:30), datetime valueField milliseconds, text
  valueField wildcards, SQL Server `=` in a text valueField, UTF-16 vs code point order past U+FFFF
* docs: `guides/22-sql.md` (the API, the security model and what the caller still must do, each dialect and
  its driver, every type, dates and time zones, the differences, a client + Express example), links from
  guide 06; the API pages have an `@simple-html/grid/sql` group (typedoc gets both entry points,
  `scripts/site/api.js` reads the modules); the demo sample "SQL from the filter" (`#sample/sql`): the
  WHERE and params of the four dialects under a grid, live as it filters, the error of a field that is not
  a column. Paths for `@simple-html/grid/sql` in tsconfig.json, samples/tsconfig.json, the dev server's
  checker and check:docs
* tests (125, in `src/sql/__tests__`): sqlSqlite.test.ts (6) - **the grid's Datasource against node:sqlite**,
  400 rows with blanks, case, lines, wildcards in the data, numbers around 0, null booleans, dates around
  midnight and both DST changes in Oslo stored five ways (wall clock text, UTC text, ISO with Z, epoch ms,
  epoch s): 13 526 filters (every field x operator x value x case, BETWEEN / IN / NOT_IN with blanks, every
  valueField pair, 3 000 random nested groups), 84% of them selecting some rows but not all, each also run
  as `NOT (sql)`; three mutations of the code (blank text, date-only text, the DST gap) each fail it.
  sqlDates.test.ts (27): the clock against JavaScript's Date in 13 time zones (Oslo, New York, Santiago,
  Sao Paulo's skipped midnight, Havana, Lord Howe, Kolkata, Chatham, St Johns, Apia's skipped day, Dublin,
  Casablanca, UTC), the ISO reading. toSqlWhere.test.ts (67): a snapshot per dialect of every operator x
  type x case, and each rule. sqlInjection.test.ts (25): hostile values (quotes, comments, backslashes,
  `%` `_` `[` `!`, unicode quotes, NUL, 1000 characters) in a strict token grammar of the SQL and as data in
  SQLite, hostile fields and columns, `__proto__` / `constructor`, a polluted prototype, 46 wrong shapes,
  a getter read once, the limits (100 000 nested groups stop at the depth), a seeded fuzz of 20 000 JSON
  values (only SQL of the grammar, a TypeError or a RangeError)
* browser (Chromium 1148, 1400x1000, Europe/Oslo): the sample and the guide, light and dark - no filter
  `1=1`, the buttons, the date in the browser's zone, the hostile text only in the params, the error of a
  field that is not a column, a header filter typed in, the sample in the guide: 17/17, no page errors (the
  script is in the session's scratchpad: the shared browser-checks folder is outside this worktree)
* not done, open: no PostgreSQL / Oracle / SQL Server server here, their SQL is checked as text against
  their docs (the guide links each); SQL Server `Latin1_General_100_BIN2` on a varchar column of another
  code page; Oracle with NLS_COMP=LINGUISTIC or a case-insensitive column collation follows that; no second
  truncation for a datetime valueField (needs a function per dialect and type); a `Date` in an IN list is
  read as its day (the grid matches nothing)

### Multi-select with a finger: taps toggle, Select › in the row and column menus (user request)

* the user: a finger has no Shift or Ctrl, so on a phone only one row / column could be selected and no
  range of cells at all - and the menu entries of a selection ("Copy selected rows", "Copy selected
  columns", the range entries) stayed greyed out. Decided by the user: a tap toggles like Ctrl+click, the
  menu is the finger's Shift and Ctrl (for every input), the row numbers get the row menu
* **a tap toggles** (lastPress.ts, new): a finger's tap on a row number toggles the row as Ctrl+click
  (`Selection.toggleRow`, 'multiple' mode; in 'single' a tap selects as a click), on a group row's number it
  adds the group's rows, on a column number it toggles the column in every mode (the columns have no mode,
  Ctrl+click selects more in every mode). The mouse and the pen unchanged. How a tap is told: checked, not
  guessed - MDN browser-compat-data `api.Element.click_event.type_pointerevent`: `click` is a PointerEvent
  in Chrome 92, Firefox 129, Safari 18.2 (iOS mirrors); Chromium 131 here: a tap's click is a PointerEvent
  with `pointerType: 'touch'`, a mouse click `'mouse'`, `element.click()` `''`. Before those versions the
  click is a MouseEvent: the pointerType of the last pointerdown in the grid (`ctx.lastPress`, a capture
  listener) is taken
* **the row numbers have the row menu** (`contextmenuRowNumber`): right click, long press (longPress.ts
  dispatches `contextmenu` on the number - delegated, no change there), Shift+F10. `context.field` is `''`,
  `context.cell` the number's cell; the entries of a cell and its column are greyed out (Undo cell edit,
  Copy › Cell Value / Column, Paste cell and Clear cell both, Filter ›, Fit column to this cell, the cell
  entries of Select ›). A group row's number has none (its long press stays a tap)
* **Select › in the row menu** (after Undo / Redo ›): This row (a checkbox item), Rows from N to here
  (`Selection.selectRowsTo`, N the anchor `Selection.getAnchorRow()` - greyed out without one (N is this
  row then), on it, in 'single'), All rows, a line, Range from the active cell to here (Shift+click on a
  cell), Add this cell to the ranges (Ctrl+click), a line, Clear selection (the rows and the ranges).
  Greyed out when they can do nothing, not hidden; in 'none' mode the rows' entries and their line are
  hidden. **In the column menu**: Select › first, a line, then the copies - This column, Columns from N to
  here, All columns, Clear column selection. Texts `row.select.*`, `column.select.*` (English, the
  Norwegian sample)
* **the active cell of a menu**: a right click moves the focus to the cell clicked first (its mousedown,
  measured in Chromium: the focus moves, the ranges stay - the `skipFocus` of a right mousedown), so with
  the mouse "Range from the active cell to here" was always the cell itself. The cell with the focus when
  the pointer went down is kept (`ctx.lastPress.active`); after a key (Shift+F10) the cell with the focus
* **one model of Shift and Ctrl on a cell**: `shiftRangeStart`, `shiftRanges`, `ctrlRanges` (and
  `samePoint`, `oneCell`) moved to cellRanges.ts; rangePointerDown and the menu use them
* **a bug fixed on the way**: Ctrl+click then Shift+click on a row above the anchor selected nothing
  (`selectRange(anchor, row)` counted up from the anchor) - the path a finger takes (tap, then Rows from N
  to here). Either way now
* docs: guide 17 (With a finger: taps, both Select › tables, how a finger makes a range; the column menu,
  the row number's menu, Known limits), 10 (the menus, the trees, the Select › ids, the row menu of a row
  number, With a finger), 01 (Touch: Selecting), 12 (the texts), 14 (Shift+F10 on a row number); JSDoc of
  MENU_IDS (tree and tables), MenuContext, GridMenus, Selection, the files
* tests: selectMenu.test.ts (36: taps on row numbers - Chromium's PointerEvent click and the MouseEvent
  fallback, 'single', the mouse and the pen and a click without a pointer unchanged, a group row; taps on
  column numbers in every mode; the row menu of a row number - context, greyed and usable entries, Delete ›
  Row, no menu on a group row, the long press; every Select › entry - enabled / greyed, the label's N,
  what it selects, the anchor rules, 'single' and 'none', the events, Copy › Row / Range / selected
  columns usable after; the active cell of a long press, a right click and Shift+F10; the model of Shift
  and Ctrl); selectionModifierKeys.test.ts +7 (the anchor, toggleRow, selectRowsTo, Shift after Ctrl above
  the anchor). Changed on purpose: gridMenus (Select › in the row menu's shape, the first item), column
  selection (Select › in the column menu), rangeClipboard (menuItem('Row') found "Rows from …": by id
  now), MENU_IDS and the texts guide. 3047 -> 3090 tests
* browser (Chromium 1148): new `touch-select-check.js` 66/66 - a phone (390 x 844, CDP touches), light and
  dark: taps toggle rows and columns, the long press on a row number (the row menu, the lift selects
  nothing, the cell entries greyed), Rows from N to here, Copy › Row usable, This row, All rows, Clear; a
  range by a tap and a long press, Add this cell, Copy › Range usable, Clear; the column Select ›; the mouse:
  a click replaces, Ctrl+click adds, the row number's menu, a right click's active cell, Shift+click after
  it. touch-check.js 61/61 and column-menu-check.js 81/81 with their expectations changed on purpose (a
  long press on a row number opens the menu now; Select › is the column menu's first entry - the changed
  copies are in this worktree's `.claude/browser-checks/scripts/`, the shared folder is outside it);
  submenu-check.js 40/40, menus-regression-check.js 25/25
* open: a second Shift+click after Ctrl+clicks (or taps) drops the rows they selected - the rows' Shift
  keeps no `kept` as the column numbers do (in the candidates); a Cmd+click on a row number still does not
  toggle (`highlightRow` reads `ctrlKey`)

### SQL: a value folded before it is bound (user request)

* the user, on `UPPER("country") IN (UPPER(:1), UPPER(:2), ...)`: "running so many UPPER is prob not
  perfect ... maybe it should do a uppercase in js, before sending to params". A value of ASCII characters
  only is folded in JavaScript now (`foldedParam`, buildWhere.ts): `UPPER("country") IN (:1, :2)` with the
  params `['FINLAND', 'FRANCE']`, `LOWER("name") LIKE $1` with `'%an%'`. The dialects fold the column only
* not every value: JavaScript and the database fold some letters differently - `'Straße'.toUpperCase()` is
  `STRASSE`, PostgreSQL's and SQL Server's `UPPER('ß')` is `ß`, SQLite's `UPPER()` folds ASCII letters only
  (`'Ærø'` stays `ÆRø`). Folded in JavaScript, a text would no longer match the same text. So a value with
  a letter that is not ASCII is folded by the database, as its column: `UPPER(:3)`. A to Z fold the same
  everywhere, except in a Turkish collation (`i` / `I` are no pair there) - in guide 22
* the results are the same: the SQLite comparison (13 526 filters, and NOT of each) passes unchanged; a new
  SQLite test with `Ærø`, `ærø`, `Straße`, `STRASSE`: the same text matches, an ASCII value every case of it,
  and SQLite's own limit (`Ø` is no `ø` there) stated. toSqlWhere.test.ts: the expectations and the four
  snapshots (only the `LOWER()` / `UPPER()` around parameters gone), a test of the non-ASCII values. 3092 tests

### Docs site: every sample grid shows 15 rows (user request)

* the user: "sql sample grid need to have a min height, so we can see some rows" (in the SQL guide the grid
  was its header only) and "all samples should show at least 15 rows of height". In a guide a sample's stage
  was 460px high for everything in it: a sample with a log or the SQL under its grid squeezed the grid
* `.demo-grid-host` is at least 15 rows of 22px high with the grid's default heights around them
  (`--demo-grid-height`), the full page sample the larger of that and the window. A guide's stage is as high
  as its parts, its grid host has that height of its own (the grid fills its host: a host without a definite
  height gave it none). A sample with more around its rows (stacked labels, a totals row) is topped up once
  rendered: `fitSampleGrids` in pages.ts, from the height of the grid's rows
* browser: new `.claude/browser-checks/scripts/sample-height-check.js` 5/5 - every grid of the 55 sample and
  guide pages (65 grids) shows 15 rows or more, at 1400x900 and 1000x600; before: 4 grids 13 rows, and the
  guides' with a log or SQL fewer

### Menus: a block in use closes the submenu beside it (user request)

* the user, on the filter menu with Filter › open beside the value list: "when I start using other parts of
  filter, then filter menu should close". Only another item closed an open submenu; the value list is a
  block, not an item. `watchBlock` (showMenu.ts): the block taking the focus (its search clicked or typed
  in, Tab into it) or a press (a checkbox) closes the submenu open in its menu at once; the pointer resting
  on it closes it after `SUBMENU_DELAY`, as on an item without a submenu, and the pointer crossing it into
  the submenu keeps it (entering the submenu stops the timer). Back on Filter › it opens again
* tests: gridMenus.test.ts +4 (focus, press, resting pointer, crossing pointer). Browser: new
  `.claude/browser-checks/scripts/filter-submenu-close-check.js` 17/17 (light and dark, the Filtering
  sample); submenu 40/40, menus regression 25/25, value list 51/51, filter ui 117/117, filter case 73/73

### Docs site: the sidebar indented by level (user request)

* the user, on the sidebar: "sub parts of menu need to have more indenting, so its easier to read". The
  section titles, the groups (Getting started ...) and the pages were all 16px in. Now a section 16px, its
  groups and its own pages (the guides) 28px, a group's pages 44px - past the group's arrow, so the sidebar
  reads as a tree. Checked in Chromium, light and dark, every part unfolded

### Menus: a drop shadow (user request)

* the user: "all menus should prob have drop of shadow, so its more typical like a menu". The menu had one
  (`10px 5px 5px black` on `.simple-html-grid-menu`), but its popover - exactly its size, `overflow:
  hidden` from `.simple-html-grid`, the scroll box of a long menu - clipped all of it: none showed. The
  shadow is on the popover now (`.simple-html-grid.simple-html-grid-popover`), which an element's own
  overflow does not clip: every popover of the grid has it - the menus and submenus, the column chooser,
  the date picker, the lookup's dropdown, the multiline editor. Softer, as a menu's: `2px 4px 12px`,
  `--simple-html-grid-menu-shadow-color` light `rgba(0, 0, 0, 0.28)`, dark `rgba(0, 0, 0, 0.6)` (was
  `black` in both). theme.test.ts and guide 13 follow
* checked in Chromium (light and dark, a menu with its Copy › submenu; the computed shadow of both
  popovers); submenu 40/40, menus regression 25/25

### The footer: "No filter" opens the filter editor (user request)

* the user, of the footer without a filter (only `500/500`): "in bottom it should probably be button like
  clear, but says no filter when there is no filter, so its easy to click on to enter advanced without
  going through menus". Without a filter (no filter tree, not "changed rows only", no Find "Filter rows")
  the footer has a button **No filter** in Clear's place: a click, Enter or Space opens the filter editor
  (`openFilterEditor`, as the chips and the menu's Advanced Filter… do). Texts `footer.noFilter` (`No
  filter`), `footer.noFilter.tooltip` (`Open the filter editor`), Norwegian in the translation sample
* the layout: the one of a filter, always - the count in the horizontal scrollbar's band at the top, the
  button on the line under it, where Clear and the chips are. Nothing moves when a filter comes or goes
  (the count was in the middle without a filter, at the top with one). The look of Clear (square, the same
  border and colours); under the pointer the hover of the grid's buttons
  (`--simple-html-grid-main-bg-selected-even`), not Clear's red. `.footer-inner` has `no-filter` (with a
  filter `has-filter`, as before), the button `.footer-filter-none`
* **one button**: Clear and "No filter" are the same `<button>` (lit keeps it, its class, text, title and
  click change), so the focus stays on it when the filter comes or goes: Enter on Clear leaves the focus
  on "No filter", and the filter editor opened with "No filter" gives the focus back to it when it closes -
  after Apply & close that is Clear. Two buttons lost the focus to the body (the button that had it was
  removed). It got `type="button"` (Clear had none: a submit button in a form)
* when it is not shown: only a footer of no height (`footerHeight: 0`, the dropdown grid of a lookup
  column): nothing would show it, and Tab skips the footer there (tabExit.ts). Not tied to `readonly`
  (filtering is not editing) nor `hideFilter`: with the header filters hidden the filter menu can not be
  opened, the button is then the way into the editor. No option: the grid can always open the editor (the
  chips do); an option to hide it can be added if an app asks
* the summary of the selected cells (it is on the filter's line): on a narrow grid it was painted over the
  collapsed chips, and over the count without a filter (380px). Now it is cut where the filter's line
  ends (`fitSummary` in rebuildFooter.ts, 12px apart; its tooltip has all of it), after the chips collapse
  as before; its width from the css again before each paint (lit keeps the element, the inline max-width
  would stay)
* Tab: the button is a stop of the footer as Clear is (`footerStops` takes every button): Tab from the last
  cell of the last row (or the last header filter with no rows, or the last group row) gets to it, Tab on
  it leaves the grid, Shift+Tab goes back to the last row. Before, Tab there left the grid at once
* tests: gridFooter.test.ts +11 (the button, a click opens the editor, gone with a filter / changed rows
  only / Find's filter rows and back after Clear, one element keeping the focus, the count's band with and
  without a filter, with `hideFilter`, none with `footerHeight: 0`, the config's texts, the summary cut /
  given back); accessibility.test.ts +2 (Tab to it and out, its name) and 5 changed on purpose (Tab from the
  last cell / last group row / last header filter with no rows now stops at "No filter" before leaving; no
  stop in a footer of no height with and without a filter); find.test.ts and rowStatus.test.ts 1 each (the
  footer after Clear has "No filter"). texts.test.ts sees both ids. Browser: new
  `.claude/browser-checks/scripts/footer-no-filter-check.js` 52/52 (light and dark: under the count, a
  button named "No filter", 4.5:1, click / Enter / Space open the editor and Cancel / Esc give the focus
  back, a filter built in the editor and applied: Clear and the chip, the focus on Clear, the count not
  moved; Enter on Clear: "No filter" with the focus; Tab in and out; `footerHeight: 0`; the summary apart
  at 1300px and 380px with and without a filter; the full grid; the Norwegian texts); footer summary
  11/11, filter ui 117/117, find 68/68, keyboard 52/52, full grid 11/11
* docs: 06-filtering.md (the footer, the editor opens from it), 14-accessibility.md (Tab order, keys, what
  a screen reader gets), 12-texts.md, 17-selection-and-clipboard.md (the summary is cut), 02-grid-config.md
  (`footerHeight`), JSDoc of `footerHeight`, `openFilterEditor()`, tabExit.ts, rebuildFooter.ts

### Filter menu: a range block for numbers and dates (user request)

* the user, on a date column's filter menu (only `Filter ›`): "date and numbers should have a easy way to set
  between/greater/less in menu ui". A text column had the value list as the main tool of its menu; a number
  or date column had to go through Operator ›, then type in the header filter (`10..20` for Between)
* `filter.range` (contextmenuFilter.ts `rangeBlock`), a `MenuBlock` under Filter › where the value list is for
  text, for number, date and datetime columns - not text and lookup columns (the value list), not boolean (the
  header checkbox): a row of the operators of Operator › (`headerOperators`: the type's, or `filterOperators`,
  in the type's order) as square buttons - `=` `≠` `<` `≤` `>` `≥` and `Between`, the one picked filled with the
  accent colour, no rounded corners, colours only the grid.css variables - then one input, From and To (a
  label each) for Between, then Cancel / Apply. As wide as the value list (220px)
* the operators are native radios (one group per grid, `ariaIdPrefix`) inside labels that are the buttons: one
  stop of Tab, the arrows pick another one - the browser's, checked in Chromium. Named by the texts of Operator
  › (`filter.operator.*`, the group `filter.operator`), which are their tooltips too (`data-tooltip`,
  attachTooltips on the block, `tooltips: false` respected); the symbols are no texts, Between shows its text.
  Picked with the mouse (`ctx.keyboardUsed` false) the focus goes on to the input: a click, the value, Enter
* prefilled from the header filter: its operator (getHeaderFilterOperator), its value as the cell shows it -
  a BETWEEN's ends in From and To. Picking Between takes the value as From, another operator after it the
  first end (as filterCallback does with a `[from, to]`)
* Apply (Enter in an input or on an operator) is the typing path, not a second one: the operator - only when it
  changed, so a default operator is not stored where typing would not store it - with
  `__setHeaderFilterOperator` and the `filter-operator-change` event (`operatorPicked`, shared with Operator ›);
  the value as typed text through `filterCallback` (`from..to` for Between, an empty end open, `..` / empty no
  filter); the header rendered again. So the state, the cell, the chip, getFilterString() are what typing gives
  (a test compares both ways for every operator of a number, a date and a datetime). Cancel / Esc / a click
  outside: nothing filtered
* the date picker is not offered in the block: opening it is opening a grid menu, which closes the filter menu
  (one menu at a time). Dates are typed in the format of the placeholder; the header cell keeps its picker
* on the way: `closePopover` hides a tooltip shown in the menu it closes (`hideTooltipIn`, tooltip.ts): a
  tooltip left in a closed menu kept the menu - and its grid - in memory until the next tooltip
* texts `filter.range.value`, `.from`, `.to`, `.run`, `.cancel` (English, the Norwegian sample); MENU_IDS.filter
  `filter.range` after `filter.values`; touch (`pointer: coarse`): the operators and inputs 36px
* docs: guide 06 (The header filter menu, a new "The range block", BETWEEN), 10 (the menus, keyboard, touch, the
  id), 12 (the texts, a section "The range block"); JSDoc of MENU_IDS, MenuBlock, GridMenus, the
  `filter-operator-change` event, contextmenuFilter.ts
* tests: new filterRangeBlock.test.ts (50): where it is shown (number, date, datetime - not text, boolean, a
  lookup on a number), MENU_IDS / the defaults, the hook removing and replacing it; the operators (order,
  names, tooltips, radios), `filterOperators` and `operator`; placeholders; prefilled (typed, Operator ›,
  BETWEEN with an open end, a date, a state from JSON); Apply = typing for the 7 operators x number / date /
  datetime (state, cell, filter, rows, chips, getFilterString, events); a date's day; Between both ends and each
  open end; empty clears, the rest of the filter kept; Cancel, Esc (the focus back), Enter in To and on an
  operator, not the Enter of a composition; the draft (Between takes the value, back takes the first end); the
  focus after a mouse pick and a keyboard pick; Tab in / Shift+Tab out, the submenu closing; the tooltip gone
  with the menu, `tooltips: false`. Changed on purpose: gridMenus.test (the text column's tree has no
  `filter.range`), texts.test (the range block's From and To opened). 3096 -> 3146 tests
* browser (Chromium 1148): new `range-block-check.js` 81/81 (light and dark, 1300x1400, the Filtering sample):
  Age `>` 30 with Enter (rows, cell, state, chip `Age > 30`), Between 30..40 with Apply (chip `Age between 30
  and 40`), reopened prefilled, To emptied (`30..`), emptied (no condition), Esc; the Filter › submenu closed by
  the block; date ≥ and Between a month, the header's date picker still there; the keyboard (Shift+F10, Tab,
  Shift+Tab, ArrowLeft, Tab to the input, Cancel, Apply, Enter on a radio); no rounded corners, the fill.
  value-list 51/51, filter-ui 117/117, filter-case 73/73, filter-submenu-close 17/17, menus-regression 25/25;
  submenu-check 40/40 with one scenario changed on purpose: "near the bottom" used the Age filter menu, which
  is now taller than its Filter › submenu (it opens above the cell) - it uses the boolean column and its Blank ›
  now. The new and the changed script are in this worktree's `.claude/browser-checks/scripts/` (the shared
  folder could not be written), with `range-block-touch-shot.js` (the 36px targets)

### Undo row edits on new rows (user request)

* the user, on the row menu with new rows selected (`+`, `N`) and "Undo row edits (selected rows)" greyed:
  "undo on selected rows does not understand there are new rows". `resetRows()` left a new row as it was
  added (only its edits back) and the menu entries were greyed for a row neither edited nor marked - a new
  row added with its values had "nothing" to undo
* now a revert takes a row to what the server has: a new row is not there, so `resetRows()` marks it for
  deletion (with the values it was added with) - struck through, out of `getChanges()` / `hasChanges()`,
  removed with the other marked rows on save; not removed at once, so it is one undo step and Ctrl+Z
  brings it back with its edits (`resetDataSelectionOnly()` still removes new rows, not undoable).
  `__resetRows(rows, discardNew)`: only `datasource.resetRows()` marks, `resetDataSelection` removes as
  before. The menu's `row.edit.revertRow` / `row.edit.revertRows` are enabled for a new row not marked yet
  (`canRevert`, contextmenuRow.ts)
* tests: history.test.ts (the new row test changed on purpose, +1: a new row not edited marked, one marked
  already stays), undoRedo.test.ts +2 (the selected new rows: enabled, marked, out of the changes, greyed
  once marked, Ctrl+Z brings them back; the row right clicked). Guides 05 and 10, MENU_IDS docs

### Docs site: "Guides - DEV", and a User guide to come (user request)

* the user: "Guides should be called Guides - DEV and we should have a user guide later... but under here
  we just say todo... all features need to be in place first". The sidebar: Status, Guides - DEV, User
  guide (one page, TODO: written when the features are in place), Samples, API. site.test.ts and
  full-grid-check.js follow the new title

### Header filters: the operator in the cell, a click changes it (user request)

* the user, on the filter row: "in filters we should maybe have an operator symbol, right side on text and
  left on numbers/date, then users can also click there to change operator type". Each header filter shows
  the operator it uses (getHeaderFilterOperator: the state's, else the column's `operator`, else the type's
  default) as a small symbol in its cell: on the right of a text filter and of a lookup column's (it filters
  as text), on the left of a number, date and datetime filter. None on a boolean column (a checkbox)
* the symbols, texts `filter.indicator.<FilterOperator>`: `=` `≠` `<` `≤` `>` `≥`, `a..b` Between (the
  `from..to` typed), and the wildcards of a text filter: `*a*` Contains, `!*a*` Does not contain, `a*` Begins
  with, `*a` Ends with. Measured at the 11px font in Chromium: 6 - 18.4px (`a…b` was 23px, `≠*a*` 21px).
  The indicator is 1.8em wide, inside the input's 2px focus outline; the input's padding on that side is
  1.8em + 5px, so the text typed (and the placeholder) stops before it. Placeholder colour
  (`--simple-html-grid-sec-font-color`), the text colour and the lookup button's background under the
  pointer and on focus; square, no new colours. z-index 1002: over the resize handle (1001) of the column's
  edge - the column is resized from its label or column number there
* **a click** (a tap) opens the **operator choice** under it: a menu of the grid with Operator ›'s items -
  one code for both: `headerOperatorItems()` and `setHeaderFilterOperator()` moved from contextmenuFilter.ts
  to headerOperatorMenu.ts (the state, the filter run again with the cell's value, the header rebuilt, the
  `filter-operator-change` event). The text typed and not filtered yet is filtered first, as a right click
  does. A mouse click puts the focus in the input first (the lookup button's way), a tap does not (the phone
  keyboard); a mousedown takes no focus. A right click / long press on it opens the filter menu
* **the keyboard**: the indicator is a button with `tabindex="-1"`, no Tab stop - Tab through the filter row
  is unchanged (cellFilterKeyNavigationCellRowHandler moves the focus between the inputs itself, a stop in
  between would change every path). **F4** in the filter opens the choice (F4 opens the list of a lookup
  cell too; Alt+ArrowDown is taken, it moves down): the focus on its first item, the menu keys, Enter picks,
  Esc closes - the focus back in the input. Under the cell when it has no indicator
* **the focus after a pick**: rebuilding the header made the input anew, the focus was lost to the body -
  also with Operator › before. setHeaderFilterOperator puts it in the new input when the old one had it
* a column with **one operator** (`filterOperators`): the symbol as a span (its name as its tooltip), no
  click, F4 does nothing. A column **under 60px** (`INDICATOR_MIN_COLUMN_WIDTH`): none, the input keeps
  its room, F4 opens the choice under the cell. **`GridConfig.filterOperatorIndicator`** (default `true`, in
  the JSON config test): `false` shows none and F4 opens nothing - the plain inputs of before, Operator ›
  only. A lookup's dropdown grid has it `false` (dropdownConfig, lookupEditor.ts: a picker has no menus,
  its contextmenu is swallowed), its own `config` can turn it on. The `menus.filter` hook is not called for
  the choice: `filterOperators` limits both
* a screen reader: the button `aria-haspopup="menu"`, named `Operator: Contains` (`filter.indicator`, the
  operator's Operator › text), tooltip `Operator: Contains (F4)` (`filter.indicator.tooltip`); the input is
  `aria-describedby` it - Chrome's tree: "Filter Company", description "Operator: Contains", also for the
  span of a one-operator column (aria-hidden, referenced)
* one path with the range block (merged while this was made): `operatorPicked` (the event) and the
  operator texts (`HEADER_OPERATOR_TEXTS`) moved to headerOperatorMenu.ts with `setHeaderFilterOperator`,
  the range block imports them
* tests: filterOperatorIndicator.test.ts 30 (the sides per type, none on a boolean, every symbol, config
  `operator` / state / setState / Operator ›, name and tooltip and description, translated texts; the
  choice: the operators, `filterOperators`, a pick = Operator › (state, filter, event, symbol, compared with
  a grid picking in the menu), the text typed first, BETWEEN, the focus, a tap, the right click, the menu
  context; the keyboard: no Tab stop, F4 / Esc / End + Enter and the focus, F4 filters the text typed, F4 with
  a modifier, Enter; one operator; the option off (no F4), F4 on a narrow column, updateConfig, a narrow
  column, stacked fields); accessibility.test.ts +1; lookups.test.ts +1 (none in a picker, F4 opens
  nothing); texts.test.ts shows every symbol; configJson's full config has the option. 3159 -> 3191 tests
* browser (Chromium 1148): new `.claude/browser-checks/scripts/operator-indicator-check.js` (in this
  worktree, the shared folder is outside it) 77/77 - light and dark: the sides, the text typed clear of it, a
  click hits it (not the resize handle), the accessibility tree, click → the choice under it → Begins with
  (symbol, state, event, rows), the focus back; Tab past it, F4, Esc, End + Enter → Between, a range typed;
  setState; one operator, a 50px column, the option off; a phone: a tap opens, a tap picks, the long press
  on the input still opens the filter menu; screenshots 1300x1400 and the header zoomed with the choice
  open. On the range block's base too: filter ui 117/117, filter case 73/73, keyboard 52/52, touch 61/61,
  submenu 40/40, filter submenu close 17/17; menus-regression 25/25 with its right edge point moved 15px → 30px in from the input's edge (its copy in
  this worktree): it right clicked 15px in, now on the indicator - which opens the filter menu too, but the
  script wants the input under the point and so took the boolean column, which has no Operator ›
* docs: 06-filtering.md (The operator in the cell), 02-grid-config.md (the option), 12-texts.md (the
  texts), 14-accessibility.md (F4, the button, Tab), 10-menus.md (the choice and the hook), JSDoc of
  `filterOperatorIndicator`, `filter-operator-change`, MENU_IDS; the Norwegian sample, the
  filter-operator-header sample's text
* open: on a phone the indicator is a small target (1.8em x the row height), the grid has no coarse pointer
  size for it; `menus.filter` does not reach the choice (documented); the right-click menu and F4 are the
  only ways on a column narrower than 60px; the range block draws its own symbols (`OPERATOR_SYMBOLS`, not
  texts) - the same glyphs as `filter.indicator.*`, it could take those texts

### Display formats: Format › in the header menu (user request)

* the user: "in right menu users should maybe be able to set formatting with menu. for dates we might
  want to show WEEK US, WEEK ISO, DAYS UNTIL, YEAR, DAY OF WEEK, and misc date formats, important to
  include norwegian typical etc. For numbers, its decimal separator, 1000 separator etc". A view
  setting of the user, like a column's width: only the text shown changes
* **the shape**: one object per column with a part per kind of value, so later rules (a `link` for text
  columns, a settings dialog) are another key and no breaking change - `ColumnConfig.format` (where the
  grid starts) and `GridState.formats` (keyed by field, `getState()` / `setState()` / `resetState()` /
  `initialState.formats`, kept in `columns[field].format` as the aggregates are). `{ date: DateFormat }`
  for a date or datetime field, `{ number: NumberFormat }` for a number field, `{}` is none. Types
  `ColumnFormat`, `DateFormat`, `NumberFormat` exported. Checked (`TypeError`, before anything changes)
  in the constructor, `updateConfig()` and `setState()`: an unknown part or id, a part for another type,
  a time format on a `date` field, a number part out of range, the same character for both separators,
  a format on a lookup column (`editor`). Text and boolean columns have none: nothing obvious to pick
  (upper case, a link ... are the later rules)
* **the mechanism**: one place turns a value into a cell's text - `GridInterface.__getCellFormatter(field,
  type?)`: the field's formatter, or with a format a Formatter made by `displayFormatter()`
  (columnFormat.ts): its `format` is the display format (a value it can not show - a blank, no date, no
  finite number - goes to the field's formatter), `formatForEdit` is the field's (its `format` without
  one), `parse` / `parseFilter` / `placeholder` the field's. Used by renderRowCell (cells, custom cells,
  the edited marker, the text editor), cellTextOf (Find, fitColumns, dimmed repeated values), the
  aggregates and the footer's summary. Everything that reads or writes the value keeps
  `datasource.getFormatter()`: the header filter (you type a date, not a week), the filter chips and
  editor, the group rows' names (made by the datasource), copy and the CSV (a paste reads them back:
  `2026-W47` and `1 234 567,89` it could not), sorting and grouping
* **the dates** (2026-11-22 13:45:12): `iso` 2026-11-22, `norwegian` 22.11.2026, `norwegianShort`
  22.11.26, `us` 11/22/2026, `uk` 22/11/2026, `medium` / `long` / `full` (Intl `dateStyle`: Nov 22, 2026 /
  November 22, 2026 / Sunday, November 22, 2026 - nb-NO 22. nov. 2026 / 22. november 2026 / søndag 22.
  november 2026), `weekday` Sunday / søndag, `weekIso` 2026-W47 (ISO 8601, the week's year: 2027-01-01 is
  2026-W53), `weekUs` 2026-W48 (Excel's WEEKNUM: week 1 has Jan 1, weeks from Sunday, split at New Year,
  2000-12-31 is week 54), `month` 2026-11, `quarter` 2026 Q4, `year` 2026, `daysUntil` 0 (whole local
  days from today, summer time does not count; today is when the cell renders - no timer, `refresh()`
  shows the next day). A datetime field also: `isoTime` 2026-11-22 13:45, `isoSeconds`, `norwegianTime`
  22.11.2026 13:45, `norwegianSeconds`, `time` 13:45, `timeSeconds` 13:45:12. The weeks are counted on
  day numbers of the local date (`setUTCFullYear`, not `Date.UTC`, which reads the years 0-99 as 19xx), so
  no time of day, summer time or time zone moves them - tested in four time zones
* **the language of the names**: the text `format.locale` (`'en-US'`), a BCP 47 tag for
  `Intl.DateTimeFormat` - set with the other texts (`setTexts`, `GridConfig.texts`), so an app's
  Norwegian texts give Norwegian dates; not `navigator.language` (an English grid with Norwegian days),
  not a config option (every grid would need it). A tag Intl throws on (`nb_NO`, `''`) shows English.
  The week and the quarter are texts too: `format.weekIso` / `format.weekUs` `'{year}-W{week}'`,
  `format.quarter` `'{year} Q{quarter}'` - the Norwegian sample has `uke {week} {year}`, `{quarter}.
  kvartal {year}`. Checked in Node 24 and Chromium 131: the same nb-NO and en-US names; nb-NO short
  month `nov.` but `mai`
* **the numbers** (1234567.891): `decimals` 0-4 (left out: as is), `thousands` `' '` `','` `'.'` `"'"`,
  `decimal` `'.'` `','`, `percent` (×100, ` %`). Menu presets Norwegian `1 234 567,891`, English
  `1,234,567.891`, Swiss `1'234'567.891`, Plain `1234567.891`; Decimals ›, Thousands separator ›,
  Decimal mark › (a separator the other one has is greyed out), Percent. The digits come from
  `Intl.NumberFormat('en-US', { useGrouping: false, signDisplay: 'negative' })`, the separators are put
  in after: rounded half away from zero of the number as written (1.005 → 1.01, toFixed gives 1.00), no
  exponent (1e21), no minus on a rounded 0 (-0.001 → 0.00), at most 20 decimals as is; percent drops the
  ×100 tail with `toPrecision(15)` (0.07 → 7 %). Plain ASCII: a space U+0020 (nb-NO's Intl writes U+00A0;
  Find finds a typed space), `-` (nb-NO's Intl writes U+2212), `'` (Chromium's de-CH writes U+2019, Node's
  `'`). The first pick from Default keeps the field formatter's decimal mark (numberComma → `,`)
* **numberOverride**: compared with the format's text of 0 (`0,00`) when the column has a format, `'0'` as
  before without one
* **Excel**: the value, with an Excel number format where Excel has one - iso / norwegian / us / uk /
  month / year / the time ones / weekday (`dddd`), `.` and `/` escaped; a number with `decimals`:
  `0.00`, `#,##0.00`, `0.0%` (Excel shows its own separators); the names formats, the weeks, the quarter
  and days until keep the field's date format, a number without decimals General. `XlsxNumber` and
  `XlsxDate.format` in xlsx.ts
* the footer's summary: the first number field's formatter with its format, the format's decimals (as
  is: two at most, as before). Hints of Format ›: examples made when the menu opens (today, 1234567.891),
  not texts; the texts test gives `format.locale` a Cyrillic locale (`ru-RU`), so an English name in a
  hint would show
* tests: columnFormat.test.ts 53 (every format, weeks around New Year in four time zones and five years
  day by day, leap day, summer time, days until across midnight with fake timers, rounding, separators,
  percent, the check of a format, the formatter of the cells), columnFormatGrid.test.ts 37 (cells,
  texts, days until, numberOverride, renderer, Find, fitColumns, editing a week / a number / readonly,
  the edited marker, the header filter, the menu per type, ✓, Default, hints, presets, greyed
  separators, the comma field, the menus hook, the state, JSON, initialState, updateConfig, the checks,
  totals / group rows / summary, copy, CSV), gridExcel.test.ts +5, xlsx.test.ts +1, configJson (a format
  in the full config), texts / gridMenus / gridState updated. Browser: new
  `.claude/browser-checks/scripts/display-format-check.js` 39/39 (light and dark at 1300x1400: the config's
  formats, Format › Norwegian / Week ISO / Day of week, Norwegian separators and Decimals › 2, the totals
  row, editing a number and a week, getState/setState through JSON, no rounded corners, the Norwegian
  sample in Intl nb-NO); full grid 11/11, submenu 40/40, menus regression 25/25, format for edit 8/8,
  footer summary 11/11
* docs: 08-formatting.md (Display formats: the formats, the rules, what changes and what not, the
  state), 03-state.md, 02-grid-config.md, 10-menus.md, 12-texts.md, 15-export.md (Excel formats, CSV),
  17-selection-and-clipboard.md (copy, the summary), 18-aggregates.md; JSDoc of `ColumnFormat`,
  `ColumnConfig.format`, `GridState.formats`, MENU_IDS, the interface; samples: the full grid (formats in
  the config, two buttons) and the translation sample (a date with Norwegian names)
* later, a `link` rule: a key of the same object (`{ link: { url, label } }`) checked by
  assertColumnFormat for text (and number) fields, its label through `__getCellFormatter` - which takes the
  row then - and renderRowCell drawing an `<a>` for such a column, as it draws a custom cell for `renderer`

### A second theme: TreDeSpace, light and dark (user request)

* the user: "Later we might want to be able to use our grid with this widget library. So we should have a
  style that also matches its dark/light mode, including our default dark/light (at least for now). So in
  theory 4 styles, 2 dark and 2 light" - the library is the user's TreDeSpace UI (`@treDeSpaceUI`), and the
  colours "must match the widget library - take them exactly from its source tokens"
* `src/theme-tredespace.css`, exported as `@simple-html/grid/theme-tredespace.css` (the build copies
  `src/**/*.css`): two rules of variables and nothing else, `[data-grid-theme='tredespace'] .simple-html-grid`
  and `... .simple-html-date` - every colour variable of grid.css and date.css as `light-dark(<light>,
  <dark>)`, and the library's font (`ui-sans-serif, system-ui, sans-serif`); the sizes stay the grid's. On
  with `data-grid-theme="tredespace"` on `<html>` or `<body>` (the menus, tooltips and filter editor are on
  the body, as for `color-scheme`); without it the default. Light / dark by `color-scheme`, which the library
  sets itself (dark by default, `data-theme="light"`). The selector is stronger than `.simple-html-grid`: the
  load order does not matter, an override uses the same selector
* the colours come from the library's source (github vegarringdal/TreDeSpaceSource, src/treDeSpaceUI):
  `styles.css` (its light theme and its dark surfaces slate-950/900/800 lifted half a step),
  `dockable/dockable.css` (`--dock-*`: ground, panel, lines, text, dim text, accent), and the Tailwind
  classes of its widgets (Menu, DialogFrame/Modal, fieldChrome, TreeView/TreeRow, SelectList, CalendarGrid,
  Tooltip.ts, tone.ts, buttonStyles.ts); the colours it does not remap from tailwindcss@4.3.3 theme.css,
  written as Tailwind's `oklch()` - Chromium draws blue-400 `#51a2ff`, the hex fallback of Tailwind's build is
  `#54a2ff`, so a hex would be 3 off. Not from the docs page around the widgets (its rounded frames, `--bg`,
  `--surface` ...)
* the mapping (light / dark as drawn): bars, menus, filter editor, date picker slate-900 `#f8fafc` /
  `#172033`; rows, filter row, inputs, chips slate-950 `#f1f5f9` / `#080f21`, every other row midway to
  slate-900 (as the library lifts its surfaces); lines slate-800, stronger lines and frames slate-700; text
  slate-200; quiet text slate-400; selected rows, menu hover, the active option blue-950 (its TreeView and
  Select), the other selected rows midway to blue-900; focus, range line, Apply, the value list's checkboxes
  blue-400 with slate-950 text (its checked box and picked day); errors red-400 and a red-500 tint (its danger
  chip); edited / new / deleted / conflict amber-400 / green-400 / slate-400 / violet-400 (no light violet in
  the library: Tailwind's violet-600, as it darkens blue and red); Find amber-500 tints, amber-200 line;
  range a blue-500 tint; totals slate-800 with slate-100; scrollbar thumbs its `color-mix(blue-400 45%,
  slate-800)`; tooltips its Tooltip (`#242933` / `#c9cfd8` / `#3a4250`, dark in both); shadows black 50% /
  45%, backdrop black 40%. Square, as the widgets (they have no rounded corners)
* four variables in grid.css, so the tooltips and the scrollbar thumbs can have the library's own:
  `--simple-html-grid-scrollbar-thumb-color` (= `main-bg-selected-odd`), `--simple-html-grid-tooltip-bg-color`
  (= `sec-bg-color`), `-tooltip-font-color` (= `main-font-color`), `-tooltip-border-color` (=
  `pinned-border`). The default theme is pixel for pixel the same (checked in Chromium, below); an override of
  the variable they name still changes them. No breaking change
* contrast: the pairs the theming guide promises are one list now (`src/__tests__/themeCss.ts`
  `CONTRAST_PAIRS`, 119: text 4.5:1 on the bars, inputs, rows, selected rows, under the error / range / Find
  tints, the row numbers at 80%; lines and marks 3:1 - focus, accent, control frames, range and Find lines,
  the row state under an error's tint, multiline, lookup, group lines, the date picker), computed for the
  default and the TreDeSpace theme in light and dark (the oklch() converted as Chromium draws it - checked
  against its pixels). TreDeSpace: all pass, lowest text 4.72:1, lowest line 3.12:1; also the value list's
  warning and the text under a merge's flash (the default's are under 4.5). Five colours differ from the
  widgets for it, or because the grid has one colour where the widgets have two: placeholders slate-400 (the
  library's slate-500 is 4.3:1 / 4.0:1 on the rows), control frames slate-500 (its slate-700 is 1.4:1 / 1.6:1 to a menu), Apply blue-400
  filled (its primary Button is blue-950 in a blue-400 frame), the date picker's selected day blue-950 in a
  blue-400 frame (its picked day blue-400 has dark text, ours slate-200), the current Find match's line
  amber-200 (amber-400 is 2.95:1 to the tint on a selected row)
* not like the widgets yet: a menu's frame is the grid's line slate-800 (its Menu slate-700) and a menu item
  under the pointer is the selected blue (its Menu slate-800; its Select blue-950) - one variable each for
  more than the menus; the checkboxes in the cells are the browser's (both themes); 11px text (its 12px)
  and the grid's weights (500 / 700)
* the docs site: *Grid theme* (Default / TreDeSpace) above *Toggle dark/light* in the sidebar - four looks,
  kept in localStorage (`simple-html-demo-grid-theme`, try/catch); `data-grid-theme` on the body, only the
  grids and their popovers change. The theming sample has a TreDeSpace button (and its teal theme turns the
  attribute off: the TreDeSpace rule is stronger); the select follows the attribute (MutationObserver)
* docs: guide 13 "Themes" (the two, turning TreDeSpace on, light / dark with `data-theme`, a table of the
  colours, what differs from the widgets and why), the four variables in its table; guide 01 (Css), README;
  JSDoc of createGrid and DateInterface; the headers of grid.css and date.css
* tests: new themeTredespace.test.ts (32): only variables, no border-radius in grid.css / date.css, every
  colour variable of both files has a TreDeSpace colour (a variable added without one fails), no unknown
  one, light-dark() or one colour where meant, 16 colours against the library's tokens as Chromium draws
  them, the 119 pairs for both themes in light and dark, package.json exports the file and the build copies
  it; theme.test.ts uses the shared helpers (themeCss.ts), a variable naming another is allowed; the demo's
  theme.test.ts +6 (the attribute, four looks, kept, an unknown one, blocked storage), site.test.ts +1 (the
  select, the css in the site). 3233 tests
* browser (Chromium 1148, 1300x1400): new `theme-tredespace-check.js` 141/141 - the four looks on the full
  grid and filtering samples: cells, header, filter row, selected rows, a range, the focus, a menu with a
  submenu, the date picker, a tooltip, the footer chips, the filter editor, Apply and the scrollbar against
  the library's tokens read from its own widgets page (dark and `data-theme="light"`, checked against its
  source), and against grid.css's colours for the default; no default-palette colour in a TreDeSpace grid or
  its popovers (the browser's checkboxes and the hidden focus input left out); the library's Menu, selected
  TreeView row and DatePicker next to the grid's; screenshots, and the library's widgets beside the grid in
  each mode (`compare-tredespace-dark.png` / `-light.png`). New `default-theme-pixels-check.js` 6/6: the
  default theme before and after, light and dark, with menus, a range, the filter editor and a tooltip - 0
  pixels differ. submenu-check 40/40, menus-regression 25/25, sample-height 5/5, full-grid 11/11. The new scripts
  are in this worktree's `.claude/browser-checks/scripts/` (the shared folder could not be written)

### Touch: less padding (user request)

* the user, testing on a phone: the filter editor's buttons - "some buttons is higher than I like" - and
  the menus and the value list - "dont like extreme padding". On a touch screen (`pointer: coarse`) the
  buttons, the range block's operators and inputs and the searches were 36px (the dialog's AND / OR 24px,
  out of line), the rows of menus, the column chooser and the value list 36px
* now the buttons, operators, inputs and searches keep their 24px (the WCAG 2.2 minimum target), in line
  with the rest of a dialog; the rows of lists are 28px - `--simple-html-grid-touch-row-height`, a size
  variable (left out of the colour tests of both themes), so an app can set its own. The column chooser's
  bottom padding 6px (was 10px)
* checked in Chromium on a phone (390 x 844, touch): every button of the filter editor 24px; touch-check
  61/61 (its 36px expectations now 28px), touch-select 66/66, range block 81/81, value list 51/51,
  TreDeSpace 141/141. Guides 01, 10, 13

### Docs site: a ☰ to hide the sidebar, sample grids at most 30 rows (user request)

* the user, on a phone: "maybe we should also set max height in samples on grid, so its max 25-30 rows..
  so it does not mess up scrolling. Able to remove side menu might be useful / hamburger menu". On a phone
  the sidebar took half the width, and a sample page as long as it had a grid of 60 rows
* sidebarToggle.ts: a ☰ in the sidebar's header hides it (`body.sidebar-hidden`), a ☰ in the top left
  corner shows it; a wide window remembers it (localStorage `simple-html-demo-sidebar`). Narrow
  (`max-width: 760px`): hidden to start with, it opens over the page (280px at most), a page picked in it,
  a tap beside it or Esc closes it
* `.demo-grid-host` is 30 rows high at most (`--demo-grid-max-height`, with the default heights around the
  rows), 15 at least as before; the full grid sample is not capped
* on a narrow screen the show button is above the page (`padding-top: 44px`), not beside it: beside it the
  page lost 44px of a phone's 390 and the touch check's cells were pushed out of view. touch-check 61/61;
  find-check's narrow grid is made by its own width now (a narrow window no longer makes a narrow grid),
  68/68
* site.test.ts +1; browser: new `.claude/browser-checks/scripts/sidebar-toggle-check.js` 15/15 (wide: hide,
  the page's width, remembered, show; phone: hidden, opens over the page, a page picked / a tap beside /
  Esc close it; a 2200px window: 30 rows, the full grid 85); full grid 11/11, sample height 5/5

### Docs site: the bottom of a sample page could not be reached

* found checking the column settings: the full grid sample's grid footer (the count, No filter, the
  settings gear) was 80px below a 1300 x 1400 window and could not be scrolled to - the body does not
  scroll (`overflow: hidden`), `.main` did not either, and the full page grid was `100vh - 190px` high, a
  guess of what is above it that a longer description and more buttons outgrew. Any sample page whose
  description, buttons and 15-row grid were taller than the window was cut off the same way
* `.main` scrolls (`overflow-y: auto`) when its page is taller than the window; the full page grid fills
  the height its page leaves (flex: 1), 15 rows at least - no guess. Checked at 1400 and 800 high: the
  footer in view (the grid 44 and 17 rows); sample height 5/5, full grid 11/11, sidebar 15/15, touch
  61/61, find 68/68, footer summary 11/11, display format 39/39, lookups 55/55

### Column settings: a dialog, templates and links of a text column (user request)

* the user: "on text we also like to add formatting rules with inline editor, so we can set that a value is
  link with adding suffix/expression what link is based on values etc. maybe a own config wheel bottom right
  corner, what gives us a dialog for setting rules/default ... so it can be saved later. for links we also
  might need to set label based on expression or from another column etc"
* **the rule**, two keys of the same per-column object as `date` / `number` (`ColumnConfig.format`,
  `GridState.formats`): `text` - a template of what a text column's cells show (`'{firstname} {lastname}'`,
  `'{value} kg'`, `'{company}'`), also the link's label - and `link: { url, newTab? }`. The label is not a
  part of the link: it is the column's text, so a template without a link (a display template) and a link
  with the cell's own text are the same two keys. Exported type `LinkFormat`. Checked by
  `assertColumnFormat` (TypeError): a text field only, not a lookup column, `text` not `''`, `link` an object
  of `url` / `newTab`, no `{__...}` placeholder, the address's scheme
* **templates, not code** (cellTemplate.ts, pure functions): `{field}` placeholders only - a name is
  anything but braces; a brace that is no placeholder is text; `{value}` is the cell's own value; the text of
  a field is its formatter's (`2026-11-22`, `1234.5`; not a display format, not a lookup's label), own
  properties of the row only (`{constructor}` is empty). No eval, no Function, no html: the cell text goes in
  with `textContent` / lit, a value `<img onerror>` is shown as text
* **the address** (`linkOf`): the template starts with `https://`, `http://`, `mailto:` or `tel:` written out,
  or is one placeholder alone (the field holds the whole address) - else a TypeError (`javascript:`, `data:`,
  `ftp:`, relative `/customer/{id}`, `{scheme}://`, `{base}/x`). Values are `encodeURIComponent`-ed (the `@`
  of a `mailto:` and the `+` of a `tel:` kept: they add no header or parameter, `? & = ;` stay encoded); a
  value `.` / `..` gives no link (the URL parser would step up the path; `%2e` is a dot to it too); a lone
  surrogate gives no link (encodeURIComponent throws a URIError). Then `new URL()` (absolute) and
  `url.protocol` in the four - after the parser's clean up (`java\nscript:` is `javascript:`); the href is
  `url.href`, what was checked (a lookalike host as punycode). A row whose address fails - an empty
  placeholder, `javascript:alert(1)` / `data:` in a whole-address field, `" onmouseover=` (encoded),
  `%0a` (encoded) - shows its text without a link. Checked against hostile values in the data and in the
  template, in happy-dom and in Chromium
* **the cell** (linkCell.ts): a custom cell of the grid's own (`renderer` id `''`, which
  `registerCellRenderer` refuses) - an `<a>` with `textContent` and `href`, `target="_blank"` +
  `rel="noopener noreferrer"` with `newTab`, no `href` (no link, not focusable) for a row without an address.
  A plain click on the text and Ctrl/Cmd+click (a new tab, no range: rangePointerDown skips it) open it; a
  middle click is the browser's; Shift+click (a range), Alt+click and the second click of a double click do
  not. A press on the text focuses the host (mousedown default prevented: no focus on the link, no text
  selection, no link drag), a right click leaves the focus and opens the row menu. Editing as a custom cell:
  Enter, F2, typing, a double click *beside* the text open the editor of one line with the value (the
  template formatter's `formatForEdit`); **Alt+Enter** opens the link (as Google Sheets;
  `aria-keyshortcuts`). Readonly grids show links. A column's own `renderer` wins (it gets the template text)
* **what follows the cells**: the template through `__getCellFormatter(field, type, row)` (it takes the row
  now) and `cellTextOf` - Find, fitColumns, dimmed repeats, rowHeights; the edited marker's original value
  is the template with the original `{value}`. The value: copy, paste, CSV, Excel (text, no `HYPERLINK`:
  a formula of data and a 255-character limit for a small gain - a candidate), sorting, grouping, the header
  filter, and the filter menu's value list (`cellTextOf(..., { template: false })`: a template of other
  fields shows one value two ways)
* **the gear** (rebuildFooter.ts): a `<button class="footer-settings">` at the right end of the footer on the
  filter row's line, a 16px gear of square teeth (inline svg, `aria-hidden`), named and titled "Column
  settings" (`footer.settings`), `aria-haspopup="dialog"`, the last stop of Tab in the footer (footerStops
  finds it). With it the footer has 32px on both sides (`has-settings`): the centered filter row never
  reaches under it, the summary of the selected cells ends 6px left of it (`right: 36px`), fitSummary /
  chipsUnderSummary measure as before - the latter fixed: it tested "starts left of the summary and reaches
  into it", chips that start right of the summary's start (now possible, the summary starts further left)
  were not collapsed; it is an overlap test now (gridFooter.test.ts +1). Checked at 1300px and 380px, with
  and without a filter. It opens the
  dialog on the column of the cell that had the focus when it was pressed (`activeCellOfMenu`), else the first.
  `GridConfig.settingsButton` (default `true`; `false` in a lookup's dropdown grid, and none in a footer of
  no height). Also *Column settings…* in the header menu (`header.settings`, after Format ›, MENU_IDS) and
  `gridInterface.openColumnSettings(field?)`
* **the dialog** (columnSettings.ts): a modal `<dialog class="simple-html-grid filter-editor-content
  column-settings">` of the filter editor's kind: its frame, title bar, body, footer, buttons and resize
  handles are the filter editor's classes and css; drag / resize / show moved from renderFilterEditor.ts to
  dialogFrame.ts and used by both (moved, not copied). Left: a `listbox` of the layout's columns (unique,
  `data-field`), each with its type and a badge (Format / Text / Link / Error), one Tab stop,
  `aria-activedescendant`, arrows / Home / End / PageUp / PageDown / a letter. Right: a date / datetime /
  number column - a picker that opens the entries of Format › (`formatSubmenu` takes a `FormatTarget` now:
  the state for the header menu, the dialog's draft here - one list of formats); a text column - Text shown,
  Show as link (a new link opens in a new tab at first), Address, Open in a new tab, each template with a
  `{ }` button: a menu of the fields of the columns and of the row (contextMenuAttributes takes a list now),
  the pick put in at the caret; a checkbox / lookup column - none. The preview: the current row (else the
  first shown) through `__getCellFormatter(..., format)` / `__getLinkResult(..., format)` - the grid's own
  code with the draft format - the link (in a new tab), its address, and the row's problems (empty field,
  unknown field, no valid address, a scheme not allowed). A template's own problems are under it at once
  (`aria-invalid`, `aria-describedby`, live regions), the column is marked Error and Apply / Apply & close are
  `aria-disabled` and do nothing. Apply = `setState({ formats })` (so `getState()` keeps it, "saved later");
  Reset column / Reset all = the start formats (`initialState.formats` ?? the config's, `__getStartFormats`),
  in the draft until Apply; Cancel / ✕ / Esc close without applying, the focus back where it was
* **colours**: `--simple-html-grid-link-color` `light-dark(#1e3a8a, #e8f1ff)`, TreDeSpace `light-dark(#1e40af,
  blue-100)` - 4.5:1 on the rows, selected rows, under the error / range / Find tints, the inputs and the
  bars, in the four looks (CONTRAST_PAIRS +23, also the danger text on the dialog). The library's blue-400 is
  2.2:1 under Find's tint on a selected row. No border-radius anywhere; the checkboxes are the browser's, as
  the value list's. Touch (`pointer: coarse`): the list's rows `--simple-html-grid-touch-row-height`, the
  buttons, inputs and the gear keep their size
* texts: 47 ids (`columnSettings.*` 45, `header.settings`, `footer.settings`), the guide's tables, the
  Norwegian sample; the placeholders and hints show `{names}` as written (texts.test.ts knows them)
* docs: 08-formatting.md (Templates and links: the placeholders, templates not code, the address, a link
  cell, what changes; The column settings dialog), 02 (`settingsButton`, `format`), 03 (formats, a saved
  state runs nothing), 10 (header.settings), 12 (Column settings), 13 (the variable, TreDeSpace), 14 (the
  gear, a link cell, Alt+Enter, the dialog's keys), 15 (Excel / CSV are the value), 17, 21; JSDoc of
  `ColumnFormat`, `LinkFormat`, `ColumnConfig.format`, `GridState.formats`, `settingsButton`,
  `openColumnSettings()`; the full grid sample: City a template with the country code of another column,
  Fruit a search link (a new tab) whose text has the country code too, Email mailto:, Phone tel:, buttons
  Column settings / Save formats / Load formats (localStorage, try/catch). Company and City stay inputs:
  theme-tredespace-check.js clicks their cells
* tests: new cellTemplate.test.ts (24: placeholders, fields of a row, encoding, schemes, `.`/`..`, lone
  surrogates, javascript:/data:/vbscript:/file:, tabs and line breaks, entities, `%3A`, lookalike schemes and
  hosts, `" onmouseover=`, `<img>`, `%0a`), linkColumn.test.ts (28: the cells, hostile data, click vs Shift /
  Alt / double click / Ctrl without a range / right click, Alt+Enter, editing the value, the arrows, a text
  template input, copy / CSV / Excel / Find / sort / value list, state JSON round trip, setState / config
  TypeErrors, renderer wins), columnSettings.test.ts (28: the gear and its option, the header menu, the API,
  modal and close, the list and its keys, each type's panel, the preview, links and their problems, the field
  menu at the caret, Apply / Apply & close / Cancel / Reset / initialState); columnFormat +7, accessibility
  (the gear is the footer's last stop, +1 without it), gridMenus, lookups (no gear in the dropdown grid),
  texts (a walk through the dialog: every id shown, no English), theme contrast pairs; typings consumer.
  3418 tests, 149 files
* browser (Chromium 1148, 1300x1400): new `column-settings-check.js` 144/144 - in the four looks (default /
  TreDeSpace, light / dark): the gear's place and name, no overlap with the summary and the filter's row at
  1300px and 380px (with a filter too), the dialog from the gear on the focused cell's column, modal with the
  focus in it, no rounded corners, number Norwegian / date Week ISO through the picker, a text template of two
  columns, Show as link, `javascript:` refused at once with Apply held back, a field put in at the caret from
  the `{ }` menu, the preview link and address, Apply & close with the focus back on the gear, the cells as
  links with the template's text, the state, a click opening a popup (intercepted), Ctrl+click without a
  range, Shift+click nothing, a press beside the text focusing the cell, Alt+Enter, F2 editing the value, a
  double click beside the text, a right click's row menu, `javascript:` / `data:` / `java\nscript:` in the
  data no links and nothing run, resetState / setState(JSON), the header menu's entry and Esc (focus back),
  Enter on the gear, Tab to the ✕ and the list, the list's outline, a same-tab link navigating. A probe:
  a middle click on a link opens a new tab, Alt+click nothing (no tab, no download). The shared checks:
  display-format 39/39, footer-summary 11/11, full-grid 11/11, submenu 40/40 (the header menu has Column
  settings…), menus-regression 25/25, theme-tredespace 141/141 (with the library's live page);
  footer-no-filter 49/52 and keyboard 51/52 as they are - they expect Tab from "No filter" / the chips to
  leave the grid, and narrow chips under the summary collapsed (fixed above); copies with the gear as a stop
  of Tab: 53/53 and 53/53. The new scripts and the copies are in this worktree's
  `.claude/browser-checks/scripts/` (the shared folder could not be written from this worktree): the shared
  footer-no-filter-check.js and keyboard-check.js want the gear's Tab step

### Text filters: `_` is one character (user request)

* the user: "in text search it could be useful to be able to search with _ where that is random part, like
  one do in sql normally". `*` and `%` were the only wildcards, `_` was literal (and escaped in the SQL)
* objectFilter.ts `matchesText`: `_` becomes `.` in the regular expression, with the `u` flag so a letter
  past U+FFFF (an emoji) is one character, as in SQL. `s` was there already: a line break is a character
  too. No escape, as for `*` and `%`
* sql: `Dialect.oneChar` (`_` for LIKE, `?` for GLOB); buildWhere splits the value on `*`, `%` and `_`,
  keeping them, and makes each the dialect's wildcard. `patternLiteral` escapes only what can still be
  literal: `!` (postgres, oracle), `[` (mssql), `[` and `?` (sqlite). `IN` values (mssql `LIKE`) keep
  `[%]`, `[_]`, `[[]`
* lookup columns filter their labels with objectFilter: they take `_` too. The value list's search and
  `IN` do not
* tests: filterOperatorsByType +1 (one character, not none or two, an emoji, a line break, a `_` in the row,
  caseSensitive, a blank row); toSqlWhere +1 and the wildcard test changed, snapshots: only the parameter
  values changed (`!_` / `[_]` to `_`, sqlite `_` to `?`). The SQLite comparison with the grid (3000 random
  filters and every operator) got the patterns `_nn`, `AN_`, `___`, `*_b`, `a_\nb` and the row `a🙂b`;
  its second text column had `a_b`, a pattern now as a `valueField`: `a-b`. The injection test skips the
  values with `_`, as those with `*` and `%` - they find more than their own row
* guides: filtering (the header filter, the backend rules), SQL (text, the dialect table, the
  differences table); JSDoc of `FilterOperator`, `toSqlWhere`, `SqlColumnType`

### Column settings: the filter operator (user request)

* the user, with a screenshot of the dialog: "in column settings, we want to also be able to see default
  operator"
* columnSettings.ts: `ColumnSettings.operators`, the operator in use of every column but a checkbox one
  (getHeaderFilterOperator) when the dialog opens. *Filter operator*: a picker (`.column-settings-operator`)
  that opens the items of Operator › for the column (headerOperators - its `filterOperators`, a lookup
  column's text ones), the one picked checked; a column with one operator shows its name. Under it
  *Default: …* - the column's `operator`, else the type's (defaultHeaderOperator). Apply calls
  setHeaderFilterOperator for each column whose operator changed - one code with Operator › and the
  indicator. Reset column / Reset all set the default
* the operator picker as wide as the format picker (320px at most)
* columnSettings.test.ts +6 (a number column, the menu's operators and the ✓, nothing applied before
  Apply; the config's `operator` as the default, a text and a lookup column; none for a checkbox, the name
  for one operator; Apply: the state, the rows, the event once; Cancel; the state's operator, Reset column /
  Reset all); the translation sample has the three texts in Norwegian
* browser: new `column-settings-operator-check.js` 13/13 (light and dark: the picker, the default, the menu
  in the dialog, Less than picked, Apply → the header's indicator shows `<`, no operator on a checkbox
  column); column-settings-check 144/144

### The tooltip behind the filter editor's fields (user request)

* the user, a screenshot of the filter editor: "match case tooltip in filter editor is behind form elements..
  this needs something better". The tooltip of Aa was cut by the value input of the next condition
* why: `.simple-html-grid input { z-index: 1000 }` is every input under a `.simple-html-grid` element - the
  filter editor dialog is one. The input is not positioned, but it is a flex item, and a flex item paints by
  its z-index; the tooltip (`position: fixed`, a child of the dialog) had 600
* grid.css: the tooltip's z-index is 10000 - over every layer of the grid (the highest is 2000). A tooltip
  of a menu is in the menu's popover, the top layer, as before
* tests: tooltipLayer.test.ts - the tooltip's z-index over every other one of grid.css, date.css and the
  TreDeSpace theme. Browser: new `editor-tooltip-check.js` 11/11 (hovers each Aa of four conditions, light
  and dark, and asks `elementsFromPoint` - with the tooltip's pointer-events on, it skips an element
  without - what is on top at its middle and corners: the tooltip; it was 7/11 before the fix);
  filter-case 73/73, column-settings 144/144

### The value list: a text search (user request)

* the user, a screenshot of the value list with "den" searched (Denmark, Sweden): "if search in box like this,
  we need to be able to click its a text search only too". Apply was always an `IN` of the values found
* contextmenuFilter.ts valueListBlock: with text in the search box and `CONTAINS` among the column's operators,
  a checkbox *Filter on the text: contains "…"* (`.simple-html-grid-value-text-search`, the row style of
  *Only values in filtered rows*). Checked, Apply and Enter call applyTextSearch: `CONTAINS` in the header
  filter's state when it was another (`filter-operator-change`), filterCallback with the text, the header
  rendered again - what rangeBlock's apply does. The values are a preview: checked and disabled, the box
  `.simple-html-grid-value-preview` at 60% opacity, its rows without pointer events (the box still scrolls);
  unchecked the draft of the values is as it was
* tests: filterContextMenu.test.ts +6 (the option only with text, the preview and back, Apply: the filter,
  the state, the cell, the event once, a row added later; Enter and `_`; no option without CONTAINS; a
  lookup column's labels); texts.test.ts types a search (a digit) so the text is shown
* browser: new `value-list-text-search-check.js` 33/33 (light, dark, TreDeSpace dark, a phone: the option,
  the preview, Apply → CONTAINS "den", the cell and `*a*`, every row has den); value-list 51/51,
  filter-submenu-close 17/17, menus-regression 25/25
* guides: filtering (the value list), texts

### Aggregates: less room around the lines, the values not bold (user request)

* the user, screenshots of group rows with Avg / Sum / Avg: "think padding is a bit much when multiple
  aggregates", "maybe using bold is a bit much too?". Every aggregate line was a whole `cellHeight` (22px),
  a group row with two was 66px; the values took the group row's header bold
* aggregates.ts: `aggregateRowHeights` uses cellHeightOf (rowHeights.ts) - the first line `cellHeight`, each
  line more `multilineLineHeight`; new `aggregateLineBox` places a line as a taller cell's lines are placed
  (linesUnderTop): a group row's aggregates from 19px, 15px apart; the totals row's first line as before,
  the others under it. grid.css: `.simple-html-grid-group-aggregates .simple-html-grid-aggregate` in
  `--simple-html-grid-font-weight`; the name keeps the header's bold, the totals row its bold
* aggregates.test.ts: the heights and tops (37 / 52px, 19 / 34px); guide 18 (the group rows), JSDoc of
  `multilineLineHeight`
* browser: new `aggregate-lines-check.js` 11/11 (light and dark: 22 + 15 per line, the lines 15px apart, the
  name 700 and the values 500, every text inside its row); full-grid 11/11, footer-summary 11/11
### Date filters: the date picker in the range block, a range picker for Between (user request)

* the user, on a date column's filter: "our date picker needs to come when we select" (the range block's
  inputs were plain text inputs: opening the date picker as a grid menu closed the filter menu, one menu at
  a time) and "if its in between when we select datepicker, we need to be able to select range... so there
  is 2 date pickers side by side" (a BETWEEN header cell, `2026-11-22..2026-11-28`, opened the single date
  picker, and Use replaced the range with one day)
* **a range mode in the date component** (public API): `IDateConfig.rangepicker` (with `datepicker: true`;
  a calendar ignores it), `IDateConfig.datepickerRange` (`[Date | null, Date | null] | null`, the range it
  opens on and the range picked so far), the event `range-select` (`[from, to]`, an end not picked null -
  an open end; `null` for Clear). Two months side by side, one when the window is narrower than two months
  and 10px (`rangeMonths`, a phone); « ‹ once before the first month and › » after the last
  (`simple-html-date-nav-space` keeps the name of the month in the middle). The first day is From, the next
  To (swapped when before From, the same day twice is that day), a third starts again (`nextRange`);
  From and To `-selected`, the days between `simple-html-date-day-in-range` (not on the dimmed days, as
  `-selected`). Under the months, as wide as both: From and To (label over `22 November 2026`, `–` while not
  picked, `aria-live`) and Clear / Use - no hours, minutes or Now. Days at 00:00 (`rangeDays`: a range given
  with times or the wrong way round is made days, From first, new dates); Use sends copies.
  `clearSelection()` clears the range too. The date picker and the calendar render as before (their tests
  unchanged); `month()` / `monthHeader()` take the index of the month (default 0)
* **grid**: contextmenuDate.ts has one builder for the grid's pickers (`createDatePicker`: datePickerConfig,
  texts) and: `contextmenuDateRange` (the range picker as the grid's menu, placed with placeMenu - measured,
  not `datepickerHeight`), `openDateInMenu` / `openDateRangeInMenu` (a picker from an element of the open
  menu), `rangeEndTexts` / `rangeFilterText` (a range as the inputs' texts / `from..to`), `filterDate`
  * the header filter: a click with the operator BETWEEN (getHeaderFilterOperator, at the click) opens the
    range picker on `parseRangeText` of the cell; Use is `filterCallback(from..to)` - as typed - Clear `''`
    (the operator stays Between)
  * the range block: a click in the value input of a date / datetime column opens the date picker on the
    date it holds, Use fills it, Clear empties it; From or To of Between open the range picker under both
    (anchored on `.simple-html-grid-range-ends`) on the two dates, Use fills both. Only the draft: Apply /
    Enter applies, Cancel / Esc / a click outside leave the filter. Another operator closes it
  * **the filter menu stays open**: the picker is a `popover="manual"` put in the menu's popover
    (`ctx.contextMenu`), as a submenu is - it is no level of the menu tree, so watchBlock does not close it -
    and closes with the menu. Its clicks stop at it (the document's click handler closes a menu on a click
    outside `.simple-html-grid-menu`, and Clear / Use bubble); a mousedown in it is canceled but in its hour
    and minute inputs, so the focus stays in the block's input (Enter applies, Esc reaches the menu); Esc on
    the menu closes the picker and is canceled (addMenuListeners leaves the menu), the second Esc closes the
    menu; a pointerdown in the menu outside the picker and its anchor closes it. The touch listener counts it
    in the menu (`ctx.contextMenu.contains`)
* **a datetime range is whole days**: From 00:00:00, To 23:59:59 - the built-in datetime formatters show
  the seconds and the filter compares to the second (toFilterTime), so 23:59 would miss 23:59:30
* css: `--simple-html-date-in-range-bg-color` `light-dark(#dee9f3, #2d4469)` (midway the background and the
  selected day), TreDeSpace blue-950 (the library's span, its ends framed); CONTRAST_PAIRS +3 (the text,
  the selected frame and today's bar on it). No border-radius; the bottom's buttons are the date picker's
  24px
* texts `datePicker.from`, `datePicker.to`, `datePicker.rangeOpen` (`–`); the guide's table, the Norwegian
  sample (Fra, Til)
* docs: guide 06 (the header filters' table, BETWEEN, a new "The range picker", the range block's date
  picker), 09 (the range picker's example and `range-select`), 10 (the picker in the menu's popover), 12
  (the texts), 13 (the look, the classes, the variable, TreDeSpace), 14 (keyboard, `aria-live`); JSDoc of
  IDateConfig (`rangepicker` with an example, `datepickerRange`, the fields it sets), DateEvents
  `range-select`, DateInterface, the templates; typings consumer (the range API, a one-end range rejected)
* tests: new src/date/__tests__/rangePicker.test.ts (26: two months / one on a 390px window / the 510px
  edge, the navigation once for the pair, no time, opening on today / From / To, the clicks - From, To, swap,
  a third, the same day, over the two months, dimmed days unmarked - the range given with times and
  reversed, a day click not reaching the page, clearSelection, Use / Clear / open ends / copies, no event
  while picking, aria-live, its own texts, the date picker and the calendar as before);
  datePickerCell.test.ts +7 (the BETWEEN cell: the range picker on from..to, two days and Use - state,
  filter, cell, rows -, one day = an open end, Clear keeps the operator, an empty cell opens on today, a
  datetime's 23:59:59 with the rows, another operator after Between the date picker again);
  filterRangeBlock.test.ts +14 (the value input's picker in the menu's popover, Use fills - nothing filtered
  until Apply -, Clear and Cancel, a datetime's time, From / To with the range picker and Apply, its Clear, a
  datetime's 23:59:59, Esc from the input and from the picker then the menu, a press outside / in the input,
  another operator, closing with the menu, its clicks not reaching the document, the focus kept, no picker
  on a number); texts.test.ts (the range picker opened: every id shown, no English). 3418 -> 3465 tests,
  150 files
* browser (Chromium 1148): new `date-range-check.js` 168/168 in six looks (1300x1000 light, dark,
  TreDeSpace light, dark; a phone 390x844 with touch - taps - light and TreDeSpace dark): the BETWEEN cell's
  range picker (two months, one on the phone, on its from..to, in the window, no rounded corners, the fill),
  two days and Use (the rows, the cell), the range block's From with the range picker in the menu's popover
  (menu open, Use fills both, nothing filtered, Apply filters), ≥ with the date picker on the input's date,
  Esc the picker only then the menu, Enter after a pick applies, the ≥ cell's date picker. The shared checks:
  range-block 81/81 (it types its dates: `fill()` does not click), touch 61/61 (59/61 once while the test
  suite ran beside it: the momentum of a swipe, timing), display-format 39/39, custom-cells 39/39. The
  script is in this worktree's `.claude/browser-checks/scripts/`, its screenshots in
  `.claude/browser-checks/shots/date-range/`

### Docs site: Developer Guide, User Guide (user request)

* the user: "Guides DEV could be called Developer Guide, and User guide, called User Guide"
* samples/demo/index.ts (the sections), pages.ts (the user guide's title), site.test.ts; the shared
  full-grid-check.js expects "Developer Guide" (backup `.before-guide-rename`): 11/11, sidebar-toggle 15/15

### The row menu of a row number: rows only (user request)

* the user, a screenshot of the menu on a row number (Undo / Redo, Select, Copy, Paste, Clear, Delete,
  Filter, View, Size, Export): "row number context menu have too many options that does not belong there"
* contextmenuRow.ts: `onCell` (the field is not `''`) in `visible` of Paste ›, Clear ›, Filter ›, View ›,
  Export ›, Undo cell edit, Copy › Cell Value / Column / Range, Select ›'s cell separator, Range to here and
  Add this cell, Size › Fit column to this cell; the `noCell` greying in them went (never shown without a
  cell). Left: Undo / Redo, Select, Copy, Delete, Size - about as a spreadsheet's row header
* selectMenu.test.ts: the menu tree of a row number is MENU_IDS.row without those, the five submenus, the
  hook still gets `row.filter`; the cell entries are not there (were greyed out). Guides 10, 17
* browser: new `row-number-menu-check.js` 7/7 (light and dark: the five on a row number, Copy › the rows
  only, on a cell the whole menu)
### Grid config: tabs, and a detail form at the right of the rows (user request)

* the user: "Want us to be able to also define detail form for the right side. So enable, then select
  the columns/order we want them in. Can be useful for if anyone have multiline text. So title should be
  grid config, and tabs on the top, where you select between column config and detail form."
* **The dialog is *Grid config*** (`columnSettings.title`, and the gear's `footer.settings`): two tabs
  under the title bar, *Columns* (all the column settings, as they were) and *Detail form*. New
  gridConfigTabs.ts: the WAI-ARIA tabs pattern - a `tablist` named by the title, `tab` buttons with
  `aria-selected` / `aria-controls`, `tabpanel`s named by their tab, one stop of Tab, ArrowLeft /
  ArrowRight (round), Home / End, automatic activation. The footer is the dialog's: Apply applies both
  tabs, Cancel drops both; its left end has the resets of the tab shown (*Reset column* / *Reset all*, or
  *Reset form*). columnSettings.ts changed as little as it could: `ColumnSettings` got `tab` and
  `detailForm`, `openColumnSettings(ctx, field, tab = 'columns')`, the Columns body got the tabpanel
  attributes (`hidden` on the other tab), `apply` calls applyDetailForm. The inner functions of the column
  panel are as they were
* **The Detail form tab** (new detailFormSettings.ts): *Show the detail form*, *Width (px)* (at least
  150), a listbox of the fields - the form's in their order, then the layout's, then the other columns of
  the config - each option with a box (`aria-checked`), its label, type and the badges *Several lines* /
  *Hidden* (not in the layout). Space checks, Alt+ArrowUp / Alt+ArrowDown move (⌥ on a Mac, the hint has
  a `.mac` text), Move up / Move down buttons. A draft until Apply; Apply sets `detailForm` only when it
  changed
* **The detail form** (new detailForm.ts): a region (*Details*, *Row n*) in the grid element, after the
  rows. updateMainElementSizes gives the header, the body, the two scrollers and the totals row `width` px
  less at the right; the grouping panel and the footer stay full width. Where the rows would get less room
  than the form beside it, or the scrolling columns less than 150px (a phone, wide pinned columns), it is
  under the rows over the footer, 40 % of the grid's height - the resize observer lays it out again. It
  shows the current row (`currentEntity`, a data row that is displayed - else *No row*): the values through
  cellTextOf (display format, template, lookup label, numberOverride), a textarea as tall as the text for a
  multiline value (`field-sizing: content`, `rows` as the fallback), a checkbox for a boolean, the link of a
  link column under its value, the errors under the field (`aria-invalid`, `aria-describedby`)
* **Editing in the form** goes the cells' way: the same readonly rules (grid `readonly`, `__isCellReadonly`
  - the column and the `isReadonly` hook - `allowPasteClearOnly`), each keystroke `row[field] =
  formatter.parse(text)` inside `History.typing()` (one undo step per field, `endTyping` on blur),
  `formatForEdit` while a field has the focus, line breaks as LF, Ctrl+Z / Ctrl+Y as in a cell (the focus
  stays). A lookup column is read-only in the form (its cell picks the value)
* **It follows the grid**: rendered at the end of triggerScrollEvent (current row, selection, validate,
  undo, filter, sort, rebuild, refresh) and by renderChangedRows when its row changed (edits, upsert, code).
  The field being typed in keeps its text (as editedInput does for cells). A render is not re-entered: a
  field with the focus removed by a render gets a blur in Chrome, its blur renders the form - lit-html
  threw `NotFoundError` there (found by the browser check, a test with a stubbed `remove` covers it)
* **The grid around it**: the wheel and a swipe over the form are the browser's (addScrollEventListeners,
  touchScroll); range and column drags auto scroll at the rows' edge, not the grid's (rangeSelection,
  dragEvent); Tab: the footer's last stop goes into the form (tabPastRows too without a footer), the form
  is the last element before the end Tab leaves the grid from, Shift+Tab from its first field goes back
  to the footer (tabBackFromDetailForm)
* **State**: `GridState.detailForm: DetailForm` (`{ show, fields, width? }`), the developer default
  `GridConfig.detailForm` (and `initialState.detailForm`) - as `totalsRow`: `updateConfig()` keeps the
  user's unless it is given. getState / setState / resetState / JSON round trip; checked
  (assertDetailForm) before anything changes, `fields` once each. New public API: `DetailForm`,
  `GridConfig.detailForm`, `GridState.detailForm`, `gridInterface.openDetailFormSettings()`
* css: the tabs, the Detail form tab, the form - existing variables only (no new colour, so nothing for
  theme-tredespace.css), square, 22px fields also on touch
* texts: `columnSettings.title` / `footer.settings` *Grid config*, `columnSettings.tab.*`,
  `columnSettings.detailForm.*` (14), `detailForm.*` (4); guide 12 tables, Norwegian in the translation
  sample, texts.test's "every text shown" walks the form and the tab (a config column `extra` not in the
  layout for *Hidden*)
* tests: detailForm.test.ts (31: state, layout right / under / pinned columns, what it shows, it follows the
  grid, editing and readonly, undo, keys, wheel, the re-entered render), detailFormSettings.test.ts (10: the
  title and tabs, the keys, the tab's list, moves, width, Cancel / Reset form / Apply of both tabs);
  changed for the title only: columnSettings.test.ts (the gear's name and the title, 2 lines),
  gridState.test.ts (the state has `detailForm`, 2 objects)
* docs: guide 02 (option, section *The detail form*), 03 (*The detail form in the state*), 08 (*The grid
  config dialog*, was *The column settings dialog* - its links in 02, 03, 06, 10, 12 follow), 12, 14; the
  sample *Detail form* (`#sample/detail-form`, Editing); the full grid's description says where it is (a
  button of its own made the grid 32px lower, under the full-grid check's 60 % - left out)
* browser: new `detail-form-check.js` 91/91 (the four looks: the gear and the title, the tabs by click and
  keys, three fields picked with Alt+ArrowUp, Apply & close -> the form at the right with the current row,
  Alt+ArrowDown follows, three lines of notes all shown, the rows scroll sideways, pinned right and the
  scrollbars end at the form, footer full width, the wheel over the form, typing edits the row and Ctrl+Z
  undoes, the state round trip, a narrower window -> under the rows and back, a phone at 390px -> under
  the rows, no rounded corners). Shared checks: column-settings-check 144/144 with a copy in the worktree
  (the gear is named Grid config, the Columns tab is a stop of Tab before the list - 12 checks were about
  that), column-settings-operator 13/13, full-grid 11/11, footer-no-filter 53/53, keyboard 53/53
### Column settings: a label, the placeholder, blank / 0, checkboxes (user request)

* the user: "for columns we should also be able to set placeholder, with option to use column label as
  this", "Also be able to set custom label is useful", "under numbers, I want a checkbox to be able to set
  null/blank to show as 0 and option to set 0 to show as blank", "under text we also want to be able to
  override to checkbox, useful for one have 0, 1"
* **where it lives**: new optional parts of `ColumnFormat`, so the state keeps them with the formats -
  Apply, Reset column / Reset all, `getState()`, a saved state as JSON, `initialState.formats` work as
  before, and the developer starts a column with them in `ColumnConfig.format`: `label`, `placeholder`,
  `placeholderLabel`, `numberOverride: 'BLANK_TO_ZERO' | 'ZERO_TO_BLANK' | 'NONE'`, `checkbox:
  CheckboxFormat` (`{ checked?: string; unchecked?: string }`, `'1'` / `'0'` left out; exported type).
  Each wins over the column's own option (`ColumnConfig.label`, `placeholderFilter`, `numberOverride`);
  `'NONE'` is needed to turn a column's own `numberOverride` off. `hasDisplayFormat` is "has a part" now
  (the new keys too); Format › reads `hasValueFormat` for its Default ✓ and sets only the `date` / `number`
  part - a pick there kept nothing else before (it replaced the whole format: a label would have gone)
* **checked** (assertColumnFormat, TypeError, config and setState): a label / placeholder of text, not
  `''`; no placeholder on a boolean field (its filter is a checkbox; a lookup on one is typed); placeholder
  not with `placeholderLabel: true`; `numberOverride` on a number field, of the three; `checkbox` on a
  text or number field, its values text, the checked one not `''`, numbers on a number field (`''` for
  the unchecked one), not the same two (`'1'` / `'1.0'` on a number field are the same); `checkbox` not
  with `text`, `link`, `number`, `numberOverride` (a checkbox shows no text); a lookup column takes a label
  and a placeholder only. `checkboxProblem()` is shared by the check and the dialog
* **the label** (getColumnLabel.ts): `format.label`, else `getConfigColumnLabel` (the column's `label`,
  the field's, the name prettified). getColumnLabel is the one place: the header, the header filter's and
  the cells' names, the menus, the column chooser, the filter editor, the footer's chips, the aggregates
  of stacked fields, the drag ghost and a new group chip, fitColumns, copy with headers (and the header
  line a paste leaves out) - and **the headers of the CSV and Excel exports**: the label the user sees and
  chose (a CSV/Excel file is read by people; the developer's `header: false` / `fields` are unchanged).
  Group chips keep the title they were grouped with (`GroupArgument.title`, data of the grouping)
* **the placeholder** (new headerFilterPlaceholder.ts, moved out of renderHeaderFilter.ts with typePlaceholder):
  the label of the same format (the dialog's draft label too) with `placeholderLabel`, else `placeholder`,
  else `defaultFilterPlaceholder` - the column's `placeholderFilter`, a BETWEEN's from..to, the formatter's,
  the type's. The user's wins over the BETWEEN's too, as `placeholderFilter` did
* **blank / 0** (cellText.ts `numberOverrideOf(column)`): the user's, else the column's, `'NONE'` none -
  none with checkboxes (the exports write the value). Used by the cells, cellTextOf (Find, fitColumns,
  dimmed repeats), the CSV and the Excel export: the old code path (overrideNumberText), one more input
* **checkboxes** (renderRowCell.ts): a text or number column whose cell is of its field's type, not a
  lookup and without a renderer of your own, takes the boolean branch: the same `<input type="checkbox">`,
  keys, ranges (Shift / Ctrl+click), context menu, readonly and `allowPasteClearOnly` as a boolean cell.
  Checked: `isCheckedValue` - the value's text trimmed is the checked value, a number equal to it. The
  change writes `checkboxValueOf(!checked)` from the value, not from the box (the click renders the cell
  again first, see the boolean cell's inverted `!e.target.checked`): the text, a number in a number field,
  null for an unchecked `''`. Space is the browser's click. Undo, the edited marker and validation as any
  edit. cellTextOf gives such a cell the type `boolean` and the value's text: Find skips it, fitColumns
  gives it a checkbox's room, the value list and dimmed repeats see the value. Copy, paste, CSV, Excel,
  sorting, grouping and the header filter have the value (the header filter is typed: `1`). Format › is
  hidden on a number column with checkboxes
* **number columns with 0/1**: supported as text columns are (a database's 0/1 flag is often a number):
  the values are numbers as text (`'1'`, `'-1'`, `''`), written as numbers; the number format and blank / 0
  go while it is on
* **the dialog** (columnSettings.ts, new small functions in the panel - the frame, title, footer and
  `render` structure as they were; `ColumnSettings` unchanged, it is all in its `formats`): *Label* first
  (every column; its input's placeholder is the column's own label - empty is that); a text / number
  column *Show as checkbox* first of its settings (a switch that does not move: turned on it takes the
  template, the link, the number format and blank / 0 out of the draft and their fields away, *Checked
  value* / *Unchecked value* side by side with a hint and the problems - Error badge, Apply held back);
  a number column *Show blank as 0* / *Show 0 as blank* under its format (one turns the other off; they
  start as the column shows them, its own `numberOverride` too: off over the column's own is `'NONE'`, the
  same as the column's own is left out); *Filter placeholder* before the operator for every column but a
  checkbox (the input's placeholder is what empty gives, `defaultFilterPlaceholder` with the draft's
  operator; *Use the column label* makes the input disabled, dashed, the label in it). The list, the
  heading, a letter and the preview's checkbox use the draft's label. The badges are a list now - Error
  alone, else Checkbox, Link / Text, Format, Blank / 0, Label, Placeholder - right aligned, on a line of
  their own under the label when the option has no room (the label keeps 80px). The preview shows blank
  / 0 and a disabled checkbox. *A checkbox column has no settings* became *... no format* (it has a label)
* css (grid.css): `.column-settings-badges`, `.column-settings-values` / `-value`, a disabled
  `.filter-editor-value` dashed, `.column-settings-preview-checkbox`; the option wraps. Colours are the
  existing variables (no new ones), no border-radius, nothing larger on touch
* texts: 16 new (`columnSettings.badge.checkbox`, `.badge.numberOverride`, `.badge.label`,
  `.badge.placeholder`, `.label`, `.blankToZero`, `.zeroToBlank`, `.checkbox`, `.checked`, `.unchecked`,
  `.checkbox.hint`, `.placeholder`, `.placeholderLabel`, `.problem.checkedEmpty`, `.problem.notNumber`,
  `.problem.sameValues`), `columnSettings.none.boolean` changed; the guide's table and the Norwegian sample
* docs: 08-formatting.md (the dialog's list, a new section *Label, placeholder, blank / 0, checkboxes* with
  the checkboxes' rules, `numberOverride`), 02 (the column label's order, `label`, `placeholderFilter`,
  `numberOverride`, `format`), 03 (the state), 15 (the export's header), 12 (texts); JSDoc of
  `ColumnFormat` (each part, the example), `CheckboxFormat`, `ColumnConfig.label` / `placeholderFilter` /
  `numberOverride` / `format`, `GridState.formats`; typings consumer. The full grid sample: a Newsletter
  column of `'1'` / `'0'` text (eight tags instead of nine: still 50 columns), the description
* tests: new columnFormatOptions.test.ts (16: the label in the header, the filter's name, the chips, the
  filter editor, the column chooser, the CSV and Excel headers, resetState; the config's format label; Format
  › keeps the label and blank / 0; the placeholder over `placeholderFilter` and BETWEEN, the label, a
  TypeError on a checkbox column; blank / 0 over the column's, NONE, the CSV, Excel, Find; checkboxes:
  rendered, a click writing text / numbers / null, undo, readonly / readonly column / paste-clear-only, the
  value in CSV, Excel, the header filter, the value list, sorting, Find skips them, no Format ›, a renderer
  and dynamicCellTypeColumn win, TypeErrors, the state as JSON); columnFormat +8 (the checks, the helpers);
  columnSettings +6 (the label and a letter, the placeholder and Use the column label, blank / 0 over the
  config's, Show as checkbox on a text and a number column and their problems, Cancel / JSON / Reset) and
  its checkboxes found by their text now (Show as checkbox is the first); texts (the walk shows the new
  ones). 3456 tests, 150 files
* browser (Chromium 1148): new `column-settings-more-check.js` 141/141 in the four looks - the label typed
  (list, heading, badge), Apply → the header, the filter's name, the column chooser, the footer chip, the
  filter editor, the CSV header; the placeholder, Use the column label (dashed, off); 0 as blank / blank as
  0 one or the other, the cells and the CSV; Show as checkbox on Newsletter: 1 / 0, a problem holding Apply,
  the cells checked where 1, a click writes '1' / '0' as text, Space back, Shift+click nothing, editing off
  nothing, the CSV, a header filter on 1, sorting; the state as JSON, resetState, setState; Reset all. A
  phone (390px, touch): the badges on a line of their own. The shared checks: column-settings 144/144,
  column-settings-operator 13/13, display-format 39/39, full-grid 11/11, custom-cells 39/39. The new script
  is in this worktree's `.claude/browser-checks/scripts/`

### Column settings: Multiline and Read only (user request)

* the user, a screenshot of the Columns tab on a text column: "for text we should also be able to set if
  its multiline or not, and readonly in edit mode"
* columnFormat.ts: `ColumnFormat.multiline` (a text field, not with checkbox, not on a lookup column) and
  `ColumnFormat.readonly` (any column, a lookup column too), checked in assertColumnFormat; `readonlyOf(column)`
  - the user's over `ColumnConfig.readonly` - in `__isCellReadonly` (before the isReadonly hook) and
  deleteRows' isLockedByHook. multilineText.ts: `multilineOf(field, column)` - the user's over the field's -
  in isMultilineCell (cellText.ts, renderRowCell.ts pass the column) and the detail form tab's badge
* columnSettings.ts `editingSettings`: the two checkboxes after the type's settings, starting as the column
  has them, left out of the format when set back to that; Show as checkbox takes multiline away; badges
* tests: columnFormatOptions.test.ts +4 (multiline true / false and a value with a line break, readonly both
  ways and the input, the hook gets it and wins, the TypeErrors), columnSettings.test.ts +2 (the checkboxes,
  the format, back to nothing, every type, checkbox mode), columnFormat.test.ts (the keys), texts.test.ts
  (the badges - and the checkbox of Use the column label by its text, the new one moved the indexes)
* browser: new `column-settings-edit-check.js` 9/9 (light and dark: Company read only - typing changes
  nothing; City multiline - Enter opens the text editor; both off again); column-settings 144/144,
  column-settings-more 141/141, column-settings-operator 13/13, detail-form 91/91, full-grid 11/11
* guides 08 (the dialog, the section of the parts - its anchor renamed, links in 02 and 03), 12; JSDoc of
  `ColumnConfig.readonly`, `FieldConfig.multiline`
### Find: Match case, and "Filter rows" for SQL (user request)

* the user, on Find: "find part, this needs to be supported in sql if possible. And be able to [set] if
  it's supposed to be case sensitive". Done in a worktree by an agent
* **Match case**: a toggle `Aa` in the find bar (findBar.ts), after the count and before the funnel - one
  Tab from the input, `aria-pressed`, named "Match case", the tooltip `Match case (Alt+C)` (a `.mac` text
  without the key). Filled with the accent colour as "Filter rows" (the bar's existing `[aria-pressed]`
  rule), the weight of the filter editor's Aa. **Alt+C** in the bar, as Firefox and VS Code, by the letter
  the key types (`key`, not `code`): Option+C on a Mac types `ç` and is left alone, Ctrl+Alt (AltGr) too.
  State `bar.caseSensitive`, kept when the bar closes (as the text); `findMatches` / `findRowFilter` take
  it (`findCase()`: as it is, or `toLowerCase()`), so the matches, the count, the marks and "Filter rows"
  follow it - `rowFilter` has it, a change filters the rows again. The footer's chip shows the `Aa` marker
  of a condition that matches case. API: `find(text, { caseSensitive })`, `FindResult.caseSensitive` (in
  `find-change`). The find input got `min-width: 24px` (was 40): five buttons stay whole in a 160px grid
* **SQL - the design**: Find matches the text the cells show, a database has the values, so "Filter rows"
  can not be the SQL as it is. Kept: the browser's row predicate (the rows shown = the marked cells, as
  documented). New: `gridInterface.getFindFilter(): FilterExpression | null` (findFilter.ts, no dom) -
  "Filter rows" as a filter a backend ANDs to `getFilter()` and gives `toSqlWhere()` like any filter; null
  while it shows every row. An OR of a condition per field of the layout, only where SQL can match the cells
  as they show: a text field shown as it is (the built-in TextFormatter, no template, no type per row)
  `CONTAINS` + `literal` (+ `caseSensitive`); a lookup column `IN` the values whose cell text (the lookup
  formatter: the label) holds the text, `caseSensitive: true` on a text field (exact values), no blank, no
  `'NULL'` (IN's blank); a number `EQUAL` the number the cell's formatter parses, when the cell of it shows
  the text (and a blank cell too, for 0 - EQUAL 0 is the blanks); a date / datetime `EQUAL` the day /
  second when the cell of its start and of its end both are the whole text (a partial date - the formatter
  completes `2026-03` with today's day - is none). No field: `IN []` on the first (`1=0`). So the SQL
  selects the rows "Filter rows" shows or fewer, never one without a match - equal on text and lookups
  (tested on SQLite). The numbers and dates by a part of their text (`30` in `130`) can not be SQL: left out
  rather than a superset; the rows the backend sends are filtered again by the browser's predicate anyway.
  `getFindFilter({ fields })`: only the fields the backend has (a field made in the browser), `toSqlWhere()`
  throws for others; the no-row condition then on `fields[0]`
* **wildcards**: Find's text is literal, a `CONTAINS` takes `*`, `%`, `_` as wildcards and the filter
  format had no escape - so a superset for `50%`. Added `FilterCondition.literal?: boolean` (and
  `where(..., { literal })`): the text as it is. The datasource (objectFilter `hasText()`: includes /
  startsWith / endsWith / ===, filter.ts passes it) and toSqlWhere (buildWhere checks it, a `Dialect.
  wildcardLiteral()`: `!%` `!_` with ESCAPE '!', `[%]` `[_]` on SQL Server, `[*]` in GLOB) agree. Ignored
  where there are no wildcards (IN, the comparisons, other types, a valueField). The header filters and the
  filter editor do not make it; the editor's Apply drops it (draftToFilter builds conditions anew) -
  documented, not changed (shared files)
* **event**: `find-filter-change` `{ filter }` - sent from filterRows() only when the rows it filters with
  change (on, off, the text after the typing, Match case, the layout fields) and from the footer's Clear;
  not for a step or a data change (`find-change` is, which would loop a backend that reloads on it)
* the SQL sample (#sample/sql): the find's SQL ANDed when Filter rows is on (`getFindFilter({ fields:
  Object.keys(COLUMNS) })` - the phone is no column), `find-filter-change` re-renders; buttons Find "acme",
  "ACME" with match case, "50%", "30", Close find. The find sample: Match case / Any case buttons, the log
* texts `find.matchCase`, `find.matchCase.text`, `find.matchCase.tooltip`, `find.matchCase.tooltip.mac`
  (+ Norwegian; keyText's MAC_TEXTS); guides 19 (Match case, Filter rows on a backend with the table of
  field types), 22 (literal, Find's filter, five rows in "where the SQL differs"), 06, 09, 12, 13, 14
* tests: find.test.ts 62 -> 71 (match case: matches / count / marks, the toggle and the focus, Alt+C and
  not AltGr / ç / Shift, Tab order, find() options and kept on close, Filter rows follows it, the chip,
  texts and the Mac tooltip); findFilter.test.ts 16 (null cases, text + literal + case, rows = Filter rows on
  text, lookups text and number, numbers with comma / display format / numberOverride / 0, dates and
  datetime / a partial date, the left-out fields, no-row, `fields`, "never a row without a match" over 19
  texts in both cases, the event and when it is not sent); filterLiteral.test.ts 4 (the datasource); toSqlWhere.test.ts
  +6 (literal per dialect and operator, blank rows, case, ignored, checked); sqlSqlite.test.ts +1 (984
  literal conditions vs the grid on SQLite); sqlFindSqlite.test.ts 7 (the find filter on SQLite: equal to
  "Filter rows" on text + lookup fields for 35 texts x both cases, never a row more with numbers and dates,
  a lookup value without a label, snapshots of the SQL in the four dialects). 3595 tests, 157 files
* browser (Chromium 1148, port 8095): new `find-case-sql-check.js` 62/62 (default and TreDeSpace, light and
  dark: Aa by mouse / Alt+C / Tab + Space + Enter, the counts with and without case vs the datasource, the
  pressed look 3:1, Filter rows with case and the chip; the SQL sample: case, 50% escaped per dialect, 30
  EQUAL ANDed with the filter, typed in the bar, Esc). Shared: find-check.js 64/68 → a copy in this
  worktree's scripts with the three checks the fifth button changes (Tab Tab to the funnel, five buttons in
  160px with the input ≥ 24px, the Tab order) 68/68; keyboard-check 53/53, footer-no-filter-check 53/53;
  sql-sample-check 4 FAIL before this change too: it expects `"Norway"` and `DROP TABLE` in the params,
  which are folded to lower case since 924615b
* known: SQL finds a number or a date by its whole value only (documented); a lookup whose labels match
  many values can pass `limits.listLength` (1000); the lookup data changing sends no `find-filter-change`
### Detail form: collapse, softer fields, min / max and a drag of its width, fields dragged; the column chooser (user request)

* the user (screenshots of the form and the dialog's tab): "We should be able to hide/collapse. In detail
  form, it should allow us to set expanded by default, else it's collapsed", "borders for an input
  shouldn't be that strong, but more dimmed with background", "be able to set min/max would be nice, also
  allow user to resize it could be also nice", "be able to drag/drop on reorder here be nice to have,
  simple, can have a drag handle right side", "column chooser search isn't easy to see, and with also might
  drag icon on the left side, so it shows better what to do?" and later "column chooser should also let us
  override the label"
* **state** (`DetailForm`, additive): `expanded?: boolean` (default `true`), `minWidth?` (default and at
  least 150), `maxWidth?` (default none). copyDetailForm keeps each only when given; assertDetailForm
  checks them (numbers of px, a boolean, `minWidth` not more than `maxWidth` - a TypeError, nothing
  changes). `width` is laid out between them (detailFormLimits / detailFormWidth), the state keeps what it
  was given (as `width` under 150 before). JSDoc of `DetailForm`, `GridConfig.detailForm`,
  `GridState.detailForm` with examples; the typings consumer has them
* **one `expanded`, not two**: the title's button and the dialog's *Expanded* change the same part of the
  state - what the form is now (as *Width* shows the width dragged). The config's `expanded` is what the
  grid starts with, a saved state gives back what the user made it. A second field (a default beside the
  user's toggle) would only matter where no state is saved, the default is the config there already. So
  the dialog says *Expanded* (not *Expanded by default*), its hint says the button changes it too.
  Documented in guide 02 and 03
* **collapsed** (detailForm.ts): the title bar is a button (chevron + *Details*, `aria-expanded`,
  `aria-controls` the body, a tooltip *Collapse the details* / *Expand the details*) - toggleDetailForm,
  `setState({ detailForm })`. Collapsed the form takes DETAIL_FORM_COLLAPSED (24px) where it is: a strip
  at the right of the rows (the title going down, `writing-mode: vertical-rl`, the chevron pointing left),
  a bar under them in a narrow grid (the chevron up). Where it is follows the expanded width, so it does
  not jump sides when it is toggled. The same elements expanded and collapsed: the button keeps the
  focus. The body is empty and hidden while collapsed (no stops of Tab in it)
* **the fields** (grid.css): a quiet frame at rest - the new variable `--simple-html-grid-detail-input-
  border-color` (`light-dark(#d4d4d4, #5f6b7a)`; TreDeSpace slate-300 / slate-700, the library's fields)
  - on the inputs' background, the controls' frame (3:1) under the pointer and with the focus, the focus
  outline as before; an error keeps the error colour under the pointer and with the focus, the red bar
  and the message under the field unchanged. theme tests: the new variable has a TreDeSpace colour, and
  a new contrast test - the frame 1.25:1 or more to the form and to the field, less than the controls'
  frame, the focus outline 3:1 to the field - in both themes, light and dark
* **its width dragged** (new detailFormResize.ts): the left edge is a splitter (`role="separator"`,
  focusable, `aria-orientation`, `aria-valuenow` the width, `aria-valuemin` the min, `aria-valuemax` the
  least of `maxWidth` and the room at the right - half the grid, the scrolling columns keep 150px: a drag
  never puts the form under the rows). A pointer drag (followPointer, captured, `touch-action: none`)
  lays out once a frame, pointercancel gives the width back, a press that does not move changes nothing.
  ArrowLeft wider, ArrowRight narrower (10px). resizeDetailForm: the state's `width`, then
  updateMainElementSizes and horizontalScrollHandler - no rebuild (`__dataSourceUpdated` walks every row),
  but a rebuild when the scrolling columns get more room than they have column elements for
  (getMiddleColumnsNeeded) - the columns area is right while it moves. Not shown collapsed (not rendered)
  nor under the rows (css). 6px, 10px on touch, the column resize handle's colour under the pointer
* **Tab** (tabExit.ts, additive): detailFormStops is exported and has the button and the splitter first:
  Tab from the footer comes to the title's button, Shift+Tab from it goes back to the footer
* **tooltips**: the grid attached its tooltips to the rows only - the form and the column chooser get
  attachTooltips of their own (the `tooltips` option asked), so their `data-tooltip`s show
* **the dialog's tab** (detailFormSettings.ts): *Expanded* with its hint; *Width*, *Min width*, *Max
  width* side by side (empty min / max: none, placeholders `150` / *None*); setWidths keeps min <= width
  <= max, each at least 150 - the one typed keeps its value, the others follow; what is no number leaves
  them. Each field has a drag handle at its right (aria-hidden, tooltip *Drag to move it*): dragField -
  the pointer captured, a 2px line in the accent colour where it goes (before an option, or under the
  last), the dragged one quiet, the list scrolls near its edges, let go it moves there (moveField) and is
  picked; on itself nothing. Mouse, pen, finger. Move up / Move down and Alt+↑ / Alt+↓ as before; the hint
  says the handle. Apply sets `expanded` only when collapsed, the min / max only when set
* **the drag handle** (new icons.ts): six dots (6x10, `currentColor`, the quiet text colour, a grab
  cursor) - the same in the dialog's list (right) and in the column chooser (left). icons.ts has the pencil,
  the magnifying glass and the chevron too
* **the column chooser** (contextMenuColumnChooser.ts): the search is framed as the dialogs' inputs (a
  `<label>` with the controls' frame, the inputs' background, a magnifying glass, the focus outline on the
  frame), placeholder and name *Search* (`columnChooser.search` was `search`); it finds a column by its
  label (getColumnLabel - a label of the user's too) or its field name - it found the names only - and
  the list is in the order of the labels (it was the names'). columnChooserFields. Each field: the handle
  at its left, the label, a ✎ at its right
* **the ✎ of a field** (the user's later request): a button *Rename {label}*, shown under the pointer and
  with the focus, always on a touch screen (24px there). It turns the label into an input with it, the
  focus in it, all selected; Enter (or leaving it) saves, Esc cancels (not the chooser's Esc), empty is the
  column's own label (the input's placeholder). renameColumn sets `ColumnFormat.label` in the state's
  formats - the grid config dialog's *Label* - the other parts of the format kept, a format of only a label
  taken out, nothing when it is the label it has. A press in the input or on the ✎ does not drag the
  field. The focus goes back to the ✎ after Enter / Esc. Every render of the chooser makes its dragEvent
  listeners again (an AbortController per render: before, only a search did)
* touch: compact - the chooser's search 24px as the other searches (it was the 28px row height), its
  rows 28px as before; the form's title bar 22px
* texts: 13 new (`detailForm.collapse`, `.expand`, `.resize`; `columnSettings.detailForm.expanded`,
  `.expanded.hint`, `.minWidth`, `.maxWidth`, `.maxWidth.none`, `.drag`; `columnChooser.drag`, `.rename`,
  `.label`, `.label.hint`), 4 changed (`columnChooser.search` *Search*, `columnSettings.detailForm.
  width.hint`, `.fields.hint` and its Mac one); guide 12, the Norwegian sample; the texts test walks the
  form collapsed and the chooser's input
* docs: guide 02 (*The detail form*: collapsed, the fields' look, min / max, the drag of the edge, the
  keys; the column chooser's search, handle and ✎), 03 (the state's new parts, one `expanded`), 08 (the
  dialog's tab, *Label* and the ✎), 10 (a section *The column chooser*, touch), 13 (the new variable; the
  chooser's search on the inputs' background), 14 (the button and the splitter, the chooser's keys); the
  sample *Detail form* (min 200 / max 600, a Collapse / expand button, the description)
* tests: detailForm.test.ts 31 -> 46 (collapsed: the button, its tooltip, the strip, focus kept, under the rows a
  24px bar, Tab; min / max laid out and their TypeErrors; the splitter's attributes, a drag live / at its
  limits / pointercancel / a press, its keys, the rebuild when the column elements are too few; the Tab
  tests: the button is the first stop), detailFormSettings.test.ts 10 -> 19 (Expanded, the widths and
  setWidths, Reset / Cancel of them, the handles, a drag with its line, up / on itself / cancel, a click on
  a handle), new columnChooser.test.ts 13 (the search framed, the tooltips, labels sorted, found by label / name / a
  user's label, the handles, a press on the ✎ is no drag, rename: Enter / Esc / blur / empty keeps the
  other parts, renameColumn), themeTredespace.test.ts +4, texts.test.ts (the walk). 3592 tests, 155 files
* browser (Chromium 1148, port 8096): new `detail-form-more-check.js` 120/120 in the four looks (the
  fields' frames and their contrast, hover, focus, an error in the full grid; collapse by a click, Enter,
  Space - the strip, the rows to its edge; Tab: the button, the splitter, its keys; a mouse drag live,
  stopped at min 200 / the room; the state round trip; the dialog: Expanded, Min over the width, a field
  dragged by its handle with the line, Alt+↑, Apply; a phone: under the rows, collapsed to a 24px bar by a
  tap, a field dragged by a finger) and `column-chooser-more-check.js` 76/76 (the search framed, its focus,
  sorted, found by name / by a user's label, the handles, a field dragged into the header, the tooltips,
  the ✎ under the pointer, rename / Esc / empty / keys, a phone: the ✎ 24px always, a tap and a label).
  Both in this worktree's `.claude/browser-checks/scripts/`. The shared checks, unchanged, against this build: detail-form 91/91, column-settings 144/144,
  full-grid 11/11, keyboard 53/53, touch 61/61, menus-regression 25/25
* **open**: the chooser's drop on a label's center replaces that column (dragEvent's, as before); the
  sticky hover of the title's button after a tap on a phone (as the other buttons); a double click on the
  splitter to go back to the default width, Home / End on it - not made
### Header filters: filter as shown, filter as you type (user request)

The user: "when we set to iso week etc, it could be useful if it could also use that formatting as filter?
Is that possible with sql etc? Maybe a way to set if filter is supposed to follow formatting?" and "In
operator part, we could have added filter after typing, so you don't need to hit enter too, can be useful
some places, prob should be under column settings too".

**Filter as shown** (`ColumnFormat.filterAsShown`, on by default; new `src/grid/filterAsShown.ts` - pure,
and `gridFunctions/headerFilterFormatter.ts` - the grid's side):

* the header filter of a column with a display format takes the text as the cells show it. A date format
  is a period - parseDateAs: a day (iso, norwegian, norwegianShort - 00-29 is 20xx as Excel, us, uk; medium /
  long / full read with Intl's order and month names of `format.locale`), a week (weekIso: Monday-Sunday,
  week 1 has January 4; weekUs: Sunday-Saturday inside the year, 2026-W53 is 27-31 Dec, 2027-W01 1-2 Jan -
  the templates `format.weekIso` / `.weekUs` / `.quarter` read back, `uke 47 2026` too, any case), month,
  quarter, year, daysUntil (today + n), the minute (isoTime, norwegianTime) and the second. weekday, time,
  timeSeconds are no period: today's parsing (NOT_FILTERED_AS_SHOWN). An ISO date typed (and the ISO text
  of a Date from JSON) is read as the period it is in (readDateAs). canFilterAsShown tries a sample date
  through the format and back: a translated template without `{year}`, a language whose names are not
  read back, are not filtered as shown
* **the filter stays plain conditions** (dateConditions): `=` BETWEEN start and last, `≥` start, `>` last,
  `<` start, `≤` last, BETWEEN `[start(from), last(to)]`, open ends kept. The last is the last day for a
  `date` field, 23:59:59 for a `datetime` (they compare the day / the second). A one-day period on a
  `date` field, one second on a `datetime`, is the condition as before (`EQUAL` the day). **≠ of a
  period**: an OR group `LESS_THAN start, GREATER_THAN last, IS_BLANK` - as NOT_EQUAL_TO a day matches a
  blank date (the grid and the SQL do). The header filter owns that group (isOutsidePeriod, the exact
  shape): filterWithoutColumn replaces it, columnConditions flattens it - so typing again does not stack
  groups, and the filter editor's Apply clears the cell when the group changed. toSqlWhere is unchanged:
  a week is `col >= Monday AND col < next Monday` in each dialect, the index works
* **what the state stores**: as before, the parsed value - a Date, the **start of the period typed**
  (`2026-W47` is Monday 00:00, a BETWEEN the starts of both ends), a number. The cell shows it through the
  header filter's formatter (asShownFormatter: `format` in the display format, `parseFilter` the period's
  start, an example as the placeholder) - `2026-W47` again after a render and after JSON (the ISO text is
  formatted as a Date is). Considered: storing the typed text - it round-trips trivially, but a format
  changed afterwards could no longer read it, and daysUntil would drift from its fixed conditions. With the
  date the cell always shows what is filtered (daysUntil `5` shows `4` tomorrow: the dates are fixed)
* the formatter is swapped in one place for every reader of the text (headerFilterFormatter): the cell,
  filterCallback, the placeholder (defaultFilterPlaceholder, now with the dialog's draft format), the range
  block of the filter menu (its inputs, the pickers), the date picker and the range picker from the cell
  (a day picked in a week column writes `2026-W47`; pickerRange opens the range picker from Monday of the
  first week to Sunday of the last). A number format: parseNumberAs (its thousands separator and any space
  out, its decimal mark, a dot also when it is no separator; percent a hundredth), shown with the format's
  separators and the decimals the number has (formatNumberTyped: `12.34` stays, not rounded to `12.3`)
* a format changed by the user (Format ›, the dialog's Apply) runs a header filter with a value again when
  the column now reads its text another way (refilterChangedFormats): week → month shows `2026-11` and
  filters November, → Default the day. `setState({ formats })` from code leaves the filter. Format ›
  Default drops `filterAsShown`
* the datetime formats take the whole text only (`2026-11-22 13:45`): a shorter text (the date alone) would
  be stored as its start and come back as the first minute - an ISO date typed is that minute, as the cell
  then shows
* assertColumnFormat: `filterAsShown` true or false, for a date / datetime / number field, not a lookup
* the dialog: *Filter as shown* under the format picker (formatSettings), on by default, `filterAsShown:
  false` when off; greyed out with the hint *Not for the day of the week or the time of day...* for a
  format that can not

**Filter as you type** (new `gridFunctions/filterOnType.ts`):

* state like Match case: `HeaderFilter.filterOnType` (true / false, only when it differs from the default,
  `__setHeaderFilterOnType`; storeHeaderFilter keeps an entry that only has it). Defaults:
  `ColumnConfig.filterOnType`, else `GridConfig.filterOnType`, else off. Never a boolean column. The
  config check: true or false
* the toggle `filter.filterOnType` (✓ while on): at the bottom of the operator choice under a line
  (`filter.filterOnTypeSeparator` - openOperatorChoice; Operator › itself is unchanged), in Filter › after
  Match case (MENU_IDS.filter), and the dialog's *Filter as you type* after the operator (applied as the
  toggle, Reset column / all back to the default)
* renderHeaderFilter: an `input` listener starts a 300ms pause (FILTER_ON_TYPE_DELAY, one per grid, a
  WeakMap); at its end the text is filtered when it differs from the last filtered and parses
  (filterTextParses: a number with a digit, a date of year 1000-9999 - `202`, `2026-W` half typed do not;
  a BETWEEN each end; text always; empty removes the filter) and the cell still shows the same column (the
  cells are reused). Enter, blur, change and opening a menu cancel the pause; Enter does not run again on a
  text filtered while typing (it does as before without filter as you type). keepHeaderFilterFocus
  (exported) keeps the caret too - the filter renders the rows, not the header, so the input stays

**A fix found by the browser check** (not of this feature, it made the operator choice look broken):
rebuildHeaderColumns made the middle header columns at the start of the section, and only a scroll placed
them - a header rendered on its own (an operator picked, a filter of the menu applied, Clear, the filter
editor) while scrolled sideways showed the first middle columns and empty headers over the ones in view.
horizontalScrollHandler's header part is `placeHeaderColumns(ctx, type)` now, called by
rebuildHeaderColumns for the middle section too (scrollHandlers.test.ts has it).

* texts: `filter.filterOnType`, `filter.placeholder.daysUntil`, `columnSettings.filterAsShown` / `.hint` /
  `.off`, `columnSettings.filterOnType` / `.hint`; the guide's tables, the Norwegian sample
* docs: 06-filtering (Filter as shown, Filter as you type, the operator choice, Filter ›), 08-formatting
  (*Filter as shown* with the formats and operators, what a display format changes, the dialog), 22-sql (*A
  week typed in the grid*), 03-state (what the state holds), 02-grid-config (the options' tables),
  12-texts; JSDoc of `ColumnFormat`,
  `ColumnConfig.filterOnType`, `GridConfig.filterOnType`, `HeaderFilter`, `GridState.headerFilters`,
  MENU_IDS
* tests: filterAsShown.test.ts (42: every format read back, the weeks around New Year - 2027-01-01 in
  2026-W53, weekUs 2026-W53 / 2027-W01 - summer time, the named dates in English and Norwegian, daysUntil
  with a fake clock, the minute and second, readDateAs of an ISO text and JSON, numbers with separators and
  percent, the formatter, each operator's conditions and the rows they select), filterAsShownGrid.test.ts
  (31: typed weeks and each operator, the ≠ group replaced, BETWEEN, the cell after a render, the state
  through JSON and run again, isoTime, daysUntil, numbers, percent, weekday kept, placeholders, switched
  off, the check, lookups, the date picker and the range picker writing weeks, the range block, Format ›
  month / Default running again, setState leaving it, the filter editor's clear, the dialog's checkbox),
  filterOnType.test.ts (21: the pause with fake timers, focus and caret, Enter / blur once, a cell reused,
  dates / weeks / numbers half typed, BETWEEN, defaults, the operator choice and Filter ›, boolean columns,
  JSON and resetState, the config check, the dialog), toSqlWhere +4 (a week as a range in every dialect,
  ≠, >, JSON), sqlSqlite +1 (the conditions of 14 typed periods × 8 operators on every date column and
  storage against a real SQLite: the same rows), scrollHandlers +1; updated: filterOperatorIndicator (the
  choice's end, End), gridMenus (Filter ›), columnFormat(Grid) (the key list; the old "keeps the field
  formatter" tests with `filterAsShown: false`), texts (the walk shows the new ids). 3652 tests, 157 files
* browser (Chromium 1148, the full grid sample, light and dark): new `filter-as-shown-check.js` 61/61 -
  Equal from the operator choice and `2026-W47`: only week 47 (50 of 5000 rows), a BETWEEN of Monday and
  Sunday, `2026-W47` again after a render; the placeholder `2026-W47`; the date picker's 18 November writes
  `2026-W47`; Between `2026-W40..2026-W47`, the range picker opens on 28 September, 7-20 September writes
  `2026-W37..2026-W38`; Updated switched to Norwegian, `16.11.2026` the whole day (00:00 to 23:59:59);
  Credit `5 000,5` is 5000.5, shown so again; Company: Filter as you type turned on in the choice (✓, the
  state), Begins with - no filter in the pause, the rows change without Enter, the focus and the caret (3)
  stay, a letter in the middle keeps the caret after it, Enter after the pause runs no filter; the dialog's
  two checkboxes, greyed out with its hint for Day of week; no page errors. Screenshots in
  `.claude/browser-checks/shots/filter-as-shown/` of this worktree. The shared checks against it:
  range-block 81/81, date-range 168/168, display-format 39/39, filter-case 73/73, column-settings 144/144,
  column-settings-more 141/141, keyboard 53/53, touch 61/61; operator-indicator 67/77 - it expected the
  choice to end with Between (its ids, End): the copy in this worktree's scripts expects the line and
  Filter as you type at the end (End, ArrowUp, Enter picks Between) and passes 79/79
### Column settings: colour rules (user request)

* the user: "In column settings, I would like us to be able to add conditional coloring. So it's easy to be
  able to set color on text, or bg based on it."
* **the rule** (new colorRules.ts, exported types `ColorRule`, `PaletteColor`): `ColumnFormat.rules?:
  ColorRule[]`, `{ operator, value?, color?, background?, bold? }` - a part of the column's format, so the
  state keeps it with the rest: Apply, Cancel, Reset column / Reset all, `getState()`, JSON, `initialState`,
  and the developer's `ColumnConfig.format`. Any column, a lookup column too. **The first rule that
  matches wins**
* **the condition is the header filter's**: `value` is text as typed in the header filter (JSON-safe, a
  date too), read as filterCallback reads it - a text as it is (wildcards, case unless the column's
  `filterCaseSensitive`), a number / date with the field's formatter (`parseFilter`, else `parse`), a
  BETWEEN's ends each (`[from, to]`, an end `''` open), a boolean `'true'` / `'false'` - then tested by the
  datasource's own `Filter` (one module instance; `isIgnoredCondition` first: a rule without a value
  matches nothing, not everything). So `≥ 100`, *contains late*, 0 is blank mean what the header filter
  means. **A lookup column** compares the label of the lookup row of its value, as valuesWithLabel does for
  its header filter (a value the lookup has not never matches); Is Blank / Is Not Blank the value.
  Operators: the type's (`operatorsFor`, a lookup's a text's) without IN / NOT_IN (a list; one rule per
  value). A value the field's formatter does not read (`22.11.2026` in a `YYYY-MM-DD` column) matches no
  cell - the header filter filters nothing with it; the dialog says so
* **checked** (`assertColorRules`, from assertColumnFormat, `TypeError`, config and setState): a list of
  objects of the five keys, an operator of the type (IN / NOT_IN told to make a rule per value; a lookup
  column told it compares labels), `value` text / `[from, to]` of text / none for the blank operators, a
  value there for an operator that compares, `color` / `background` of the palette ("no hex colours"),
  `bold` boolean, something to colour. `colorRuleProblem()` is shared with the dialog
* **the cells** (new showCellColor.ts): the classes of the rule on the cell element -
  `simple-html-grid-cell-text` + `-text-<colour>`, `simple-html-grid-cell-bg` + `-bg-<colour>`,
  `simple-html-grid-cell-bold` - toggled on every render (a recycled cell loses the old ones), none on a
  group row and an empty cell, and in `showEdit` (the colour follows the value as it is typed). On the cell
  element, so every kind of cell has them: input, multiline (its lines), checkbox (boolean and
  `format.checkbox`), link, template, a custom cell (its host's text inherits; a renderer's own colour wins -
  the sample's badge keeps its colour on the orange). The detail form's input / textarea get the classes
  (not a checkbox). Not the exports (said in guide 15), not group rows or the totals row
* **css** (grid.css): the colour classes set `color` / `background-color` from the palette's variables; the
  text of a cell takes it (`color: inherit` on its input, lines, custom host, link, the preview's link).
  **What wins**: an error and a match of Find - `:not()`ed out of the colour rules, such a cell shows as
  without a rule (its tint, the grid's text): they stand out, and Find's yellow is never taken for a yellow
  rule; a range's tint is a background-image over the rule's background; the selected row keeps its colour
  in the other cells, the rule's background is the cell's over it; focus outline, edited and multiline
  markers on top; bold stays. No border-radius
* **the palette**: 14 variables `--simple-html-grid-palette-<colour>-color` / `-bg-color` (red, orange,
  yellow, green, blue, purple, grey), light-dark(), in grid.css and theme-tredespace.css. Contrast pairs
  added to CONTRAST_PAIRS (+245, both themes, light and dark): a text colour 4.5:1 on the rows, the selected
  rows, a range's tint over them, the inputs, every background of the palette (and a range over it); the
  text and a link 4.5:1 on every background (+ range); focus, row state, conflict, multiline, range line 3:1
  on the backgrounds. Picked with a solver over OKLCH (a scratch script): the most vivid colour of each hue
  that keeps the pairs. Default light: dark text (`#90101a` ...), 200-level backgrounds. Default dark: the
  rows are mid grey (`#4b5563` / `#5a6370`), 4.5:1 there leaves only light tints for the text colours
  (`#ffe4dd` ...) - the 900-level backgrounds carry the colour. TreDeSpace: the library's Tailwind steps -
  text red / blue / purple 800, orange / yellow / green 900, slate-700 (light), 300 (dark); backgrounds 200 /
  slate-300 (light), 950 / slate-800 (dark); blue's background is **sky**: blue-100 / 200 / 950 are
  TreDeSpace's selected rows. A grey background is not the line colour (a cell's lines stay)
* **the dialog** (new columnSettingsRules.ts; columnSettings.ts got `ruleSettings()` before the preview, a
  badge *Colours*, the rules' problems in `withProblems`, the preview's classes): *Colour rules* (a group
  with its hint), *No rules*, each rule a group *Rule n*: the operator picker (the header filter's names -
  `filter.operator.*`, `filter.filter.isBlank` / `isNotBlank` - the column's `filterOperators`, a ✓ on the
  one in use), its value (From / To for Between, none for blank, a checkbox *Checked* for a boolean column),
  Move up / Move down / Remove rule (aria-disabled past an end, the focus follows the rule moved, to the next
  Remove or Add rule after a remove), *Text colour* and *Background*: native radio buttons drawn as 20px
  squares (`appearance: none`), a `radiogroup` each, named by colour (*None*, *Red* ...) with a tooltip, one
  stop of Tab, the browser's arrows; the picked one a 2px frame in the text colour inside a ring (shape, not
  colour only); *None* crossed out. *Bold*. *Add rule*: the column's header filter operator, red text on red
  (a spreadsheet's first highlight), the focus on its operator. Problems under the rule at once (no value,
  nothing to colour: Error, Apply held), the unread value too (not held). The draft's rules are written in
  ColorRule's key order (a saved state reads the same). The preview shows the colours of the matching rule;
  a checkbox and a lookup column get a preview when they have rules (the checkbox, the label)
* texts: 24 new (`columnSettings.badge.rules`, `columnSettings.rules.*` with the seven colour names), guide
  12's table, Norwegian in the translation sample; texts.test's walk shows them all (a rule on a lookup, a
  date and a checkbox column)
* docs: 08 (*Colour rules*: the parts, the condition, lookups, first wins, the palette, where, what wins,
  checks, state; the dialog's list; the intro), 13 (*Colour rules*: the variables, the dark default's pale
  text and why, the classes, error / Find; the variables table; TreDeSpace's table), 02 (`format`'s parts,
  the detail form), 03 (state), 14 (the dialog's groups and swatches, the keys), 15 (not exported), 21 (a
  custom cell); JSDoc of `ColorRule`, `PaletteColor`, `ColumnFormat.rules` and its example; typings
  consumer (a hex colour and a number value are type errors). The full grid sample: Balance < 0 red text (its
  data has one balance in eleven below 0 now), Status = waiting an orange background (the custom badge
  cell); *Formats: Norwegian* keeps Balance's rules; the description mentions them at the same length (719
  characters, was 720)
* tests: new colorRules.test.ts (28: every operator of every type against the header filter itself -
  filterCallback - and the datasource's filter: text, case sensitive, number with Between, date, datetime,
  lookup labels, checkbox, blanks / 0; the condition, the problems, the classes; first match wins; the cells
  of every kind, recycled while scrolling, typing / undo / code, setState / updateConfig / resetState, group
  rows, error and Find classes beside them, the detail form, JSON; the TypeErrors; grid.css's selectors),
  columnSettingsRules.test.ts (16: the section on every kind, the config's rules, the swatches, Add rule and
  its problem, the operators offered, Between / blank / back, swatches and Bold, Move up / down and the
  focus, Remove and the focus, a checkbox column, an unread date, the preview, Apply / Cancel, Reset, JSON);
  columnFormat (the keys), texts (the walk), theme contrast pairs. The equivalence tests mount a grid of one
  column: each header filter run renders the grid, eleven columns ran the worker out of memory.
  3596 tests, 156 files (was 3552, 154)
* browser (Chromium 1148, port 8093): new `color-rules-check.js` 90/90 in the four looks + a phone - the
  sample's rules drawn in the palette's colours of the look (computed against the variables, 4.5:1+), the
  custom badge on orange; a rule by mouse (Add rule -> the focus on its operator, a value, swatches, Bold,
  the badge, 20px square swatches, no rounded corners, Apply & close -> Age >= 60 green and bold, the
  state); a rule by keyboard (Enter on Add rule, Enter on the operator, arrows + Enter pick Less than, Tab
  past Move up / Move down / Remove to the text colours, ArrowRight picks Orange with an outline, the
  backgrounds, Bold by Space, Move up / Remove by Enter with the focus following, Apply & close by Enter ->
  Credit < 1000 orange and bold); scrolling keeps each Balance cell's colour; a selected row and the focused
  cell (the red text 4.5:1 on the selected blue, the outline 3:1); the detail form's value in red; Find's
  matches without the orange; a phone (390px): the rules wrap inside the dialog. The screenshots looked
  at: clear colours in light and in
  TreDeSpace dark; the default dark's red text a pale pink, as the contrast asks. Shared checks:
  column-settings 144/144, column-settings-more 141/141, column-settings-operator 13/13, full-grid 11/11,
  detail-form 91/91, custom-cells 39/39. The new script is in this worktree's
  `.claude/browser-checks/scripts/`
* not done, candidates: Excel fills / font colours (the export writes no style per cell yet); a rule
  compared with another field (`valueField`); IN lists in one rule; a whole row's colour from a rule (the
  `rowClass` hook does it in code); `fitColumns()` measures the normal weight - a bold cell can be a few px
  wider; a date picker for a rule's date value

### The placeholder of the column settings is the empty cells' (user request)

* the user, after the column settings got a placeholder with "Use the column label": "filter placeholder,
  that was supposed to be for row..." - the placeholder an empty cell shows (`ColumnConfig.placeholderRow`),
  not the header filter's
* columnFormat.ts: `ColumnFormat.placeholder` / `placeholderLabel` are `placeholderRow` / `placeholderRowLabel`
  (not released yet: renamed, not kept) - over `ColumnConfig.placeholderRow`; `rowPlaceholder(column, label)`
  in renderRowCell.ts. The header filter has its own again (`defaultFilterPlaceholder`; headerFilterPlaceholder
  went). The dialog's *Placeholder* (was *Filter placeholder*) shows the column's own `placeholderRow` in its
  input, not for a checkbox column or one shown as checkboxes
* tests: columnFormatOptions (the empty cells, every row with `placeholderRowCurrentEntityOnly: false`, the
  current row only by default, the header filter's own, the TypeError), columnFormat (the checks), columnSettings
  (the dialog); the typings consumer; guides 02, 03, 08, 12
* browser: the shared `column-settings-more-check.js` reads the current row's Company input and the header
  filter's own placeholder (backup `.before-row-placeholder`): 149/149
### Edit permissions: add, change, delete (user request)

* the user: "also nice if we can set edit only allows new, only delete or only change. or some of them...
  good way to control outcome, stopping someone"
* **the option**: `GridConfig.edit?: EditPermissions` - `{ add?, change?, delete? }`, each `true` when it is
  left out (new exported type `EditPermissions`). Named `edit` because it is the other half of
  `readonly: false`: readonly turns editing on, `edit` says which of it; `add` / `change` / `delete` are the
  user's words (new, change, delete) and `add` is `addNewEmpty()`'s. An object, not three flat booleans: the
  three are one rule set, read and documented together, and `updateConfig({ edit })` replaces it as a whole
  (one left out is allowed again - said in the JSDoc and guide 02), as `detailForm` and `texts` are
* **a permission, not state**: not in `GridState` (setState can not take it - a type error in the typings
  consumer), not in a menu or the grid config dialog. The column's `readonly` is different - the user's
  *Read only* (`format.readonly`) of the column settings wins over it - so it is documented as a default the
  user can change, and `edit` as what they can not; the isReadonly hook can not unlock a row it locks either
* **checked** (`assertEditPermissions`, `TypeError`, the constructor and `updateConfig()` before anything
  changes): an object, only `add` / `change` / `delete`, each boolean or undefined - a misspelt `chnage:
  false` or `'false'` would leave the user allowed without a word
* **one place for the rules** (new editPermissions.ts: `editPermissionsOf`, `mayChangeRow`,
  `mayChangeValues`, `mayDeleteRow`, `isNewRow`), asked through the GridInterface: `__isCellReadonly(row,
  field)` is `true` for every cell of a row the permissions lock (before the hook, so every per cell path
  follows without a change of its own: typing, the text editor, the date picker, lookups, checkboxes, custom
  cells, paste, clear, fill, the row menu's Paste / Clear entries, the detail form); `__canChangeRow(row)`
  (readonly grid or a locked row: what renderRowCell and the detail form used `config.readonly` for - the
  look, no stripes); `__canChangeValues()` (some value can change: the gates of paste, Delete on ranges,
  Ctrl+D, `fillDown()`, the fill handle, the row menu's Paste › / Clear › - all `config.readonly` before);
  `__canDeleteRow(row)` (deleteRows.ts `canMarkRow`: the row menu's Delete › Row / Rows and Delete on a row
  number). Without `edit` every one of them is what `readonly` alone was: no behaviour changed (the 3785
  tests before passed unchanged)
* **the rules**: `change: false` locks the rows that were there; **a new row** (`__isNew`) can be changed
  while `change` or `add` allows it - who may add a row may fill it in; after `acceptChanges()` it is a row
  that was there. `delete: false` stops marking rows that were there; **a new row can always be taken out**
  (Delete ›, Delete on its number, Undo row edits) - not on the server, nothing is deleted, the undo of an
  add. `add: false`: the grid has no add of its own (checked: no menu entry, no key, paste adds no rows) - it
  is for the app's add button and for new rows the app adds, which can not be filled in with `change: false`
  too. With `change` and `add` both false nothing can change: no Paste › / Clear ›, no fill handle, Ctrl+V,
  Delete and Ctrl+D are the browser's, as in a readonly grid
* **what still works**: undo / redo (the history has only what was allowed and the app's code edits), the
  reverts (Undo cell edit, Undo row edits, the edited marker's click), taking a deletion mark off - they put
  back what was. A permission taken away at runtime leaves the history: the docs say to call
  `clearHistory()` with it when a redo must not bring back what was done before. The app's own code
  (`addNewEmpty()`, `markForDeletion()`, a value set) is not stopped; `gridInterface.fillDown()` goes through
  the grid and follows them
* **the menus**: the cell menu keeps its shape - Paste cell / Clear cell greyed out on a locked row (they
  were greyed for a readonly cell already), Delete › Row / Rows greyed out on rows that were there; the
  submenus Paste › and Clear › hidden only where no value can change (as in a readonly grid); Delete › and
  Undo / Redo › stay in an editable grid. The row number's menu is the same function: Delete › greyed the
  same way
* the sample: new *Edit permissions* (`samples/demo/samples/editPermissions.ts`, after Editing & row state):
  starts as add only, a button per permission as a developer would set them (`updateConfig({ edit })`),
  *Add new row* disabled when add is off, *Save* (acceptChanges) shows a new row become locked, the detail
  form beside the rows
* docs: guide 05 (new *Edit permissions: add, change, delete* - the option, a table of what each stops and
  what stays, the menus, what still works, the app's code, the hook; *Deleting rows*), 02 (options table,
  hooks, updateConfig, detail form), 10 (the row menu table, the `visible` note), 17 (paste, fill), 20
  (lookups), 21 (custom cell `readonly`); JSDoc of `GridConfig.edit`, `EditPermissions` (with examples),
  `readonly`, `ColumnConfig.readonly`, `DetailForm`, the isReadonly hook, `CellRenderContext.readonly`,
  `updateConfig()` and the constructor's `@throws`, MENU_IDS.row's table; typings consumer. No new texts
* tests: new editPermissions.test.ts (64: the rules of all 8 combinations; defaults, the TypeErrors,
  updateConfig before anything changes and as a whole, not state, the config not changed; `change: false`:
  inputs, typing, no stripes, checkbox, date picker, multiline editor, lookup button / F4 / Delete, a custom
  cell's `readonly`, the hook and the user's Read only not unlocking, acceptChanges, updateConfig at runtime
  (an open editor closed unsaved, an open menu closed; another option leaves them);
  a pasted block, one value, Delete on ranges, Ctrl+D / `fillDown()`, the fill handle, all the browser's
  where nothing can change; the row menu's entries, Clear / Paste (selected rows); the detail form and
  updateConfig; undo / redo of a new row, the reverts of a code edit; `delete: false`: Delete › on cell and
  row number menus, Rows (selected), Undo (selected), Delete on a row number, Undo row edits on a new row;
  delete only; add false; every combination in a mounted grid; a readonly grid stays readonly). 3849 tests,
  164 files (was 3785, 163)
* browser (Chromium 1148, port 8094): new `edit-permissions-check.js` 57/57, light and dark - a row that was
  there: real typing, Ctrl+V of a block, Ctrl+D, the detail form write nothing, Paste cell / Clear cell /
  Delete › Row greyed out, Delete on its number marks nothing; *Add new row*: typed into, Ctrl+D from the
  row above, Ctrl+V, the detail form, its menu entries usable, Delete on its number takes it out and Ctrl+Z
  brings it back; the buttons: change on -> typing writes, delete on -> Delete › Row usable, add and change
  off -> the new row readonly, no Paste › / Clear ›, the add button disabled; Save -> the new row locked.
  The screenshots looked at: the menu with the greyed Delete entries, the new row typed in, the locked rows
  as in a readonly grid (no stripes), light and dark. Shared checks: keyboard 53/53, fill 12/12, row-delete
  6/6, row-number-menu 7/7, detail-form 91/91, custom-cells 39/39, lookup 55/55, full-grid 11/11, touch
  61/61. The new script is in this worktree's `.claude/browser-checks/scripts/`
* **`updateConfig({ edit })` closes what is open**: a menu (its entries were worked out under the old
  permissions - Delete › Row marks without asking again), the date picker, a lookup's list and the editor of
  a multiline cell (not saved: its row may be locked now). The rebuild does not close them (only a
  disconnect does). Only for `edit`: `updateConfig({ readonly })` leaves them as before
* not done, candidates: an add row entry of the grid's own (a row menu entry, a key) - `add` would hide it;
  a permission per column (`change` for some fields only - the isReadonly hook does it in code);
  `updateConfig({ readonly: true })` closing the open editors the same way

### Docs site: the full grid sample about 30 rows (user request)

* the user: "full grid sample, show height of grid to around 30 rows". It filled the height the page left
  (`flex: 1`, no max) - 60 rows in a tall window
* index.css: `.stage-full .demo-grid-host` is `--demo-grid-max-height` high (30 rows with the default heights;
  30.6 measured), not flex; the page scrolls in a low window
* browser: the shared sidebar-toggle-check.js expects about 30 rows (28 to 31) where it expected more than 30
  (backup `.before-full-30`): 15/15; full-grid 11/11, sample-height 5/5, detail-form 91/91, color-rules 90/90

### The multiline editor: a ✕ (user request)

* the user, a phone screenshot of the editor with "Ctrl+Enter to save, Esc to cancel" under it: "multiline box,
  add also a close x bottom right in footer panel, useful for mouse/touch" - a finger has neither key
* textEditor.ts: the hint is in a footer row with a ✕ button at its right (`.simple-html-grid-text-editor-close`,
  20px, the touch row height on a finger): it saves and closes as a click beside the editor does, the focus
  back in the cell - its mousedown is prevented so the focus stays in the text (Safari does not focus a
  clicked button, and a phone's keyboard does not flicker). A readonly editor's ✕ is "Close". The editor
  attaches the tooltips (the ✕'s), hides one on close. Texts `cell.multiline.close`, `.closeReadonly`
* multiline.test.ts +2; guide 05 (the editor's table), 12
* browser: new `text-editor-close-check.js` 10/10 (a phone: tap to open, the 28px ✕ at the bottom right, a
  tap saves and closes; wide dark with the mouse: saved, the focus back in the cell); multiline-lines,
  keyboard, custom-cells as before
### Docs site: a feature overview (user request)

* the user: "Maybe docs should have a feature table / tables / list?". What the grid can do was spread over 22
  guides and 35 samples; nothing said it at a glance - for a developer weighing the grid, or a power user
* new `guides/00-features.md`, *Feature overview*: 19 tables by area (data and setup, columns and layout,
  display and formatting, filtering, sorting and grouping, selection and clipboard, editing, find, detail form,
  grid config dialog, menus, export, state, live data, theming, texts and translation, accessibility, touch,
  SQL helpers), each `Feature | What it does | See`: one plain line per feature, and links to the guide's
  heading and the sample (every sample is linked). Then the keyboard shortcuts used most, `Keys | What they
  do`, linked to the full list in guide 14. Only what is there: each line checked against the guides and the
  samples (a row menu filter has Replace / Add, not "leave out"; CSV separators `,` `;` tab). Calculated
  columns are left out (built in parallel, the user adds them)
* a guide, so `check:docs` checks its links and headings and the site renders it as the others; in the
  sidebar a section of its own, **Features**, between Status and Developer Guide (index.ts: the guide
  `features` goes there, the rest to the Developer Guide). Being the first guide it is the **start page** of
  the site (no hash) - was Getting started. Getting started's *Where to go next* links it
* index.css: `.doc table` is `display: block; overflow-x: auto` - a table wider than the page scrolls in its own
  box instead of the whole article sideways (a phone, the option tables of guide 02). The overview's tables
  (`.doc[data-guide='features']`, the attribute set by renderGuidePage) are as wide as the page with the same
  fixed columns, so the 19 read as one list; narrower columns under 600px so they fit a 390px phone
* README: a *Features* section, 15 highlights, linking the overview on the site and the file
* tests: site.test.ts expects the sections Status, Features, Developer Guide ...; the start page
  `#guide/features`; new test of the overview (its own section, the tables and their columns, every link to a
  page of the site, more than 25 samples linked). 3851 tests, 164 files
* browser (Chromium 1148, port 8095): new `features-page-check.js` 21/21 - the sidebar, the start page, the
  same column widths in every table, light and dark colours, all 143 links (108 guide headings found and
  scrolled to, 35 samples open with a grid), a phone: no sideways scroll, no text out of a cell, guide 02's
  tables scroll in their own box. Screenshots looked at (desktop and phone, light and dark). Shared:
  sidebar-toggle 15/15, sample-height 5/5; full-grid 10/11 - it opened `#guide/02-grid-config`, no route,
  which showed the start page; the copy in this worktree's `.claude/browser-checks/scripts/` opens
  `#guide/grid-config` (backup `.before-features`): 11/11
* not done, candidates: a check that every sample is in the overview (it would fail the merge of a new
  sample until its line is written); the User Guide page is still the TODO
### Keyboard shortcuts help (user request)

* the user: a help overlay of the grid's keyboard shortcuts, opened from the keyboard (`?` when not typing,
  maybe F1 or Ctrl+/) and from the UI
* the keys: `?` where the key types nothing - a readonly cell, a checkbox, a column header, a row number, a
  button of the grid - and Ctrl+/ (Cmd+/) anywhere in the grid, also while typing in a cell, a header
  filter or the find bar (as Google Sheets and Docs). One keydown listener on the grid element, next to
  Find's (createDom): it leaves a key that is used already (a character typed in a lookup cell opens its
  list, in a custom cell its editor - canceled) and the keys of an IME. "Types nothing": not an input or a
  textarea that is not readonly, not contenteditable; the element is the first of the event's path (a
  shadow root). F1 was left out: Chrome's help on Windows, and nothing it adds to Ctrl+/
* the UI: *Keyboard shortcuts…* in the header menu after *Column settings…* (`header.shortcuts`, its hint
  Ctrl+/ - ⌘/ on a Mac). Not in the footer (no more stops of Tab there, another task works on it) and not
  in the grid config dialog (a dialog from a dialog)
* `GridConfig.shortcutHelp` (default `true`): `false` turns the keys and the menu entry off;
  `gridInterface.openShortcutHelp()` opens it from code always. A lookup's dropdown grid has it `false`
* the dialog (shortcutHelp.ts): a modal `<dialog>` of the filter editor's kind (dialogFrame.ts: moved,
  resized, Esc, the focus back), a search (the column chooser's look), a hint (the arrows are the caret's,
  Alt moves between the cells), a table per group - its caption the title, the keys a row header of
  `<kbd>`s, what they do a cell. Opened by a key the focus is in the search; by a click on the dialog (a
  phone's keyboard). The search keeps the entries whose text, keys or group have the text, else a status
  says none does
* the list (shortcutList.ts): 9 groups, 52 entries - moving around, selecting cells, in a cell, changing
  values, copy and paste, find, filters / headers / groups, menus, dialogs and this help. Each key was
  checked against its handler (cellRowKeyNavigation, jumpKeys, rangeSelection, renderRowCell, customCell,
  textEditor, lookupEditor, undoRedoKey, fillDown, rangeClipboard, deleteRows, columnNumbers, findBar,
  renderHeaderFilter, cellFilterKeyNavigation, headerLabelKeydown, renderRowGroup, showMenu,
  addMenuListeners, gridConfigTabs, detailFormSettings, renderFilterEditor). Not listed because the grid
  has no such key: Ctrl+A, Ctrl+X (the input's own cut), Shift+Space / Ctrl+Space. An entry can be left
  out where its keys do nothing: `editable` (a readonly grid), `operatorIndicator`, `shortcutHelp`,
  `notMac` (Alt+C)
* platform: on a Mac ⌘ ⌥ ⇧, in a Mac's order and without the `+` (⇧⌘Z) - keyText.ts's `.mac` texts.
  The key names are texts (`shortcuts.key.*`, Strg / Entf for a translation); a letter, F2 and the arrows
  are shown as they are
* one list for the dialog and the docs: guide 14's *Every key of the help* is made from it
  (`src/grid/__tests__/shortcutDocs.ts` prints it), a test checks the guide has it as it is, and that every
  key of the list is in the guide's keyboard section (where each key is described, and tested)
* texts: 90 `shortcuts.*` and `header.shortcuts(.hint, .hint.mac)` - guide 12 (*Keyboard shortcuts help*,
  the `.mac` list), Norwegian in the translation sample. css: the dialog and the key caps with the existing
  variables (no theme change), square, a phone's width
* docs: guide 14 (*The keyboard shortcuts help*, `?` / Ctrl+/ in the cell table, the help in *The rest* and
  in *What a screen reader gets*), 02 (options), 10 (`header.shortcuts`), 12; JSDoc of `shortcutHelp`,
  `openShortcutHelp()`, MENU_IDS.header
* tests: new shortcutHelp.test.ts (27: the keys and where they type, Ctrl+/ / Cmd+/, a lookup cell, Alt and
  AltGr, a used key, `shortcutHelp: false` and updateConfig; the dialog, a readonly grid,
  filterOperatorIndicator, the focus, the search, a Mac, translated key names, closing, one dialog, a menu
  closed, the grid leaving the page, before the grid is on the page; the header menu entry; the list's
  texts, its keys, a Mac's order, the guide's table, the guide's keyboard section); texts.test (the help
  shown, on a Mac too - a key cap that is a letter or F2 is no text), gridMenus, lookups, configJson.
  3877 tests, 165 files
* **found on the way, fixed - the ✕ of the dialogs on a touch screen**: the resize handle of the top right
  corner is 20px there (`pointer: coarse`) and covered the middle of the ✕ - a tap resized the dialog
  instead of closing it, in the filter editor and the grid config dialog too. The ✕ is over the handles
  now (`z-index: 4`, grid.css)
* browser (Chromium 1148, port 8096): new `shortcut-help-check.js` 41/41 - `?` typed in an editable cell,
  a header filter and the find bar is typed; Ctrl+/ from a cell opens it, the focus in the search, Esc
  back to the cell; a readonly grid: `?` on a cell and on a column header opens it (the `?` not typed in
  the search), no *Changing values*; the search (`undo`, `zzz` and its status); the header menu entry
  (the focus on the dialog), the ✕; `shortcutHelp: false`; light, dark, TreDeSpace light and dark - in the
  window, square, the text 9.7:1 and more, the keys 7:1 and more, their frame 3:1; a Mac user agent (⌘Y /
  ⇧⌘Z, ⌥⇧Home, no Alt+C, Cmd+/, the menu's ⌘/); a phone (390px wide, the list scrolls, nothing sideways, a
  tap on the ✕ closes it). The screenshots looked at. Shared checks: keyboard 53/53, find 68/68, touch
  61/61, full-grid 11/11. The new script is in this worktree's `.claude/browser-checks/scripts/`
* not done, candidates: F1 (Chrome's help on Windows); a "?" button of its own somewhere (the footer, the
  grid config dialog); a key that leaves out the entries of a cell the grid does not have (no lookup
  column: no lookup keys) - the list is per grid config, not per column; Shift+F10 is shown on a Mac too,
  where browsers may send no context menu for it (not tried on a Mac)
### Calculated columns, colour rules on several fields / formulas / more colours (user request)

The user: "be able to add dynamic column in column config would also be nice, very useful when we get to
conditional formatting with background color etc", for the colour rules "maybe if based on multiple column
values etc", "color rules we need to be able to set more colours, maybe color picker? also expression based on
other columns values etc", and "important that expressions is injection proof, so no one can hack / script
injection".

* **The formula language** (new `src/grid/formula.ts`): a tokenizer, a recursive descent parser into a fixed
  set of node kinds (number, text, boolean, field, negate, not, binary, call), a type check, and an
  evaluator that switches on the kind - no `eval`, `new Function`, timers, regexes / css / html from input.
  Grammar: `OR` < `AND` < `NOT` < one comparison (`= <> < <= > >=`, no `a < b < c`) < `&` < `+ -` < `* /` <
  unary `- +` < primary (number with `.`, text in `"` / `'` with the quote doubled, `TRUE` / `FALSE`,
  `{field}`, `NAME(args)`, brackets). Keywords and functions in any case. Functions (a `Map`, so
  `constructor` / `toString` are none): IF (lazy), ROUND (halves away from 0, n -10..10), ABS, MIN / MAX
  (numbers or dates, blanks skipped), TODAY, DAYS (calendar days, DST-safe), YEAR, MONTH, CONCAT, COALESCE,
  ISBLANK. Types number / text / date (a datetime is a date) / boolean, checked before it runs: field types
  from the datasource (an unlisted field is text). Blanks: null in arithmetic and functions -> null, a
  comparison false (`=` true for two blanks), AND / OR / NOT / IF take blank as false, `&` takes ''.
  Texts compare without case (`localeCompare`, sensitivity accent), dates on the day; a computed number keeps
  15 significant digits (`0.1 + 0.2` is 0.3). A row where it can not be computed (divide by 0, a value not of
  its field's type, Infinity, a text over 10 000) gives a problem of the row -> a blank cell, never a throw.
  Limits: 1000 characters, 500 parts, 32 levels. Every problem has a text id
  (`columnSettings.formula.problem.*`) with its position / part / types
* **The values** (new `src/datasource/calculatedField.ts`, entityHandler.ts, dataContainer.ts, dataSource.ts):
  chosen over storing values on the rows - the container keeps a Map of calculated fields, the row proxy's get
  trap answers a read of one with `value(row)`, the set trap ignores it. So it is never an edit (not dirty, not
  in getChanges / JSON / Object.keys, not sent), always current after edits, undo / redo, upsert, live data,
  resetData - nothing to invalidate - and every reader (filter, sort, group, aggregate, cells, copy, CSV /
  Excel, Find, detail form) reads it as a field. `getField()` / `getFormatter()` / `__getFieldConfig()` know
  its type and label. The kept aggregates: a calculated field's change count moves with the fields it uses
  (transitively) and when it is set, a TODAY() one also when the day changes; `rows-changed` names it with
  the field. A listed field name or `__` is refused (TypeError); a datasource on the container can not list
  a calculated name. The fast path of the get trap stays a `size` check when there are none
* **The grid** (new `src/grid/calculatedColumns.ts`, gridInterface.ts, gridConfig.ts, new
  gridFunctions/calculatedState.ts): `CalculatedColumn { formula, label?, type? }`, `CalculatedType`;
  `GridConfig.calculatedColumns`, `GridState.calculatedColumns` (getState / setState / resetState /
  initialState / updateConfig). Compiled together: a column can read another, a cycle (direct or long) is a
  problem. Registered on the datasource before the formats / aggregates / filter options are checked (the
  constructor, updateConfig, applyState), taken back when one of those throws, and on destroy() (only the
  ones this grid set). Names: `^[A-Za-z][A-Za-z0-9_]{0,63}$`, not an Object.prototype name, not a listed
  field or an own field of a row; 50 at most. A removed one leaves the layout, sort, grouping, filter
  (`filterWithout`), header filters, detail form, its format and aggregates; the column chooser hides it
  (`__isGoneCalculated`). New ones get a `columns` entry; the datasource parts are applied again when they
  change. Read only in `__isCellReadonly` (one early return)
* **Colour rules** (colorRules.ts): `ColorRule.operator` optional; three kinds - Value (as before, saved
  states unchanged), Conditions (`conditions: RuleCondition[]` of `{ field, operator, value? }`, `combine:
  'AND' | 'OR'`, each tested with the context of its field: type, formatter, lookup label, case), Formula
  (`expression`, must be boolean, compiled once per grid and cached until the fields change -
  `__ruleFormulaMatches`). Checks: one kind, conditions 1..20 on known fields (`RuleFieldOf`), operator of
  the field's type, the formula's problem, `combine` only with conditions. A rule colouring the whole row:
  not done (see below)
* **More colours, custom colours** (grid.css, theme-tredespace.css by a forked agent; ruleColors.ts): 14
  palette colours (amber, lime, teal, cyan, indigo, pink, brown new, the 7 old unchanged, every contrast pair
  of the theme tests kept in both themes); `RuleColor = PaletteColor | '#rrggbb'` (strict regex). A custom
  colour is a custom property set with `style.setProperty()` (showCellColor, `styleMap` in the detail form and
  the preview): `--simple-html-grid-rule-bg`, `--simple-html-grid-rule-text-light` / `-dark`, classes
  `-text-custom` / `-bg-custom`. A custom background without a text colour gets black or white (higher
  contrast); a custom text colour is as picked in light and lightened (HSL) in dark until 4.5:1 on #5a6370
  (the lightest dark row); on a custom background as picked. The dialog warns under 4.5:1 (light rows or
  the custom background). theme.test.ts knows the three cell properties
* **The dialog** (columnSettings.ts, columnSettingsRules.ts): *Add calculated column* under the list (calc_n,
  *Calculated n*, the focus in its formula); a calculated column's section in place of the label: field name
  (while new: rename, problems name / taken), label (drops a format label), formula with `{ }` (the
  formula fields), *Gives: Type*, the value in the preview row, its problems at once (Error badge, Apply
  held; a row problem is said, not held), *Remove calculated column*, *Apply first* while its type is not
  applied (its type-specific settings wait - the format / filter / rule helpers read the datasource's type).
  Apply: `setState({ formats, calculatedColumns, layout })` - a new one at the end of center (100px); the
  removed ones' formats and detail form fields dropped; Reset column / Reset all include them. Rules: a kind
  radio group on the rule's first line with Move up / down / Remove; Conditions lines (field picker - the
  field menu with search -, operator, value, ✕; a field of another type takes its default operator),
  Add condition, All / Any picker over two or more; Formula input with `{ }` and the result in the preview row;
  the colour picker after the swatches (a `+` box until picked, the picked frame then). Problems use the
  draft's calculated columns (a rule on a removed one is an Error)
* **Security**: the hostile list - no code execution (source scanned in the test), Map function lookup, no
  member access, fields only known ones and own properties (`readerOf`), `__` refused, limits, no recursion
  (cycles refused before a row is read), results are data (lit text bindings / `.value`), strict names and
  colours, a TypeError before anything changes. CSV: calculated values pass `escapeFormulas` (on by default)
  as any text; Excel writes inline strings only; the clipboard does not escape (as documented before)
* `toSqlWhere` unchanged: a condition on a calculated column throws its existing TypeError (`filter.children[0].field
  "total" is not one of the columns`); guide 22 *Calculated columns* says so, with a generated column / view
  and a `withoutFields` helper for a browser-only filter
* texts: 75 new (`columnSettings.calculated.*`, `columnSettings.formula.*`, the kinds / conditions / combine /
  formula / custom / contrast of the rules, 7 colour names, `columnSettings.badge.calculated`), guide 12's
  table, Norwegian in the translation sample. The texts walk shows them all (a calculated column with every
  problem, the kinds of a rule); its checker leaves the formula language's words and the walk's field names
  alone; its timeout 90s (it ran near 30s before)
* docs: new guide 23 *Calculated columns* (config, the formulas, functions, types, blanks, comparisons,
  how the values are provided, state, the dialog, rules on several fields, SQL, Security); 02 (the label
  order, *Calculated columns*), 03 (*Calculated columns in the state*), 08 (the dialog's list, *Colour rules*:
  kinds, parts, conditions, palette of 14, custom colours, checks), 13 (14 colours by the fork; custom
  colours: the properties, the classes, the picker), 22. JSDoc of every new public type; index.ts exports
  `CalculatedColumn`, `CalculatedType`, `RuleColor`, `RuleCondition`; typings consumer
* sample: new *Calculated columns* (Formatting): Total, Days late, a rule on two fields, a formula rule
  with a custom colour, totals; not in the full grid sample (its description would grow)
* tests: formula (22), formulaHostile (13: the source, eval / Function spies, prototype names, payloads and
  a seeded fuzz of 3000 formulas with a row that records its reads, markup in a cell, hostile names,
  colours, cycles), calculatedFields (12, datasource), calculatedColumns (21, grid), colorRuleKinds (16),
  columnSettingsCalculated (12, dialog); updated colorRules, columnSettingsRules, gridState, texts walk,
  theme tests. 3881 tests, 169 files
* browser (Chromium 1148, port 8093): new `calculated-column-check.js` 61/61 in four looks + a phone (the
  sample's values, sort by the label, the header filter, an edit, the multi-field and the formula rule with
  its custom colour readable, the dialog: three columns - `{ }`, IF, DAYS(TODAY()) - an invalid one, a
  division by 0, Apply, a Conditions rule and a Formula rule with the colour picker made in the dialog, the
  state JSON round trip, no rounded corners). Shared: column-settings 144/144, column-settings-edit 9/9,
  full-grid 11/11, detail-form 91/91, filter-as-shown 61/61, find-case-sql 62/62; color-rules 98/98 with a
  copy in this worktree (the Tab order: the rule's buttons are on its first line now, the colour picker is a
  stop after the swatches); column-settings-more 133/149 - its failures test the row placeholder
  (`placeholderRowLabel`) of the parallel placeholder work, its `.before-row-placeholder` copy 141/141
* not done, candidates: a rule that colours the whole row (a row class from the rules: every cell's render
  would test every column's row rules - kept out, the `rowClass` hook does it in code); the type-specific
  settings of a new calculated column before Apply (the format / filter helpers read the datasource);
  renaming an applied calculated column; more functions (DAY, WEEKDAY, text functions, a date + days);
  a calculated value in a lookup's label; a backend computing it (the SQL guide shows a generated column)
### Quick dates: Today, This week, Last month ... one click on a date column (user request)

The user: one click for the date ranges filtered on all day in an ERP - Today, Yesterday, This week, Last
week, This month, Last month, This quarter, Last quarter, This year, Last year, Last 7 days, Last 30 days,
Next 7 days, maybe Overdue - on date and datetime columns.

* **where**: a block of buttons, `filter.dates`, under the range block of a date column's filter menu, as
  wide (220px), two columns - this one and the one before side by side - 24px buttons (on touch too: the
  block stays compact, 7 rows). One click filters and closes the menu, no Apply: it is no draft. Chosen over
  a submenu (`Filter › Dates ›`): seen at once, one tap on a phone (a submenu is two), and it is next to the
  range block that makes the other ranges. The one in use filled with the accent colour (`aria-current`), the
  tooltip of a button its days as the field writes a date (`2026-11-16 – 2026-11-22`, a datetime's seconds,
  Overdue `Before 2026-11-22`). Keyboard: one stop of Tab after the range block (a roving tabindex: the one
  in use, else the first), ArrowLeft / ArrowRight / ArrowUp / ArrowDown in the two columns, Home / End,
  Enter / Space. A `role="group"` named *Quick dates*
* **the days** (new `src/grid/datePresets.ts`, pure): `datePresetDays(preset, now, weekStart)` - new Dates
  made from year / month / day (`new Date(y, m, d)`: a summer time change is no hour off). The week starts on
  the date picker's `datePickerConfig.weekStart` (`weekStartOf`, Monday by default - ISO; 0 Sunday), so This
  week is the week the picker shows. Last / Next 7 days and Last 30 days count today in (today and the 6 days
  before / after) - documented in the guide's table. Overdue is `[null, yesterday]`: an open start, blanks
  never match. `datePresetRange` makes a datetime's To 23:59:59, as the range picker does
* **relative, stored as itself**: `HeaderFilter.datePreset` (`GridState.headerFilters[field]`) with the
  operator `BETWEEN` and the `[from, to]` computed last; the datasource's filter is a plain `BETWEEN` of the
  days (withColumnConditions in filterCallback.ts: the column's top level conditions replaced, as typing
  does). So `getFilter()`, `getFilterString()`, the filter editor and `toSqlWhere()` see dates, never the
  preset. Computed again from today: when picked; when a state with it is set - applyState stores it and
  replaces the column's conditions in the state's `filter` (or the grid's when the state has none), so
  `setState(saved)` on another day filters on that day, and `{ value: null, datePreset: 'today' }` alone
  filters; `initialState`, `resetState()`; Enter on its name; and `gridInterface.refreshDatePresets()`
  (public: filters again only when the days changed), which the grid calls on the window's `focus` and on
  `visibilitychange` to visible (listeners on the window and the document, aborted when the grid leaves the
  page - `Grid.datePresetListenersAbort`). A page looked at over midnight without either needs the app's
  timer: the JSDoc has one. A preset a column can not take (no date column, no `BETWEEN`, an unknown id) is
  dropped from a state, the rest of the header filter kept
* **the operator** is set to `BETWEEN` (a preset is a range; `filter-operator-change` when it was another).
  Considered: leaving the user's operator and showing a symbol of its own - the cell, the range block, the
  date pickers and filterCallback all read the operator, a stale one beside a `[from, to]` would need special
  cases everywhere. Clearing the column afterwards leaves Between picked, as the range block's Between does
* **what shows it**: the cell its name (renderHeaderFilter; the indicator `a..b`), the footer's chip
  `Order date = This month` - getFilterTree's condition nodes now have `field` (FilterConditionNode, public,
  additive) so the footer knows the column: a `BETWEEN` of the top AND group on a column with a preset; the
  range block its days in From / To; the button filled
* **what ends it**: a new value (`__setHeaderFilterValue` drops it): a date typed or picked, Clear Filter,
  Blank ›, a filter replaced as a whole (the row menu's Replace filter, Clear); another operator (filterCallback runs the value with
  it: This week with ≥ is ≥ Monday). Kept: picking Between again, filter as you type, a display format
  changed (refilterChangedFormats runs filterCallback with the value - datePresetToRun runs the preset
  again), the range block's Apply with nothing changed, the filter editor's Apply when the column's
  conditions are as they were (`__clearChangedHeaderFilters`). Changed in the editor, it is dropped - the
  editor shows and edits the dates, documented. The name typed in the cell (`today`, `LAST WEEK`) is the
  quick date - the cell shows the name, so whatever it shows filters again the same way
* **a display format plays no part**: This month on a column shown as weeks is the month (dateConditions is
  not used), the tooltips are written with the field's formatter for the same reason
* **which a column offers**: `ColumnConfig.datePresets` - a list in its order, `false` / `[]` none; left out
  every one but Overdue (`DEFAULT_DATE_PRESETS`; "before today" means something on a due date, not a
  birthday). Exported `DATE_PRESETS` (frozen, every id in the menu's order) and the type `DatePreset`.
  assertDatePresets (gridInterface.ts, in assertFilterOptions): a list of ids or false, a date or datetime
  column, `BETWEEN` among its operators - a `TypeError` naming the column. Like `filterOperators` it limits
  what the user picks, not a state
* texts `filter.dates` (the group), `filter.dates.<id>` (14 names), `filter.dates.range` (`{from} – {to}`),
  `filter.dates.before` (`Before {date}`); the Norwegian sample (I dag, I går, Denne uken, Forrige uke, Denne
  måneden, Forrige måned, Dette kvartalet, Forrige kvartal, I år, I fjor, Siste 7 dager, Siste 30 dager,
  Neste 7 dager, Forfalt; Hurtigvalg av datoer, Før {date}). css: grid.css only, the existing variables (no
  new colour, nothing for TreDeSpace), no border-radius
* samples: Full grid's Due date offers every quick date (Overdue too); Filtering has a button that sets
  This month from code, its description mentions them
* docs: guide 06 (a new *Quick dates*: the table of days, relative, plain filter, what shows / ends it, the
  keyboard, `datePresets`; the filter menu, the footer), 03 (*Quick dates in the state*), 02 (the column
  option), 10 (`filter.dates`, the keyboard), 12 (*The quick dates* table), 22 (*A quick date*: the WHERE of
  Today, This month, Overdue); JSDoc of `DatePreset`, `DATE_PRESETS`, `ColumnConfig.datePresets`,
  `HeaderFilter.datePreset`, `GridState.headerFilters`, `refreshDatePresets()`, MENU_IDS, MenuBlock,
  FilterConditionNode.field; typings consumer (the ids, `datePresets`, the state, refresh; a wrong id, `true`
  and DATE_PRESETS.push rejected)
* tests: new src/grid/__tests__/datePresets.test.ts (41): every preset on Sunday 2026-11-22; 00:00 days; ISO
  vs Sunday (and Saturday) week starts; the new year; month and quarter ends; leap years (2028-02-29); a week
  over summer time; date vs datetime ranges; ids / defaults; weekStartOf; with a faked clock in the grid: the
  block where it shows, the names, datePresets order / false / [], no BETWEEN, the tooltips, weekStart 0,
  each preset's rows on a date and on a datetime column, cell / indicator / chip / state / plain filter, the
  menu again (filled, the stop of Tab, the range block's days), other columns kept, the event once, the
  keyboard, a menus hook; Enter on the name and the name typed, a date typed, another operator / Between
  again, Clear and Is blank, the range block's Apply unchanged / changed, filter as you type and a format
  change, the filter editor's keep / drop; a state through JSON set ten days later (December), headerFilters
  alone, initialState and resetState on another day, presets a column can not take dropped,
  refreshDatePresets (nothing on the same day, a spy), the window's focus and visibilitychange - none after
  the grid left the page, toSqlWhere of This month (date), Today (datetime), Overdue; the config check. Passes
  in Oslo, New York and Tokyo time. Changed on purpose: filterRangeBlock (the date menu has `filter.dates`,
  MENU_IDS' last three), gridMenus (text and number menus without `filter.dates`), texts walk (Updated offers
  every quick date, its menu and a picked one shown; the test formatter's placeholder is data; the TypeError
  test's datasource has the fields), filterString / filterExpression / filterOperatorsByType (the tree's
  `field`). 3850 -> 3891 tests, 165 files
* browser (Chromium 1148, `page.clock` fixed to Sunday 2026-11-22): new `date-presets-check.js` 69/69 - the
  Full grid light and dark (1300x1100): the block under the range block, 13 / 14 buttons, two columns, 24px,
  square, in the window; the tooltip; each preset on Orderdate against the rows counted in the page (0 to
  5000), menu closed, cell, chip, state; the indicator; reopened filled with the range block's days; Updated
  (datetime) Last 7 days, To 23:59:59; Duedate (weekIso) This month is the month (269 rows, not the 366 of
  its weeks), Overdue without blanks; `2026-W47` typed replaces it, `last month` typed is Last month; the
  keyboard (Shift+F10, Tab, arrows, Enter, the outline); the state through JSON on 2 December is December; the
  window's focus on the 23rd moves Today. A phone (390x844, touch, the Filtering sample): in the window, 24px,
  a tap filters. No page errors. Shared checks against it: date-range 168/168, filter-as-shown 61/61,
  operator-indicator 79/79, touch 61/61; range-block 79/81 - it expected the date column's menu to end with
  the range block: the copy in this worktree's scripts expects `filter.dates` after it, 81/81; filter-ui
  115/117 - not this change: its Filter › list predates Filter as you type (`filter.filterOnType`). Script
  and screenshots in this worktree's `.claude/browser-checks/` (`shots/date-presets/`)
* not done: a "Tomorrow" / "Next week" / "Next month" (easy to add: an id, its days, a text); quick dates in
  the column settings dialog; a grid-wide default (`GridConfig.datePresets`); Year to date; refreshing on a
  timer of the grid's own at midnight
### Named views (user request)

* the user: saved views like "My open orders" / "Late deliveries" to switch between, the state of the grid
  under a name - with Save / Save as / Revert / Rename / Delete / Set as default and a "modified" marker
* **a view is plain JSON**, `GridView { id, name, state, readonly?, default? }` (new `src/grid/gridView.ts`,
  exported type). `state` is what `getState()` gives; applied, what it leaves out is the config's state
  (`getStartState()`: `initialState` + `layout`) - a view is all of the state, not a change of the one shown,
  and a view saved before a part was added to the state (calculated columns ...) gets the config's
* **API** on `GridInterface`: `getViews()`, `setViews(views)`, `getCurrentView()` (null = "Standard", the
  config's state), `isViewModified()`, `applyView(id | null)` (null = `resetState()`), `saveView()` (over the
  view shown), `saveViewAs(name)`, `renameView(id, name)`, `deleteView(id)`, `setDefaultView(id | null)`.
  Event `views-change { views }` on every change of the list by the user or those calls - not by `setViews()`
  / `updateConfig({ views })` (the app gave the list: no save loop), nor on a switch
* **config**: `views` (the list the grid starts with), `viewsStorageKey` (the opt-in localStorage helper,
  try/catch, a warning when it can not write; stored: the views that are not readonly + the default's id -
  readonly views come from the config every time, once the user saved some the stored list is the user's),
  `viewsButton` (default: true when `views` or `viewsStorageKey` is given - a grid without them looks as
  before). `TypeError`s for a list that is no list of views (ids unique, one default at most) and a key that is
  no text; a stored list that is broken is passed by, a default view that can not be applied too (a warning,
  the grid starts in the config's state)
* **modified**: the state as JSON with the keys sorted (`viewStateText`), compared with a snapshot taken
  right after the view was applied or saved - a snapshot, not the stored `state`, so the normalising of
  `applyState()` (Dates, the order of the header filters, defaults filled in) is no change. Left out:
  `expandedGroups` (opening a group is no change of the view; the view still keeps them) and layout columns
  without fields (`__parseConfig` drops them). The footer computes it on render; the few state changes that do
  not rebuild call `__refreshViewsButton()`: an operator picked, Match case, filter as you type, the detail
  form's width dragged (detailFormResize.ts)
* **interplay** (decided): `setState()` from code and the grid config dialog's Apply mark the view changed
  (it stays the view shown); `resetState()` is Standard - no view, also when the grid started in a default
  view; the default view is applied on top of `initialState` when the grid is made; deleting the view shown
  keeps the state (Standard, marked changed - *Save as new view…* gets it back, so no confirmation);
  `updateConfig()` keeps an unchanged Standard unchanged (a new layout or columns is the config's state);
  `updateConfig({ views | viewsStorageKey })` makes the list again as at start, `setViews()` replaces it
* **UI: a button at the left end of the footer** (`viewsMenu.ts`), on the line of the filter's row - the left
  end was empty, the gear is at the right end. Chosen over the grouping panel (often hidden, `panelHeight`, and
  the group chips fill it) and over a tab of the grid config dialog (two clicks to switch, and other work
  changes that dialog). It shows the view's name, a `*` in the edited-cell colour when changed, a chevron;
  `aria-label`/tooltip "View: My open orders (changed)"; the first stop of Tab in the footer. The filter goes
  first on a narrow grid: the footer keeps 36px on both sides (`has-views`) and the name is cut where the
  filter's row starts (`fitViews`, as `fitSummary`) down to the `*` and the chevron - a sliver of a name is
  hidden. The menu (showMenu, the grid's keyboard): Standard and the views with ✓ - one click to switch, hints
  *default* / *shared* - then Save, Save as new view…, Revert changes, Rename…, Delete, Default view (a ✓
  toggle); greyed out where they do not apply. A second click on the button closes it. The name is asked in a
  menu block at the button (input with the focus, a line saying what is wrong - empty, a name another view has
  in any case - Cancel / Save, Enter, Esc). Not part of the `menus` hook: `viewsButton: false` + the API for a
  control of your own. Existing colour variables only (no new ones, no TreDeSpace entry needed), square
* texts `views.*` (17, guide 12 table, Norwegian in the translation sample)
* docs: guide 03 new *Views* (the button, where they are kept, applying / saving / modified and the
  interplay), 02 (options), 09 (`views-change`), 10 (*The views menu*), 12 (texts); JSDoc with examples on
  every new member; the typings consumer. New sample *Named views* (`samples/demo/samples/views.ts`, group
  Config, two shared readonly views + `viewsStorageKey`, the API from buttons); the full grid sample has
  `viewsStorageKey` (description unchanged)
* tests: new gridViews.test.ts (35: the helpers - assertViews, ids, the state text, storage read / write /
  throwing, the start list, the name problems; the API - save as, modified and back, two views switched, a view
  of a few parts, groups opened, save / rename / delete / default and their TypeErrors, the default view on
  start and a broken one, setViews, updateConfig; localStorage across two grids; the button - when shown, the
  name / `*` / aria-label, without a rebuild, the first Tab stop, the menu's entries and greyed ones, every
  command, the name asked, Rename, the grid's texts). texts.test.ts shows the button, the menu and the name
  (its describe's timeout 30s -> 60s: 15-25s alone, 40s in the whole run on a loaded machine). 3885 tests,
  165 files (was 3850, 164); tsc, biome, check:typings, check:docs, typecheck, build, build:demo pass
* not done, candidates: a views hook in `GridMenus`; sharing a view of the user's with others (the app's,
  from `views-change`); a confirmation for Delete
* browser (Chromium 1148, port 8091): new `views-check.js` 46/46 (in this worktree's
  `.claude/browser-checks/scripts/`) - two views saved with other filters and columns (a column resized with
  the mouse marks Standard changed), switched, the `*` and "(changed)", Save, Revert changes, Rename…,
  Default view, a reload keeps them and opens in the default, Delete keeps the state; the keyboard (Enter /
  Space on the button, the arrows, Enter applies and gives the focus back, Esc, a letter, the first Tab
  stop); the name asked (focus, empty, taken, Enter); the button on the line of "No filter", clear of it and
  of the chips; contrast 4.5:1 and the `*` 3:1 in light, dark, TreDeSpace light and dark; a phone (Pixel 7):
  the button cut to its `*` and chevron beside two chips, the menu and the name in the window; the full grid
  sample with three chips. Screenshots looked at (light, dark, both TreDeSpace, phone, full grid): first
  version on the phone showed a sliver of the name ("/*") - the button's padding and the footer's room made
  wider and a name under 16px hidden. Shared checks, unchanged: footer-no-filter 53/53, footer-summary
  11/11, keyboard 53/53, full-grid 11/11, column-settings 144/144, detail-form 91/91
### Import: CSV and Excel files, paste rows as new rows (user request)

* the user: paste rows copied in Excel / Google Sheets as new rows (a paste wrote into existing cells only),
  and import a CSV or .xlsx file with a column mapping step, the problems summarized, undoable, permissions
* **the UX: one dialog for every source** (`gridFunctions/importDialog.ts`, the filter editor's frame):
  *Choose file…*, a file dropped on it, rows pasted into it (Ctrl+V). The first rows in a table with a field
  picker (a native `<select>`, *Skip*) over each column; *First row is a header* (found: the first row names
  a field), the separator (found, or picked), the sheet of a workbook, the decimal mark when a number field
  is picked, the order of dates with `/` when a date field is. A line says how the columns were matched (by
  name / by position from a field), the count, the first 8 problems in words (*Row 3, Age: Not a number:
  abc*) and the cells marked (the error tint, the message as tooltip); *Rows with problems*: import them,
  marked / skip them. *Import N rows* adds and closes. Why one dialog for paste too: a block of many rows is
  a bulk add - the user sees where each column goes before anything is added (a header named by Excel goes
  by name, a block without one by position from the clicked cell), and the same problems list; Ctrl+V into
  a cell stays as it was (no rows added past the last row - mixing writes and adds would surprise)
* **the entries**: `GridConfig.importMenu` (default `false`: a bulk add is for the app to allow) - the row
  menu's Paste › *As new rows…* (`row.paste.newRows`, after a line `row.paste.newRowsSeparator`): the
  clipboard (`readText()`; refused or empty -> the dialog asks for a paste into it), columns from the right
  clicked cell's column; the header menu's *Import rows…* (`header.import`) - a grid without rows has no
  cell to right click. Both only in an editable grid with `edit.add` (`__canAddRows()`, `__showImportMenu()`).
  Not on a row number's menu (kept lean, as Paste › is not there)
* **the API**: `gridInterface.openImport(source?: Blob | string)` (a file of the app's own drop zone, or
  text; nothing in a readonly grid or without `add`, as the menus), `gridInterface.importRows(rows,
  options): ImportResult` (`ImportOptions`: `header`, `fields` by position with `null` to skip,
  `decimalMark`, `dateOrder`, `invalidRows: 'import' | 'skip'`; checked - an option it does not know throws),
  `readImportFile(file, { sheet, separator }): Promise<ImportTable>`, `ImportFileError` (`problem`:
  `tooLarge` / `xls` / `broken` / `unsupported`), `IMPORT_LIMITS`, types `ImportCell`, `ImportProblem`
  (`{ row, field, value, kind: 'value' | 'rule', message }`). Code is not stopped by readonly or the
  permissions (as `addNewEmpty()` is not), said in the JSDoc. Datasource: `addNewRows(rows, { scrollTo })` -
  many new rows at once (addNewEmpty in a loop sorts once per row), the rows at the end, grouped into their
  groups with the first one's group expanded, the first selected
* **the columns**: by name - a header cell that is a column's label as shown, a field name or a datasource
  label, any case, spaces collapsed; a field once (a second column of it skipped); by position - the layout
  from the start field. Importable: the datasource's fields but a readonly column; the pickers list the
  layout, then the other config columns. The isReadonly hook is not asked (it decides about rows there are;
  documented). A lookup column takes the label (writeCellValue, its `set` fields too)
* **the values, as typing reads them** (`readCell`): through the field's formatter, with what a file has:
  numbers with spaces / `'` / the other mark between groups of three (`1 234,5`, `1.234,5`, `1,234.5`), the
  decimal mark per column from its formatter (`format(1.5)` has a comma -> `,`), and the other mark once and
  not between groups is the decimal mark (`12,5` with a decimal dot, as typing reads it); dates ISO (an
  offset / Z is an instant - the raw CSV export round trips), `31.12.2026`, `/` in the order picked, a time
  after; another form by the formatter only when it writes the date back as the text (`20.11.26` would else
  be 1926); booleans true/false/1/0 and the formatter's own words. A value not read is never guessed from a
  part: the field is empty, a `'value'` problem. Text is kept as it is: `=1+1` stays text (CSV injection),
  the CSV export's `'` too
* **the problems**: the validation is dry run before anything is added - `DataContainer.__checkRow(values)`
  runs the container's rules on a plain object (a required field the file does not have is a problem of
  every row); after the add `datasource.validate(added)` shows the errors on the cells. The values not read
  go into the new row's `__rowError` (*Not imported: Age: Not a number: abc*): its row number shows them -
  the "imported and marked" the user asked for. It is the row error of a server (`setErrors()` replaces it,
  `acceptChanges()` clears it) - said in the guide; the cells can not carry an error that is not a rule's
* **undo as one step**: the history never adds or removes a row - an added row is recorded as its deletion
  mark taken off (`DataContainer.__recordAdded`, `before: true, after: false`): undo marks the imported rows
  for deletion - a new row marked is in no list of `getChanges()`, as Delete takes out a new row - redo takes
  the marks off. An edit after it is a step of its own
* **CSV** (`csv.ts`): `parseCsv(text, separator, limits)` and `detectSeparator()` - the separator that
  splits the first lines (64 KB) into the same number of fields, more than one, the most lines, then the
  most fields, ties tab > `;` > `,`. parseTsv shares the reader, rewritten to slice runs instead of adding
  characters one by one (100 000 lines well under a second); the BOM left out. Encodings (`importFile.ts`):
  UTF-8 (BOM or not), UTF-16 LE/BE by their BOM (Excel's Unicode text), else Windows-1252 (Excel's "CSV" in
  Norwegian - æøå); a NUL is no text (a binary file is `broken`)
* **.xlsx** (`unzip.ts`, `xlsxRead.ts`): the other half of zip.ts / xlsx.ts. The end record searched past a
  comment, the central directory, the local headers - every offset checked; stored and deflated
  (`DecompressionStream('deflate-raw')`, no dependency - Node 24 has it, the tests run it for real); the
  size and CRC-32 checked. Parts by `_rels/.rels` -> the workbook -> its rels (case-insensitive names,
  relative and absolute targets, `..`); the worksheets in tab order (a hidden one too, a chart sheet not);
  shared strings with rich text (the phonetic guide left out), inline strings, `str`, `b`, `e` (the text),
  `d` (ISO); numbers, and a `Date` for a date style - the built-in ids (14-22, 27-36, 45-47, 50-58) or a
  format code with d/m/y/h/s outside quotes, escapes, brackets (`[h]` counts), `_x` / `*x` - the 1900 system
  with Lotus' leap day and the 1904 one, local time; `_xHHHH_` decoded (the writer escapes `_` that way);
  a prefixed namespace (`x:`) read (children by localName); rows without `r` follow the one before, gaps of
  rows kept as `[]` so `rows[4]` is Excel's row 5 (the problems say the row the user sees in Excel). Each
  sheet read once, on demand (the sheet picker)
* **a hostile file**: `IMPORT_LIMITS` - 20 MB file (checked before reading), 100 MB unzipped for all parts
  read together, 100 000 rows, 1 000 columns, 1 000 000 cells. A zip bomb: a part larger than the budget is
  refused by its declared size before inflating, the inflating stops at the declared size (a lying ZIP is
  never held), the CRC must match; encrypted, ZIP64, other methods refused; a `<!DOCTYPE` refused before
  `DOMParser` (billion laughs), not well-formed XML is broken; a cell at `XFD1048576` stops at the limits
  before any array is made; the CSV reader counts while reading (a million empty lines stops at 100 000).
  Nothing of the file is markup: lit text bindings only. `.xls` (and password protected .xlsx, both compound
  files) said in words; `.ods` is a ZIP without a workbook: broken
* texts: 48 new ids (`row.paste.newRows`, `header.import`, `import.*`), in guide 12 (a new *Import dialog*
  table) and Norwegian in the Translation sample; the texts test shows the dialog in every state (empty, the
  clipboard without rows, a header without rows, pasted rows with each problem and more than it lists, no
  header, no field picked, a workbook of two sheets with an empty first, reading, each file error, the row
  error after the import). css: `.import-*` under `.filter-editor-content`, the existing colour variables
  only (no new ones: no TreDeSpace change), square, the selects 24px on touch too
* docs: new guide 23-import.md (turning it on, the dialog, the columns, the values table, the rows added,
  from code, the files, a file is not trusted); 17 (*Paste as new rows*), 10 and MENU_IDS (the ids), 02
  (`importMenu`), 05 (`addNewRows()`), 15 (a link). Sample *Import CSV and Excel* (`#sample/import`, group
  Export): `importMenu: true`, buttons for the dialog, a sample CSV as Norwegian Excel saves it (`;`, decimal
  commas, dates with dots, rows with problems, a formula) and an .xlsx made at run time with `getExcel()` of
  a grid interface not on the page (no static assets: the demo has no public folder) - each opened in the
  dialog or downloaded to try Choose file / drop, and "Copy two rows (as Excel does)" for Paste › As new rows
* tests: csvParse (RFC 4180 edge cases, buildCsv round trip per separator, the limits, detectSeparator),
  xlsxRead (the writer's file back: every type, stored and deflated, every day of a summer-time year; shared
  strings, rich text, prefixes, styles, 1904, gaps, sheets; excelDate, isDateFormatCode; the zip bomb, a
  lying size, CRC, garbage DEFLATE, ZIP64, encryption, no workbook, broken XML, DOCTYPE, the row/column/cell
  limits, no DecompressionStream), importFile (encodings, xls, NUL, size, sheets; getExcel() / getCsv() of a
  grid imported into another give the same values), importRows (matching, numbers, dates, booleans, plan,
  problems, undo/redo, skip, lookups, options checks, permissions of the menus), importDialog (pasted rows,
  picking by hand, header toggle, skip, hints, separator, files dropped / picked, two sheets, file errors,
  the menus, disconnect), addNewRows (datasource). gridMenus.test: `importMenu: true` for every row entry,
  `header.import` hidden in a readonly grid. 3951 tests, 170 files (was 3850, 164)
* browser (Chromium 1148, port 8094): new `import-check.js` 83/83 - light, dark and TreDeSpace dark: a TSV
  clipboard (CRLF after each row) through Paste › As new rows… (by position from the clicked column, the
  problem listed and marked, Import -> values parsed with a decimal comma and dates with dots, the row
  error on the row number, Ctrl+Z takes both out, Ctrl+Y back), a CSV through Import rows… and setInputFiles
  (header by name, separator found, four kinds of problem, a field skipped by hand, the problem rows
  skipped), an .xlsx of the grid's own export (typed), a dropped File (DataTransfer), Esc; a phone (390px):
  the dialog fits, the buttons 24px. Screenshots looked at: the dialog with pasted rows, the CSV with its
  problems, the workbook, the grid after (the + and ! on the row numbers), the phone. Shared: fill 12/12,
  keyboard 53/53, edit-permissions 57/57, row-number-menu 7/7, full-grid 11/11, menus-regression 25/25 -
  none needed a change. The script is in this worktree's `.claude/browser-checks/scripts/`
* a dialog opened before its rows are read grows with them: it is moved up after a render to stay in the
  window (seen in the phone screenshot)
* not done, candidates: a sheet's merged cells and the formats of a number written as text in a cell are
  not read; the CSV decoder guesses Windows-1252 for anything that is not UTF-8 (a Mac Roman or Shift-JIS
  file shows garbled); limits are not an option of `readImportFile()` / the dialog; an `import` grid event
  with the result (the datasource's `collection-changed` says rows were added); "1 rows" (no plural texts);
  the dialog previews the first 8 rows, a problem further down is listed (first 8) but not shown in the
  table; Ctrl+V into the last row could add the rows past it; the isReadonly hook asked for the new rows

### Data bars, colour scales, icon sets - and colours in the Excel export (user request)

From the list of missing features the user picked "6. Data bars, colour scales and icon sets, as in Excel's
conditional formatting" and "7. Colours in the Excel export (the rules and formats don't carry over today)".

* **The model** (new `src/grid/dataBars.ts`, columnFormat.ts): three parts of `ColumnFormat` for a number
  column (a calculated one too) - `bar?: DataBarFormat { color?, min?, max? }`, `scale?: ColorScaleFormat
  { minColor, midColor?, maxColor, min?, mid?, max? }`, `icons?: IconSetFormat { set, thresholds?, unit?,
  reverse?, position? }` with `IconSetName` `'arrows' | 'traffic' | 'flags' | 'symbols'`. Exported from the
  package. Checked by `assertValueFills` (from assertColumnFormat, so config, updateConfig and setState):
  number field only, not a lookup column, not with `checkbox`, known keys, colours of the palette or
  `#rrggbb`, finite numbers (NaN / Infinity named as such), min below max, `mid` only with `midColor` and
  between, two thresholds in order (0..100 in percent), the set / unit / position values. State with the
  rest of the format
* **The range**: `shownRange()` = `datasource.aggregate(field, 'min' / 'max')` over the filtered rows - the
  datasource already keeps them until the field's change count moves or other rows are filtered, a
  calculated field's change count moves with the fields it uses. So a render of the cells on screen reads
  100 000 rows once (a test counts the reads: 200 000 for the min and the max on the first render, only
  the visible cells on a refresh, 100 000 again after a filter). Grouped: every row the filter lets through,
  collapsed groups too (as the totals row) - expanding a group does not move the bars. Group rows / totals
  row: none. A data bar's range has 0 in it when left out (`min(0, smallest)`, `max(0, largest)`): the axis
  is where 0 is, a negative value's bar goes left of it; a fixed range without 0 starts at its end. A scale
  and percent thresholds use the plain smallest..largest; the scale's midpoint is halfway (not the 50th
  percentile - no sort needed); a range of one value is the middle
* **Drawing** (showCellColor.ts, grid.css): classes `simple-html-grid-cell-bar` / `-scale` and custom
  properties set with `style.setProperty()` - `--simple-html-grid-bar-start/end` (`12.5%`), `-bar-color`,
  `--simple-html-grid-scale-from/to/at`. Their colour values are only `var(--simple-html-grid-palette-<name>
  -bg-color)` or `light-dark(#tint, #tint)` built from a checked `#rrggbb` (`fillValue`). The bar is a
  `linear-gradient` background image held in `--simple-html-grid-cell-bar-image`: the generic rule puts it
  on every cell, the range's rule lays its tint over it (the range tint and the bar were both
  `background-image`); a find match / an error hide it as they hide a rule's colours. The scale is
  `color-mix(in srgb, to at%, from)` as the background colour. No rounded corners
* **Colours readable**: a bar and a scale use the palette's backgrounds (the grid's text is 4.5:1 on them
  already); a custom colour is a tint - a fifth of it, the rest white in light, black in dark (`lightTint`,
  `darkTint`, ruleColors.ts). A quarter failed: TreDeSpace's pink text was 4.30:1 on black's tint. Chosen over
  black / white text per cell, because a bar covers part of the text only and a scale may mix a palette
  colour (a css variable js does not know) with a custom one. The theme tests compute: the text 4.5:1 on
  every mix of two palette backgrounds at 0/25/50/75/100 %, a rule's palette text colour on neighbour
  mixes, the text and every palette text colour on the tints of the corners of the colour cube and greys,
  the icons 3:1 on them, palette + custom mixes - both themes, light and dark
* **Precedence with the rules**: a rule's background wins over the scale (no scale class on that cell); a
  rule's text colour and bold show over a scale; a bar is drawn over a rule's background; icons show with
  any rule
* **Icons** (new gridFunctions/cellIcon.ts, renderRowCell.ts): a 12px svg (filled paths: ▲ ► ▼, ●, ⚑, ✓ ! ✕)
  left or right in the cell, over the input (1001), the input's padding 19px on that side. Three new theme
  variables `--simple-html-grid-icon-green/amber/red-color` (default: green-800 #166534, amber-800 #92400e,
  red-700 #b91c1c; dark #86efac, #fcd34d and red-200 #fecaca - red-300 was 2.93:1 on a range's tint over the
  #5a6370 row; TreDeSpace the same light, its 300s dark), 3:1 pairs in CONTRAST_PAIRS. Level by `(value -
  min) * 100 >= p * (max - min)` (67 of 0..100 is high, not lost to 0.67*100). `reverse` swaps the icon
  (shape and colour), as Excel's. A screen reader: visually hidden *High* / *Middle* / *Low* (`cell.icon.*`),
  the input's `aria-describedby` (with the multiline marker's id when both). Not in a custom cell
* **An edit that moves the range** (renderChangedRows.ts, grid.ts `valueRanges`): the ranges of the columns
  with bars / scales / icons as a key; when it changed since the last changed-rows render, every row on screen
  renders (triggerScrollEvent), not only the changed one. The first change after the grid is made renders
  all once (the range before is not known)
* **The dialog** (new gridFunctions/columnSettingsBars.ts, columnSettings.ts): *Data bars, scales, icons*
  under the colour rules, number columns not shown as checkboxes. A checkbox each - on starts a blue bar,
  red - yellow - green, the arrows; swatches of the palette's backgrounds (the rules' swatches row was made a
  shared `colorSwatches()` - the rules' DOM is the same), Min / Midpoint / Max (empty *Automatic*), the set as
  radio buttons showing its icons, *Middle from* / *High from* (placeholders 33 / 67), % of the range /
  Values, before / after, Reverse. Numbers typed as text (`.` or `,`, no thousands): kept in
  `ColumnSettings.typedNumbers` while typed so `1,` is not rewritten; a text that is no number, min not below
  max, a midpoint out, thresholds reversed or out of 0..100 are problems (column Error, Apply waits). Five
  sample cells from the smallest to the largest value of the rows (`column-settings-bars-sample`, not the
  preview's class: a check reads the first preview cell) and the row's preview get the bar, scale and icon.
  Badges *Bar*, *Scale*, *Icons*. Reset column / Reset all / Apply clear the typed numbers.
  `keepDialogInView` (dialogFrame.ts): the dialog's height follows its content up to the window but its top
  stayed - turning the three parts on pushed the footer 63px below the window; after a render the top moves
  up as far as it takes
* **Excel** (xlsx.ts, gridExcel.ts): `XlsxCell` may be `{ value, style: { color?, fill?, bold? } }`; Styles
  writes fonts (bold / colour), solid fills and cellXfs each once (`applyFont` / `applyFill`), a styled blank
  as `<c r s/>`. `XlsxSheet.conditionalFormats`: `<conditionalFormatting>` after the autoFilter (CT_Worksheet
  order), a `cfRule` each with priorities 1.., `dataBar minLength="0" maxLength="100"` (Excel's default is
  10..90 %), `colorScale` (cfvos then colours), `iconSet` (`3Arrows`, `3TrafficLights1`, `3Flags`,
  `3Symbols2`, first cfvo percent 0, `reverse="1"`). Thresholds: Excel's `min` / `max` / `percent 50` when on
  every row, else formulas over the whole column (`MIN($C$2:$C$101)`) so the range stays the column's; the
  bar's ends `MIN(0,MIN(...))` / `MAX(0,MAX(...))`. No dxfs (not needed). The grid side: the rules -
  `colorRuleOf` once per row of a column with rules - as static font / fill / bold in the light palette
  (`LIGHT_PALETTE`, ruleColors.ts, a theme test compares it with grid.css), a custom background's black /
  white text as the grid makes it; a scale's sqref leaves out the rows whose rule has a background; scale
  colours = palette backgrounds / light tints; a bar's colour halfway between the palette's text and
  background (Excel fades it to white; blue gives #6694ce ≈ Excel's own #638ec6), a custom one as picked.
  `ExcelOptions.colors` (default true, false = values and number formats only, a TypeError for a
  non-boolean). The number formats were there already (display format decimals / thousands / percent,
  dates). Excel's 2007-style bars have no axis: a negative value is not drawn left of 0 there (said in the
  guide). CSV: no colours (said)
* **Read back with openpyxl 3.1.5** (a scratch venv, not in the repo): the sample's download loads without a
  warning, 17 rules with their cfvos / colours / priorities, the negative balance's font `FF90101A`, the
  waiting status's solid fill `FFFED7AA`
* **Texts**: 34 `columnSettings.bars.*`, 3 badges, 3 `cell.icon.*`; guide 12's table, Norwegian in the
  translation sample, the texts walk shows them all (the problems one by one, the no-numbers hint)
* **Docs**: guide 08 - *Data bars*, *Colour scales*, *Icon sets*, *Bars, scales, icons and the colour rules*,
  the dialog's list, the rules' Excel line; 15 - *Colours* (a table of what is a fill and what is Excel's
  own), the option; 13 - *Data bars, colour scales and icons* (the properties, the classes, the tints) and
  the 3 variables in both tables; 00-features - Data bars, Colour scales, Icon sets, Colours in Excel. JSDoc
  of the new types with examples; typings consumer
* **Sample**: the full grid - Balance a blue bar (negatives left of 0, its red rule over it), the months a
  red - yellow - green heat map, KPI 1 arrows; the description the same length (724 characters)
* **Tests**: dataBars (29: ranges, bars, scales, levels, icons, fills, tints, the TypeErrors, the dialog's
  numbers and problems), dataBarsGrid (15: cells, a filter, scrolling, a range-moving edit, typing, a custom
  cell, groups, a calculated column, rules, icons and their description, state, 100 000 rows read once),
  columnSettingsBars (7), dataBarsExcel (12: styles.xml, cfRules, partial rows, sqref, the grid's colours,
  colors: false), themeDataBars (17), the icon pairs in CONTRAST_PAIRS, texts walk, the format keys message.
  4056 tests, 176 files
* **Browser** (Chromium 1148, port 8093): new `data-bars-check.js` 75/75 in four looks + a phone (the
  sample's bars / scales / icons, the dialog by mouse with its five cells and a problem, Apply, every cell's
  gradient stops vs its value, the scale's colour vs the palette mix, the icon's level, a header filter, three
  scroll positions, the number 4.5:1 and the icons 3:1, the Excel download unzipped: 17 cfRules, priorities,
  formulas, the rules' font and fill, a negative balance's font; colors: false; the phone's cells and the
  dialog without a sideways scroll). Shared: color-rules 98/98, column-settings 144/144 (4 failed until the
  samples left the preview's class), column-settings-more 149/149, calculated-column 61/61, full-grid 11/11,
  detail-form 91/91
* **Not done, candidates**: Excel 2010's data bars (`x14` extension: an axis for negatives, solid fill) -
  2007 bars only; bars / icons in the detail form's values; a percentile midpoint; more icon sets (4 / 5
  arrows, stars, ratings); the traffic lights' amber in light (#92400e, dark for 3:1 on the selected rows
  and the palette's backgrounds) is brown next to red - an outlined icon would allow a brighter fill; the
  footer of the grid config dialog is wider than a phone (its *Apply & close* is cut, before this too)

### The buttons of a dialog wrap on a phone

* three agents saw it in their phone screenshots: the grid config dialog at 390px had Reset column, Reset all,
  Cancel, Apply and Apply & close on one line, squeezed - "Apply & cl"
* grid.css: `.filter-editor-footer` (every dialog's footer: the filter editor, the grid config dialog, the
  import dialog) wraps (`flex-wrap: wrap`): with no room Apply & close goes to a second line, at the right; a
  wide dialog is as it was. Measured: no button's text cut at 390px in the grid config dialog and the filter
  editor, the same lines at 1300px; column-settings, filter-ui, detail-form-more, import and data-bars checks
  as before

### Row numbers: Cmd+click, and a second Shift+click after Ctrl+clicks

* `Selection.highlightRow` (src/datasource/selection.ts) read `ctrlKey` only, and kept its state as the
  last key used (`lastKeyCodeUsed`) and a switch over seven pairs of keys: shift after shift re-made the
  range alone, dropping the rows of the Ctrl+clicks before it
* now the model of the column numbers (columnSelection.ts): an anchor (`lastRowSelected`, the last row
  clicked without Shift) and the keys kept (`keptKeys`, the selection at the last Ctrl+click, none after a
  plain click). Shift+click = kept + the range from the anchor; Ctrl or Cmd toggles and sets both; a plain
  click selects the row only. 'single' mode: every click selects the row. Before any click the anchor is
  the first selected row (a selection by code), as before. The unused `setSelectedRows` removed
* Cmd also on a group row's number (renderRowSelector.ts) and the corner (rebuildHeaderColumns.ts)
* one change of behaviour: after a plain click, then a selection by code, Shift+click goes from the row
  clicked, not the first selected row
* tests: selectionModifierKeys.test.ts (Cmd, a second Shift+click, a finger, plain click drops the kept,
  Ctrl after Shift, 'single'), accessibility.test.ts (Cmd+click on a row number in the grid). Guide 17
  and the changelog updated

### The date picker's week numbers

* `src/date/utils/getWeekNumber.ts` had its own count (from epoch-calendar.com): 0 for 2027-01-01 and
  2021-01-03 (ISO 53), and a US week that is not WEEKNUM
* which days the picker passes (week.ts: the first day of each row, a Monday with `isoWeek`, a Sunday
  without): ISO was right on every Monday 2015-2035; US was off in 478 of 1096 rows - a week lower than
  the column's `usWeek` and the `2026-W47` filter
* now `isoWeek()` / `usWeek()` of columnFormat.ts: ISO of the date; US = WEEKNUM of the Saturday of the
  date's week, so the row across New Year (its December days too) is week 1, as Outlook. Right for any
  day, not only the row's first
* tests: getWeekNumber.test.ts (ISO across New Year, US = WEEKNUM, the row across New Year),
  datePicker.test.ts (the rendered numbers of January 2027 ISO and November 2026 US). `isoWeek`'s doc
  (interfaces.ts) and the changelog updated

### Tab, Enter and Alt+arrows move the focus at once

* `focusInAMoment` (cellRowKeyNavigationCellRowHandler.ts) focused the next cell in a `setTimeout` of
  100ms, after the scroll event had rendered the rows; `ctx.focusMovePending` and `focusMoveKey` canceled
  the keys that move or type meanwhile (the cell and filter handlers, jumpKeys.ts)
* now `focusCellNow`: `scrollRowIntoView` (a row target), `triggerScrollEvent` (renders at once), focus -
  as goToCell. `focusMovePending`, `focusMoveKey` and the three checks of it removed
* found on the way: the handlers scrolled the *middle* scroller by two rows near an edge, but
  triggerScrollEvent sets the others from the body scroller - in the same keydown that undid it (a held
  Alt+ArrowDown stopped at the bottom of the view). Those six blocks removed, with their rects; the row
  goes just into view as with the jump keys
* tests: keyNavigation.test.ts (the focus in the next cell in the keydown, a held key goes on, Tab after
  it) and jumpKeys.test.ts (a jump key right after an Alt+arrow) replace the two of the waiting. Browser:
  focus-now-check.js (new, 11: no wait after Alt+arrows, Tab, Shift+Tab, Enter; 40 held Alt+ArrowDown
  scroll to row 43 and back; a character right after lands in the new cell; from a header filter);
  keyboard-check.js's two checks of the waiting changed to the new behaviour, 53/53; range-block 81/81,
  filter-ui 117/117. Guide 14 and the changelog updated
* Alt+ArrowDown from a header filter into row 0 did not make row 0 the current row: focusCellNow
  compared the key's row with the target, and a header filter's row is 0 too. Now as goToCell: the target
  row is made current when it is not (`fromRow` dropped from focusCellNow). Tests: keyNavigation.test.ts
  (Alt+ArrowDown from a filter makes row 0 current; Alt+ArrowUp into a filter keeps it), focus-now-check.js
  asserts the current row too
* touch-select-check.js failed 3 of 66, the same on the code before these changes: it expected the cell
  entries of *Select ›* and *Copy ›* greyed out on a row number, but since commit 26101022 ("The row menu
  of a row number: only what is about rows", guide 10) they are left out. The check updated, 66/66

### The grid config dialog: a column's settings in tabs (user request)

* the user: "gridconfig column config might need a sub tab per section. To big form now" - the right of
  the Columns tab was one form of every setting: 622px of settings for a number column in the full grid
* `ColumnSection` (columnSettings.ts): General, Display, Header filter, Colours; `settings.section` kept
  across columns, General when the column has not the tab. A tab only when it has settings: no Display
  for a checkbox or lookup column (General says "has no format"), no Header filter for a checkbox column;
  a calculated column waiting for Apply has no tabs. Every tab's panel rendered, the others `hidden`
  (what they hold keeps its state, the tests find every control); the preview under them
* gridConfigTabs.ts: `tabList()`, the dialog's tab list made generic - the dialog's tabs use it too;
  `TabOf.problem` puts a mark and a visually hidden " Error" after the text. A tab has a problem by the
  same checks as `withProblems`: General the calculated column's, Display formatProblems /
  checkboxProblems, Colours colorRulesHaveProblem / valueFillProblems
* css: `.column-settings-sections` (no side room, wraps), `.column-settings-section` (as the panel),
  `.column-settings-tab-problem` - a 6px square, no round corner (the theme test)
* texts: five ids, in texts.ts, the translation sample (Norwegian) and the table of guide 12; guide 08
  describes the tabs
* tests: columnSettings.test.ts (the four tabs and their panels, General first; click, arrows, Home,
  End; the tab kept, a checkbox column's two; the mark and "Error"; no tabs for a pending calculated
  column), detailFormSettings.test.ts (its helpers: the dialog's own tabs and panels),
  texts.test.ts (the checkboxes by their text, not their place)
* browser: column-sections-check.js (new, 42/42 - every tab shown alone, the tallest 247px of 622, the
  dialog in the window, Tab and the keys, the mark, a phone); `scripts/sections.js` - required by the
  checks of the dialog, it clicks the tab of a hidden setting before Playwright acts on it, as the user
  does. With it: color-rules 98, calculated-column 61, column-settings 144 (`http://127.0.0.1:8090/`: it
  answers every other origin), data-bars 75, column-settings-more 149, filter-as-shown 61, operator 13,
  edit 9, detail-form 91 (its tabs scoped), detail-form-more 120, display-format 39, edit-permissions 57,
  multiline-lines 128 - all pass

### The tests failed on GitHub's runners: the time zone, not a timeout

* 22 tests of columnFormat.test.ts, filterAsShown.test.ts and filterAsShownGrid.test.ts failed on the
  runner, every one a date an hour off (`2026-11-16T00:00Z` expected, `2026-11-15T23:00Z` received). They
  passed here: this machine is CET. `TZ=UTC npx vitest run` showed the same 22
* the files set `TZ=Europe/Oslo` in `beforeAll`, but their dates (`TODAY`, `MONDAY` ...) are made when the
  file loads, before it: on a UTC machine those were UTC, the code's dates Oslo
* vitest.config.ts sets `process.env.TZ = 'Europe/Oslo'` before the workers start: every test file runs
  in it from its first line, on any machine. Checked: all 4252 with `TZ=UTC`, the three files with
  `TZ=America/New_York`

### A dev build to GitHub Packages: the next workflow (user request)

* the user: publish to GitHub's free package registry by hand, as `{package version}-next.{run number}`;
  package.json says 6.0.0
* `.github/workflows/next.yml`: workflow_dispatch, the checks of beta.yml, `githubPackage.js next`,
  `npm publish --tag next`. GITHUB_RUN_NUMBER counts the runs of this workflow: 6.0.0-next.1, .2 ...
* githubPackage.js: the kind `next` - `<version>-next.<run>`, tag `next`, the same name
  (`@<owner>/simple-html-grid`) and checks (a final version in package.json, a run number). Tests in
  scripts/__tests__/githubPackage.test.ts; README and the changelog say how to install it
* beta.yml is kept (`-beta.<branch>.<run>`, a tag per branch)
* "Run workflow" shows for a workflow on the default branch only: next.yml has to be on master too, as
  release.yml and beta.yml (see *Questions for the user*)

### Saved views in the exported grid; Min lines where Multiline is (user request)

* the user: "asked earlier for gridconfig to enable/setting to show saved/save custom configs. Like saved
  view showed. Can these be included when getting gridconfig/setting gridconfig?" - the views button is
  `viewsButton`; the views the user saved were not in exportConfig (only `config.views`). Now `views`:
  getViews() - set back by importConfig with setViews. The format stays version 2 (an optional part);
  convertGridConfig checks it is a list. updateColumns is simpler: the views come with exportConfig
* "missing way to set min rows to show in multiline field in detail in gridconfig": minRows was on the
  Detail form tab only, for a field multiline by the grid's config - Multiline turned on in the dialog's
  Columns tab did not count before Apply. Now *Min lines in the detail form* under Multiline (the same
  draft, setFieldOption), and detailFormTabPanel takes the dialog's multiline (isMultiline)
* detailFormOf keeps the options of a field out of the form (Min lines set for a column not in the form
  yet was lost on Apply)
* tests: configVersion.test.ts (views out and in), detailFormSettings.test.ts (Min lines under Multiline,
  options kept)

### Checks before a push: npm run verify, a pre-push hook (user request)

* the user, on the failed run 45260464054: "we also have some failing action, maybe we need to add rule on
  testing better before push". It was commit 594d5972: a test's type error (typecheck, check:docs fail -
  the docs check typechecks too). The local typecheck had shown it; it was read as a count of grep lines
  (0) and pushed. Fixed in 438d2fb6, every run after it green
* scripts/verify.js (`npm run verify`): the commands of checks.yml's matrix, read from the workflow - they
  can not drift apart - every one run, a PASS / FAIL summary, exit 1 on a failure; `npm run verify --
  vitest` runs the ones with the text. Tests: scripts/__tests__/verify.test.ts
* .githooks/pre-push runs it; `npm run hooks` turns it on (git config core.hooksPath .githooks) - once per
  clone, the user's to do: changing git config was not mine to. `git push --no-verify` skips it, knowingly
* CLAUDE.MD: the rule - verify before every push, push on "all 5 passed" and exit 0 only

### The columns of a source changed (user request)

* the user: "be able in the gridConfig to set if view button should show or not" - there: `viewsButton`
  (the sample shows it). "a cleanup strategy helper ... updateColumn where we set array of column config
  to define real columns, in case we have built it with a view as source, and now source view have been
  changed and some new columns have been added or removed ... remove some color rules/config, or at least
  disable the rules ... column chooser need to be able to find new columns / not show removed"
* reconcileColumns.ts: a pure function on a saved grid (ExportedGrid) - the load-time case: the app reads
  the view's columns, makes the datasource with them, reconciles, makes the grid. `known` = the config's
  columns and the layouts' fields (not calculated); gone = known not in the source; the calculated columns
  naming a gone field (`{name}` in the formula), until none more. cleaner(): layout, filter (groups, valueField),
  rules (conditions, formulas), formats, detail form, state - used on the config, initialState, state,
  views. Rules that can not work are taken out, not "disabled": a ColorRule has no such flag, and the
  report lists them for the app to tell the user
* gridInterface.updateColumns: exportConfig + getViews → reconcileColumns → importConfig + setViews (the
  config keeps its own views). The datasource's fields are fixed when it is made: a new field without a
  type there is text (documented)
* tests: reconcileColumns.test.ts (10). Sample: reconcile-columns (Config)

### Match case seen in the header (user request)

* the user: "Important we also have a getFilter, in case we want to send it to backend, then generate sql
  string. Also need to be able to set in config if filter is case sensitive. Dunno how we will show that
  in header so its obvious"
* there already: `datasource.getFilter()` (the filter as JSON) and `toSqlWhere()` of
  `@simple-html/grid/sql` - it keeps `caseSensitive` (no LOWER()); `ColumnConfig.filterCaseSensitive`. New:
  seeing it
* filterOperatorIndicator.ts: `Aa` before the symbol while isHeaderFilterCaseSensitive, a wider indicator
  and input padding (`-case` classes), the name "…, match case"; the operator choice ends with Match case.
  contextmenuFilter.ts: matchCaseItem / setHeaderFilterCaseSensitive shared - the setter now rebuilds the
  header (it did not: nothing showed it before). columnSettings.ts: the `caseSensitive` draft, its checkbox,
  Apply, Reset column / all (startCaseSensitive: the config's, as startOperator)
* not shown without the operator indicator (`filterOperatorIndicator: false`, a column under 60px)
* tests: filterCaseAndOperators.test.ts (Aa, its name, the choice, the dialog), the choice's entries in
  filterOperatorIndicator / filterOnType tests, texts

### The header over the rows on a phone (user request)

* the user, a screenshot from Brave on Android: "header/row is not in sync, header prob need a block same
  size as scrollbar if scrollbar is active, thats why it had it even though it looked ugly"
* the header had `overflow-y: scroll`: its own empty scrollbar was the block, as wide as the rows' (10px)
  on a desktop. An overlay scrollbar (a phone) takes no room: the header's middle was 10px wider than the
  rows', scrolled 10px less at the end, and its right pinned columns ended at the edge
* updateMainElementSizes: the header's middle and right viewports end `__scrollbarSize` before the edge,
  as the body; createDom: `.simple-html-grid-header-gutter` in the corner, the track colour. grid.css: the
  header `overflow: hidden`, its scrollbar css gone
* header-align-check.js (local): overlay scrollbars (--enable-features=OverlayScrollbar) and desktop -
  every header cell over its column at the start, at the far right, with a right pinned column

### Column chooser: drag with a finger (user request)

* the user: "drag drop from column chooser do not work with touch, probably other places too"
* not reproduced in headless Chromium (CDP touch: 17/17, held 350 and 800ms, straight up): it has no
  threaded scrolling. On a phone the browser decides at touchstart whether the touch can block its pan;
  dragEvent added its non-passive touchmove listener at the hold - too late: the list pans, pointercancel,
  the drag ends. The chooser is the one drag on a `pan-y` element; the others are `touch-action: none`
* dragEvent.ts: the touchmove listener on the cell from the start, cancelling only while a finger drags
  (`fingerDrags`); `menuOnLongPress: false` for the chooser - a touch contextmenu (Android's, the grid's
  long press) canceled in the capture phase, the drag goes on; a finger on `.simple-html-grid-drag-handle`
  drags on a move, no hold. grid.css: every drag handle `touch-action: none`, 24px with a coarse pointer
* the other drags checked: column resize, fill handle, the detail form's edge and list handle, the
  dialogs' titlebar and corner, header labels, group chips - all `touch-action: none` already; no HTML5
  drag and drop anywhere
* tests: columnDragDrop.test.ts (the handle, the long press); chooser-touch-drag-check.js (local, 27/27),
  touch-check.js 61/61, column-chooser-more-check.js 76/76
* to confirm on a real phone: the user's device - headless Chromium can not show the first cause

### Changes: kinds, rows, fields (user request)

* the user: "We prb want to have helpers called getChanges({deleted, new, modified}) where null = all.
  Maybe other helper function we should include"
* changes.ts: `ChangeKinds`, changeKindsOf - all for none / null / `{}`; the kinds `true` when one is;
  else all but the `false` ones (both readings of "null = all": `{ deleted: true }` only deletions,
  `{ deleted: false }` the rest). Checked: a TypeError for another key or value
* dataContainer.ts: changeKindOf / editedFields shared by getChanges, hasChanges (the same rows as
  before), getChangedRows, getChangedFields, getOriginalValue; Datasource wraps them typed
* chosen helpers: getChangedRows - the validate docs filtered `__rowState` by hand to validate what a
  save sends; getChangedFields / getOriginalValue - read `__controller` internals before. Not added:
  a row's state (`row.__rowState` is there), revert (`resetRows()` / the row menu are)
* tests: changeHelpers.test.ts. Guide: editing, *One kind of change, the rows, the fields*

### Colour rules on a date: periods, quick dates, ISO / US weeks (user request)

* the user: "in column color, on date, we should be able to set condition based on week etc like in
  filter. But also important that week can be select based on US (sunday?) and ISO (monday?)"
* colorRules.ts: `datePreset` and `week` on a rule and a condition; dateRuleCondition reads a period
  (typedPeriod: the week of the rule's weeks, month, quarter, year - the grid's texts and the library's,
  so a saved rule reads the same in every language) or a quick date's days (datePresetDays with Monday /
  Sunday) and makes the conditions with periodConditions - split out of filterAsShown's dateConditions,
  which uses it too (an open start for Overdue). ruleCondition returns a FilterExpression now (an OR group
  for NOT_EQUAL_TO). defaultRuleWeek: the column's week format, else the date picker's weekStart
* gridInterface.refreshDatePresets(): a new day renders the cells when a rule has a quick date
* the dialog (columnSettingsRules.ts dateTemplate): Compare with, Weeks; a quick date picked after a typed
  value is Equal (the column's default ≥ was the typed value's); the operator menu leaves out Between
* tests: colorRuleDates.test.ts (today faked: ISO and US weeks, every operator, datetime, Overdue, typed
  periods, Norwegian texts, the defaults, TypeErrors, the new day), columnSettingsRules.test.ts, texts

### A saved grid has a version (user request)

* the user: "when we export gridConfig, we need to include version number, if no version number is used,
  it need to expect version 1, and auto convert so its easier to use old configs". Asked: version 1 is
  v5's saved config (v6 is 2), and a new export / import pair carries it
* configVersion.ts: `GRID_CONFIG_VERSION`, `ExportedGrid`, `convertGridConfig()` - the converter of
  MIGRATION.md (fromV5Config, fromV5) moved into the library, also the misspelt
  `placeHolderRowCurrentEnityOnly`. A saved grid without a version that has v6 keys throws instead of
  becoming an empty grid
* gridInterface: `givenConfig` - the constructor's config with what updateConfig() changed, structuredClone'd
  - `exportConfig()`, `importConfig()` (updateConfig first: a config that throws changes nothing)
* a later change of the format: version 3, and a `fromVersion2` step in convertGridConfig
* tests: configVersion.test.ts (the conversion, the errors, export and import round trip, a v5 config into a
  grid). Docs: grid config guide *Exporting with a version*, MIGRATION.md

### Detail form sections: open or collapsed by default (user request)

* the user: "collapse panels also need a option if its default open or not". `collapsed` was both the
  default and what the header's button wrote (into the state): a click changed the default
* `collapsed` is the default now - *Open at start* in the dialog (checked: not collapsed). The header's
  button is kept by the grid (detailForm.ts `toggled`, per grid, keyed by the form's fields as JSON): a
  width dragged, the form collapsed / expanded, another row keep it; other fields or sections (the dialog's
  Apply, setState, resetState) start from the defaults
* tests: detailForm.test.ts (the toggle is not in the state, what keeps and what resets it),
  detailFormSettings.test.ts (Open at start)

### The detail form: sections are rows of the list (user request)

* the user, on the dialog with a section header per field: "it could be useful if we could add section
  row, so its easy to add/move items into it, maybe called section, and you set if its panel or not, name,
  padding etc"
* a section is an entry of `DetailForm.fields` now (`DetailFormSection`), not `fieldOptions.section` of
  its first field: moving the first field took the header with it. `fieldOptions` keeps `minRows` and the
  room. Not released, so nothing to convert (the saved grid's version stays 2)
* detailForm.ts: isDetailFormSection, copyOptions / assertOptions shared by fields and sections,
  toggleDetailFormSection by the section's index. gridInterface keeps the sections when columns go
* detailFormSettings.ts: the draft's `order` has the sections as objects (the one picked is that object),
  addSection / removeSection / setSectionOption, the section's settings under the list. The list's keys,
  drag and Move up / down work on a section as on a field; Space does nothing on one
* tests rewritten for it (detailForm.test.ts, detailFormSettings.test.ts, texts.test.ts)

### The detail form: sections, min lines, room (user request)

* the user: "in multiline, it could be useful to say min rows ... and for all inputs be able to add
  section header with collapse, and set padding top/bottom if needed"
* `DetailForm.fieldOptions` - a map beside `fields`, which stays a list of names: saved states, the
  dialog's list and the removal of a column (gridInterface) work as they did. `section` on a field starts a
  section, `collapsed` on it is state (the header's button sets it, as the title's sets `expanded`)
* detailForm.ts: copyFieldOptions (empty entries and `collapsed` without a `section` left out),
  assertFieldOptions, sectionTemplate / toggleDetailFormSection; minRows is the textarea's `rows` and a
  custom property for the min height where field-sizing makes `rows` nothing (theme.test.ts lists it with
  the per-cell properties)
* detailFormSettings.ts: the draft's `options`, setFieldOption, the settings of the field picked; Apply
  keeps the options of the fields in the form only
* tests: detailForm.test.ts (sections, toggle, rows, room, the TypeErrors), detailFormSettings.test.ts, the
  texts test with a section. detail-form-sections-check.js (local): 16/16, light and dark
* the user asked whether the shadow of tredespace's menus should be stronger: in dark the menu's line was
  the grid's line colour and black hardly shows on slate-900 - `--simple-html-grid-menu-border-color`,
  slate-600 in its dark. The theme test keeps its shadows one colour in light and dark, so the line it is

### Text filters: the escape `\` (user request)

* the user: the SQL escapes `!`, "what if we want to search = S__den, or a name containing % or *"; `\`
  rather than Excel's `~`; `_` as one character stays useful. There was no escape: `literal` (API, Find)
  takes the whole value as it is, a header filter could not make it, nor mix plain and wildcards
* textPattern.ts `textPatternParts(value, literal)`: the one reading of a text value - plain text,
  wildcards, escaped characters (`\*`, `\%`, `\_`, `\\`). A `\` before anything else or at the end is a `\`
  (`C:\temp`). objectFilter.ts `matchesText` and sql/buildWhere.ts `compareText` both build from it, the
  escaped character is the dialect's `wildcardLiteral`, as with `literal`. `blankRowMatches` uses
  objectFilter: no change
* `escapeTextPattern(text)` exported: the value that finds a text as it is (an app filling a header filter)
* fixed with it: the row menu's *Filter* on a cell made `EQUAL` without `literal` - a cell `50%` found `500`
  too. Now `literal: true` on a text field
* tests: textPattern.test.ts (parts, the grid's rows), toSqlWhere.test.ts (the pattern per dialect),
  sqlSqlite.test.ts (texts with `\` in the rows, 16 escaped values x 6 operators x case x literal: grid
  and SQLite select the same rows), sqlInjection.test.ts's real database with `literal`
* changes the meaning of a saved value with `\*`, `\%`, `\_` or `\\` in it - rare; in the changelog

### Fill down in the row menu

* the row menu's Paste › Fill down (`row.paste.fillDown`), after Paste range: `fillDown(gridInterface,
  { row, field })` - the ranges, or without one the cell right clicked from above (Ctrl+D's own rules).
  Greyed out with no range and a readonly cell; hint Ctrl+D / ⌘D (keyText.ts). In MENU_IDS.row, the menus
  and texts guides, the Norwegian sample
* tests: fillDown.test.ts (the cell from above, a readonly cell greyed out, a range filled from another
  cell's menu, none in a readonly grid); rangeClipboard.test.ts lists it with the paste entries

## Considered, not done

## Candidates / not started

Checked against the code on 2026-11-21: what was fixed is in *Candidates checked (2026-11-21)* above.

### Questions for the user (2026-11-23)

* **The start page of the docs site**: the Feature overview (`#guide/features`) is the start page now, it was
  Getting started (`samples/demo/index.ts`, `fromHash()`). Keep it?
* **Read only of the developer**: in the grid config dialog the user can uncheck *Read only* of a column the
  config has as `readonly: true` (`ColumnFormat.readonly: false` wins over `ColumnConfig.readonly`). Lock the
  developer's `readonly: true` against that, as `GridConfig.edit` is locked (not in the state)?
* **The totals row bold**: the values of a group row are in the weight of the cells now, the totals row keeps
  its bold, as the totals of a spreadsheet. Keep that, or the cells' weight there too?
* **The amber of the traffic lights** (icon sets, `--simple-html-grid-icon-amber-color`): `#92400e` in light
  mode looks brown beside the red - it is that dark to keep 3:1 on selected rows and the palette's
  backgrounds. An outlined icon would allow a brighter fill: worth it?
* **The publish workflows on master**: copy `.github/workflows/release.yml`, `beta.yml` and `next.yml` onto master, so
  GitHub shows their "Run workflow" buttons? The user (2026-11-23): not yet - keep them ready on v6_maybe.
  When it is time: one commit on master with the three files; a run then builds the branch picked
* **The old worktrees**: about 35 merged worktrees in `.claude/worktrees/` - `git worktree remove --force
  <path>` for each, by the user (removal commands are blocked for Claude)

### On hold

* **Validation rules in the grid config dialog** (required, min / max, length, a pattern, a formula of the
  safe expression language): the user - "kinda like color expressions ... lets put this on hold for now"

### Not wanted

* **A server-side row model** (rows loaded page by page from a backend, filtered and sorted there): the user
  does not want it - `toSqlWhere()` stays a helper for the user's own backend

### Bugs

* **Touch, not tried on a device**: the touch work was checked in Chromium's emulation only. Safari on
  iOS (no `contextmenu`, the long press timed by the grid; a canceled touchend dropping the click; the
  callout and the loupe on a cell's input under `-webkit-touch-callout: none`) and Chrome on Android (its
  own long press `contextmenu`, simulated in the check with one sent from the page; whether a long press
  on an editable input also starts the browser's text selection) are worth a look on real phones

### Accessibility

* **The column numbers by keyboard**: only a click gets to a number (then Shift+F10, Ctrl+C, Esc work
  there); Alt+ArrowDown from a header filter goes to the first row. And `aria-multiselectable` follows the
  row selection mode, while several columns can be selected in every mode
* **Keyboard**: the days of the date picker and the column chooser are for the mouse (the picker's
  buttons and hour / minute fields can be reached, a date can be typed); the picker opened from a cell is
  put at the end of the body, no key opens it and it does not take the focus - worth doing together with
  keys for its days; the two scrollbar elements are unnamed stops of Tab in Chrome; Shift+Tab into the
  grid from after it lands on the last input in the dom (a cell of a row rendered at the bottom of the
  view), not the last row or the footer; no Shift+Space / Ctrl+Space (a row, a column), no Ctrl+Left /
  Ctrl+Right to the edge of the data sideways (they are the input's word), no Alt+Shift+PageUp / PageDown;
  the treegrid's ArrowRight / ArrowLeft on a group row
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

* **Column settings, more** (see *Column settings* above): a template and a link on a number or date column (`{value} kg` on a number, a link from an order number); relative
  addresses within the app (resolved against a base the config gives, the base's origin kept); an "Open link"
  entry in the row menu; a `HYPERLINK` in the Excel export (a formula of data, Excel's 255 characters); the
  dialog's own undo (the filter editor has one); `placeholderRow` and `focusButton` on a link cell; more of
  the column in the dialog (its width, aggregates, readonly) - the whole of a column's view in one place;
  the
  group chips keep the title they were grouped with when the label changes after (`GroupArgument.title`);
  a checkbox column's header filter as a checkbox (it is typed now: `1`)
* **Display formats, more** (see *Display formats* above): grouping by the format - a group per week,
  month, quarter or year (needs a group value function in the datasource; the group names are the field
  formatter's now); a value list of weeks for a date column (the header filter takes `2026-W47` now, see
  *Filter as shown*); copy and CSV of the text shown as an option; Days until kept up to date over
  midnight (a timer); more formats - US with time on a 12-hour clock, `november 2026`, a week without
  its year, short day names, a currency, negatives in parentheses or red, more than 4 decimals; the
  names formats in Excel with its locale codes (`[$-414]`, its names and order differ from Intl's)
* **Touch, smaller things**: a finger makes ranges of cells with the row menu's Select › (Range from the
  active cell to here, Add this cell) but drags none (a hold and a drag could be one); the fill handle
  (7px) is small for a finger; the editor
  of a multiline cell hints "Ctrl+Enter to save, Esc to cancel", keys a phone has not (a tap outside
  saves); the date picker's days are 22px rows (`datePickerConfig.rowHeight`), the filter editor's AND /
  OR and icon buttons 24px - small for a finger; the docs site is not made for a phone (its sidebar takes
  half the width: touch-check.js gives the grid the page with css of its own)
* **Custom cells, the plan's "later"**: `focusButton` and `placeholderRow` on a custom cell, a `measure()`
  for `fitColumns()`, renderers for group rows, the totals row and header labels
* **Formatters are fixed when the datasource is made**: there is no setter to switch a field's formatter
