# Design

How `@simple-html/grid` is built and why: what to know before changing the code. It is not a user guide
and not a changelog. The guides for developers who use the package are in `guides/`. The guide for the
people who use a grid in an app is in `user-guide/`. What changed in each version is in `CHANGELOG.md`
and `MIGRATION2V6.md`.

| where | what |
| --- | --- |
| `src/datasource/` | the rows: fields and types, formatters, filter, sort, group, selection, edits, undo, validation, live data. No DOM |
| `src/grid/` | the grid element, `GridInterface`, config and state, and the pure modules the grid calls (formats, rules, formulas, csv, xlsx, zip) |
| `src/grid/gridFunctions/` | the grid's DOM code: one file per job (render a cell, a menu, a key handler, a dialog) |
| `src/date/` | the date picker, range picker and calendar (`DateInterface`, `<simple-html-date>`), used by the grid and on its own |
| `src/sql/`, `src/sql.ts` | `@simple-html/grid/sql`: `toSqlWhere()` and its helpers, for an app's own backend |
| `src/texts.ts` | every text the UI shows, by id |
| `src/grid.css`, `src/date.css`, `src/theme-tredespace.css` | the styles: CSS variables, the default theme and a second theme |
| `src/emitter.ts` | the typed event emitter of the datasource, the grid and the date picker |
| `samples/demo/` | the docs site: guides, samples, the API pages, the "Try it" boxes |
| `scripts/` | build, pack, docs checks, `verify`, the site's build (`scripts/site/`), the browser checks (`scripts/browser/`), the release helpers |
| `guides/`, `user-guide/` | the developer guides and the user guide, rendered by the site |

## Principles

From `CLAUDE.MD` and what held up while v6 was built:

- **Simple code, well documented, well tested.** Keep it simple, and do not guess how JS or TypeScript
  behaves. Every public export has JSDoc with an `@example`. The datasource is covered by tests, and so
  is most of the grid.
- **Pure logic apart from the DOM.** The rules (formats, colour rules, templates, formulas, filter as shown,
  date presets, csv, xlsx, reconcile) are modules that take values and return values. The grid code in
  `gridFunctions/` only calls them. They can be tested without a grid, and the dialogs and the checks use the
  same functions. For example `checkboxProblem` and `colorRuleProblem` are used both by the column settings
  dialog and by the `assert*` functions.
- **The config is plain JSON.** `GridConfig`, `GridState`, `fields`, `formatters` and `validate` hold no
  functions, so an app can store them in a backend. Code is registered under an id and the config names the
  id: `registerFormatter`, `registerValidator`, `registerCellRenderer`, `registerLookup`. Functions that
  change behaviour are hooks (`GridHooks`, `src/grid/gridHooks.ts`), passed apart from the config with
  `createGrid(host, { config, datasource, hooks })` or `updateHooks()`. A hook put into the config throws
  and names the hook. `scripts/typings-consumer/consumer.ts` checks at the type level that no function type
  gets into `GridConfig` or `GridState`.
- **Check input first, then change.** Every option is checked before anything is changed, in the
  constructor, `updateConfig()`, `setState()` and the datasource setters. A bad option throws a
  `TypeError` that names where it was (`GridConfig: columns.hours …`). A misspelt key, or `'false'` given as
  a string, would otherwise leave things on without a word. An old positional boolean call throws too
  (`assertOptions()`, `src/datasource/assertOptions.ts`): in plain JS `setData(rows, true)` would otherwise
  replace the rows instead of adding them.
- **No positional booleans.** Options objects and named methods: `setData(rows, { add, refilter })`,
  `markAllForDeletion()`, `removeAllData()`, `deselectAll({ notify })`.
- **What only the developer decides stays in code.** Validation rules, field locks (`caseSensitive`,
  `clobType`, `readonly`) and edit permissions (`GridConfig.edit`) are set by the app. They are not in `GridState`, a
  saved view or the grid config dialog, so the user can not change them.
- **No server-side row model.** The grid holds all its rows. `toSqlWhere()` is a helper for the app's own
  backend, not a paging data source.
- **No code from input.** No `eval`, `Function`, HTML or CSS is built from user input or config. Templates are
  `{field}` placeholders. Formulas have their own parser. Colours are checked `#rrggbb` or palette names.
  Results go into the DOM as text.
- **Every change updates its docs, tests and texts** in the same commit (see `CLAUDE.MD`).

## Datasource

`Datasource` (`src/datasource/dataSource.ts`) is what an app talks to. The rows live in a
`DataContainer` (`dataContainer.ts`), which several datasources can share, for example a grid and a lookup
on the same rows. The edit tracking, the undo history, the unique indexes and `rows-changed` belong to the
container. Filter, sort, group, the shown rows and the selection belong to each datasource.

### Rows and the proxy

- Each row is wrapped in a proxy (`entityHandler.ts`). A write through the proxy is an edit: it is tracked,
  validated, recorded for undo and sent in `rows-changed`. A row given to `setData()` is the proxy
  afterwards, so setting a property on it from code is an edit too.
- Internal fields start with `__` (`__KEY`, `__controller`, `__edited`, `__rowState`, `__groupLvl` ...).
  The proxy's `get` has a fast path: a name that does not start with `__` goes straight to the row, which
  made sorting about 15% faster. Keep new internal fields `__`-prefixed. The `set` trap must return `true`,
  or strict mode throws.
- A key of `0` is a valid key: never test a key for being truthy.
- Group rows are their own type, `GroupRow`. They are not entities. `getRows()` returns
  `(Entity | GroupRow)[]` and `isGroupRow(row)` tells them apart. `Entity` has `__group?: never`, so a group
  row can not be passed where an entity is wanted. Selection, editing, paste and export take entities only.
  In v5 group rows were fake entities, and that caused a whole class of bugs.
- Calculated fields (`calculatedField.ts`) are not stored on the rows. The container keeps them in a Map,
  the proxy's `get` computes `value(row)`, and the `set` trap ignores writes. So a calculated value is never
  an edit, never in `getChanges()`, JSON or `Object.keys`, and always current after edits, undo, upsert and
  reload, with nothing to invalidate. The `get` fast path must stay a `__calculated.size` check.

### Fields, types and formatters

- A field's type is set in one place: `new Datasource({ key, fields, formatters, selectionMode, container })`.
  The types are `text`, `number`, `boolean`, `date` and `datetime`. Sort, group, filter, edit tracking and
  the grid all read the type from there (`getField()`, `getFormatter()`). v5 kept the type in three places
  that could disagree.
- `date` compares, filters and sorts on the day; `datetime` on the time. Change tracking compares a
  `datetime` to the second, not the millisecond: the datetime `parse` stamps the current milliseconds, so
  typing the same value again would otherwise count as an edit.
- `Formatter` (`formatter.ts`) is `format`, `parse`, `parseFilter?`, `formatForEdit?` and `placeholder?`.
  The grid only calls `parse` / `parseFilter` with text; a stored Date or number is formatted first.
  `formatForEdit` is the text shown while a cell is edited.
- Formatters are referenced by id (`formatterRegistry.ts`, `DEFAULT_FORMATTER_IDS`). The built-ins are
  registered, and a formatter object given where an id belongs throws. Ids are resolved once, when the
  datasource is made. There is no setter that switches a field's formatter later (see the last section).
- `datasource.setFields()` replaces the fields at runtime and keeps the datasource object, so callers keep
  what they hold. The new fields are checked before anything is stored, then `fields-change` is sent and the
  rows are reloaded. The container tracks which datasource gave which field (`__fieldOwners`). A field given
  by two datasources must agree on its type, as the key must.
- `parseRow()` / `setData(rows, { parse: true })` (`parseValue.ts`) turn the JSON text of the listed fields
  into values. A `YYYY-MM-DD` day becomes local midnight: `new Date('2026-11-28')` is UTC midnight, which is
  the day before west of Greenwich. A value it can not read stays as it is.
- **0 is blank for numbers.** This was decided on purpose and is documented on `FilterOperator`: an emptied
  number cell stores 0, `IS_BLANK` matches 0, the value list puts 0 under Blank, and `required` fails on 0.
  Text fields show `0` and `false` as text, so they do not group with the blanks.
- `dynamicCellTypeColumn` gives a column a type per row. `valueText.ts` turns a Date into its ISO text for
  the text formatter, the text filter, sort and grouping, so the grid agrees with SQL on text columns. A
  field that holds more than one kind of value sorts every value by that text (`runOrderBy`): numbers
  compared as numbers and dates as text gave no consistent order.

### Filter

- One filter format (`filterExpression.ts`): `FilterExpression = FilterGroup | FilterCondition`, built with
  `and()`, `or()` and `where()`. `valueField` compares two fields. The type always comes from `fields`.
  A single condition is a valid filter, and `filter(null)` clears it.
- `isIgnoredCondition()` is the one test for a condition that is left out: incomplete, or a blank value
  without `valueField`. The runtime filter, the filter editor's apply and the colour rules all use it, so
  `getFilter()` and saved state never hold half-built conditions.
- `operatorsFor(type)` is the one list of the operators each type offers. Older operators (CONTAINS on a
  number, text `<`) still filter as before, so saved v5 filters work, but no menu offers them.
- Text (`objectFilter.ts`, `matchesText` / `compareText`): case is ignored unless `caseSensitive`.
  `*` / `%` match any text and `_` one character (a code point, as in SQL). A `\` escapes one of them, and a
  `\` before anything else is a literal `\` (`C:\temp`). `\` was chosen over Excel's `~`.
  `textPatternParts()` (`textPattern.ts`) is the one reader of a pattern, and both the filter and the SQL in
  `src/sql/buildWhere.ts` are built from it. `literal: true` turns the wildcards off. The row menu's
  *Filter* on a text cell uses it.
- `IN` compares without case, on upper-cased keys (`inListKey`). A number in the list is formatted with the
  field's formatter, so it matches what the cell shows. `isInListBlank()` is the blank test shared by the
  value list and `IN`.
- `BETWEEN` takes `[from, to]`. A blank end is open. If `from > to` no rows match, as in SQL.
- "Changed rows only" is a datasource flag (`__changedOnly`, `filterChangedOnly`), ANDed in the filter run.
  It is not a condition in the user's filter: a condition would show in the footer and the editor, and
  `setState` would drop it.
- Find's "Filter rows" is a second internal filter (`__setRowFilter`). It is not in `getFilter()`, the
  state or the SQL (a decision: Find works in the browser only).
- Hooks the grid gives the datasource (`__setFilterText`, `__setSortValue`, `__setSortText`,
  `__setGroupValue`, `__setColumnRules`) keep a list of owners. The last owner given is used, and a grid's
  `destroy()` takes back only its own. A second grid on the same datasource used to overwrite the first
  grid's hooks.
- v5 filters: `convertV5Filter`, `isV5Filter` and `normalizeFilter` (`v5Filter.ts`) treat their input as
  hostile. They throw a TypeError that names the place, and a RangeError when nested too deep.

### Sort and group

- Blanks (null, undefined, `''`, an invalid Date) sort first ascending and last descending. 0 and false are
  values. Grouping keys values the way the sort compares them, so no group shows twice.
- A collator that calls different strings equal (`setLocaleCompare(code, { sensitivity: 'base' })`) has
  its ties broken by code points. The sort never returns 0 for different strings, because a group is keyed
  by its exact text.
- Rows are always sorted by the group fields first. Every grouped row gets `__groupLvl`, which goes back to
  0 when the rows are shown ungrouped (`Grouping.resetLevels()`).
- A template column sorts on the text it shows (`sortText`, computed once per row per sort). A grouped
  column sorts on its value instead, because groups must be runs of rows.

### Selection

- `selectionMode` belongs to the datasource (`'none' | 'single' | 'multiple'`). In v5 the grid config had
  one too, and it overrode the datasource on every rebuild.
- `selection.ts` keeps an anchor and the rows kept at the last Ctrl/Cmd click (`keptKeys`). Shift+click
  selects the kept rows plus the range from the anchor. The column numbers use the same model.

### Edits, history and change tracking

- `getChanges()` (`changes.ts`) returns typed `Changes<T>`: deleted, modified and new rows as plain copies,
  ready for one transaction on the server. Fields edited back to their original value are left out.
  `hasChanges()`, `getChangedRows()`, `getChangedFields()` and `getOriginalValue()` share the same code
  (`changeKindsOf`).
- **Delete is a tag.** `markForDeletion()` marks a row, `unmarkForDeletion()` takes the mark off, and both
  can be undone. A new row that is marked stays in the data so the mark can be undone, but it is in no list
  of `getChanges()`. `removeData()` is the untracked removal, for rows that never came from the server.
- `resetRows()` on a new row marks it for deletion instead of removing it: revert means "back to what the
  server has", and the mark keeps the revert to one undo step.
- Undo (`history.ts`) lives in the container, shared by its datasources. A step is `{row, field, before,
  after}`; field `null` is the deletion mark. One synchronous run of code is one step (closed in a
  microtask), so a paste over many rows is one Ctrl+Z. Grid keystrokes go through `history.typing()`, one
  step per cell until blur. Writes that change nothing are not recorded. At most `HISTORY_LIMIT` (100)
  steps are kept.
- History never adds or removes a row. Adding a row is recorded as "deletion mark taken off"
  (`__recordAdded`), so undoing an add marks the row deleted.
- Undo writes through the proxy with recording off, so the edited flags, the row state and validation
  follow. `setData` (replace), `removeAllData`, `resetData` and `acceptChanges` clear the history.
- `History.editingCell()` / `startEditing()`: an editor of the grid's own (the text editor, a lookup's
  list) claims its cell. A merge into that cell is then a conflict rather than an overwrite.

### Validation

- Rules are JSON on the field (`validate: ['required', { id: 'min', value: 0 }]`) or on the grid's column
  (`ColumnConfig.validate`), resolved by `resolveRules()` (`validatorRegistry.ts`). The field's own rules
  come first. The rules are code-only: the grid config dialog shows them read-only, and `getState()` holds
  none.
- The built-ins are `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `integer`, `decimals`,
  `oneOf`, `email` and `unique`. `required` uses `isMissingValue`, which counts text of only spaces as
  missing; the required stripes of the cells use the same test. Do not name an example validator after a
  built-in: registering it replaces the built-in.
- `unique` is never called as a validator. `resolveRules` makes a `UniqueCheck`, backed by an index of
  key → rows kept in the container (`__uniqueIndexes`). It is built on the first check and kept up to date
  by edits, removals and `acceptChanges`. It can only see loaded rows, which is why the guide tells the app
  to keep the database constraint.
- When validation runs: a field is validated on edit, and the row's other failing fields are checked again
  so a rule across fields can clear. `validate(rows?)` runs before a save. Loaded and new rows are not
  validated on their own, or a new row would be all errors. Server errors (`setErrors()`) are kept apart but
  shown the same way. Messages are text ids `validation.*`.

### The save workflow

`getChanges()` → the app saves → `acceptChanges({ rows?, newKeys? })`, applied in one rebuild. Deleted
rows go, new rows become ordinary rows, edits become the originals, and errors clear. `newKeys` maps a
temporary key to the server's, compared as text, so a map from JSON works. Every key is checked before
anything changes. See `guides/05-editing.md`.

### Live data

- The container sends `rows-changed` once per microtask with the rows (and fields) that changed. The grid
  renders those rows on screen in the next animation frame (`renderChangedRows.ts`). That is why
  `row.price = 10` from code shows without `refresh()`.
- `upsert(rows, { removeMissing })` (`liveData.ts`) merges by key with one Map and runs filter, sort and
  group once. It writes with recording off and makes the new value the original. A field the user edited
  keeps the user's value and gets the server's value as its original. That is a conflict when the server's
  value differs both from the user's value and from where the edit started. `removeMissing` keeps a
  locally changed row as a `remote: 'removed'` conflict. `resolveConflict(row, field, 'remote' | 'local')`
  decides. An upsert that only changes values sends no `collection-changed` and causes no rebuild.
- Never `push(...rows)` with a big array: it overflows the stack at around 300k rows.

### Events and aggregates

- One `Emitter` (`src/emitter.ts`) serves the datasource (`DatasourceEvents`), the grid (`GridEvents`)
  and the date picker (`DateEvents`). The payloads are typed, the names are kebab-case, and `on()` returns
  the unsubscribe function. A handler's return value is ignored; in v5 a handler that returned nothing was
  dropped after the first event. The grid keeps its unsubscribe functions and calls them on disconnect.
- `datasource.aggregate()` (`aggregate.ts`): sum, avg, min and max over finite numbers, and count of
  non-blanks. The sum is Neumaier-compensated. Results are cached per group row and per filtered list,
  keyed by a change counter per field that the container bumps on every write, so editing a field that is
  not aggregated recomputes nothing.
- The grid shows an average rounded to 2 decimals when the column's number format has none
  (`formatAggregate`, `aggregates.ts`): the field's formatter shows every decimal, and `38.69346733668342`
  pushed the label out. A cell of an aggregate is a wrapping flex row laid out from the right, the value
  first: a label that does not fit beside the value wraps onto a second line, which the cell hides. So the
  label goes whole (it was cut to `S..`), then the value ends in an ellipsis.
- The values of a group row are in the cells' weight, only its name is bold. The totals row stays bold, as
  the totals of a spreadsheet are (the user: "total row is ok").

## Grid

`createGrid(host, { config, datasource, hooks })` (`createGrid.ts`) makes the `<simple-html-grid>` element
(`gridElement.ts`), sizes it, connects it and returns the `GridInterface` (`gridInterface.ts`), which is
the public API. `Grid` (`grid.ts`) is the internal context passed as `ctx` to the functions in
`gridFunctions/`. `destroy()` removes the document listeners, the ResizeObserver, the scroll listeners,
the timers and the custom cell renderers, even after the host has left the page. Grids used to leak: the
dropdown grid of a lookup is made on every open.

### Config, state and hooks

- **Config** (`GridConfig`, `gridConfig.ts`) is what the developer writes: options, `columns` keyed by field
  (`ColumnConfig`), and `layout` (`left` / `center` / `right`, each a list of `{ fields, width }`). A column is
  declared once, and the layout refers to it by field. In v5 a column was named in two lists, and the split
  caused bugs.
- **State** (`GridState`, `getState()` / `setState(partial)` / `resetState()`, `initialState`) is what the user
  changes: the layout, sort, group, expanded groups, filter, header filters, formats, aggregates, totals row,
  calculated columns and detail form. `getState()` hands out `structuredClone` copies in both directions, so
  Dates survive and no one shares the datasource's objects.
- **Hooks** (`GridHooks`: `isReadonly`, `cellClass`, `rowClass`, `menus`) are code and stay outside the
  JSON.
- `updateConfig(partial)` changes options at runtime with one rebuild. A built-in toggle (such as "Use dimmed
  values") must go through it, or the next `updateConfig` undoes the toggle. Where the user has a value of
  their own (totals row, detail form), `updateConfig` keeps it unless the option is given.
- `null` in a config means the default (`nullsAsDefaults`, `configNulls.ts`). It runs first in the
  constructor and in `updateConfig`. A v5 option given directly throws (`V5_CONFIG_OPTIONS`).
- Saved grids: `exportConfig()` / `importConfig()` write `{ version, config, state, views }`.
  `GRID_CONFIG_VERSION` is 2, and version 1 is a v5 config, converted by `convertGridConfig()`
  (`configVersion.ts`). A future change of the format bumps the version and adds a step. A config with v6
  keys and no version throws rather than giving an empty grid.
- `reconcileColumns()` (`reconcileColumns.ts`, `gridInterface.updateColumns`) is a pure function on an
  exported grid. When the source's fields change, it removes the gone fields from layout, filter, rules,
  formats, detail form, state and views, and the calculated columns that read them. It reports what it
  removed so the app can tell the user.
- Edit permissions (`GridConfig.edit = { add, change, delete }`, `gridFunctions/editPermissions.ts`) are a
  permission, not state. They are asked in one place: `__isCellReadonly`, `__canChangeRow`,
  `__canChangeValues` and `__canDeleteRow`. The `isReadonly` hook can not unlock a row that `edit` locks.
  A new row may be changed with `add` or `change`, and can always be taken out (that is the undo of the
  add). The app's own code is never blocked.

### Rendering: lit-html, the pool, virtual scrolling

- The grid renders with lit-html templates. It stays on lit-html: see *Custom cells* for why not Solid or JSX.
- Rows and columns are virtual. The row and column elements are a pool (`rebuildRows.ts`,
  `rebuildRowColumns.ts`), reused while scrolling: `assignPool()` lets an element keep the row it already
  shows and gives the free elements the rows that are new on screen. A logical row is five DOM elements
  (group, selector, left, middle, right), so DOM order is not row order. Columns off screen are not in the
  DOM. A cell element (`HTMLCellElement`) says what it shows now in its `$` fields (`$row`, `$attribute`).
  Read those, not the `cellpos-` classes, which are stale on hidden rows.
- Scroll handlers (`verticalScrollHandler.ts`, `horizontalScrollHandler.ts`) find the first row or column with
  a binary search (`firstIndexAtOrAfter.ts`, which returns the length for "not found", not 0). The three
  sections share one path (`pinnedSection.ts`). The cost that was measured was rendering cells and forced
  layout, not the search. During a fast scrollbar drag the rows hide for about 150ms (`largeScroll`), on
  purpose. A far jump renders at once.
- Rows have a fixed height. Virtual scrolling depends on it. A multiline row is `cellHeight` +
  (lines − 1) × `multilineLineHeight` (`rowHeights.ts`). `multilineLineHeight` is an option, not a CSS
  variable, because JS needs the pixels to place rows. Row heights are kept in lines per row key, not in
  pixels, so a change of either option needs no refit. They are not state, because generated keys mean
  nothing once saved.
- A focused cell input is never re-rendered under the user. DOM nodes are never moved for order, because a
  moved node loses its focus. The aria order uses `aria-owns` instead.
- Row classes from the `rowClass` hook go through `showRowClass()`. A WeakMap per element remembers the old
  classes, because row elements are reused. Classes on cells (colour rules, `cellClass`) are toggled on
  every render for the same reason.
- happy-dom does no layout, so the grid tests stub the sizes (`gridTestHelpers.ts`). Without that, the
  virtual scroller renders nothing.

### Columns and labels

- The layout has pinned left, center and pinned right sections. A layout column can stack several fields
  (`fields: ['age', 'born']`). A stacked field is its own column for ranges, copy, export and aria.
- `getColumnLabel()` is the one source of a column's label: the user's `format.label`, else the column's
  label, the field's label, or the field name made readable. The header, the menus, the chooser, the filter
  editor, the chips, copy with headers and the CSV and Excel headers all use it.
- `getCellType()` is the one source of a cell's type: the field's, or the type `dynamicCellTypeColumn` gives
  the row.
- `__getColumnFormat(field)` is the one reader of a column's display format. It merges the formats by type
  (`typeFormats`) with the column's own. Every reader of a date or number format goes through it.
- Column numbers (a third header row) select whole columns (`columnSelection.ts`). A selection is a set of
  positions, so it is cleared when the layout's fields change, and it is not state.
- `fitColumns()` measures the text shown in the 20 longest values only, because measuring every value takes
  about 540ms per 100k rows.

### Menus

- Menus are data (`gridMenus.ts`, drawn by `showMenu.ts`). The entries are `MenuItem`, `MenuSection`,
  `MenuSubmenu`, `MenuSeparator` and `MenuBlock`. Every built-in entry has a stable id in `MENU_IDS`, whose
  order is the default order and which the texts are keyed on. The `menus` hook gets the default entries and
  returns the entries to show, so an app can hide, reorder or add entries. Ids stay the same across versions:
  submenus reuse the old section ids, so a hook that hides a parent hides everything under it.
- Menus are `popover="manual"`, never `auto`. On macOS and Linux `contextmenu` fires on the press, and the
  release would light-dismiss an auto popover at once. The grid closes menus itself (outside click, scroll,
  one menu at a time, grid removed; `addMenuListeners.ts`).
- A menu opens inside the closest dialog or popover of the element that opened it (`popoverParent`),
  because everything outside a modal dialog is inert. `placeMenu` puts it below the point, else above, else
  beside it. Only a menu taller than the window gets a scroll, because the scroll box clips the shadow.
- The keyboard follows the APG menu pattern: roving tabindex, arrows that wrap, Home/End, first letter.
  Submenus open on hover after `SUBMENU_DELAY`, so a diagonal move does not open the ones in between.
  Whether a menu takes the focus depends on whether the last input was a key or a pointer.
- Entries that need a selection are disabled, not hidden, so the menu keeps its shape.
- A right mousedown moves the focus to the clicked cell, so the cell focused before the press is kept in
  `ctx.lastPress` (`lastPress.ts`).

### Header filters and the value list

- Typing in a header filter replaces only that column's top-level conditions. Ranges, nested groups, other
  columns and an OR root are kept. The operator picked in the header is state; `ColumnConfig.operator` is
  only the operator it starts with.
- **Filter as shown** (`filterAsShown.ts`, on by default): the header filter of a formatted column reads the
  text as the cells show it. A week typed as `2026-W47` becomes the plain conditions
  `>= Monday AND < next Monday`, so `toSqlWhere` needs nothing new and the SQL can use an index. The state
  keeps the parsed start of the period, not the typed text, because a later format change could not read
  the text back.
- Filter as you type (`filterOnType.ts`) waits `FILTER_ON_TYPE_DELAY` and filters only when the text parses,
  so a half-typed date does not filter.
- The operator indicator (`filterOperatorIndicator.ts`, `headerOperatorMenu.ts`) shows the operator in the
  cell. It is `tabindex="-1"`, because the filter row moves the focus between inputs itself. F4 opens the
  choice, because Alt+ArrowDown is taken.
- Quick dates (`datePresets.ts` is pure; `datePresetFilter.ts`, `datePresetBlock.ts`): a preset is stored
  relative (`HeaderFilter.datePreset`) and run as a plain `BETWEEN` of days, so `getFilter()`, the filter
  editor and SQL only ever see dates. It is computed again on window focus and `refreshDatePresets()`. A page
  left open over midnight needs the app's own timer. Days are built with `new Date(y, m, d)`, so a summer
  time change can not move them.
- The value list (`dropDownFilterData.ts`) lists what the cells show (`cellTextOf`, lookup labels included),
  built from the rows every *other* filter lets through. Values are grouped by `inListKey`, so values `IN`
  can not tell apart are never split. It is capped at `DROPDOWN_FILTER_MAX_ROWS` (100), with a flag that says
  so. Apply uses the shorter of `IN` of the checked values or `NOT_IN` of the unchecked ones.
- The range block (number and date columns) applies through the same path as typing. A date picker opened
  from the filter menu is a manual popover inside the menu, not a menu of its own, because only one grid menu
  can be open at a time.

### The filter editor

`renderFilterEditor.ts` is a modal `<dialog>` (`showModal`), so the page behind it is inert, Esc closes it,
and the focus goes in and comes back. It is re-rendered in the same dialog, so position, size and focus stay.
Its frame (`dialogFrame.ts`: drag, eight resize handles, `keepDialogInView`) is shared with the grid config
dialog and the import dialog, so all dialogs look the same. It works on a draft and drops the incomplete
conditions on Apply. It empties only the header filters whose conditions it changed
(`__clearChangedHeaderFilters`). Its undo (`filterEditorHistory.ts`) is its own, with up to 100 copies of the
draft: Ctrl+Z belongs to the focused input while that input has typing, then to the editor, because Chrome's
page-level undo would move the focus. The field and operator pickers are grid menus, so they have the menu
keyboard.

### Editing

- Every cell is an `<input>`, so Home, End and Ctrl+Left/Right stay the caret's.
- A multiline cell's input is readonly, because `<input type=text>` drops line breaks. Editing opens the text
  editor (`textEditor.ts`), a manual popover with one open at a time. It saves on outside mousedown, scroll,
  a menu, and destroy, and writes `parse(text)` once, only when the text changed, so CRLF from a server
  survives.
- Readonly is decided in one place, `__isCellReadonly`: the `edit` permissions, then the column's `readonly`
  (the user's `format.readonly` wins), then the `isReadonly` hook. Calculated columns and locked fields
  (`FieldConfig.readonly`) are always readonly, the hook is not asked. Clear, paste, fill and delete ask the
  same function. The lock is the field's, not the column's, as `caseSensitive` is: the column's `readonly`
  is a default the user may change in the grid config dialog, the field's is the app's (`__isFieldReadonly`,
  no object made per cell). The import leaves locked fields out.
- The edited marker (`showCellEdited.ts`) is an element of its own, hidden from aria. A click restores the
  original value. The row number shows one status icon with the precedence deleted > conflict/error >
  new/edited (`rowStatusIcon`, `rowStatus.ts`).
- Undo from the keyboard moves the focus to the change (`undoRedoKey.ts`). `datasource.undo()` from code
  does not.
- Fill down (`fillDown.ts`) copies each range's top row down in one undo step. Ctrl+D is not taken in a
  readonly grid, where it is the browser's bookmark key.

### Keyboard and accessibility

- `.simple-html-grid-aria` is the grid element, not the host, because the panel and footer buttons can not be
  inside a `grid`. Its role is `grid`, or `treegrid` while grouped. The selector row element is the `row` and
  `aria-owns` its cells in column order. `aria-rowindex` and `aria-colindex` count the virtual rows and
  columns. `updateAriaGrid` (`ariaGrid.ts`) runs after the scroll render and writes only what changed.
- Tab visits every cell in the order shown, like a form, then the footer buttons, then leaves the grid
  (`tabExit.ts`). Focus moves are synchronous (`focusCellNow`): scroll into view, render, focus, with no timer.
- Alt+arrows move between cells. Jump keys (`jumpKeys.ts`): Ctrl+Home/End, PageUp/Down, Alt+PageUp/Down,
  Ctrl+ArrowUp/Down. Mac hints come from separate `.mac` text ids (`keyText`), so translators control them.
- `shortcutList.ts` is the one list of shortcuts. The shortcut help (`?` or Ctrl+/) and the table in
  `guides/14-accessibility.md` are made from it, and a test keeps them equal. Add new keys there.
- Focus is one inset `:focus-visible` outline: inset because cells sit in parents with `overflow: hidden`.
- Only Chrome's accessibility tree has been checked (see the last section).

### Touch and pointer

- Drag and resize use pointer events (`followPointer.ts`, `dragEvent.ts`). A mouse or pen starts a drag after
  `DRAG_DISTANCE` (5px). A finger starts one after holding for `TOUCH_HOLD`, so a swipe still scrolls.
  `dragEvent.ts` adds a non-passive touchmove listener at touchstart, because that is when the browser
  decides whether a pan can be blocked.
- Swipes (`touchScroll.ts`) write the scrollers directly, with the axis locked after `TOUCH_SLOP` and
  momentum (`MOMENTUM_DECAY`). The grid takes a swipe only if it can scroll that way; otherwise the page does.
- A long press (`longPress.ts`, `LONG_PRESS` 500ms) sends a `contextmenu` event, so the right-click menus
  are reused. Chromium on Linux and iOS Safari send none of their own.
- A tap on a row or column number toggles it, as Ctrl+click does. The Select › entries of the menus give a
  finger what Shift and Ctrl give a mouse.
- The wheel event is cancelled, so the page does not scroll too. Ctrl+wheel (zoom) is left to the browser.

### Ranges, clipboard, export and import

- A range is `{ fromRow, fromField, toRow, toField }`: shown row indexes and field names (`cellRange.ts`,
  `cellRanges.ts`, `rangeSelection.ts`). It is cleared when the shown rows or the layout change. Dragging
  inside one cell stays the input's text selection.
- copy and paste listen on the document (`rangeClipboard.ts`), because Chrome sends a focused checkbox's
  events to the body. Each grid acts only when the focus is in one of its cells. Several ranges copy as one
  table. A copy of more than one cell has a header line (`copyHeaders`). Paste skips a first line of labels
  and is one undo step.
- Copy, paste, CSV, sort, group and the filter chips use the field's formatter, not the display format,
  because a paste or an import must be able to read the text back (`2026-W47` can not be).
- CSV (`csv.ts`, `gridCsv.ts`): RFC 4180, CRLF and a BOM. A value that starts like a formula is escaped by
  its value, not by the field type. Excel (`xlsx.ts`, `zip.ts`, `gridExcel.ts`) has no dependency: the zip
  uses `CompressionStream`. Numbers, dates and booleans keep their types, and display formats become Excel
  number formats where Excel has one. The sheet always has a bold frozen header, an autofilter and a flat
  list. Colour rules are written as static fills, and bars, scales and icons as `<conditionalFormatting>`.
  Downloads use a detached `<a download>`, because an open modal dialog makes the page inert.
- Import (`importDialog.ts`, `importRows.ts`, `importFile.ts`, `xlsxRead.ts`, `unzip.ts`): one dialog for a
  file, a drop and a paste, with the column mapping shown first. A plain Ctrl+V in a cell never adds rows.
  Values are read as typing reads them, and a value that can not be read is never guessed: it is reported.
  Text is kept as it is (`=1+1` stays text). A file is not trusted: `IMPORT_LIMITS` (`importLimits.ts`), the
  sizes and CRCs a zip declares are checked, ZIP64 and encryption are refused, and `<!DOCTYPE` is refused
  before `DOMParser`. The menu entries are off by default (`importMenu`) and need `edit.add`. The API is not
  limited by readonly or permissions, just as `addNewEmpty` is not.

### Find, lookups, calculated columns

- Find (`findBar.ts`, `findMatches.ts`): `cellShowsText` is the one test of a match, with the same rules as
  `cellTextOf`. Matches are keyed by row object and field, not by index, so a sort keeps them. Ctrl+F and
  Alt+C are matched on `key`, because Mac Option+C types `ç`. Ctrl+F falls back to `code` only for
  non-Latin layouts. The current match does not become the current row while stepping, or a bound detail
  form would reload on every Enter.
- Lookups (`lookup.ts`, `lookupColumn.ts`, `lookupEditor.ts`): `registerLookup(id, …)`, values compared with
  `===`, sorted on the label (then the value on ties, so groups stay whole). The select renders at most
  `MAX_OPTIONS` (500) for speed. A linked dropdown grid is connected only while it is open. A lookup and a
  renderer on one column throw.
- Formulas (`formula.ts`): a hand-written tokenizer, a recursive-descent parser over fixed node kinds, a type
  check and an evaluator. There is no `eval`, functions are looked up in a Map (so `constructor` is not a
  function), and there are limits on length, parts and depth. A failure in one row gives a blank cell, never
  a throw. `formulaHostile.test.ts` tries to break it. `formulaFunctionMenu.ts` (the ƒ button) has a test that
  lists every function.
- Calculated columns (`calculatedColumns.ts`, `calculatedState.ts`): config and state. They are compiled
  together, and a cycle is refused before any row is read. They are registered as calculated fields on the
  datasource (rolled back on a throw, removed on destroy), so every reader sees them as fields. Fields are
  read only as known own properties (`readerOf`), and `__` names are refused.

### The grid config dialog, detail form and views

- One modal dialog (`columnSettings.ts`, `gridConfigTabs.ts`, `gridDefaultsSettings.ts`,
  `detailFormSettings.ts`) opens from the gear, the header menu, `openColumnSettings()` and
  `openDetailFormSettings()`. Its tabs follow the WAI-ARIA tabs pattern, and hidden panels stay rendered so
  their drafts survive. Everything is a draft until Apply, which calls `setState()`, so `getState()` has the
  result and it can be saved. The preview uses the grid's own code with the draft. Pickers are grid menus,
  not `<select>`. The browser checks click the right tab first (`scripts/browser/sections.js`).
- The detail form (`detailForm.ts`, `detailFormResize.ts`) is state (`GridState.detailForm`), with
  `GridConfig.detailForm` as the default. It sits right of the rows, or under them when there is too little
  room. It edits by the cell rules, with one undo step per field. Its render must not be re-entered: a blur
  during a lit render threw a `NotFoundError`.
- Named views (`gridView.ts`, `viewsMenu.ts`): a view is plain JSON with the whole state. "Modified" compares a
  sorted text of the state with a snapshot taken after apply or save. `views-change` is not sent for
  `setViews()` / `updateConfig({ views })`, to avoid save loops. `resetState()` is the Standard view.

## Display formats, colour rules, data bars, icons

- `ColumnFormat` (`columnFormat.ts`) is one object per column, with an optional key per kind of rule (date,
  number, text, link, label, placeholderRow, numberOverride, checkbox, rules, bar, scale, icons, filterAsShown,
  multiline, readonly). A new kind is a new key, so adding one breaks nothing. The developer sets it in
  `ColumnConfig.format`. The user's version is `GridState.formats`, which wins key by key.
- One place turns a value into cell text: `__getCellFormatter(field, type?, row?)`, which wraps the field's
  formatter with `displayFormatter()`. The display format shows the value. A value it can not show falls back
  to the field's formatter. `formatForEdit`, `parse`, `parseFilter` and `placeholder` stay the field's: the
  user types `2026-11-22`, not a week.
- Date names come from the text `format.locale` (a BCP 47 tag), so an app's Norwegian texts give Norwegian
  dates. `navigator.language` was rejected because it would give an English grid with Norwegian day names.
  A tag that `Intl` rejects falls back to `en-US`. Weeks (`isoWeek`, `usWeek`) are computed on local day
  numbers, so the time of day, DST and the time zone never move a week. The date picker uses the same
  functions.
- Number separators are inserted in plain ASCII (space, `-`, `'`), never Intl's U+00A0 or U+2212, so Find
  finds a typed space. Rounding is half away from zero of the number as written.
- Templates (`cellTemplate.ts`) are `{field}` placeholders only, filled with the formatter's text. `{__…}`
  is refused. Links (`linkOf`) must start with `https://`, `http://`, `mailto:` or `tel:`, or be a single
  placeholder that holds the whole address. Values are `encodeURIComponent`-ed and the result is checked
  again with `new URL()`. A link cell is the grid's own custom cell (`linkCell.ts`, renderer id `''`, which
  `registerCellRenderer` refuses). A template column filters and sorts on the text it shows
  (`__setFilterText`, `__setSortText`), and `toSqlWhere({ shown })` can do the same in SQL
  (`templateFormula.ts`).
- `format.checkbox` shows a text or number column as a checkbox. Numbers are allowed because databases often
  store flags as 0/1. A change writes the value computed from the value, not from the box, because the click
  re-renders the cell first.
- Colour rules (`colorRules.ts`, `showCellColor.ts`, `ruleColors.ts`) are part of the format, so they are
  saved in state. The first matching rule wins. There are three kinds: Value, Conditions and Formula. A Value
  rule means exactly what the header filter means: the typed text is parsed as the filter parses it and tested
  by the datasource's `Filter`. Error and Find-match cells are left out of the rule CSS (`:not()`), so Find's
  yellow is never taken for a yellow rule. Date rules share `periodConditions` with filter as shown.
- Data bars, colour scales and icon sets (`dataBars.ts`, `cellIcon.ts`) are for number fields only. Their
  range is the min and max over the filtered rows (`datasource.aggregate`, cached). When an edit moves the
  range, every visible row renders again. Per-cell values are CSS custom properties holding only palette
  `var()`s or tints of a checked `#rrggbb`. A custom colour is a 1/5 tint, so the text keeps 4.5:1 (a 1/4 tint
  failed).

## Custom cells

`registerCellRenderer(id, renderer)` (`cellRendererRegistry.ts`) and `ColumnConfig.renderer: id`. The guide
is `guides/21-custom-cells.md`.

- **A renderer hook, not a framework in the core.** It was asked whether the grid should move from lit-html
  to Solid 2.0, for JSX cells and signals. No:
  - JSX cells would help only Solid users. Solid JSX is not React's, and a grid built on Solid would ship
    Solid to every app. The grid is for apps without a framework.
  - The build and vitest would need Babel; esbuild does not compile Solid JSX.
  - Signals do not fit the pool. A scroll gives a cell another row and everything in it changes at once, so
    signals would re-run every binding and add bookkeeping. What signals would give is already there:
    `rows-changed` and a render per frame, with lit-html touching only what changed.

  A hook that depends on no framework gives every app custom cells in its own tool (plain DOM, lit-html,
  React, Solid), as AG Grid and the like do.
- **The API.** `CellRenderer = (host) => CellRendererInstance`. It is called once per cell element, not per
  row. The instance's `update(context)` is called on every render: a new row while scrolling, a changed
  value, `refresh()`. `destroy?()` is called when the element stops using the renderer. `edit?(typed)` lets a
  renderer edit itself. `CellRenderContext` gives `row`, `field`, `value`, `text` (what the default cell would
  show), `type`, `readonly`, `rowIndex` and `gridInterface` (the registry is for the page, so a renderer can
  not know its grid otherwise). A write to `context.row[field]` goes through the datasource like any code:
  tracked, validated, undoable. The number of instances is the pool size (rows on screen + 5, times the
  stacked cells), not the row count. `update()` runs on every render, without a "same row and value" check,
  because frameworks diff anyway and a renderer may read other fields of the row.
- **The cell** (`customCell.ts`, `renderCustomCell`): a host `div` with the `cellpos-` class and
  `tabindex`, so keyboard navigation finds and focuses it as it does an input. It has no children in the
  template, so lit-html leaves the renderer's content alone. The host gets the input's handlers minus typing:
  navigation, range keys, Delete, undo, `cell-click`, `cell-row-focus` and the row menu. Events from the
  renderer's content bubble to them, and a renderer with keys of its own stops them. Without `edit`, Enter,
  F2, typing and double click open the text editor in single-line mode.
- **The lifecycle** (`cell.$renderer = { id, instance }`): with the same id, `update()`; with another id,
  destroy, empty the host, mount. Rendering anything else in the element calls `releaseRenderer()` first,
  because lit-html is about to remove the host. A group row hides the cells and keeps the instance.
  `releaseAllRenderers()` runs in `rebuildRows`, `rebuildRowColumns` and `disconnectElement()`: a React root
  or a subscription would otherwise keep the grid alive.
- **What keeps working unchanged**, because it works on the cell element or on the data: errors, the
  edited marker, ranges, `cellClass` backgrounds, the readonly and required stripes, copy, paste, clear, CSV,
  Excel, sort, filter, group, aggregates. The cell stays the `gridcell` and the host is the focus target. There
  is no `aria-label` on the host, because it would hide the content, so the renderer must render readable
  text. An unknown id throws in `createGrid` and `updateConfig()` (`assertRenderers`).
- React and Solid may write the DOM a tick after `update()`. That is fine, because the grid never reads the
  renderer's DOM.

## SQL

`@simple-html/grid/sql` (`src/sql.ts`, `src/sql/`) is a separate entry that must load in Node with no DOM
and no lit-html. `scripts/build.js` bundles it into `dist/sql.mjs` and `dist/sql.cjs`. The build fails if a
module outside a whitelist gets in: the sql files, `grid/formula.ts` and some datasource filter modules with
no imports, shared so that the grid and the SQL behave the same. `src/sql.ts` declares its own types, and
`sqlHelpers.test.ts` checks them against the grid's types.

- `toSqlWhere(filter, { dialect, columns, timeZone?, dateStorage?, … })` returns `{ sql, params }`. It is one
  function with no builder, and the options are checked on every call. `columns` is the whitelist. The result
  is one bracketed term (`AND ${sql}` is safe). No conditions give `1=1`.
- It is strict where the grid is lenient: bad input throws a `TypeError`, a limit a `RangeError`.
  `isSqlFilterError()` marks the errors that should be a 400, using a symbol from the global registry so two
  copies of the package agree.
- Two-valued logic: each condition handles null itself, so `NOT (sql)` is the exact complement. The answer
  for a blank row is the grid's `objectFilter`. Numbers do blank-is-0 when the SQL is built rather than with
  `COALESCE`, so an index can be used.
- Text is folded with LOWER, or UPPER for IN. ASCII values are folded in JS, anything else by the database,
  because JS and databases fold ß and Æ differently. Patterns per dialect: LIKE with `ESCAPE '!'`
  (PostgreSQL, Oracle), GLOB (SQLite, whose LIKE can not keep case), LIKE in a BIN2 collation (SQL Server,
  whose `=` ignores trailing spaces). Plain EQUAL on text without wildcards becomes `=` where it is safe.
- Dates are ranges `[start, next)` in the user's IANA `timeZone`, with an explicit conversion and no session
  settings. `dateStorage` says how the column stores them.
- Calculated columns (`formulaSql.ts`, `toSqlWhere({ calculated })`) write the grid's semantics out in SQL:
  blanks, division by 0, ROUND half away from 0. `getServerFilter({ fields, calculated })` is `getFilter()`
  minus what the backend can not filter (`withoutFields`, in `filterFields.ts`). A removed condition counts as
  true, so the backend gets a filter that lets through every row the full filter does.
- Field locks reach the backend: `sqlColumnsFromFields()` copies `caseSensitive` and `clobType`, so the server
  enforces them without trusting the browser.
- The tests (`src/sql/__tests__`) compare the SQL's answers with the grid's on `node:sqlite`, and include an
  injection fuzz. The limits per dialect are in `guides/22-sql.md`.

## Texts and translation

- `src/texts.ts`: `TEXTS` (the English defaults, keyed by `TextId`), `setTexts()` for the page,
  `GridConfig.texts` per grid. A text is resolved grid → page → default (`getText`, `findText`). Ids are
  grouped by area (`row.*`, `filter.*`, `filterEditor.*`, `footer.*`, `datePicker.*`, `validation.*`). Menu
  entries use their `MENU_IDS`. Values go in as `{name}` (`fillText`), so a text must not contain a `{x}` of
  its own. Tooltips are `<id>.tooltip` and Mac key hints `<id>.mac`. Month and day names are texts too.
  There are no plural forms.
- The datasource uses the page texts, not a grid's, because validation runs in the container, which several
  grids may share.
- A new text id needs its row in `guides/12-texts.md` and its Norwegian in
  `samples/demo/samples/translation.ts`. `src/__tests__/texts.test.ts` and `src/grid/__tests__/texts.test.ts`
  guard this: every id must be in the guide, and a scan looks for literal English in the templates. They also
  render every menu, dialog and picker with each text replaced by `«id»`, and fail on any letter outside the
  guillemets.

## Themes and CSS variables

- Every colour is a CSS variable (`--simple-html-grid-*`, `--simple-html-date-*`), and dark mode is
  `light-dark()` inside each variable. The grid follows the page's `color-scheme`, which must be set on `:root`
  or `body`, because menus, tooltips and dialogs live on the body.
- `src/theme-tredespace.css` holds only variables, under `[data-grid-theme='tredespace']`, all as
  `light-dark()`. The selector is stronger than the default's, so load order does not matter. The attribute
  goes on `html` or `body`, for the same reason as `color-scheme`. Every colour variable of `grid.css` and
  `date.css` must have a TreDeSpace value, and a test fails otherwise.
- Contrast: `CONTRAST_PAIRS` in `src/__tests__/themeCss.ts` is the one list (4.5:1 for text, 3:1 for lines and
  controls), checked for both themes in light and dark (`theme.test.ts`, `themeTredespace.test.ts`,
  `themeDataBars.test.ts`). Add pairs when adding colours. The 14 rule palette colours were picked to meet these
  pairs. The Excel export's `LIGHT_PALETTE` (`ruleColors.ts`) is compared with `grid.css` by a test.
- The tests also check that there is no literal colour outside the theme rules and that every `var()` is
  defined. They check the z-order of the filter input (1000) < resize handle (1001) < drop zones and
  indicator (1002); otherwise only half the resize handle can be grabbed. Tooltips are at 10000.
- There is no `border-radius` anywhere (tested). Date picker classes are prefixed `simple-html-date-*`, because
  generic names clashed with page CSS. Touch targets are at least 24px.
- `GROUP_LEVEL_WIDTH` (15) is in both TS and `grid.css`; keep the two in sync.

## Build, package and tests

- One package at the root. `scripts/build.js` emits untranspiled es2025 to `dist` (gitignored), with
  `stripInternal` (members tagged `@internal` are left out of the `.d.ts`) and `include: ['src']`. The
  `exports` map covers `.`, `./sql`, `./grid.css`, `./date.css`, `./theme-tredespace.css` and
  `./package.json`. `files` ships `dist` and `src` without tests. `prepare` builds, so an install from a git
  branch gets a `dist`, and that is why the tgz is a separate `npm run build:tgz` (`scripts/pack.js`).
- `lit-html` is a range dependency so apps can dedupe it. Most devDependencies are pinned. TypeScript 6 with
  `strict`. The library has no node types: use `ReturnType<typeof setTimeout>`.
- `npm run check:typings` compiles a consumer (`scripts/typings-consumer/`) against `dist` with strict and
  `skipLibCheck: false`. It catches public signatures that use a type stripped as `@internal`. A typedoc
  warning "X is referenced by Y but not included" means the same: export the type, narrow the signature, or
  mark it internal.
- Biome (`biome.json`) formats and lints. `files.includes` excludes the build folders explicitly rather than
  relying on `.gitignore`. `noStaticOnlyClass` is off, because the built-in formatters are static classes in
  the public API.
- Tests: vitest with happy-dom (`vitest.config.ts`). `TZ` is set to `Europe/Oslo` before the workers start,
  because test files build dates at load time and GitHub's runners are UTC. `testTimeout` is 30s, because
  whole-grid tests are slow on runners. `src/__tests__/popoverStub.ts` stubs the popover API, which happy-dom
  lacks. happy-dom has no layout, top layer, inert, focus or pointer capture either, which is why the browser
  checks exist. Tests pin current behaviour, including a formatter's quirks: change such a quirk by changing
  its test on purpose.

## The docs site and the browser checks

- The demo is the docs site (`samples/demo/`), built by `npm run build:demo` (`scripts/buildDemo.js`) into
  `dist_demo`. Its sidebar has Features (`guides/00-features.md`, the start page), Developer Guide
  (`guides/`), User Guide (`user-guide/`), Samples and API. Routes are hashes: `#guide/<id>[/<section>]`,
  `#user-guide/<id>`, `#sample/<id>`, `#api/…`. typedoc is used only as a parser, not for its HTML, so the
  site has one look, live grids next to the text, and examples that are checked.
- `scripts/site/markdown.js` renders the markdown with `marked` and rewrites links to repo files. A link
  between guides is written GitHub-style (`05-editing.md#x`), and a link to a root file goes to GitHub. Fenced
  blocks: ```` ```sample <id> ```` embeds a live sample with its source; ```` ```tryit <id> ```` is a "Try it"
  box. `scripts/site/api.js` makes the API pages from typedoc's JSON model, so they can not drift from the
  code. Samples show their real source through a `?raw` import (`scripts/site/esbuildPlugin.js`), so the code
  shown is the code that runs.
- The "Try it" boxes (`samples/demo/tryIt.ts`): a live grid and tasks that tick when done. A box polls the
  grid, so any way of doing a task counts. A task the grid can not see (export, copy) gets a checkbox. Progress
  is kept in localStorage (wrapped in try/catch), and a box whose tasks changed starts over. Confetti
  (`confetti.ts`, no library) fires only when a box becomes all done, and not with `prefers-reduced-motion`. A
  task's check must not tick before the user does it (`user-guide-check.js`).
- `scripts/site/status.js` makes the build line of the sidebar (version, branch @ commit, `dev`) and the
  Known limits page, which is the `## Known limits and next` section of this file. Keep that heading exact and
  last. The branch comes from `GITHUB_HEAD_REF`, then `GITHUB_REF_NAME`, then git, because a pull request's
  ref is `64/merge`.
- `npm run check:docs` (`scripts/checkDocs.js`) runs typedoc validation as errors (every export documented,
  no broken links). It typechecks every guide ```` ```ts ```` block and `@example` against `dist`, and
  resolves sample ids, links and headings. The user guide must have no code.
- Browser checks (`scripts/browser/`, see its README): `run.js` serves `dist_demo` on `PORT` (8090) and runs
  `checks/*.js` in Chromium through Playwright (`CHROMIUM_PATH`, or Playwright's own). Each script opens a
  sample, acts like a user and prints `PASS` / `FAIL` lines. They cover what happy-dom can not: layout,
  scrolling, real pointer and touch events, focus, the clipboard, colours. `npm run check:browser -- --only
  <name> --jobs 4`. A UI change runs them and updates the checks it breaks.

## CI and releases

- `checks.yml` runs on every push and pull request. A matrix has one job per check (typecheck, vitest,
  biome, check:typings, check:docs), so they all report, plus a `browser checks` job.
- `npm run verify` (`scripts/verify.js`) reads the matrix commands from `checks.yml`, so the two can not
  drift, and must end with "all 5 passed". The pre-push hook (`.githooks/pre-push`, turned on with
  `npm run hooks`) runs it. The browser checks are left out of it, because they take minutes.
- `pr.yml` checks that a pull request title is a conventional commit (`scripts/prTitle.js`); `!` is allowed on
  `fix` and `feat`. The version is not made from it: it is set by hand in `package.json`.
- `release-dry-run.yml` runs `publish.yml` with `dry_run` on a pull request to master, so a release that
  would fail fails there. "Published already" and a tag on another commit are only warnings there.
- There is no workflow for the tag alone: the release makes it (a `tag.yml` was removed, two release
  workflows were confusing). `publish.yml` (by
  hand, from the default branch, in a concurrency group that is never cancelled) runs the checks, then
  publishes to GitHub Packages with the `latest` tag, and stops if the version is published already.
- `publish.yml` also makes the GitHub Release `v<version>` with the package as a tgz, for apps that use no
  registry: installed from the release's address it needs no token and no alias (a public repository).
  It is packed before `githubPackage.js` renames the package, so it is `@simple-html/grid`. Its notes are
  the version's section of CHANGELOG.md (`scripts/releaseNotes.js`). The release comes before
  `npm publish`, and a run again replaces its tgz (`gh release upload --clobber`): a run that failed in the
  publish can be run again. Creating the release makes the tag on the commit; a tag on
  another commit stops it, as the tgz would not be the tagged code. `publish.yml` needs `contents: write`
  for it, so `release-dry-run.yml` gives that to its dry run.
  `next.yml` publishes `<version>-next.<run>` with the tag `next`. `beta.yml` publishes
  `<version>-beta.<branch>.<run>` with the tag `beta-<branch>`. GitHub shows "Run workflow" only for workflows
  on the default branch.
- `scripts/githubPackage.js` rewrites the name, repository and version in the workflow's checkout only, never
  committed. GitHub Packages takes a package only in its owner's scope, so `@simple-html/grid` is published as
  `@<owner>/simple-html-grid` and installed under an npm alias.
- `pages.yml`: master's site at the root after each push. Another branch's site goes under `dev/<branch>/` by
  hand, and comes down with "remove" or when the branch is deleted. `scripts/pages.js` places the build and
  writes `dev/index.html`. gh-pages is one force-pushed commit that keeps the other folders, in a concurrency
  group that is never cancelled. It does not wait for the checks.

## Known limits and next

What is known and not done. Limits of one area are also listed in their guides:
[accessibility](guides/14-accessibility.md), [selection and clipboard](guides/17-selection-and-clipboard.md),
[find](guides/19-find.md), [custom cells](guides/21-custom-cells.md), [SQL](guides/22-sql.md).

### Open questions

- **The start page of the docs site**: the Feature overview (`#guide/features`) is the start page now; it
  was Getting started (`samples/demo/index.ts`, `fromHash()`). Keep it?
- **The amber of the traffic lights** (icon sets, `--simple-html-grid-icon-amber-color`): `#92400e` in light
  mode looks brown beside the red. It is that dark to keep 3:1 on selected rows and on the palette's
  backgrounds. An outlined icon would allow a brighter fill. Is it worth it?

### On hold

- **Validation rules in the grid config dialog** (required, min / max, length, a pattern, a formula): on hold
  at the user's request. The rules are in the grid's config (`ColumnConfig.validate`), and the user of a grid
  should not be allowed to change them, so the dialog shows them but does not edit them.

### Not wanted

- **A server-side row model** (rows loaded page by page from a backend, filtered and sorted there): not
  wanted. `toSqlWhere()` stays a helper for the app's own backend.

### Bugs

- **Made for the desktop first**: the grid was built and checked with a mouse and a keyboard. Touch works,
  but some things may be odd on a phone or a tablet - see the touch items below and under Features.
- **Touch has not been tried on a device**: the touch work was checked in Chromium's emulation only. Worth a
  look on real phones:
  - Safari on iOS: there is no `contextmenu`, so the grid times the long press. A canceled touchend drops the
    click. Check the callout and the loupe on a cell's input under `-webkit-touch-callout: none`.
  - Chrome on Android: it has its own long-press `contextmenu`, which the check simulates by sending one from
    the page. Does a long press on an editable input also start the browser's text selection?

### Accessibility

- **The column numbers by keyboard**: only a click reaches a number (Shift+F10, Ctrl+C and Esc work from
  there). Alt+ArrowDown from a header filter goes to the first row. `aria-multiselectable` follows the row
  selection mode, while several columns can be selected in every mode.
- **Keyboard**:
  - The days of the date picker and the column chooser are for the mouse. The picker's buttons and hour /
    minute fields can be reached, and a date can be typed.
  - The picker opened from a cell is put at the end of the body, no key opens it, and it does not take the
    focus. This is worth doing together with keys for its days.
  - The two scrollbar elements are unnamed Tab stops in Chrome.
  - Shift+Tab into the grid from after it lands on the last input in the DOM (a cell of a row rendered at the
    bottom of the view), not on the last row or the footer.
  - Missing keys: Shift+Space / Ctrl+Space (a row, a column); Ctrl+Left / Ctrl+Right to the edge of the data
    sideways (they are the input's word moves); Alt+Shift+PageUp / PageDown; the treegrid's ArrowRight /
    ArrowLeft on a group row.
- **Only Chrome's accessibility tree** has been tried. Firefox, Safari (weaker `aria-owns`) and real screen
  readers (NVDA, JAWS, VoiceOver) have not.

### Tooling

- **Test coverage** was last measured at 91% of the statements: `src/datasource` 96%, `src/grid` 98%,
  `src/grid/gridFunctions` 88%, `src/date` 85%. The thinnest parts:
  - the key handlers of the header filter row (40%) and of the rows (59%)
  - `renderHeaderFilter` (62%)
  - `fillDown` (60%; the fill handle's drag is covered by `fill-check.js`)
  - `contextmenuLabel` (67%)
  - the date picker's `day.ts` (78%)

  Measure with `npm run test:coverage`.

### Features

- **Column settings, more**:
  - relative addresses within the app, resolved against a base the config gives, keeping the base's origin
  - an "Open link" entry in the row menu
  - a `HYPERLINK` in the Excel export (a formula of data, within Excel's 255 characters)
  - the dialog's own undo (the filter editor has one)
  - `placeholderRow` and `focusButton` on a link cell
  - more of the column in the dialog (its width, aggregates, readonly), so the whole of a column's view is in
    one place
  - group chips that follow a label changed after grouping (`GroupArgument.title` keeps the old one)
- **Display formats, more**:
  - a value list of weeks for a date column (the header filter takes `2026-W47` already)
  - copy and CSV of the text shown, as an option
  - Days until kept up to date over midnight (a timer)
  - more formats: US with time on a 12-hour clock, `november 2026`, a week without its year, short day
    names, a currency, negatives in parentheses or red, more than 4 decimals
  - the named formats in Excel with its locale codes (`[$-414]`; Excel's names and order differ from Intl's)
- **Touch, smaller things**:
  - A finger can make ranges of cells with the row menu's Select › (Range from the active cell to here, Add
    this cell), but can not drag one. A hold and a drag could be one gesture.
  - The fill handle (7px) is small for a finger.
  - The multiline cell's editor hints "Ctrl+Enter to save, Esc to cancel", keys a phone does not have (a tap
    outside saves).
  - The filter editor's AND / OR and icon buttons are 24px. This is kept: the user found taller buttons too
    tall, so a finger gets taller list rows only.
  - The docs site is not made for a phone: its sidebar takes half the width (`touch-check.js` gives the grid
    the page with CSS of its own).
- **Custom cells, later**: `focusButton` and `placeholderRow` on a custom cell; a `measure()` for
  `fitColumns()`; renderers for group rows, the totals row and header labels.
- **Formatters are fixed when the datasource is made**: there is no setter to switch a field's formatter.
