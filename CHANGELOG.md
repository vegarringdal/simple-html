# Changelog

## 6.0.0 (2026-11-27)

v6 is a rewrite of the v5 grid. The datasource is typed and owns the fields, their types, formatters and
validation rules. The grid config, the state and the fields are plain JSON, so they can be stored in a
backend and given back as they are; what is code (formatters, validators, hooks) is registered or given
next to the config. There is a docs site with guides and live samples,
https://vegarringdal.github.io/simple-html/, and a user guide for the people who use a grid.

What an app has to change is in [MIGRATION2V6.md](MIGRATION2V6.md) (also on the site as
[guides/11-migrating-from-v5.md](guides/11-migrating-from-v5.md)).

### Breaking changes

The big ones, one line each. [MIGRATION2V6.md](MIGRATION2V6.md) has every change with a before and after.

- **Package**: the css is imported from the package root, `@simple-html/grid/grid.css` (not `/dist/`);
  the package has an `exports` map, deep imports into `dist` no longer resolve.
- **Renamed**: `Formater` is `Formatter` everywhere, plus a few typos (`setLocaleCompare()`, `deselectAll()`,
  `placeholderRow*`). `sortReset()` is removed, use `resetSort()`.
- **Events**: `addEventListener` / `removeEventListener` are replaced by `on(name, handler)`, which returns
  a function that unsubscribes. The handler gets the payload, what it returns is ignored (no more
  `return true`), and event names are kebab case (`selection-change`, `current-entity`).
- **Group rows are not entities**: they have their own type, `GroupRow` (`isGroupRow()`). `getRows(true)` is
  `getDataRows()`; `Entity` lost the `__group*` fields but `__groupLvl`.
- **`new Datasource(options)`**: `key`, `fields`, `formatters`, `selectionMode` and `container` in one
  object. Column types move from the grid config to the datasource's `fields`; `date` and `datetime`
  replace `includesTime`; `setDates()` is removed.
- **Formatters are per field and named by id**: `registerFormatter(id, formatter)`, then
  `fields: { price: { formatter: 'numberComma' } }`. `ValueFormatter` and the `set*Formatter()` methods are
  removed; a formatter's methods are `format`, `parse` and `parseFilter`.
- **One filter format**: `FilterExpression`, a `FilterGroup` (`{ group, children }`) or a `FilterCondition`
  (`{ field, operator, value?, valueField? }`). `FilterArgument`, `attribute`, `logicalOperator` and
  `attributeType` are gone. `convertV5Filter()` converts a saved v5 filter.
- **Options objects instead of positional booleans**: `setData(rows, { add })`, `select(row, { notify })`
  and more. A v5 call with a boolean throws a `TypeError` that shows the v6 form.
  `markForDeletion(null, true)` is `markAllForDeletion()`, `removeData(null, true)` is `removeAllData()`.
- **`setData()` runs the filter that is set** by default (`refilter: false` for the old way).
- **Change tracking**: `getChanges()` is typed and returns copies (a `Date` stays a `Date`); a field
  edited back is not a change; deleting a new row marks it (it can be undone) instead of removing it.
- **`mandatory` is the `required` validation rule** of the field: `fields: { name: { validate: ['required'] } }`.
- **Grid config**: `attributes` and `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight` are
  `columns` and `layout: { left?, center, right? }`. `Attribute` is `ColumnConfig`.
- **`selectionMode` is the datasource's**, not the grid config's.
- **Config and state apart**: `saveConfig()`, `loadConfig()`, `loadInitConfig()` and `updateInitConfig()`
  are removed. Use `getState()` / `setState()` / `resetState()`, and `initialState` for a grid that starts
  sorted, grouped or filtered. `importConfig()` reads a v5 `saveConfig()`.
- **A v5 option left in a grid config throws** a `TypeError` that says where it went.
- **The callbacks are hooks**: `readonlySetter()` and `cellAppendClassSetter()` are removed; `isReadonly`,
  `cellClass` and `menus` are `GridHooks`, given next to the config and changed with `updateHooks()`.
- **Methods renamed**: `triggerScrollEvent()` -> `refresh()`, `triggerRebuild()` -> `rebuild()`,
  `getOptionalAttributes()` -> `getHiddenFields()`, `getAttributeColumns()` -> `getLayoutFields()`.
- **Menus**: `contextMenuCustom()` and the context menu element methods are removed; use the `menus` hook,
  `openMenu()` and `closeMenu()`. The menus are popovers, the filter editor is a modal `<dialog>`, and the
  default menus are submenus. The row menu exports Excel, not CSV.
- **Texts**: `tooltipText`, `TOOLTIPS`, `OPERATORS` and `IDateConfig.monthHeader` / `weekHeader` are
  removed. Every text has an id: `GridConfig.texts`, `setTexts()` and `TEXTS`.
- **Column drag/drop and resizing use pointer events**, and a click is a press that does not move (v5
  went by time).
- **Theming**: the colours are `light-dark()` (Chrome/Edge 123, Firefox 120, Safari 17.5), the focus
  style is an outline on `:focus-visible`, and `grid.css` no longer styles every `input` of the page.
- **Accessibility**: `role="grid"` / `"treegrid"` is on a new element, `<simple-html-grid>` no longer has
  `role="table"`.
- **The date picker's class names are prefixed** (`.year` -> `.simple-html-date-year` ...);
  `datepickerHeight` defaults to 282.
- **The text inside a header label cell is `simple-html-label-text`**, the cell keeps `simple-html-label`
  (both were `simple-html-label`).
- **Text filters**: `_` is a wildcard for one character, and `\` makes the next wildcard a plain character.
- **The row number shows the row's state** with an icon and is 14px wider (`rowStatus: false` for the
  old look).
- **A vertical scroll renders only the rows that scroll in**: a change the cells show that did not go
  through the datasource needs `refresh()`.
- **A copy of more than one cell starts with a line of column labels** (`copyHeaders: false` for values
  only).
- **The wheel over the grid no longer scrolls the page.**
- **Types**: internal members are left out of the typings, and the library is compiled with
  TypeScript `strict` (`getFilter()` can return `null`). `html`, `render` and `Grid` are no longer exported.

### New

#### Datasource

- `fields` is the schema: `FieldConfig` (`type`, `label`, `formatter`, `validate`, `multiline`,
  `caseSensitive`, `clobType`, `readonly`), `FieldType` with `'datetime'` new, `getField()`, and `setFields()` for fields known
  later (event `fields-change`).
- Typed events: `DatasourceEvents`, `GridEvents`, `DateEvents`, every event and its payload documented.
- `datasource.parseRow(row)` and `setData(rows, { parse: true })` read rows from JSON as the field types.
- `getChanges(kinds?)`, `hasChanges(kinds?)`, `getChangedRows()`, `getChangedFields(row)` and
  `getOriginalValue(row, field)`; `Changes<T>` and `ModifiedEntity<T>` types.
- `filterChangedOnly(on)` / `isChangedOnly()`: show only new, edited and deleted rows.

#### Columns and config

- `createGrid(host, { config, datasource, hooks })` puts a grid on the page in one call;
  `gridInterface.destroy()` removes it.
- `updateConfig(partial)` changes options while the grid is shown; `updateHooks()` changes the hooks.
  A `rowClass` hook gives css classes to a whole row.
- `exportConfig()` / `importConfig()`: the config and the state as one JSON object with a `version`.
  `convertGridConfig()` converts a v5 config on its own. `null` in a config is an option left out.
- `reconcileColumns()` and `updateColumns()`: a saved grid brought up to date when the source's columns change.
- **Named views**: the views button in the footer, `getViews()`, `setViews()`, `applyView()`, `saveView()`,
  `saveViewAs()` and more, `GridConfig.views`, `viewsStorageKey`, the event `views-change`.
- **The grid config dialog** (the gear in the footer, `openColumnSettings()`): per column its label,
  placeholder, multiline, read only, display format, header filter operator, colour rules, data bars and
  validation rules (read only); a Detail form tab and a Defaults tab (`typeFormats`, the default view).
- **The detail form**: a form of the current row beside the rows (`GridConfig.detailForm`), with sections,
  collapse and a splitter. `openDetailFormSettings()`.
- **Calculated columns**: `GridConfig.calculatedColumns`, a formula of the row's fields, added from the
  grid config dialog. The formulas are parsed by the grid's own parser: no `eval`.
- **Aggregates**: `ColumnConfig.aggregate` (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'`, or several) in the
  group rows (`groupAggregates`) and a totals row (`totalsRow`); also from the header menu.
  `datasource.aggregate(field, fn, rows?)`. An average shows 2 decimals unless the column's number
  format has its own; in a narrow column the label (`Sum`) goes whole before the value is cut.
- `fitColumns()`, `resetColumnWidths()`, `fitRows()` and `resetRowHeights()`; a double-click on a resize
  handle fits the column. `autoResizeColumns()` is deprecated.
- The column chooser has a search and renames a column in place.
- **Menus as data**: the `menus` hook gets the built-in entries and returns the ones to show; `MENU_IDS`
  lists every id. `openMenu(at, entries)` opens a menu of your own; `MenuSubmenu` nests.

#### Filtering

- Filter builders `and()`, `or()` and `where(field, operator, value?)`.
- `operatorsFor(type)`: the operators each type offers. New `BETWEEN` (typed `10..20` in the header);
  `ColumnConfig.filterOperators`.
- **Match case**: `FilterCondition.caseSensitive`, `ColumnConfig.filterCaseSensitive`, and
  `FieldConfig.caseSensitive` to lock it on. `Aa` shows in the header.
- Compare with another field of the row: `valueField`.
- Header filters show their operator as a symbol (a click or F4 changes it), filter as you type
  (`filterOnType`), and take a value as the cells show it (a week, a Norwegian date, `50%`).
- The filter menu: **Filter ›**, a value list of what the cells show (with "contains" on the text
  searched), and a range block for numbers and dates.
- **Quick dates** (Today, This week, Last 30 days ...): `ColumnConfig.datePresets`, `DATE_PRESETS`,
  `refreshDatePresets()`.
- The filter editor is redone: one row per condition, AND / OR groups, undo and redo, dragged and resized
  with a mouse, pen or finger.
- `escapeTextPattern(text)` and `FilterCondition.literal` for a value with `*`, `%` or `_` in it.
- The footer shows a **No filter** button that opens the filter editor.

#### SQL for a backend

- `toSqlWhere(filter, { dialect, columns, ... })` in `@simple-html/grid/sql`: the grid's filter as a SQL
  `WHERE` and its bound parameters, for PostgreSQL, Oracle, SQLite and SQL Server. It selects the rows the
  grid's own filter does, and is made for a filter sent by the browser: every value is a parameter, only
  the columns given are allowed, limits on size and depth.
- `sqlColumnsFromFields()`, `isSqlFilterError()`, `withoutFields()` and `gridInterface.getServerFilter()`.
- `convertV5Filter()`, `isV5Filter()` and `normalizeFilter()` read v5 filters (old links, saved configs).

#### Sorting and grouping

- A date column shown as weeks, months, quarters or years groups by them.
- Group rows have a +/- box and lines of the levels, like a tree.
- A column with a text template sorts on the text it shows; a lookup column on its labels.

#### Editing, validation and saving

- **Validation**: rules in the fields as JSON (`validate: ['required', { id: 'min', value: 0 }]`) and in
  `ColumnConfig.validate`. Built-ins `required`, `min`, `max`, `minLength`, `maxLength`, `pattern`,
  `integer`, `decimals`, `oneOf`, `email` and `unique`; `registerValidator(id, validator)` for your own.
- `datasource.validate(rows?)`, `getErrors()`, `hasErrors()` and the `validate` event. The grid shows the
  errors on the cell and the row number, and the server's (`setErrors()`) next to them.
- **The save workflow**: `unmarkForDeletion()` undoes a delete, `acceptChanges({ rows?, newKeys? })` after
  a save (the new rows get the server's keys), `hasChanges()`. The row menu can delete rows.
- **Undo and redo**: `undo()`, `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`, the event
  `history-changed`; Ctrl/Cmd+Z and Ctrl/Cmd+Y. `resetField(row, field)` and `resetRows(rows)` revert.
- **Row status and edited cells**: icons on the row number (`rowStatus`), a corner marker on an edited
  cell with the original value (`editedMarker`); a click reverts it.
- **Multiline text**: `FieldConfig.multiline`, an editor over the cell, `multilineLineHeight`,
  `multilineTooltipLines`.
- **Edit permissions**: `GridConfig.edit` (`{ add?, change?, delete? }`).
- **A field locked against edits**: `FieldConfig.readonly` - no grid lets the user edit it, and they can not
  turn it off (*Read only* is greyed out in the grid config dialog). A column's `readonly` stays a default
  the user can change.
- **Lookup columns**: `ColumnConfig.editor: { type: 'select' | 'grid', lookup }` and `registerLookup()`.
- **Fill down**: Ctrl+D, the fill handle, `gridInterface.fillDown()`.
- `Formatter.formatForEdit(value)`: the text a cell shows while it is edited.
- The date picker is redesigned, and has a range picker (`IDateConfig.rangepicker`, event `range-select`)
  used by a date header filter with Between.
- Delete or Backspace on a row number marks the selected rows for deletion.

#### Selection, clipboard, find, export and import

- **Cell ranges**: drag, Shift+click, Ctrl/Cmd+click, Alt+Shift+arrows. `getRanges()`, `setRanges()`,
  `clearRanges()`, event `range-change`, type `CellRange`.
- **Copy and paste** with Excel and Sheets: TSV and an HTML table out, TSV with Excel's quoting in; one
  value fills the ranges; one undo step.
- The footer shows Count, Sum, Average, Min and Max of the selected cells.
- **Column numbers** select columns: `getSelectedColumns()`, `selectColumns()`, event
  `column-selection-change`, and a column menu to copy columns and header names.
- A finger's tap on a row number toggles the row; **Select ›** in the row and column menus.
- **Find** (Ctrl+F): a find bar with match case and *Filter rows*. `find()`, `openFind()`, `findNext()`,
  `findPrevious()`, `closeFind()`, `getFind()`, event `find-change`.
- **CSV export**: `getCsv()` and `downloadCsv()`, `CsvOptions` (separator, BOM, formula escaping).
- **Excel export**: `getExcel()` and `downloadExcel()`, a real .xlsx with no dependency, with typed cells,
  number formats and the colour rules, bars and icons.
- **Import**: rows from a CSV or .xlsx file, or pasted from Excel, as new rows through a dialog that shows
  the problems. `openImport()`, `importRows()`, `readImportFile()`, `importFile()`,
  `GridConfig.importMenu`, `datasource.addNewRows()`. A file is not trusted: size limits, no zip bombs.

#### Display formats, colour rules, data bars and icons

- **Format ›** in the header menu of date and number columns: ISO, Norwegian, US, UK and named dates,
  weeks, months, quarters, years, days until; decimals, thousands separator, decimal mark, percent.
  `ColumnConfig.format`, `GridState.formats`, `GridConfig.typeFormats`. Only the display changes.
- `ColumnFormat.text` templates (`'{firstname} {lastname}'`, `'{value} kg'`) and `ColumnFormat.link`
  (`LinkFormat`), checked addresses only.
- Show as checkbox for `1` / `0` columns, and Show blank as 0 / 0 as blank.
- **Colour rules** (`ColumnFormat.rules`, `ColorRule`): a text colour, background or bold by value, by
  conditions on other fields or by a formula; 14 palette colours or any `#rrggbb`. On a date a rule takes
  a week, month, quarter, year or a quick date.
- **Data bars** (`bar`), **colour scales** (`scale`) and **icon sets** (`icons`) on number columns.

#### Custom cells

- `registerCellRenderer(id, renderer)` and `ColumnConfig.renderer`: draw a column's cells with plain DOM,
  lit-html, React or Solid. They keep the grid's keys, focus, copy and paste, ranges, Find and undo.
  `CellRendererInstance.edit()` lets a renderer edit the value itself.
- The event `cell-dblclick`.

#### Live data

- **Reactive cells**: a value set on a row from code shows without `refresh()`; event `rows-changed`.
- `datasource.upsert(rows, { removeMissing, refilter })` merges rows from a server by key, keeping the
  selection, scroll position and expanded groups.
- **Conflicts**: an unsaved edit is never overwritten by a merge. `getConflicts()`, `hasConflicts()`,
  `resolveConflict()`, event `conflicts-changed`; a conflict marker on the cell and the row number.
- A cell changed by a merge flashes once (`mergeHighlight`); `getMergedAt()`.
- Faster: a vertical scroll of one row 6.4 -> 2.3 ms on a grid of 100 000 rows and 305 columns;
  `upsert()` of 100 000 rows with 1% changed in 56 ms.

#### Keyboard, accessibility and touch

- Grid / treegrid semantics that stay right with virtual rows and columns: `aria-rowcount`,
  `aria-colindex`, `aria-sort`, `aria-selected`, `aria-expanded` and more. Visible keyboard focus.
- The keys of a spreadsheet: Ctrl+Home / Ctrl+End, PageUp / PageDown, Ctrl+arrows to the edge of the data,
  with Shift to extend a range.
- Every menu works from the keyboard (the WAI-ARIA menu pattern); Shift+F10 or the menu key opens the
  menu of a column header, a column number or a row number.
- `?` or Ctrl+/ opens a dialog of every key (`openShortcutHelp()`, `shortcutHelp: false` turns it off).
- Touch and pen: columns are moved and resized with a finger, a long press opens the context menu,
  swipes have momentum, and menus have rows for a finger on a touch screen (`pointer: coarse`).

#### Themes and texts

- **Dark theme**: the grid follows the page's `color-scheme`. New css variables for focus, errors, row
  states, ranges, find, links and the palette.
- A second theme, `@simple-html/grid/theme-tredespace.css` with `data-grid-theme="tredespace"`, light and
  dark.
- **Texts**: every text the grid shows has an id with its English default in `TEXTS`. `setTexts()` sets
  them for the page, `GridConfig.texts` for one grid; `{name}` values are filled in; types `Texts` and
  `TextId`. A validator can return a text id, so its messages are translated too.

#### Docs site and user guide

- The docs site, https://vegarringdal.github.io/simple-html/: the guides, a live sample for each feature
  (and a full grid to try everything), the API pages, a light / dark and theme switch.
- A [feature overview](guides/00-features.md): what the grid can do, linked to its guide and sample.
- The guides in [guides/](guides/), from getting started to SQL, import and custom cells.
- A user guide in [user-guide/](user-guide/) for the people who use a grid: filtering, sorting,
  grouping, editing, find, export, import, views and the keyboard.

### Fixes

Fixes to things that did not work in v5:

- Grouping after `filter()` or `setData()` grouped rows that were not sorted, so a group showed up more
  than once. The rows are now always sorted on the grouped fields first.
- `removeGroup()` with a copy of the grouping removed nothing; `expandGroup()` of a sub group under a
  collapsed group did nothing.
- `currentEntity` and the selection kept pointing at rows that `setData()` or `removeData()` had removed:
  a row added later with the same key came back selected.
- `selectAll()` sent `selection-change` in the `'single'` and `'none'` modes.
- `DateInterface.setSelected(dates)` showed no day as selected.
- `getChanges()` listed a field edited back to its original value.
- A boolean header filter set to `false` and a number header filter of 0 showed as empty.
- Line breaks in a text value were lost when its cell was edited.
- Cells copied from a spreadsheet and pasted went into one cell, tabs and all.
- `setData(rows, { add: true })` with very many rows threw `Maximum call stack size exceeded`.
- On a scrolled page the menus were off by the scroll, and a menu could open below the window.
- Tab on the last cell and Shift+Tab on the first header filter kept the focus in the grid (a keyboard trap).
- The wheel used `wheelDeltaY`, which Firefox does not have.
- Buttons of the date picker and the footer's Clear submitted a `<form>` the grid was in.

### Packaging

- Published to GitHub Packages as `@vegarringdal/simple-html-grid`. Install it under its usual name with
  an npm alias, so the imports stay `@simple-html/grid`:
  `npm install @simple-html/grid@npm:@vegarringdal/simple-html-grid`. See the README for the `.npmrc`.
  Dev builds are published with the npm tag `next`.
- Every release is also a GitHub Release with the package as a tgz: `npm install` from its address needs no
  token and no alias.
- The `exports` map: `@simple-html/grid`, `@simple-html/grid/sql` (ESM and CommonJS, no DOM, for Node),
  `@simple-html/grid/grid.css`, `@simple-html/grid/date.css` and `@simple-html/grid/theme-tredespace.css`.
- Typings: compiled with TypeScript `strict`, internal members left out, and every type a public
  signature uses is exported.
- Installing from a git branch builds `dist` on install (`prepare`); tests are no longer in the package.
