# Changelog

## 6.0.0 (in progress)

v6 is allowed to break the API, see `V6_PLAN.md` for what is planned and `MIGRATION.md` for
what to change in your code. Released in phases.

### Phase 0 - foundations

#### ⚠️ Breaking changes
- **`Formater` is spelled `Formatter`** in every class, type and method name, plus a few other
  typos in public names (`setLocaleCompare`, `deselectAll`, `placeHolderRowCurrentEntityOnly`).
  `sortReset()` is removed, `resetSort()` did the same.
- **Css is imported from the package root**: `@simple-html/grid/grid.css`, not `/dist/grid.css`.
  The package has an `exports` map now, so deep imports into `dist` no longer resolve.
- **Internal members are left out of the typings** - `GridInterface.__parseConfig` and the other
  `__` methods, `connectGrid`, `handleEvent`, `Datasource.__select`, `getSelection`.
- **`html`, `render`, `Grid` and `EntityHandler` are no longer exported** (`EntityHandler` still
  is as a type).
- **Types are stricter** - the library is compiled with TypeScript `strict`. `getFilter()` can
  return `null`, saved config state can be `null`, `HTMLCellElement.$attribute` can be `null`.

#### Fixes found by turning on strict mode
- date picker: a calendar (`datepicker: false`) showed an hour/minute row whose arrows threw.
  It is only shown in datepicker mode now.
- date picker: clearing the hour or minute input made the date invalid; it keeps the old value
- removing a `simple-html-date` element that never got an interface threw
- `getFilterString()` showed incomplete conditions as `[UNDEFINED] <<UNDEFINED>>`, a group
  without `logicalOperator` as `UNDEFINED`, and threw for an attribute not in the grid config
- `setGrouping()` and then `expandGroup()`/`collapseGroup()` threw before the grouping was applied
- `DataContainer.replace()` gave new rows no key, so `setErrors()` threw
- `contextMenuCustom()`, `removeContextMenuElement()`, `getAttributeColumns()` and
  `getOptionalAttributes()` threw when the grid was not in the dom yet
- mousedown on an empty header label cell (a column with fewer rows than the tallest) threw
- the filter editor threw on "add condition"/"add sub group" for a group set from code without
  `filterArguments`

#### Package and tooling
- installing straight from a git branch works again: `prepare` builds `dist` on install
  (`dist` is not committed). The tgz is `npm run build:tgz`.
- tests are no longer shipped in the package
- typedoc documents the public entry only, with 0 warnings: every type a public signature uses
  is exported
- `Listener` is the one type for event listeners (was three identical `callable` types)

### Phase 1 - datasource

#### ⚠️ Breaking changes
- **A v5 call with a positional boolean throws** a `TypeError` that shows the v6 form, so plain
  JavaScript does not quietly do something else (e.g. replace rows that were meant to be added)
- `DataContainer.lenght()` is spelled `length()`
- **Events are subscribed with `on()`**: `addEventListener` / `removeEventListener` are removed
  from `Datasource`, `GridInterface` and `DateInterface`. `on(name, handler)` subscribes to one
  event and returns a function that unsubscribes. The handler gets the payload, not
  `{ type, data }`, typed from the event name.
- **What a handler returns is ignored**: no more `return true` to keep listening. In v5 a listener
  that returned nothing was dropped after its first event.
- **Event names are kebab case**: `selectionChange` -> `selection-change`, `currentEntity` ->
  `current-entity`, `gridConnected` -> `grid-connected`.
- **`Listener` is removed**, and `DateInterface.callSubscribers()` is internal
  (`__callSubscribers`).
- **Group rows are not entities**: the group header rows in `getRows()` have their own type,
  `GroupRow`. `getRows()` returns `(EntityUnion<T> | GroupRow)[]`, `getDataRows()` (was
  `getRows(true)`) `EntityUnion<T>[]`, `getRow()` `EntityUnion<T> | GroupRow`.
  The `__group*` field names are unchanged.
- **`Entity` lost `__groupID`, `__groupName`, `__groupTotal`, `__groupChildren` and
  `__groupExpanded`**, and `__group` is typed `never` on it: a group row can not be passed where
  an entity is expected (`markForDeletion()`, `removeData()` ...). `__groupLvl` stays.
- **`currentEntity` is `EntityUnion<T> | GroupRow | null`**: moving the focus from the first data
  row up into the header filter row while grouped makes the group row above current, and so does
  `setRowAsCurrentEntity()` with a group row's index.
- **`getSelectedRows()` returns `EntityUnion<T>[]`** (was `Entity[]`), never a group row.
- **The `cell-header-focus` event's `rowData` is `Entity | GroupRow | undefined`**: it is the first
  displayed row, a group row when grouped. The other cell events and `readonlySetter()` /
  `cellAppendClassSetter()` only get data rows, documented now.
- **`new Datasource(options)`** replaces `new Datasource(dataContainer, options)`: `key`, `fields`,
  `formatters`, `selectionMode` and `container` (to share rows) in one object. A `key` that is not
  the container's key throws. `DatasourceConfigOptions` is replaced by `DatasourceOptions`.
- **Types live in the datasource's `fields`**: `Attribute.type` is removed from the grid config,
  the grid, sorting, grouping and filtering read `datasource.getField(name).type`. A field that is
  not listed is `'text'`. `DataTypes` is renamed `FieldType`.
- **`setDates()` is removed**: a `date` field sorts on the day.
- **`date` and `datetime` replace `includesTime`**: a `date` field filters, sorts and groups on the
  day, a `datetime` field on the timestamp. `includesTime` on the date formatters and
  `ValueFormatter.dateIncludesTime()` are removed.
- **Formatters are per field**: `ValueFormatter`, `DefaultValueFormatter`, `DateAndNumberFormatter`,
  `setValueFormatter()` / `getValueFormatter()`, `setDateFormatter()` / `getDateFormatter()` and
  `setNumberFormatter()` / `getNumberFormatter()` are removed. A field takes a `formatter`, the
  `formatters` option sets the default per type.
- **The built-in formatters are plain objects** with the `Formatter` methods: `fromSource`,
  `fromSourceDisplay` and `fromSourceGrouping` are `format`, `toSource` is `parse`, `toFilter` is
  `parseFilter`, `placeholder()` is the `placeholder` property (only the date formatters have one).
  One `format` for the readonly cell and the edit input.
- **`getFilterString()` / `getFilterTree()` take an optional `label(field)` function** instead of the
  grid. The labels default to the field labels.
- **A text field shows 0 and false** (the v5 default formatter showed them blank), and a field that
  is not listed groups on its value as text - a `Date` in it is no longer grouped by day.
- **`dynamicCellTypeColumn` applies to any text field**, a field that is not listed included (v5
  needed `type: 'text'` on the column). It can name `'datetime'`.
- **One filter format**: `FilterArgument` is replaced by `FilterExpression`, a `FilterGroup`
  (`{ group: 'AND' | 'OR', children }`) or a `FilterCondition` (`{ field, operator, value?,
  valueField? }`). `attribute` is `field`, a group's `logicalOperator` is `group`, `filterArguments`
  is `children`; `type`, `logicalOperator: 'NONE'`, `valueType` and `attributeType` are removed.
  `filter()`, `setFilter()`, `getFilter()`, `GridConfig.filter` and `saveConfig()` all use it. A
  filter saved by v5 is ignored, `MIGRATION.md` has a function that converts one.
- **`FilterComparisonOperator` is renamed `FilterOperator`** (same operator names), and
  `FilterAttributeSimple`, `FilterExpressionType`, `FilterLogicalOperator` and `FilterValueType` are
  removed. `Attribute.operator` is a `FilterOperator`.
- **A condition's type comes only from `fields`**: `attributeType` is gone, a field that is not
  listed is `'text'`. A number or `Date` value still compares as a number or date.
- **`valueField` replaces `valueType: 'ATTRIBUTE'`** (with the other field's name in `value`) to
  compare with another field of the row.
- **`filter()`**: the array form `filter([a, b])` is removed (use `and(a, b)`), `filter(null)` removes
  the filter (v5 ran the current one again), an empty group is kept and filters nothing (v5 turned
  it into no filter), and a single condition stays the root: `getFilter()` returns it as given, v5
  wrapped it in an AND group.
- **`getFilterTree()` returns `null` when nothing of the filter is shown**, the same case where
  `getFilterString()` returns `''`. v5 returned an empty group when every condition was incomplete.
  A `valueField` is shown by its label (v5 showed the name).
- **The filter editor applies only complete conditions**: a condition without a field or operator,
  or set to compare with a field that is not picked yet, is left out (the open dialog keeps it).
- **Options objects instead of positional booleans** on `Datasource` and `DataContainer`:
  `setData(rows, { add, refilter })`, `sort(args, { add })`, `setOrderBy(args, { add })`,
  `group(groups, { add })`, `select(row, { notify })`, `deselectAll({ notify })`,
  `addNewEmpty(row, { scrollTo })`, `removeData(rows, { refilter })` and the container's
  `setData(rows, { add, isNew })`. The defaults are unchanged. In plain js a boolean passed the v5
  way throws a `TypeError` that shows the v6 form.
- **The `all` flags are methods**: `markForDeletion(null, true)` is `markAllForDeletion()`,
  `removeData(null, true)` is `removeAllData()`, on the datasource and the container.
  `markForDeletion()` / `removeData()` take a row or a list, not `null`.
- **`getRows(true)` is `getDataRows()`, `length(true)` is `getDataRows().length`**: `getRows()` and
  `length()` take no argument, `getRows()` has no overloads.
- **`getChanges()` returns plain copies, not a JSON copy**: a `Date` stays a `Date`, a field set to
  `undefined` is kept. `JSON.stringify()` of the result is the same as before.
- **A time only change on a `datetime` field is an edit**, and so is one on a field that is not
  listed in `fields` (v5 compared every date on the day). A `date` field still compares on the day.
  Dates are compared to the second, the milliseconds are ignored.
- **Datasources sharing a container must give a field the same type**: the container tracks the
  edits with the types of every datasource on it, a field two of them list with different types
  throws in the constructor of the second.
- **`EntityHandler`'s constructor takes `{ key, isNew, fieldType }`** (was `(keyString, tagAsNew)`),
  for a handler given to `overrideEntityHandler()`.

#### Fixed
- `getChanges()` listed a field edited back to its original value in the modified entry (when
  another field of the row was still edited); it lists the fields that differ only
- a time only change on a `datetime` field was not an edit, so it was missing from `getChanges()`
  and the row was not marked modified
- `NumberFormatterComma` `parse` (was `toSource`) threw on null, undefined and a number
- the `*THHMMSS` formatters' `parseFilter` (was `toFilter`) put the current milliseconds on a filter
  boundary, they are 0 now
- the date formatters' `parse` / `parseFilter` gave null for a `Date`: it passes through now, a date
  only `parseFilter` moves it to the start of its day
- changing the operator of a date column's header filter dropped the filter
- a boolean typed into the filter editor was kept as text and never matched; pasted text into a
  boolean column was stored as text
- the date formatters turned a value that is no date, text or number (`true`) into `1970-01-01`
- a single condition at the root of the filter (set with `setFilter()`) was filtered on, but
  `getFilterString()` / `getFilterTree()` ignored it, so the footer showed no filter, and the header
  filter's "Set Is Blank" dropped it
- the filter editor applied a JSON copy of the filter, so a `Date` value became text
- an `IN` / `NOT_IN` condition with the list as text was rewritten into an upper case array while
  filtering
- the header filter's "Clear Filter" and "Set Is Blank" changed the filter object in place (also the
  one the user passed in); they set a new filter now

#### Added
- event maps `DatasourceEvents`, `GridEvents`, `DateEvents`, with every event and its payload
  documented, plus `GridCellEventData` and `EventHandler` to type a handler written on its own
- `GroupRow`, the type of a group header row, and `isGroupRow(row)` to tell it from a data row
  (narrows the type, takes `null`/`undefined`)
- the schema: `FieldType` (`'datetime'` is new), `FieldConfig` (`type`, `label`, `formatter`),
  `datasource.getField(name)` (the resolved `Field`) and `datasource.getFormatter(field, type?)`
- `FieldConfig.label`: the grid's column label falls back to it (`Attribute.label` still wins)
- the `Formatter` interface, and `TextFormatter` / `BooleanFormatter`, the defaults for `text` and
  `boolean` fields
- `DataContainer.getKeyAttribute()`
- filter builders `and(...children)`, `or(...children)` and `where(field, operator, value?)`, and the
  types `FilterExpression`, `FilterGroup`, `FilterCondition`, `FilterOperator`, every operator
  documented
- **0 is blank** is decided: kept as it is, and documented on `FilterOperator` - `IS_BLANK` matches 0,
  `IS_NOT_BLANK` leaves it out, the value list puts 0 under "Blank"
- `getChanges()` is typed: `Changes<T>` (`newEntities`, `modifiedEntities`, `deletedEntities`) and
  `ModifiedEntity<T>`, the key plus the changed fields of an edited row
- `getDataRows()`, `markAllForDeletion()` and `removeAllData()` on the datasource;
  `markAllForDeletion()` and `removeAllData()` on the container
- `addNewEmpty(row)` takes `Partial<T>`, so a typed datasource can add a row with some fields
- demo: the editing sample shows `markAllForDeletion()` and the typed `getChanges()`, the rows
  sample `removeAllData()`, the sorting sample `sort(args, { add: true })`, the selection sample
  `select(row, { notify: true })`
- demo: the filtering sample uses the builders and logs `getFilter()`, the save & load sample loads a
  config with a filter
- demo: the formatters sample uses per field formatters and the `formatters` option, the value
  formatter override sample is replaced by a custom formatter sample

#### Internal
- one `Emitter` (`src/emitter.ts`) instead of three copies of the listener code
- the grid interface subscribes to each datasource event it follows and unsubscribes on
  disconnect. Connecting the same interface again subscribes once.
- the grid and the datasource check for group rows with `isGroupRow()`, not by reading `__group`
- the four date formatters share one implementation (`dateFormatterParts.ts`), the two number
  formatters one parser
- the grid reads a column's type, label and formatter in one place each: `getCellType()` (with
  `dynamicCellTypeColumn`), `getColumnLabel()` and `datasource.getFormatter()`
- one rule for an ignored condition (`isIgnoredCondition`), used by the filter, `getFilterString()`,
  `getFilterTree()` and the filter editor. The filter editor edits drafts (`Partial<FilterCondition>`)
  and converts them when it applies
- the filter editor's operator picker hands over a typed operator, no more round trip through the
  display text
- edit tracking compares in one function, `isSameValue(original, value, type)`. The container
  passes each row's `EntityHandler` a field type lookup, filled by the datasources made on it
  (`__addFieldTypes`)

### Phase 2 - grid interface and config

#### ⚠️ Breaking changes
- **Columns are declared once**: `attributes` and `columnsPinnedLeft` / `columnsCenter` /
  `columnsPinnedRight` are replaced by `columns` (the options of a column, keyed by field name) and
  `layout: { left?, center, right? }`, whose columns name their `fields` (was `rows`). A field in the
  layout without an entry in `columns` gets the defaults. The internal `__attributes` list is gone,
  and with it the v5 bug where a header filter's text survived for a column not in `attributes`.
- **`Attribute` is `ColumnConfig`**, without `attribute` (the key is the field) and without
  `currentFilterValue` (state now). `Columns` is `LayoutColumn`, `Sort` is removed (use
  `SortArgument`, the same shape).
- **Casing fixed**: `placeHolderRow` -> `placeholderRow`, `placeHolderFilter` -> `placeholderFilter`,
  `placeHolderRowCurrentEntityOnly` -> `placeholderRowCurrentEntityOnly`.
- **Config and state apart**: `saveConfig()`, `loadConfig()`, `loadInitConfig()` and
  `updateInitConfig()` are removed. `getState()` / `setState()` / `resetState()` read and set what the
  user changes: column order, pinning and widths, sorting, grouping, expanded groups, the filter and
  the header filters. `setState()` applies the parts it is given and keeps the rest (`loadConfig()`
  replaced everything).
- **`sorting`, `grouping`, `expandedGroups` and `filter` left `GridConfig`**: a grid that starts
  sorted, grouped or filtered sets them in `initialState`, which `resetState()` goes back to (with
  the config's `layout`). What `initialState` leaves out is cleared, in the datasource too.
- **The header filter operator the user picks is state**, `getState().headerFilters[field].operator`.
  `ColumnConfig.operator` is the operator a header filter starts with; v5 wrote the picked operator
  into it.
- **Options are not part of the state**: v5's `saveConfig()` / `loadConfig()` also carried every
  option (`readonly`, `tooltips` ...). To change one while the grid is shown, use
  `gridInterface.updateConfig()`. `dimRepeatedValues` toggled from the row menu is not in the state.
- **`filter-operator-change` sends `{ field, operator, column, rebuildHeader }`** (was
  `{ cellConfig, rebuildHeader }`, with the operator in `cellConfig.operator`).
- The internal sizes (`__rowHeight` ...) are no longer on the `GridConfig` type.
- **`readonlySetter()` and `cellAppendClassSetter()` are removed**: the callbacks are in the config,
  `GridConfig.isReadonly(row, field, readonlyByConfig)` and `GridConfig.cellClass(row, field)`. The row
  comes first, `cellClass` has no third argument, and it returns `{ input, background }` (was
  `{ inputClass, dimmedClass }`, both optional now) or `null` / `undefined` for no classes. Set or
  remove them later with `updateConfig()`.
- **Methods renamed**: `triggerScrollEvent()` -> `refresh()`, `triggerRebuild()` -> `rebuild()`,
  `getOptionalAttributes()` -> `getHiddenFields()`, `getAttributeColumns(filterSelectedColumns)` ->
  `getLayoutFields({ selectedOnly })`. `getLayoutFields()` gives every field by default (v5's default
  was the selected columns), and `{ selectedOnly: true }` gives `[]` when no column is selected (v5
  gave every field). A boolean in place of the options throws a `TypeError`.
- **`GridElement.enableCleanup` is removed** (a test flag), and `connectedCallback()` /
  `disconnectedCallback()` are left out of the typings - the browser calls them.
- **`new GridInterface(config, datasource)` takes the row type from the datasource**: a
  `Datasource<Person>` gives a `GridInterface<Person>`.
- **`contextMenuCustom()`, `getContextMenuElement()`, `setContextMenuElement()` and
  `removeContextMenuElement()` are removed**: `openMenu(at, entries)` opens a menu of your own,
  `closeMenu()` closes the open menu. An item has its own `action` (v5: one callback for every
  `{ value, label, isHeader }`), clicking it closes the menu (v5 kept it open unless the callback
  returned `true`), and labels are shown as given (v5 pretty printed them and added a colon to a
  header). An element that should close with the menus, a dropdown grid, is a block of the menu:
  `openMenu(cell, [{ type: 'block', id, element }])` places it, where v5 had you place it and register
  it with `setContextMenuElement()`. `getContextMenuElement()` has no replacement.

#### Fixed
- a boolean header filter set to `false` showed as empty after the header was rebuilt, and a number
  header filter of 0 showed nothing (the value was read with `||`)
- the class from `cellClass` (v5 `dimmedClass`) was joined to the grid's `simple-html-readonly` /
  `simple-html-mandatory` class without a space, so on a readonly or mandatory cell of an editable grid
  neither class applied
- the internal `Grid.disableResizeEvent()` / `enableResizeEvent()` did the opposite of their names.
  They also take effect right away now: disable disconnects the resize observer (and cancels a pending
  resize rebuild), enable makes it again for a grid in the dom
- a menu opened from a click handler (v5 `contextMenuCustom()`) was closed again by that same click
  reaching the document; it stays open now
- a click inside an element registered with `setContextMenuElement()` (the dropdown grid sample)
  closed it, so its filter input could only be used from the keyboard. A block in a menu stays open
- the header and filter menus could open below the bottom of the window, they open above the cell
  when there is no room below (as the row menu did). A menu that sticks out on the right of the
  window is moved in

#### Added
- `GridConfig.columns`, `GridConfig.layout`, `GridConfig.initialState`, and the types
  `ColumnConfig`, `GridLayout`, `LayoutColumn`, `GridState`, `HeaderFilter`
- `gridInterface.getState()`, `setState(state)`, `resetState()`, documented with examples
- `MIGRATION.md`: a function that converts a v5 config
- demo: the save & load sample is a state sample (`getState` / `setState` / `resetState`,
  `initialState`), the column layout sample logs the layout
- **`createGrid(host, { config, datasource })`**: makes the interface and a `<simple-html-grid>`
  element that fills the host, connects them, adds the element and returns the interface. Type
  `CreateGridOptions`
- **`gridInterface.destroy()`**: removes the element and disconnects the grid from the datasource,
  the document and the `on()` handlers
- **`gridInterface.updateConfig(partial)`**: changes options while the grid is shown and rebuilds
  once. The keys given change, `undefined` gives back the default, `columns` replaces every column's
  options, `layout` is shown right away (as `setState({ layout })`) and is what `resetState()` goes
  back to, `initialState` only changes what a later `resetState()` goes back to
- `GridConfig.isReadonly`, `GridConfig.cellClass` and the type `CellClass`
- JSDoc with examples on `GridInterface` and `GridElement`: every public method, and the class
- README and the demo use `createGrid()`; the samples that change an option use `updateConfig()`,
  the cell styling sample the config callbacks. `MIGRATION.md`: setup, callbacks, `updateConfig()`
  and a table of every renamed or removed method
- **Menus as data**: the row, header and filter menus are lists of entries - items, section headers,
  separators and blocks (`MenuEntry`: `MenuItem`, `MenuSection`, `MenuSeparator`, `MenuBlock`) - each
  with a stable id. **`GridConfig.menus`** (`GridMenus`) has a function per menu, `row`, `header` and
  `filter`, that gets the built-in entries and the `MenuContext` (field, row, row index, cell, grid
  interface, datasource) and returns the entries to show: hide, reorder, relabel or add. An item
  takes `action(context)`, and optional `hint`, `visible(context)`, `disabled(context)` and
  `selected(context)`
- **`MENU_IDS`**: every built-in id per menu, in the order shown, documented with its label and
  when it is shown. The header filter's value list is one block entry, `filter.values`
- **`gridInterface.openMenu(at, entries)`** opens a menu of your own at a mouse event, a position
  (`MenuPosition`) or under an element; **`closeMenu()`** closes the open menu, the grid's own too
- menu entries carry their id in a `data-menu-id` attribute; a disabled item has the class
  `simple-html-grid-menu-item-disabled` and `aria-disabled="true"`
- demo: the custom cell menu sample is a menus sample (`menus` hides a built-in entry and adds a
  part of its own, `openMenu()` as a value picker), the dropdown sample opens its grid with
  `openMenu()` as a block. `MIGRATION.md`: the menus, before and after

#### Internal
- the grid reads `layout.left` / `layout.center` / `layout.right` and `columns` where it read
  `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight` and `__attributes`; the logic is
  unchanged. A missing `left` / `right` / `columns` is filled in once, when the interface is made
- the header filter values and picked operators live in the grid interface (`__getHeaderFilter`,
  `__setHeaderFilterValue`, `__setHeaderFilterOperator`, `__clearHeaderFilterValues`), one
  `getHeaderFilterOperator()` picks the operator a header filter uses
- `filterCallback()` takes the field, not the column config
- the state tests replace the save/load config tests (`gridState.test.ts`)
- the grid knows its element from the start (`new Grid(element)`), and the interface remembers the
  grid it was connected to last, so `destroy()` also works after the element left the dom
- one internal check for a readonly cell, `__isCellReadonly()`, used by the cells and the row menu's
  paste and clear; `__getCellClass()` for the classes
- the row menu's "Use dimmed values" goes through `updateConfig()`, so a later `updateConfig()` keeps it
- tests: `createGrid.test.ts`, `updateConfig.test.ts`, `cellCallbacks.test.ts`, and refresh / rebuild
  / resize toggle tests in `gridLifecycle.test.ts`
- one renderer for every entry menu (`showMenu()`): the row, header and filter menus and `openMenu()`
  share the markup, the placement and the closing. The three menus build their default entries, the
  config's `menus` function changes them; `contextMenuCustom.ts` is gone. Rendering is unchanged: the
  same elements and css classes, a section header followed by its solid line, the separators dashed.
  The value list's parts are in one element of their own (a flex column, as the menu is)
- an item click closes the menu first, then runs the action, so an action can open another menu.
  The column chooser opens at the mouse position of the right click (it used the click on its menu
  item)
- the value list renders only itself again when values are checked or searched (it rendered the
  whole filter menu)
- tests: `gridMenus.test.ts` - the ids, hiding, reordering, custom entries and their context,
  `visible` / `disabled`, `openMenu()` / `closeMenu()`, a dropdown grid as a block

### Fixes found while writing the docs

Writing the guides against the code found these. Each fix has a test that fails on the old code: `datasource/__tests__/docsFindings.test.ts`,
`grid/__tests__/docsFindings.test.ts`, the `setSelected` and `datePickerConfig` tests in
`date/__tests__/datePicker.test.ts` and `grid/__tests__/datePickerCell.test.ts`, the docs site tests in
`samples/demo/__tests__/` and the typings consumer.

#### ⚠️ Breaking changes
- **`GridConfig.selectionMode` is removed**: the datasource owns the selection mode
  (`new Datasource({ selectionMode })`, `datasource.setSelectionMode()`) and the grid reads it from
  there. The grid used to set its own (default `'multiple'`) on the datasource on every rebuild, so
  `new Datasource({ selectionMode: 'single' })` became `'multiple'` once shown in a grid.
- **`setData()` runs the filter that is set by default** (`refilter: true`). The new rows bypassed a
  filter that was still set - and still shown by the header filters and the footer. `refilter: false`
  keeps the old behaviour; it is then the only `setData()` that sends `collection-filtered`
  (`'__internalUpdate, forced'`, with no filter, sort or grouping).
- **`ColumnConfig.mandatoryOnlyIfEmpty` is removed**: it was read nowhere, `mandatory` marks only the
  empty cells. Phase 5 (validation) replaces the mandatory options.
- **`DateInterface.selected` is a `Set<number>`** of timestamps and `getSelected()` returns `number[]`
  (was `unknown`); `setSelected(dates)` stores the timestamps of the dates.
- **`removeGroup(group)` finds the level by its field**: a copy removes it. A field that is not grouped
  on changes nothing and sends no event (it used to regroup and send `collection-grouped` twice).

#### Fixed
- `setGrouping()` followed by `filter()` (or `setData()`, `reloadDatasource()` ...) grouped rows that
  were not sorted for the grouping, so a group showed up once per run of equal values. So did
  `setOrderBy()` or `resetSort()` while grouped. The rows are now always sorted on the grouped fields
  first, whatever path leads to the grouping; each grouped field keeps the direction the sort gives it
- `removeGroup()` with a copy of a grouping (e.g. from a saved state) removed nothing, but still
  regrouped and sent the events
- `expandGroup(id)` of a sub group whose parent is collapsed did nothing: it expands the groups above it
  too now, so the group is shown
- `currentEntity` kept pointing at a row of the old data after `setData()` replaced the rows: it is set
  to `null` (and `current-entity` sent) when the current row is no longer in the data
- `selectAll()` sent `selection-change` in the `'single'` and `'none'` selection modes, where it selects
  nothing: it does nothing there now. Also a click on the grid's top left corner
- `DateInterface.setSelected(dates)` showed no day as selected: it stored the `Date`s, the days were
  matched by timestamp. A day is selected when a selected date falls on it, whatever its time, and a
  click on such a day unselects it
- `GridConfig.datePickerConfig` demanded a whole `IDateConfig`, though the grid fills in a default for
  every field it reads: it is a `Partial<IDateConfig>`
- a click on a group row logged `group selected, do I want something here ?` to the console. Two
  unreachable `console.log('err')` went too
- docs site: the guides' links to `../MIGRATION.md` (and other files of the repo that are not guides)
  were a 404 on the site; the site links them to the file on github. `npm run check:docs` checks that
  the file exists, and the heading of a markdown file
- docs site: the dark theme's colours for new, modified and deleted rows never applied - the
  `row-is-*` class is on the element around the row number, not on `.simple-html-selector-text`. Same
  fix in the dev sample's dark mode (`samples/grid01`)

#### Docs
- the text header filter starts with `EQUAL`, a whole-text match (`ann` does not find `Anna`). The
  filtering guide and `ColumnConfig.operator` show `columns: { name: { operator: 'CONTAINS' } }` for a
  contains search per column
- emptying a number cell stores 0 (the number formatters' `parse('')` gives 0), the row menu's Clear
  stores `null`: in the editing and formatting guides, on the number formatters and `MENU_IDS`, with a
  formatter that stores `null` instead
- the selection mode's guide section has a table of what each mode does; the samples set the mode on the
  datasource, the selection sample switches it while the grid is shown, the rows sample has a
  `refilter: false` button

### Phase 2b - save workflow, validation, config as JSON

The grid config, the state and the datasource's `fields` + `formatters` are plain JSON, so they can be
stored in a backend and given back as they are. What is code - formatters, validators and the grid's
functions - is registered or given next to the config. Deleting a row is a tag that can be undone, the
fields' rules validate the edits and `validate()` checks the rows before a save, and `acceptChanges()`
closes the save round trip: one transaction with the deleted, edited and new rows, then the grid shows
what was saved, the new rows with the server's keys.

#### ⚠️ Breaking changes
- **Deleting a new row marks it**: `markForDeletion()` and `markAllForDeletion()` no longer remove a new
  row (from `addNewEmpty()`), they mark it like any other row - so `unmarkForDeletion()` brings it back.
  While it is marked it is in none of the lists of `getChanges()`, as before; it stays in `getAllData()`,
  `getDataRows()`, `getMarkedForDeletion()` and the grid until `acceptChanges()`,
  `clearMarkedForDeletion()` or `resetData()` removes it.
- **`getChanges().newEntities` has `__KEY` without a key field**: the temporary key of the new row, as
  `modifiedEntities` has it, so the server's key can be given back. Typed
  `(T & { __KEY?: string | number })[]`. With a `key` nothing changed.
- **The row menu of an editable grid can delete rows**: a "Delete:" section (`row.delete`,
  `row.delete.rows`, `row.delete.undo`) between "Clear:" and "Summary:", see Added. Hide it with the
  `menus` hook where the user should not delete rows.
- **`collection-filtered` has two more `info` values**, `'unmarkForDeletion'` and `'acceptChanges'`. The
  grid now rebuilds on every `collection-filtered` but `'__internalUpdate, forced'`.
- **Formatters are named by id**: `FieldConfig.formatter` and the datasource option `formatters` take
  the id of a registered formatter, not the formatter object -
  `fields: { price: { type: 'number', formatter: 'numberComma' } }`, `formatters: { date: 'dateDDMMYYYY' }`.
  Register your own with `registerFormatter('money', money)` before the datasource that names it is
  made. An id that is not registered throws when the datasource is made, listing the registered ids;
  a formatter object where an id goes (plain JS) throws a `TypeError` saying how to register it.
- **`isReadonly`, `cellClass` and `menus` left `GridConfig`**: they are hooks (`GridHooks`), given next
  to the config - `createGrid(host, { config, datasource, hooks })`, `new GridInterface(config,
  datasource, hooks)` - and changed with `gridInterface.updateHooks()`. `updateConfig()` no longer
  takes them. A config with one of them (plain JS, or a config written for a v6 pre-release) throws a
  `TypeError` naming the hook, in the constructor, `createGrid()` and `updateConfig()`.
- **`CellClass` moved to the hooks** (`src/grid/gridHooks.ts`); it is still exported from the package
  root under the same name.
- **`ColumnConfig.mandatory` is removed**: it is the `required` validation rule of the datasource field,
  `fields: { name: { validate: ['required'] } }`, which draws the same stripes (`simple-html-mandatory`)
  and also validates. A config with `mandatory` (plain JS, a stored config) throws a `TypeError` naming
  the field, in the `GridInterface` constructor, `createGrid()` and `updateConfig()`. The stripes now
  show where `required` fails: a number field of 0 is striped (0 is missing, as for `IS_BLANK`), an
  unchecked checkbox is not (`false` is a value).
- **`Field` (from `getField()`) has `validate`**: the field's rules written out, `[]` without. A
  `toEqual()` on a whole `getField()` result has to add it.
- **The grid shows `__rowError`** (`setErrors()`) on the row number: the class `simple-html-row-error`
  and the message as its tooltip. It showed nothing before.
- **`DatasourceEvents` has a `validate` event**, and the methods that remove rows can send
  `current-entity` and `selection-change` (see Fixed): a `switch` over every event name has to add it.
- **`EntityHandler` takes `onEdit`** in its options and its set trap calls it: a handler of your own
  (`overrideEntityHandler()`) has to call it, or the edits are not validated.

#### Added
- **Validation**, for item 47 of the plan:
  - **rules in the fields, as JSON**: `fields: { age: { type: 'number', validate: ['required', { id: 'min',
    value: 0 }, { id: 'max', value: 150, message: 'too old' }] } }`. A rule is the id of a validator, or
    `{ id, ...options, message? }`. Types `ValidationRule`, `ValidationRuleObject`, `ValidationOption`.
  - **`registerValidator(id, validator)`**, one registry for the page like the formatters. A `Validator`
    is `(value, row, rule) => string | null`: the message, a message id, or `null` when valid. The
    datasource looks its ids up when it is made: an unknown id throws listing the registered ones, and so
    do rules that are no list, a rule without an id, a `message` that is not text, and a built-in rule
    with a wrong option (`min` without a number, a `pattern` that is no regular expression). A validator
    that returns something else than text or `null` throws a `TypeError`.
  - **built-ins**: `required` (fails on `null`, `undefined`, `''`, an invalid Date and 0 - like
    `IS_BLANK`, because an emptied number cell stores 0; `false` passes), `min`, `max` (numbers),
    `minLength`, `maxLength`, `pattern` (text; a regular expression as text, not anchored). All but
    `required` pass a blank value, and the values not of their kind.
  - **messages by id**, `VALIDATION_MESSAGES`: `'validation.required'` `Required`, `'validation.min'`
    `Must be at least {value}`, `'validation.max'` `Must be at most {value}`, `'validation.minLength'`
    `Must be at least {value} characters`, `'validation.maxLength'` `Must be at most {value} characters`,
    `'validation.pattern'` `Not in the expected format`. A rule's `message` replaces the default, and
    `{name}` is replaced by the rule's option `name`. The ids are for the texts map of phase 3.
  - **when it runs**: an edit, from the grid or from code - the field, and the row's fields that have an
    error, so an error that reads another field clears once that is fixed. The rows from `setData()` and
    the new rows from `addNewEmpty()` are not validated until they are edited or `validate()` runs.
  - **`datasource.validate(rows?)`** checks every field with rules of every row (or the rows given),
    keeps the errors and returns them as `ValidationError<T>[]` - `{ row, field, messages }`, in the
    order of the rows and the rules - and sends `validate` (`{ errors }`). **`getErrors(rows?)`** and
    **`hasErrors()`** read the errors there are now. A row marked for deletion is skipped and has none
    (they are back when it is unmarked). `acceptChanges()` and `resetData()` clear them,
    `resetDataSelectionOnly()` those of the selected rows.
  - **kept apart from the server's errors**: `setErrors()` / `__rowError` does not change them, and
    `validate()` / `getErrors()` / `hasErrors()` do not read it. The grid shows both on the row number.
  - **shared containers**: the rules are the container's, like the field types - an edit through any
    datasource on it is validated; two datasources that both give a field rules must give the same
    ones (the order of a rule's options does not matter), or the second throws.
  - **in the grid**: a cell with an error gets `simple-html-cell-error` (a red border inside, a tint)
    and its messages as the tooltip, one per line; the row number `simple-html-row-error` (a red bar, a
    tint) with the server's error and a `Label: messages` line per field. An edit in the grid shows them
    as the user types, without rendering the input again; `validate()` shows them through its event.
    The grid's own tooltip shows them (`tooltips: false` turns it off, `data-tooltip` is written
    either way); it is on the grid's body now, hidden on wheel and when the grid leaves the page, and
    keeps the line breaks (`white-space: pre-line`). New css variables `--simple-html-grid-error-color`
    and `--simple-html-grid-error-bg-color`, a lighter red in the demo's dark theme.
- **`unmarkForDeletion(rows)` and `unmarkAllForDeletion()`** on `Datasource` and `DataContainer`: undo a
  delete. The row is as it was before it was marked - its edits kept, a new row new again. Sends
  `collection-filtered` with `info: 'unmarkForDeletion'`.
- **`acceptChanges({ rows?, newKeys? })`** on `Datasource` and `DataContainer`, for after a successful
  save. For every row, or the `rows` given: a row marked for deletion is removed (a new one too), a new
  row becomes an ordinary row, the values it has now become its originals (nothing counts as edited),
  and its error is cleared. `newKeys` is a `ReadonlyMap` from each temporary key (as in
  `getChanges().newEntities`) to the server's key, compared as text (`-1` and `'-1'` are the same key):
  the new row gets it in its key field, or as its `__KEY` without one - no edit, and a selected row stays
  selected. A key in `newKeys` that is not the key of a new row accepted, or a blank server key, throws
  before anything changes; a new row not in it keeps its key. The rows themselves in place of the
  options (plain JS) throw a `TypeError`. The datasource rebuilds its displayed rows and sends one
  `collection-filtered`, `info: 'acceptChanges'`.
- **`hasChanges()`** on `Datasource` and `DataContainer`: `true` when `getChanges()` lists a row.
- **Row menu "Delete:"**, in an editable grid: *Rows (selected rows)* marks the selected rows for
  deletion - the rows stay in the grid until the changes are accepted - and is greyed out when no
  selected row is left to mark; *Undo (selected rows)* takes the mark off, shown when a selected row is
  marked. A row the `isReadonly` hook returns `true` for in every column of the layout is locked, delete
  skips it; the columns' `readonly` option does not lock a row, and undo works on every marked row (a
  hook that makes the marked rows readonly does not stop it). In `MENU_IDS.row` and the menus guide.
- **`registerFormatter(id, formatter)`**: one registry for the page. The built-ins are registered from
  the start: `'text'`, `'boolean'`, `'numberDot'`, `'numberComma'`, `'dateYYYYMMDD'`, `'dateDDMMYYYY'`,
  `'datetimeYYYYMMDD'`, `'datetimeDDMMYYYY'`; the defaults per type are `'text'`, `'numberDot'`,
  `'boolean'`, `'dateYYYYMMDD'` and `'datetimeYYYYMMDD'`. The datasource looks its ids up once, when it
  is made: registering an id again replaces it for the datasources made after (a built-in id too). An
  id that is not text, or a formatter without `format()` / `parse()`, throws a `TypeError`.
  `getFormatter()` and `getField().formatter` still give the formatter object, and the exported
  formatter objects stay.
- **`GridHooks<T>`** - `isReadonly`, `cellClass` and `menus`, with the same behaviour as before. With a
  `Datasource<Person>` the hooks get typed rows (`EntityUnion<Person>`). `CreateGridOptions.hooks`.
- **`gridInterface.updateHooks(hooks)`**: only the keys given change, `undefined` removes a hook; the
  visible cells are rendered again once (a menu uses its new function the next time it opens). The
  grid keeps a copy of the hooks object.
- JSDoc with examples on `registerFormatter`, `GridHooks` and `updateHooks`; every built-in formatter
  says its id. `GridState` and `setState()` say what happens to a `Date` stored as JSON.
- guides: "Hooks" and "Saving the config" in the grid config guide, "A formatter of your own" and the
  ids in the formatting guide, "Dates in a saved state" in the state guide; the other guides, README
  and `MIGRATION.md` (before/after for formatter ids and the hooks) use ids and hooks
- samples: the formatter samples register their formatters and name them by id, the cell styling
  sample uses `updateHooks()`, the menus sample gives `menus` as a hook, `samples/grid01` registers its
  switchable formatters
- samples, save workflow: a new "Saving" sample (edit, add, delete, then a fake server call that
  gives the new rows ids, `acceptChanges({ newKeys })`, `hasChanges()`); "Add & remove rows" deletes
  by marking, with an undo, and keeps `removeData()` / `removeAllData()` as the untracked removal;
  "Editing & row state" has undo buttons and logs `hasChanges()`; `samples/grid01` unmarks and
  accepts. The demo's light theme colours the row numbers by row state, a deleted row's struck through.
- guides, save workflow: "Deleting rows" (tag, undo, the row menu, `removeData()` for the untracked
  case) and "Saving" (the round trip in one transaction, the keys of new rows) in the editing guide,
  linked from the datasource guide; the new `info` values in the events guide; the delete entries in
  the menus guide

#### Fixed
- **The methods that remove rows let go of them**: `removeData()`, `removeAllData()`,
  `clearMarkedForDeletion()`, `acceptChanges()` (rows marked for deletion), `resetData()` and
  `resetDataSelectionOnly()` (new rows) left `currentEntity` on a row they removed, and its key in the
  selection - a row added later with the same key came back selected. They now set `currentEntity` to
  `null` the way `setData()` does, take the removed rows out of the selection, and send
  `current-entity` / `selection-change` after their own event when that changed something.

#### Docs
- **Validation**: a "Validation" section in the editing guide (the rules, the built-ins and why 0 fails
  `required`, messages, rules of your own, when it runs, validating before a save, how the grid shows
  the errors) and "Errors from a server" says how they relate; "Validation rules" in the datasource
  guide; `mandatory` gone from the grid config guide, the `validate` event in the events guide, a line
  in "0 is blank"; the migrating guide and `MIGRATION.md` (mandatory -> required, the new API, the
  grid showing `__rowError`, the v5 config converter keeps the mandatory fields). JSDoc with examples on
  `registerValidator`, `VALIDATION_MESSAGES`, the rule types, `Validator`, `ValidationError`,
  `validate()`, `getErrors()`, `hasErrors()`, `FieldConfig.validate`.
- samples: a new "Validation" sample (required, min/max, maxLength, pattern and a validator of its own
  with options, a save that validates first, a server error next to the validation errors); "Mandatory &
  placeholders" is "Required fields & placeholders" (`required-placeholders`), with the rule in the
  fields and a validate button; `samples/grid01` has its mandatory columns as required fields and a
  validate button; the events samples log `validate`.
- **A `Date` in a stored state**: JSON turns it into its ISO text, and `setState()` keeps the text (it
  does not turn it back into a `Date`); `getState()` then gives the text. A `date` or `datetime` field
  reads the text as the same moment - the same rows, the same date in the header filter and
  `getFilterString()`. A field that is not listed as `date` / `datetime` filters on a `Date` as a date
  only while it is a `Date`: after JSON it compares the text and filters other rows. The same goes for
  a `Date` in `initialState`. Pinned by tests, written in the state guide.

#### Internal
- tests: `saveWorkflow.test.ts` - unmark (one row, a list, all, a new row, the events), a new row marked
  (not in `getChanges()`, dropped by `acceptChanges()`, back on unmark), `acceptChanges()` for every row
  and for the rows given (deleted removed, new ordinary, edits the originals, errors cleared,
  `hasChanges()` false, one event), `newKeys` (key field and `__KEY`, no edit, without a key field, as
  text, the errors, the selection), the options guard, a shared container, the whole round trip twice.
  `rowMenuDelete.test.ts` - when the delete entries show, their actions, the `isReadonly` lock, one
  rebuild, the grid after `acceptChanges()`. The tests that pinned the removal of a new row on
  `markForDeletion()` / `markAllForDeletion()` pin the mark now
- typings consumer: the new methods, `newEntities[0].__KEY`, the new `info` values, and
  `@ts-expect-error` checks that the rows in place of the options and a plain object as `newKeys` do
  not compile
- `Selection.replaceKey()` keeps a row selected when `acceptChanges()` changes its key
- the grid reads the hooks from the interface (`__getHooks()`), not from the parsed config
- tests: `configJson.test.ts` - a config with every option, a `getState()` result and the datasource
  `fields` + `formatters` go through `JSON.parse(JSON.stringify())` unchanged, and a grid made from the
  copy shows the same (state, rows, markup); the Date cases above. `formatterRegistry.test.ts` - the
  built-in ids, registering, replacing, the errors. Hook tests moved to `GridHooks` / `updateHooks()`
  (`cellCallbacks.test.ts`, `gridMenus.test.ts`), plus the `TypeError` for a hook in the config
  (`createGrid.test.ts`, `updateConfig.test.ts`). Tests that register a formatter use an id of their
  own, and the one that replaces a built-in id puts it back in `afterAll`
- tests: `validation.test.ts` - the built-ins (what `required` takes as missing, 0 included, and that
  the stripes use the same test), messages and their options, `registerValidator` (replacing, a built-in
  put back in `afterAll`, the errors), the rules in the fields and their errors, when it runs (edits from
  code, the fields with an error checked again, new rows, `validate()` of all rows / the rows given, the
  event, copies), rows marked for deletion, clearing, server errors apart, shared containers.
  `removedRows.test.ts` - `currentEntity`, the selection and the events after each removing method.
  `validationInGrid.test.ts` - the required stripes (0, readonly), the `mandatory` guard, the error class
  and tooltip of a cell and a row number while typing and after `change`, `validate()` without a
  refresh, `acceptChanges()`, a row marked for deletion, server errors alone and with validation errors,
  the tooltip on hover and `tooltips: false`. `configJson.test.ts` - the rules (a built-in with a message,
  one of your own with options) survive JSON and validate the same. Tests that register a validator use
  an id of their own
- typings consumer: `registerValidator`, rules, `validate()`, `getErrors()`, `hasErrors()`,
  `ValidationError<T>`, `getField().validate`, the `validate` event, `@ts-expect-error` checks that
  `ColumnConfig.mandatory` and a validator that is no function do not compile, and the JSON check of
  the fields with `validate` in them
- typings consumer: `registerFormatter`, formatter ids, hooks, `updateHooks`, typed hook rows,
  `@ts-expect-error` checks that a formatter object in the options and `isReadonly` / `cellClass` /
  `menus` in `GridConfig` no longer compile, and a type-level check that `GridConfig`, `GridState` and
  the `fields` + `formatters` options hold no function anywhere

### Phase 3 - UI

Every text the grid shows has an id, and every one can be replaced: one texts map, plain JSON, so a
translation can be stored with the config in a backend.

#### ⚠️ Breaking changes
- **A v5 option left in a grid config throws** a `TypeError` naming where it went in v6 (was only
  `mandatory`): a config stored before v6 can not lose a setting without a word
- **`GridConfig.tooltipText` and `TOOLTIPS` are removed**: the tooltips are texts like the others,
  their ids end with `.tooltip` - `tooltipText: { 'filterEditor.close': 'Lukk' }` is
  `texts: { 'filterEditor.close.tooltip': 'Lukk' }`. Some of the old ids without `.tooltip` are now the
  text of the element itself (`filterEditor.title` is `Filter Editor`).
- **`OPERATORS` is removed**: what `getFilterString()` shows for an operator is the text
  `filterString.operator.<FilterOperator>`, AND / OR are `filterString.and` / `filterString.or`. The
  string is the same with the default texts.
- **`IDateConfig.monthHeader` and `weekHeader` are removed**, and the grid no longer reads them from
  `datePickerConfig`: each name is a text, `datePicker.month.january` ... and `datePicker.day.sunday`
  ... A `DateInterface` of your own uses the page's texts, or its own in the new `IDateConfig.texts`.
- **`VALIDATION_MESSAGES` is removed** (it came in phase 2b): the default messages are the texts
  `validation.*` in `TEXTS`.

#### Added
- **`TEXTS`**: every text by id with its English default, 190 ids grouped by area - the menus (the ids
  of `MENU_IDS`, a hint is `<id>.hint`), the value list (`filter.values.*`), the column chooser, the
  filter editor, the footer, labels for screen readers, the date picker, and the texts the datasource
  makes: the validation messages, `getFilterString()` and the name of the group of blank values
  (`grouping.blank`). A tooltip is `<id>.tooltip`. An operator has a name in each place it is shown:
  `filterEditor.operator.*`, `footer.operator.*`, `filterString.operator.*`. Types `Texts` and `TextId`.
- **`setTexts(texts)`**: the texts of the page, for every grid and datasource. It replaces the texts set
  before, `setTexts({})` is English again. Throws a `TypeError` for a text that is not a string.
- **`GridConfig.texts`**: the texts of one grid, they win over the page's. `updateConfig({ texts })`
  replaces them as a whole and rebuilds. The lookup is `GridConfig.texts`, then `setTexts()`, then
  `TEXTS`; the texts the datasource makes come from `setTexts()` and `TEXTS` only (it has no grid, and
  validation runs in the `DataContainer` that datasources share - so no texts option on the datasource).
- **Values in texts**: `{name}` is filled in when the text is shown - `'Count: {count}'`,
  `'{shown}/{total}'`, `'{count} rows found'`.
- **Text ids for your own messages**: a validator, or a rule's `message`, can return a text id; its
  text comes from `setTexts()`, so a message of your own is translated like the built-ins'. An id
  without a text is shown as it is.
- New guide `guides/12-texts.md`: how to translate, the lookup order, when a changed text shows, and
  every id with its English text. New sample "Translation": the grid in Norwegian, every id typed
  `Record<TextId, string>` so the compiler names a missing one.

#### Changed
- A changed text is read when what shows it is made: the grid after its next rebuild, a menu, the
  filter editor and the date picker the next time they open, `getFilterString()` on its next call. A
  validation message is made when the value is validated, so after `setTexts()` an error already there
  keeps its text until the field is validated again; the blank group's name changes the next time the
  rows are grouped.
- The name of the group of blank values is `'Country: blank'` (was `'Country:  blank'` with two
  spaces; the html showed one). Its id is still `' blank'`.
- `getFilterString()` shows an operator that is not one (plain JS) as it is, not as `UNDEFINED`.
- The filter editor shows an operator that is not one as it is, not prettified.
- **One label per column, wherever the grid shows it.** A column without a `label` of its own or of
  its field showed `First Name` in the header, the column chooser and the attribute menu, but
  `first_name` in the footer filter, the filter editor, the group chip, the drag ghost and a copied
  table. Now it is `First Name` in all of them. A grouping made by dragging gets that label as its
  `title`.

#### Docs
- `guides/12-texts.md`; the grid config, editing (messages), filtering, events (date picker) and menus
  guides say where their texts come from. `MIGRATION.md` has a Texts section: `tooltipText` /
  `TOOLTIPS`, `OPERATORS` and the month and day names.

#### Internal
- `src/texts.ts`: the defaults, `setTexts()` and the lookup (`findText`, `getText`, `fillText`), used
  by the datasource and the date picker; `gridText(ctx, id)` adds the grid's own texts. The validation
  messages use the same `{name}` filling as the texts.
- tests: `src/__tests__/texts.test.ts` - the lookup order, values, what `setTexts()` takes, every id
  and its English text in the tables of the texts guide (and nothing else), and a scan of the
  `html` / `svg` templates in `src` for text of their own (between the tags, and in `placeholder`,
  `title`, `aria-label`, `data-tooltip`). `src/grid/__tests__/texts.test.ts` - every text replaced by
  its id in «»: the menus, the value list, the column chooser, the filter editor and its menus, the
  footer (every operator, the collapsed box), the date picker (every month), the validation messages,
  the group rows and `getFilterString()` are opened one by one; nothing with a letter may be left
  outside «», and every id has to be shown. Once with `setTexts()`, once with the grid's texts in the
  config and the datasource's from `setTexts()`. Plus the lookup order in a grid, `updateConfig({ texts })`,
  `setTexts()` after a rebuild, the date picker's texts. `datasourceTexts.test.ts` - the validation
  messages (built-ins, ids of your own, a rule's message as an id, made at validation time),
  `getFilterString()` and the blank group. Tests that call `setTexts()` go back to `setTexts({})`
  after each test.
- typings consumer: `setTexts`, `TEXTS`, `Texts`, `TextId`, `GridConfig.texts`, `IDateConfig.texts`,
  a `Record<TextId, string>` translation, and `@ts-expect-error` checks that `tooltipText`,
  `monthHeader`, a text that is not a string and changing `TEXTS` do not compile

#### Menus and the filter editor on the platform

The menus are popovers and the filter editor is a modal `<dialog>`: the browser shows them in the top
layer, over everything on the page, and does the focus and Esc of the editor. Before, they were
elements put on `document.body` by hand, with a z-index, and removed by hand.

- ⚠️ **The menus are `popover="manual"`**: the row, header and filter menus, `openMenu()`, the column
  chooser, the field and operator pickers of the filter editor and the date picker. In the top layer
  a container with `overflow: hidden` does not cut them off, and no z-index puts anything over them.
  They get the class `simple-html-grid-popover`, which undoes the browser's popover style; their
  `position: absolute` moved from an inline style to it, the `z-index: 500` of `.simple-html-grid-menu`
  and the date picker's inline `z-index: 2000` are gone. `manual` and not `auto`: where `contextmenu`
  comes on the button press (macOS, Linux), the pointerup after it is outside the menu, and the
  browser's light dismiss of an `auto` popover would close a right click menu as soon as it opened.
  So the grid still closes them itself - one at a time, on a click outside, on scroll, when the grid
  leaves the page - and `closeMenu()` and the `menus` hook are unchanged.
- **Esc closes the open menu.** It is canceled (`preventDefault()`), so a modal dialog under the menu -
  the filter editor - stays open. The column chooser stays open on Esc elsewhere, a click outside and
  another menu (columns are dragged from it), and closes on Esc in its search field.
- **A menu item does not take the focus** (its mousedown is canceled): the focus stays on the cell the
  menu was opened from. When the focus is in a menu as it closes (a search field), it goes back to the
  element that had it when the menu opened.
- **A menu opened from an element in a `<dialog>` or a popover of the page is put inside it**, not on
  the body: outside a modal dialog it would be inert, outside a `popover="auto"` a click in it would
  close that popover. The filter editor's pickers and date picker are in its dialog.
- ⚠️ **The filter editor is `<dialog class="simple-html-grid filter-editor-content">`, opened with
  `showModal()`**. Modal, as the grey layer over the page made it before: the grid behind it can not be
  used - now the keyboard can not reach it either (the focus used to stay on the cell). The grey layer
  is its `::backdrop`; the `.filter-editor-container` element and the `.simple-html-grid` element in it
  are gone, `.filter-editor-content` is the dialog itself. The browser moves the focus to the dialog
  when it opens (it has `autofocus` and `tabindex="-1"`, so a value field does not get it and show the
  keyboard on a phone) and gives it back when it closes. Esc closes it (a picker open in it first).
- **The filter editor is dragged and resized with pointer events**: by its title bar, from every edge
  and corner, with a mouse, a finger or a pen. The pointer is captured on the handle
  (`setPointerCapture`), the title bar and the handles have `touch-action: none`. Only the primary
  pointer with its main button; pointercancel stops where it got to.
- **The filter editor is rendered again in the same dialog** on every edit (it was thrown away and made
  again): lit keeps the elements, so the place, the size and the focus stay. The value fields use
  `live()`. Closed and opened again, it is in the middle of the window.
- **The tooltip is put in the dialog or popover of the element it describes** (the filter editor, a
  menu), else on the body as before: on the body it would be behind them. Hidden, it is out of the
  document, so a closed dialog is not kept in memory by it.
- Fixed: on a scrolled page the menus were off by the scroll (viewport coordinates on an absolute
  element). They are placed from the top left of the page, and move with it when it scrolls.
- The css of the editor's value fields is `.filter-editor-content .grid-condition input` / `textarea`
  (was `.simple-html-grid .filter-editor-content input`): the menus in the dialog keep their own look.
- Browser support: `showPopover()` / `hidePopover()` are in every browser since April 2024 (MDN; MDN
  lists the Popover API as a whole, with parts the grid does not use, as Baseline 2025), `<dialog>`
  long before.
- Docs: `guides/10-menus.md` "How a menu opens and closes", the filter editor in
  `guides/06-filtering.md`, the JSDoc of `openMenu()`, `closeMenu()` and `openFilterEditor()`,
  `MIGRATION.md` "The menus are popovers, the filter editor is a modal dialog".
- Internal: `openMenuElement()` (shows an element as the grid's menu), `placeMenu()`, `moveMenu()` and
  `popoverParent()` in `showMenu.ts`, used by every menu; `closePopover()` in `removeContextMenu.ts`
  gives the focus back. `addBodyClickListener.ts` is `addMenuListeners.ts`: the click and keydown
  listeners on the document, removed with an `AbortController` (`Grid.menuListenersAbort`, was
  `clickListener: any`). `Grid.filterEditorContainer` is `Grid.filterEditor` (the dialog), new
  `Grid.menuReturnFocus`; `closeFilterEditor()` closes it for its buttons, after Esc (the `close`
  event) and when the grid leaves the page. The editor's drag and resize use `followPointer()`.
- tests: happy-dom 20.11 has `<dialog>`'s `show()` / `showModal()` / `close()` (they set `open`,
  `close()` sends `close` at once), but no top layer, no inert page, no focus moved or given back, and
  Esc does nothing (no `cancel`). It has the `popover` attribute but no `showPopover()` /
  `hidePopover()`, no `toggle` events, no light dismiss. `src/__tests__/popoverStub.ts` (loaded by the
  new `vitest.config.ts`) adds a minimal `showPopover()` / `hidePopover()` that keeps whether a popover
  is shown (`isPopoverShown()`) and throws as a browser does without the attribute or out of the
  document. The rest - the top layer, inertness, focus into and out of the dialog, Esc closing it - is
  checked by reading the HTML spec; the tests check what the grid does around it. `filterEditor.test.ts`
  (the dialog, modal, autofocus, rendered in place, closing, Esc, its menus in the dialog, drag and
  resize from all 8 handles by pointer, touch, pointercancel, a second pointer, kept in the window,
  minimum size), `gridMenus.test.ts` (popover, Esc, focus back, an item keeps the focus, dialogs and
  popovers of the page, page scroll, the column chooser, a dropdown grid's own menu),
  `datePickerCell.test.ts` and `gridLifecycle.test.ts` (the document listeners are aborted).

#### Touch and pen

Column drag/drop and resizing listen to pointer events, not mouse events: moving, resizing and
sorting in the header work with a mouse, a pen and a finger.

- ⚠️ **Pointer events, not mouse events**: the header labels, the group chips, the fields of the column
  chooser and the resize handles listen to `pointerdown` / `pointermove` / `pointerup` /
  `pointercancel`. Code that sends them mouse events (tests, scripts) has to send pointer events, see
  `MIGRATION.md`.
- ⚠️ **A click is a press that does not move**: it sorts however long it is held, a press that moves
  5px is a drag. v5 went by time: held for 200ms was a drag, a quick drag was a click and sorted.
- **Touch**: a finger held still on a label for 200ms drags it, a finger that moves sooner scrolls
  the grid (as on the rows), a tap sorts. A finger on a resize handle resizes. The grid does not
  scroll under a finger that drags or resizes. Labels, chips, chooser fields and resize handles get
  `touch-action: none`, so the browser does not pan the page under them (and cancel the pointer).
- **Pen**: as a mouse.
- Only the primary pointer with its main button drags or resizes - the left mouse button, the first
  finger, the pen's tip. A right click or a second finger does nothing (the resize handle took any
  mouse button).
- **pointercancel** (the browser takes the pointer: a system gesture, the pen leaves the screen ...)
  ends a drag without a drop, and gives a column being resized its width back.
- The drop target is what the browser's hit test (`elementFromPoint`) finds under the pointer, and the
  drag highlights it - on touch as well. The drop zones and the panel lost their mouse enter/leave/move
  handlers.
- Fixed: the element that follows the pointer was `position: absolute` at viewport coordinates: on a
  scrolled page it was off by the scroll. It is `position: fixed`, and `pointer-events: none` (inline).
- Fixed: a label dropped on the panel of another grid on the page grouped its own grid on the field.
- Touch scrolling is unchanged: touch events, a swipe moves the rows and columns by the finger's
  distance, without momentum.
- Docs: `guides/02-grid-config.md` "Moving and resizing columns" (linked from getting started, state and
  sorting), `MIGRATION.md` "Column drag/drop and resizing use pointer events".
- Internal: `followPointer()` and `isPrimaryPress()` (`src/grid/gridFunctions/followPointer.ts`) follow
  one pointer from pointerdown to pointerup/pointercancel, for the drag/drop and the resize handle. The
  listeners are on the document, filtered by `pointerId`. The dragged cell captures the pointer
  (`setPointerCapture`) once the press is a drag - before that a click on a child (the remove icon of a
  group chip) still reaches the child; the resize handle captures on pointerdown.
- tests: `columnDragDrop.test.ts` - every drop target, click or drag (`DRAG_DISTANCE`, a slow click,
  shift), the ghost and the highlighted target, capture only once dragging, empty label cells, primary
  pointer and left button only, the events of another pointer, pointercancel, a pen, another grid's
  panel, `touch-action`, and touch: a tap, held for `TOUCH_HOLD` then dragged (the grid does not scroll),
  a swipe (scrolls, no drag, no sort), a swipe on the rows. New `columnResize.test.ts` - follows the
  pointer, rebuilds once on release, 25px minimum, pinned left and right, pointercancel, primary only, a
  finger. The helpers `pointerEvent()` (happy-dom's defaults are not a browser's: `isPrimary` false,
  `pointerId` 0, no bubbling), `pointerOver()` (happy-dom does no layout, `elementFromPoint` is always
  null), `touchAt()` and `resizeHandle()`; `dragAndDrop()` and `dragResizeHandle()` send pointer events.
  happy-dom 20.11 has `PointerEvent`, `TouchEvent` and `setPointerCapture` / `hasPointerCapture` /
  `releasePointerCapture`, but capture is bookkeeping only: no retargeting, no `gotpointercapture` /
  `lostpointercapture`, no implicit release.
- the touch scrolling looked up `' simple-html-grid-middle-scroller'` (a leading space); browsers ignore
  it, happy-dom threw.

#### Theming (item 25)

##### ⚠️ Breaking changes
- **The colours are `light-dark()`** and the grid follows the page's `color-scheme`. Needs Chrome/Edge
  123, Firefox 120, Safari 17.5; in an older browser the colours are invalid (set the variables with
  plain colours in `@supports not (color: light-dark(white, black))`).
- **The focus style**: the dashed border and outline on `:focus` are replaced by a 2px inset outline
  on `:focus-visible`, in `--simple-html-grid-focus-color`.
- **`grid.css` no longer styles every `input` of the page**: its `z-index` / `pointer-events` rule is
  `.simple-html-grid input`.

##### Added
- **Dark theme**: `color-scheme: dark` on `:root` or `body` (or `light dark` to follow the OS). Every
  variable has a dark colour, checked for contrast (text at least 4.5:1).
- **Visible keyboard focus** in the grid, its menus, the filter editor and the date picker.
- New variables: `--simple-html-grid-focus-color`, `--simple-html-date-focus-color`,
  `--simple-html-grid-warning-font-color`, `--simple-html-grid-danger-font-color`,
  `--simple-html-grid-danger-border`, `--simple-html-grid-readonly-stripe-color`,
  `--simple-html-grid-required-stripe-color`, `--simple-html-grid-stripe-bg-color`,
  `--simple-html-grid-menu-shadow-color`, `--simple-html-grid-dialog-shadow-color`,
  `--simple-html-grid-tooltip-shadow-color`, `--simple-html-grid-scrollbar-shadow-color`,
  `--simple-html-grid-backdrop-color`.
- Guide `guides/13-theming.md` (every variable with its light and dark colour) and the sample
  "Theming & dark mode".

##### Fixed
- The column resize handle can be grabbed over its full height: the filter input covered its lower
  half.
- 17 colours were written in the css, out of reach of a theme.
- `--simple-html-grid-font-weight-cell` was used but never defined (menu items, the filter editor's
  title): it is `--simple-html-grid-font-weight`.
- The date picker's hour and minute inputs had no focus outline.

#### Accessibility (item 22)

##### ⚠️ Breaking changes
- The grid's accessibility structure is new: `role="grid"` / `"treegrid"` is on a new
  `.simple-html-grid-aria` element, `<simple-html-grid>` no longer has `role="table"`.
- Only the row element of the row selector is `role="row"` and has `aria-rowindex`; `aria-rowindex`
  counts the header rows (the first data row is 3 with labels and filters).
- Cell inputs no longer have `role="cell"`; their `aria-label` is the column label, not the field name.
- Text id `grid.focusHelper` is removed. `row.paste.cell` / `row.clear.cell` default to `Paste cell` /
  `Clear cell` (both were `Cell`).
- Grid elements get ids `simple-html-grid-<n>-...`.

##### Added
- Grid / treegrid semantics that stay right with virtual rows and columns: `aria-rowcount`,
  `aria-colcount`, `aria-rowindex`, `aria-colindex`, rows and cells put in order with `aria-owns`.
  Checked in Chrome's accessibility tree.
- `aria-sort` on the first sort column, `aria-selected` on the rows (selection modes single and
  multiple), `aria-multiselectable`, `aria-level` and `aria-expanded` while grouped.
- Keyboard: column headers sort with Enter/Space (Shift adds), reached with Alt+ArrowUp from the
  filter; the group expand/collapse is a labelled button (Enter/Space); the group chip's remove and
  the footer filter chips are buttons. The footer row count is a live status.
- Text ids `grid.label`, `grid.filter`, `grid.groupToggle`, `grid.removeGroup`.
- Guide `guides/14-accessibility.md`: what a screen reader gets, every key, focus, the labels, the
  known limits.

##### Fixed
- Keyboard trap (WCAG 2.1.2): Tab on the last cell and Shift+Tab on the first header filter kept the
  focus in the grid. They leave it now.
- The focus helper input was a Tab stop announced as "dummy cell".
- The filter inputs were named "🔍"; they are "Filter <column label>".
- Paste and clear in the row menu had the same text.

### Phase 4 - performance

#### Scroll handlers (item 26)

Measured in Chromium on a grid of 100 000 rows and 305 columns (3 pinned left, 2 right), JS time in
the scroll listeners per scroll step, one machine:

| step | before | after |
| --- | --- | --- |
| vertical, 22px | 6.4 ms | 6.2 ms |
| vertical, 450px | 14.7 ms | 13.5 ms |
| horizontal, 20px | 2.5 ms | 1.8 ms |
| horizontal, 400px | 6.4 ms | 5.4 ms |

The linear scan for the first row/column was a small part (0.17 ms per event at the end of 100 000
rows); the vertical time is rendering every cell of every row on screen, which stays (see item 36).

##### Performance
- The first row and column on screen are found with a binary search instead of a scan from 0 on every
  scroll event.
- Horizontal scrolling of a wide grid costs 20-30% less JS per event: the header columns are placed
  once per event instead of once per row, the partly visible left column keeps its element, styles
  are only written when they change, and the scroll listeners look their elements up once.

##### Fixed
- A middle section narrower than its last column showed no columns when scrolled to the end.
- A viewport shorter than the last row showed no rows when scrolled to the end.
- After a long scrollbar drag the rows came back 300 ms after it stopped, now 150 ms (the delayed
  render compared with the position of the first jump, and hid the rows again).

##### Internal
- One code path for the left, middle and right sections (`pinnedSection.ts`); `assignPool.ts` decides
  which row/column each pooled element shows; `firstIndexAtOrAfter.ts` is the binary search.
- The dead horizontal `largeScroll` / `largeScrollLeftTimer` / `delayScrollRender` code is removed. The
  vertical one is kept and documented: a jump of more than 500px hides the rows and renders them once
  the scrolling stops, instead of rendering every row on every event of a scrollbar drag.
- Tests: the binary search, the pool assignment, and the rendered rows and columns checked against
  what the sizes say after small and large scrolls both ways, with pinned columns and grouping.

### Phase 5 - editing

#### Edited cells and the row state (items 27, 29)

##### ⚠️ Breaking changes
- The row number shows the row's state with an icon (`GridConfig.rowStatus`, default on) and is 14px
  wider; `rowStatus: false` gives the old look and width.
- The row number's tooltip starts with the state ("Edited", "New row", "Marked for deletion") before
  the errors.
- The cells of a row marked for deletion are struck through (with `rowStatus`).

##### Added
- **Row status**: icons for new, edited, deleted and error rows (one icon: deleted, then error, then
  new/edited), the state in the tooltip, and as text for screen readers in the row number cell.
- **Edited cell marker** (`GridConfig.editedMarker`, default on): a corner triangle on an edited cell
  (not on new rows); its tooltip shows the original value (formatted, `(blank)` for a blank), a click
  reverts the cell - one undo step. The marker shows in a readonly grid but does nothing there.
- **Changed rows only**: `datasource.filterChangedOnly(on)` and `isChangedOnly()` show only new, edited
  and deleted rows, ANDed with the filter (the filter itself, `getFilter()` and the state are not
  changed). Row menu `row.view.changedOnly` (a toggle), a footer chip; the footer's Clear and Clear All
  Filters turn it off. A row edited back to its original drops out on the next filter run, not while
  the user types.
- Theme variables `--simple-html-grid-edited-color`, `--simple-html-grid-new-color`,
  `--simple-html-grid-deleted-color` (light and dark, 3:1 against the rows).
- Text ids `rowStatus.*`, `cell.editedMarker.*`, `row.view.changedOnly`, `footer.changedOnly`.
- The editing sample shows the status, the markers, a validation rule and a "Changed rows only"
  button, without its own RS column.

##### Fixed
- The `row-is-*` states had no built-in look.
- A row's errors were in its tooltip only; a screen reader now gets them with the row number.

#### The date picker redesigned, no rounded buttons (user request)

##### ⚠️ Breaking changes
- The date picker's generic class names are prefixed (they also picked up page css): `.year` ->
  `.simple-html-date-year`; `.main` -> `.simple-html-date-month-title` / `.simple-html-date-month-name`;
  `.month` is gone (`.simple-html-date-month-header` is the row); `.side` -> `.simple-html-date-time-field`;
  `.icon` -> `.simple-html-date-nav` / `.simple-html-date-step`; `.date-flex` -> `.simple-html-date-time-row`;
  `.date-flex-col` -> `.simple-html-date-actions`; the time `<label>` -> `.simple-html-date-time-label`.
- `--simple-html-date-main-bg-border` colours only the lines (button frames:
  `--simple-html-date-button-border`, the selected frame: `--simple-html-date-selected-border`);
  `--simple-html-date-main-bg-selected` is no longer the button hover (`--simple-html-date-hover-bg-color`).
- `datepickerHeight` defaults to 282 (was 317): the picker is 277px tall now.

##### Changed
- Flat and square, the grid's font: month and year on one line with square « ‹ › » buttons (« »
  change the year); quieter week numbers and other months' days (readable now: they were 1.3:1);
  today bold with a bar under it, apart from the selected day (fill and frame); hour and minute a number
  between two square steppers; Clear / Now / Use an equal-width button bar, Use the primary. Text at
  least 4.5:1, the marks 3:1, light and dark.
- **No rounded corners in the grid's own UI**: the footer chips, Clear, the row count, the filter
  group box, the filter editor and its buttons, the column chooser and filter menu buttons, the tooltip.
- New `DateInterface.nextYear()` / `prevYear()`; texts `datePicker.previousYear` / `previousMonth` /
  `nextMonth` / `nextYear` (the buttons' names); variables `--simple-html-date-button-border`,
  `-hover-bg-color`, `-selected-border`, `-today-color`.

##### Fixed
- The picker's buttons are `type="button"`: a picker in a `<form>` no longer submits it. The hour and
  minute inputs have names for screen readers.

#### The wheel scrolls the grid, not the page

##### Fixed
- The wheel over the grid also scrolled the page under it (the event was not cancelled): it is now,
  so a grid in a scrolling page keeps the wheel, also at its first and last row. Ctrl+wheel (the
  browser's zoom, a trackpad's pinch) is left alone.
- The wheel used the non-standard `wheelDeltaY` (Firefox has none): it uses `deltaX` / `deltaY`, a
  wheel that counts lines or pages moves as many px, and left/right (a trackpad, Shift+wheel) scrolls
  the middle columns.

#### Header filters say what to type

##### ⚠️ Breaking changes
- An empty text or number header filter shows its type, `Text` / `Number` (text ids
  `filter.placeholder.text` / `filter.placeholder.number`), where it showed a 🔍 - like a date filter
  shows its format. A column's `placeholderFilter` still wins; a boolean filter is a checkbox as before.

#### Menus stay in the window

##### Fixed
- A menu taller than the room below and above the cell (the row menu in a small window) was cut off.
  It now goes next to the point (right, else left), as near it as the window allows; a menu taller
  than the window scrolls. Every menu keeps 4px from the window's edges; a menu near the right edge
  is measured at its natural width (it was squeezed by the edge, then grew past it once moved).

#### Row menu: undo a cell edit, a row's edits

##### ⚠️ Breaking changes
- The row menu's "Edit:" section is first in the menu (it was after Delete). Default texts:
  `row.edit.undo` "Undo last change", `row.edit.revertCell` "Undo cell edit", `row.edit.revertRows`
  "Undo row edits" (with the hint "selected rows").

##### Added
- `row.edit.revertRow` "Undo row edits": the row right clicked back to its original values and
  unmarked for deletion, without selecting it first - one undo step.

#### Undo and redo (item 28)

##### ⚠️ Breaking changes
- The custom entity handler hook is `onEdit(row, field, oldValue)` (`DataContainer.overrideEntityHandler`):
  a handler that leaves out `oldValue` records `undefined` as the value before an edit.
- Edits from code are recorded in the undo history. `setData()` without `add`, `removeAllData()`,
  `resetData()` and `acceptChanges()` clear it.
- `resetDataSelectionOnly()` is an undo step.
- Row menu: a new "Edit:" section between Delete and Summary - `MENU_IDS.row` has 5 more ids, the ones
  after it moved.

##### Added
- **Undo/redo history** on the DataContainer, shared by the datasources on it: `datasource.undo()`,
  `redo()`, `canUndo()`, `canRedo()`, `clearHistory()`, and the event `history-changed`
  (`info: 'edit' | 'undo' | 'redo' | 'clear' | 'remove'`). A step is what the user typed in one cell, a
  paste, a clear, a (un)mark for deletion, a revert, or one synchronous run of code. The last 100 steps
  are kept. New rows are not in the history: undo never adds or removes a row.
- **`datasource.resetField(row, field)` and `datasource.resetRows(rows)`**: a cell or rows back to their
  original values (deletion marks off). Reverts are undo steps; a new row stays, with the values it was
  added with.
- **Keys**: Ctrl/Cmd+Z undoes, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo, in a cell of an editable grid. While
  typing in a cell Ctrl+Z is the input's own undo, until the typing is undone or the cell is left.
- **Row menu "Edit:"**: `row.edit.undo`, `row.edit.redo`, `row.edit.revertCell`, `row.edit.revertRows`,
  with text ids `row.edit*`.
- The grid renders its cells again after an undo or redo, also one from code or from another datasource
  on the same container.
- Guides: "Undo and redo" and "Reverting a cell or a row" in the editing guide; the editing sample has
  Undo/Redo buttons that follow `history-changed`.

#### Multiline text (item 30)

##### ⚠️ Breaking changes
- `datasource.getField()` returns a `multiline` property.
- A text cell whose value has a line break is no longer typed in directly: its input is readonly and
  shows the first line, Enter opens the editor instead of moving down.

##### Added
- `FieldConfig.multiline` (text fields only; throws on another type or a non-boolean) and
  `Field.multiline`. Automatic for any text value with a line break.
- Multiline cells show the first line, a marker, the whole text as the tooltip (errors first, cut at
  15 lines / 600 characters) and `aria-describedby` for screen readers.
- The editor over the cell (a popover, works inside a dialog): Enter / F2 / double click / typing a
  character open it (a typed character goes at the end, never replaces the text); Ctrl/Cmd+Enter saves,
  Esc cancels, Enter is a new line, Tab / Shift+Tab save and move on; a click outside, scrolling, a
  menu, the filter editor or `destroy()` save and close it. One undo step, LF line breaks, validation;
  read-only in readonly grids and cells.
- Texts `cell.multiline.more`, `cell.multiline.hint`, `cell.multiline.hintReadonly`; theme variable
  `--simple-html-grid-multiline-color`; the sample "Multiline text".

##### Fixed
- Line breaks in a text value were lost when its cell was edited (the input strips them, and the
  stripped value was written back).
- The edited-cell marker's tooltip cuts a long original value.

### Phase 6 - selection and clipboard

#### Cell ranges and the clipboard (items 32, 33)

##### ⚠️ Breaking changes
- Alt+Shift+arrows in a cell select a range of cells (they moved like Alt+arrows).
- Shift+click on a cell no longer makes its row current or opens the date picker; Ctrl/Cmd+click no
  longer opens the date picker; Shift/Ctrl/Cmd+click on a checkbox no longer toggles it.
- Esc in a cell with ranges clears them and cancels the key (a dialog the grid is in stays open for
  that Esc).
- Ctrl+C in a cell with no text selected copies the cell's value (it copied nothing).
- `MENU_IDS.row` has `row.copy.range`, `row.paste.range`, `row.clear.range`; the Paste:/Clear:
  sections also show on a readonly cell when there are ranges. The row menu's copy listener runs in
  the document's capture phase.

##### Added
- **Cell ranges**: drag across cells (pinned sections and stacked fields included), Shift+click,
  Ctrl/Cmd+click or drag for more ranges, Alt+Shift+arrows, Esc clears, auto-scroll while dragging.
  `getRanges()`, `setRanges()`, `clearRanges()`, event `range-change`, type `CellRange`
  (`{ fromRow, fromField, toRow, toField }`). Cleared when the displayed rows or the layout's fields
  change. `aria-selected="true"` on the gridcells in a range.
- **Copy** a range (Ctrl+C) as TSV and an HTML table - pastes into Excel / Sheets; **paste** TSV with
  Excel's quoting (Ctrl+V): a block from the top left of the range, one value fills the ranges,
  readonly cells skipped, parsed per field type, no rows added, one undo step. **Delete / Backspace**
  clear a range. Row menu Copy: Range, Paste range, Clear range.
- `CsvOptions.rows: 'range'`.
- Theme variables `--simple-html-grid-range-bg-color`, `--simple-html-grid-range-border-color`;
  classes `simple-html-cell-in-range`, `simple-html-cell-range-top/-bottom/-left/-right`.
- Guide "Selection and clipboard", sample "Ranges & clipboard".

##### Fixed
- Cells copied from a spreadsheet and pasted into a cell went into that one cell, tabs and all, line
  breaks turned into spaces; they go into the grid's cells now.
- A single value pasted into a checkbox, a multiline cell or an `allowPasteClearOnly` column did nothing.

### Phase 7 - live data

#### Reactive cells, merge by key, conflicts (items 36, 37, 38 data)

##### ⚠️ Breaking changes
- A vertical scroll renders only the rows that scroll in. Something the cells show that changed
  outside the datasource (what the `isReadonly` / `cellClass` hooks read, a value on an object of your
  own) needs `gridInterface.refresh()`; before, the next scroll showed it by accident.
- No render, `refresh()` included, renders the cell input the user has typed in since it got the
  focus; it is rendered once the focus leaves it.
- `collection-changed` `info` can be `'upsert'`; `history-changed` `'remove'` is also sent by `upsert()`
  (removed rows, and history changes that became no-ops after a merge).

##### Added
- **Reactive cells**: a value set on a row (from code, undo/redo, `resetField()` / `resetRows()`,
  `upsert()`), a deletion mark or a `setErrors()` error shows without `refresh()`: the grid renders the
  changed rows on screen once per animation frame. Event `rows-changed` `{ rows, fields }`, once per
  run of code.
- **`datasource.upsert(rows, { removeMissing, refilter })`**: merges rows by key as server values
  (value and original, not edited, no undo step, validated), adds new keys, and with `removeMissing`
  removes the rows the server did not send (rows with local changes stay, in conflict). Keeps the
  selection, scroll position and expanded groups, runs filter/sort/group once, returns
  `{ added, updated, removed, conflicts }`. Keys compare as text (`7` matches `'7'`).
- **Conflicts**: an edit the user has not saved, or a cell being typed in (or open in the multiline
  editor), is never overwritten by a merge - the server's value becomes a conflict. `getConflicts()`,
  `hasConflicts()`, `resolveConflict(row, field, 'local' | 'remote')`, event `conflicts-changed`, types
  `Conflict`, `ValueConflict`, `RemovedConflict`, `UpsertOptions`, `UpsertResult`.
- `datasource.getMergedAt(row, field)`: when the last merge changed a field, for a highlight.
- Undoing an edit after the server changed the field goes back to the server's value, not the stale
  original (the history is rebased on a merge).
- Guide "Live data", sample "Live data".

##### Fixed
- `setData(rows, { add: true })` with very many rows (300 000) threw `RangeError: Maximum call stack
  size exceeded` (`push(...rows)`).

##### Performance
- Vertical scroll, one row per step: 6.4 -> 2.3 ms on a 100 000 x 305 grid, 5.2 -> 2.2 ms grouped.
- Reading a field through the row proxy has a fast path: sorting 100 000 rows 52 -> 44 ms, grouping
  122 -> 112 ms.
- `upsert()` of 100 000 rows with 1% changed: 56 ms (1000 rows into 100 000: 17 ms), plus the
  filter/sort/group run when they are set.

### Phase 8 - more

#### Aggregates (item 40)

##### Added
- `ColumnConfig.aggregate`: `'sum' | 'avg' | 'min' | 'max' | 'count'`, shown in each group row
  (`GridConfig.groupAggregates`, default `true`) in the column's place, and in a totals row under the
  rows (`GridConfig.totalsRow`, default `false`). sum/avg/min/max need a number field; a wrong config
  throws a `TypeError`.
- `datasource.aggregate(field, fn, rows?)`: over the filtered rows, a group row's rows (collapsed
  sub-groups included) or a list of rows; type `AggregateFunction`. Blanks skipped, nothing rounded
  (the formatter formats), a compensated sum (100 000 x 0.1 is 10000), kept until a value of the field
  changes - edits and merges update them in the next frame.
- Texts `aggregate.sum` / `avg` / `min` / `max` / `count` / `total`; theme variables
  `--simple-html-grid-totals-bg-color`, `--simple-html-grid-totals-font-color`,
  `--simple-html-grid-aggregate-label-color`.
- Accessibility: an aggregate is a gridcell of its column; the totals row is the grid's last row with
  "Total" as its row header.
- Guide "Aggregates", sample "Aggregates". Not in the CSV export.

##### Fixed
- Row menu "Summary:": the max of negative numbers was 0, min skipped 0, the average was rounded to a
  whole number and counted blank cells. A text value (`'12'`) is no longer read as a number.

#### Aggregates: several per column, on lines of their own, from the header menu (user request)

##### ⚠️ Breaking changes
- A group row with aggregates has its **name on a line of its own** and the aggregates on the lines
  under it: 1 + n lines (n the most functions a column has), where it was one line with the name over
  the first columns. The totals row has the n lines.
- Each aggregate line has its **label at the left and its value at the right** of the column (was the
  label in front of a right aligned value). In a column that stacks fields the label says which field:
  `Avg Age`. The lines of a column are its fields' functions from the top (an aggregate of a stacked
  field is no longer on the line of its field).
- `GridState` has `aggregates` and `totalsRow`: `getState()` gives them, `setState()` applies them,
  `resetState()` goes back to the config's. `updateConfig()` changes the totals row only when it is
  given `totalsRow`.

##### Added
- **Several functions per column**: `ColumnConfig.aggregate: ['sum', 'avg']`, a line each, in the order
  sum, avg, min, max, count.
- **The header menu** (right click a column label) has an "Aggregate:" section: Sum, Average, Min, Max
  (number columns) and Count as toggles with a ✓, and Totals row. Ids `header.aggregate.*`, texts too.
- For a screen reader a field's aggregates are one gridcell named with all its lines.

#### Fit and reset column widths and row heights, like Excel; the multiline tooltip (user request)

##### ⚠️ Breaking changes
- `autoResizeColumns()` is deprecated, use `fitColumns()`: it measures the text as the cells show it
  (formatted, `numberOverride`), only the rows the filter lets through, a multiline text by its widest
  line (it measured the stored values of every row).
- Header menu: `header.size.column` / `header.size.all` read "Fit column width" / "Fit all columns".
- A multiline cell's tooltip shows the first 5 lines and "… N more lines"
  (`GridConfig.multilineTooltipLines`), each line cut at 100 characters (was 15 lines / 600).
- The row menu has a "Size:" section before "Export:" (new ids in `MENU_IDS.row`).

##### Added
- `gridInterface.fitColumns(fields?, { rows? })` (one, some or every column; `{ rows: [row] }` fits a
  column to one cell) and `resetColumnWidths(fields?)` (back to the widths `resetState()` gives). A
  double-click on a column's resize handle fits it.
- `gridInterface.fitRows(rows?)` / `resetRowHeights(rows?)`: a row as many lines high as its multiline
  cells need (at most 20), kept by row key (not in the state); a multiline cell shows its lines in a
  taller row. 100 000 rows: `fitRows()` ~85 ms, `fitColumns()` ~180 ms (the 20 longest texts of a field
  are measured).
- `GridConfig.multilineTooltipLines` (default 5).
- Header menu: Reset column width / Reset all column widths. Row menu "Size:": Fit column to this cell,
  Fit row height, Fit rows (selected rows / ranges), Fit all rows, Reset row height, Reset all row
  heights. Texts `row.size.*`, `header.size.reset*`, `cell.multiline.moreLines`.

##### Fixed
- Fitting columns counted rows the filter hides, skipped dates, ignored `numberOverride`, and measured
  a multiline text as one long line.
- A press on a resize handle that does not move rebuilt the header, so a double-click never reached it.
- Scrolling to a selected row uses the row's own height.

#### The clipboard: every range, with the column headers (user request)

##### ⚠️ Breaking changes
- A copy of more than one cell starts with a **header line of the column labels**, in the text and in
  the html table (`<thead>`): Ctrl+C on ranges and the row menu's Copy: Column / Row / Row (selected
  rows/col) / Range. `GridConfig.copyHeaders: false` copies the values only. One cell (Ctrl+C, Copy:
  Cell Value) is still just its value.
- **Several ranges are copied as one table** (they copied the last range): the rows of every range x
  the fields of every range, a cell in no range empty.
- The row menu's copies write the values **as the cells show them** (they wrote dates as ISO and
  numbers raw), through the same code as Ctrl+C.

##### Added
- `GridConfig.copyHeaders` (default `true`).
- A paste whose first line is all column labels of the grid leaves that line out: a copy of the grid
  pasted back into it writes the values, not the labels.

##### Fixed
- The row menu's copied html table did not escape the values (a `<` broke the table); it had no header
  in its plain text.

#### Excel export (user request)

##### ⚠️ Breaking changes
- The row menu's **Export:** offers Excel instead of CSV: `row.export.excel` ("Excel, all rows") and
  `row.export.excelSelected` ("Excel, selected rows"); `row.export.csv` / `row.export.csvSelected` and
  their texts are gone. `getCsv()` / `downloadCsv()` stay.

##### Added
- `gridInterface.getExcel(options?)` (a `Promise<Blob>`) and `downloadExcel(filename = 'export.xlsx',
  options?)`: a real .xlsx with no dependency - the grid writes the ZIP and the SpreadsheetML, deflated
  with `CompressionStream` where there is one. Typed cells: numbers, dates and datetimes (the local
  day, Excel date formats), booleans, text (line breaks wrapped). The header row is always there, bold
  and frozen, with an autofilter over every row; the widths follow the grid's. **Always a flat list**:
  grouped, every data row in the grouped order, collapsed groups included - no group rows, no outline,
  no totals.
- `ExcelOptions`: `rows: 'all' | 'selected' | 'range'`, `fields`, `sheetName` (Excel's rules, a
  `TypeError` otherwise). More rows or columns than Excel takes reject with a `RangeError`.
- The export guide covers Excel first; the export sample has Excel buttons.

#### CSV export (item 41)

##### Added
- `gridInterface.getCsv(options?)`: the rows as CSV text (RFC 4180, CRLF line ends, a header line of
  the column labels). By default every row the filter lets through, in the sort order (grouped: every
  data row, collapsed groups included, no group rows), the columns of the layout in the order the user
  sees them, each value as the cell shows it. Works without a connected grid too.
- `gridInterface.downloadCsv(filename = 'export.csv', options?)`: saves the same text as a file, with a
  UTF-8 BOM by default so Excel reads æøå.
- `CsvOptions` / `CsvSeparator`, plain JSON: `rows: 'all' | 'selected'`, `fields`, `header`,
  `formatted` (`false`: raw values, ISO dates in UTC, dot decimals), `separator: ',' | ';' | '\t'`
  (`';'` for Excel in a locale with a decimal comma), `bom`, `escapeFormulas` (default on: text
  starting with `=`, `+`, `-`, `@`, tab, CR, LF or their full-width forms gets a `'` in front - OWASP
  CSV injection; numbers, dates and booleans are never escaped, a phone number `+47 ...` is). An
  unknown option or value throws a `TypeError`.
- Row menu **Export:** section: `row.export.csv` (CSV, all rows) and `row.export.csvSelected` (CSV, selected
  rows, greyed out with none selected), in every grid. Texts `row.export*`.
- Guide "Export" and sample "Export to CSV".

#### Menus: submenus, much shorter, and the keyboard (user request)

##### ⚠️ Breaking changes
- **The default menus are trees of submenus**: the row menu went from 38 rows to 14, the header menu
  from 24 to 7. The `menus` hook's `defaults` hold submenus (`MenuSubmenu`), so an entry in one is
  changed through that submenu's `entries`; a filter on a submenu's id prefix (`row.export`) still
  hides it as a whole. The section ids `row.edit`, `header.column` and `filter.filter` are gone from
  `MENU_IDS` and the texts (no section headers left in the defaults); the other ids stay - the Pin
  submenu is `header.column.pin` and the Blank one `filter.filter.blank`, so their entries keep theirs.
- **The row menu's Summary is gone** (`row.summary`, `row.summary.count` / `.sum` / `.max` / `.min` /
  `.avg`, ids and texts): the summary of the selected cells is in the footer (item 35).
- Submenu labels have no colon; texts changed: "Hide column", "Column chooser…", "Advanced Filter…",
  "Is blank", "Is not blank", "Operator". A selected item shows a ✓ and is a `menuitemcheckbox`
  (`aria-checked`) instead of a highlighted background; "Use dimmed values" and "Changed rows only" use
  `selected` instead of a "✓ " in the label.

##### Added
- `MenuSubmenu` (`{ type: 'submenu', id, label, entries, visible? }`) in `openMenu()` and the `menus` hook:
  opens beside its item on hover (after 150ms), click, ArrowRight, Enter or Space; flipped left when there
  is no room on the right, kept in the window, scrolls when taller; nests; hidden when it has nothing to
  show. New ids `header.column.pin`, `filter.filter.blank`, `row.edit.separator`,
  `header.aggregate.totalsSeparator`; texts `header.column.pin` ("Pin"), `filter.filter.blank` ("Blank").
- **The keyboard in every menu** (the WAI-ARIA menu pattern): a menu opened from the keyboard focuses its
  first item (a mouse-opened one on ArrowDown/Up), arrows, Home/End, a letter, Enter/Space, ArrowLeft/Esc
  for a submenu, Tab closes it; the focus goes back on close. Roles `menu`, `menuitem`,
  `menuitemcheckbox`, `aria-haspopup` / `aria-expanded` / `aria-disabled`. The filter menu's value list:
  Tab into it, "Run Search" is a button.

##### Fixed
- Shift+F10 or the menu key on a focused column header opens the header menu (Chrome sends it to the
  header cell, the handler was on the label in it).

#### The filter menu's value list shows what the cells show

##### ⚠️ Breaking changes
- The value list's texts are no longer upper case, and Apply after a search no longer adds a `CONTAINS`
  of the search text: `getFilter()` has another shape for it (an `IN` of the values the search found).

##### Fixed
- The filter menu's value list shows, searches and sorts (`localeCompare`) the text the cells show - the
  formatter's text, a lookup column's labels (`Norway`, not `NO`) - not the raw values upper cased. Apply
  filters on the values behind the checked texts; values shown the same are one entry, their counts
  added. The first 100 texts are listed, in order.
- `IN` / `NOT_IN` on a number field formats a number in the list as the rows are: `[1.5]` finds
  numberComma's `1,5`. A number lookup column's header filter with such a formatter found nothing.

##### Added
- A value list for a lookup column on a number field (its cells show labels).
- The footer chips show a lookup column's labels: `getFilterTree(label, formatterOf)`.

#### The keyboard of a spreadsheet (user request)

##### Added
- Ctrl+Home / Ctrl+End (Cmd on a Mac) go to the first cell of the first row / the last cell of the last
  row; Alt+Home / Alt+End to the first / last cell of the row; PageUp / PageDown a page of rows (the rows
  scroll with the focus); Alt+PageUp / Alt+PageDown a page of middle columns; Ctrl+ArrowUp / Ctrl+ArrowDown
  to the edge of the data. Home / End still move the caret in the cell.
- With Shift those keys extend the last range of cells: Shift+PageDown, Ctrl+Shift+End, Alt+Shift+Home,
  Ctrl+Shift+ArrowDown.
- A header filter has Ctrl+Home / Ctrl+End, Alt+Home / Alt+End and PageDown; a column header and a group
  row's button have Ctrl+Home / Ctrl+End.
- Undo / redo (Ctrl+Z / Ctrl+Y and the row menu) scroll to and focus the cell they changed.
- On a Mac the key hints show ⌘Z / ⇧⌘Z, ⇧Enter and ⌘Enter. Texts `row.edit.undo.hint.mac`,
  `row.edit.redo.hint.mac`, `find.previous.tooltip.mac`, `cell.multiline.hint.mac`.
- The buttons of group rows and the footer's Clear and filter chips are Tab stops.

##### Changed
- Tab from the last cell of a row before a group row goes to the group's button, not past it; Tab from the
  last cell of the last row goes to the footer's buttons while the rows are filtered.
- Moving into the header filter row no longer changes the current row (it made row 0 current - a group
  row when grouped).
- For the 100ms after Tab, Enter or an Alt+arrow only the keys that move or type are held back, and only
  in that grid: Esc (a menu closes), Ctrl+C and the keys of other grids pass (they were all cancelled,
  in every grid).
- A range extended from the keyboard that scrolls the active cell away moves the focus to the end of the
  range, so Ctrl+C and more Shift keys keep working.

#### Docs site: a full grid to try everything, the sidebar and the sources folded (user request)

##### Docs
- Sample "Full grid: try everything" (Getting started): 50 columns of every kind - text, money numbers
  edited as the plain number, dates, a date and time, checkboxes, a lookup, a badge renderer, notes of
  several lines, monthly sales with aggregates - pinned left and right, 5 000 rows to start and buttons to
  add 5 000 / 50 000, editing on and off, grouping, the totals row, undo / redo, the changes. The grid is
  most of the window (`fullPage`).
- The sidebar's groups (the samples' "Getting started", "Datasource" ... and the API's) fold too, and every
  part starts folded: the way to the page shown unfolds. The source of every sample starts folded.

#### Formatters: a text for editing (user request)

##### Added
- `Formatter.formatForEdit(value)` (optional): what a cell shows while it is edited - from when its input
  gets the focus until it loses it - and the text the editor over a cell starts from: the plain value to
  type over, `'25008.76'` for `'25 008.76'`. Left out, `format` is used; a readonly cell always shows
  `format`. The money formatters of the samples and the guide have one.

#### The filter editor keeps the header filters it did not change

##### Changed
- Light mode text contrast to WCAG AA: the secondary text (`--simple-html-grid-sec-font-color`,
  placeholders, search boxes) is `#6b6b6b` (was `#979494`, 3.0:1), the row numbers are at 80% opacity
  (was 50%, 2.9:1), and the header filters' placeholders are no longer at 20% opacity (1.3:1).

##### Fixed
- Sorting with a collator that calls different strings equal (`setLocaleCompare(code, { sensitivity:
  'base' })`: 'a' and 'A') put them in the order they came in, and grouping could split a value into two
  groups. They are put by their code points now ('A' before 'a').
- Applying the filter editor emptied every header filter cell, also of the columns whose conditions it
  kept: the rows stayed filtered by them while the headers showed nothing. Only the cells whose column's
  conditions were changed or removed are emptied now.
- The dev samples' dark toggles switch the page's `color-scheme` instead of injecting v5 colours.

#### The candidates list checked, small bugs fixed

##### ⚠️ Breaking changes
- `getRow(n)` is typed `EntityUnion<T> | GroupRow | undefined`: out of range it was always `undefined`, now
  the type says so.
- `getFilterTree()`: a group node's `logicalOperator` is `group`, the name the filter uses.

##### Fixed
- The filter menu's value list put a `false` (a text field holding booleans) under "Blank", and the IN it
  applied then left those rows out. A false is a value of its own now.
- A date picked in a header filter's date picker was stored as text (`getState().headerFilters`), a typed
  one as a `Date`: both are a `Date` now. The picker opens on the date typed in the filter.
- `cell-header-focus` (`rowData`) and the header / filter menus' `context.row` had the first displayed row
  from when the header was rendered, stale after a filter: they are read when the focus or the menu
  happens.
- `__groupLvl` of the data rows: with one grouping level only the first row of each group had it, and
  removing the grouping left it. Every grouped row has the number of levels now, 0 when not grouped.
- A click on a group row's row selector in the 'single' or 'none' selection mode sent `selection-change`
  with nothing selected.
- Dim repeated values compared the formatter's text, not what the cell shows (`numberOverride`).
- Docs site: the copy button threw without `navigator.clipboard` (plain http); it says "copy failed".

#### Row classes: the `rowClass` hook

##### Added
- `GridHooks.rowClass(row, rowIndex)`: css classes for a whole row from its values (a late order, a
  blocked customer), on the row's element in every section - the row number, pinned left, middle,
  pinned right. They follow the row: when it is rendered (scroll, `refresh()`) and after its values
  change (an edit, a paste, an upsert, an undo), in the next frame. Not for group rows. In
  `updateHooks()`; a config with `rowClass` throws, it is a hook. The "Cell styling" sample marks the
  inactive rows.

#### Find: filter the rows (user request)

##### Added
- A **Filter rows** toggle in the find bar (the funnel after the count, `aria-pressed`): only the rows with
  a match are shown, matched exactly as Find marks the cells (the shown text: formatters, numberOverride,
  lookup labels, custom cells). It sits on top of the filter and "changed rows only" and is not part of
  them, the state or `getFilterString()`; it filters again with the text and whenever the datasource
  filters, not on an edit. Closing the bar (Esc, ✕, `closeFind()`) or the footer's Clear turns it off.
- A footer chip `Find: {text}` while it hides rows.
- `gridInterface.find(text, { filterRows })` and `FindResult.filterRows`, sent with `find-change`.
- Texts `find.filterRows`, `find.filterRows.tooltip`, `footer.findFilter`.

#### Custom cell rendering (item 39)

##### Added
- `registerCellRenderer(id, renderer)` and `ColumnConfig.renderer`: draw a column's cells with code of
  your own - plain DOM, lit-html, React, Solid. The renderer is called once per cell element (not per
  row), `update(context)` on every render of the cell, `destroy()` when the cell is done with it. Types
  `CellRenderer`, `CellRendererInstance`, `CellRenderContext` (row, field, value, text, type, readonly,
  rowIndex, gridInterface).
- Custom cells keep the grid's keys, focus ring, copy and paste, ranges, Find, fill down, errors, the
  edited marker and undo. A renderer can write `context.row[field]`: tracked, validated, one undo step.
- Editing a custom cell: Enter, F2, typing and a double click open the grid's one-line editor over the
  cell (Enter saves, Esc cancels), a click on a date cell opens the date picker, and
  `CellRendererInstance.edit()` lets a renderer edit the value itself (a select). New text
  `cell.editor.hint`.
- An unknown renderer id, or a column with both `renderer` and `editor`, throws a `TypeError` when the grid
  is made or in `updateConfig()`.
- Guide "Custom cells" (21) and sample "Custom cells" (a badge, a progress bar, a link, a select, a date
  with its weekday, 10 000 rows).

#### The filter menu and the filter editor redone (user request)

##### Changed
- **The header filter menu** is **Filter ›** (Operator ›, Blank ›, Clear Filter, Clear All Filters,
  Advanced Filter…) and then the value list: a framed search box ("Search values"), a "10 values" count,
  "Select all" as the list's header (tri-state: checked, mixed, unchecked), each value's row count
  right-aligned and muted, a scrolling list, Cancel and Apply buttons. Entry ids are unchanged;
  `filter.filter` is the submenu (the old section id), the separator `filter.filter.blankSeparator` is gone.
- **The filter editor**: a condition is one row - Field ▾, Operator ▾, the value (a list for IN / NOT IN,
  none for the blank operators), ⇄, delete - with select-style pickers; a group is an indented bracket
  with an AND/OR toggle (`aria-pressed`), "+ Condition", "+ Group", wrap and delete; an empty filter says
  so; Cancel / Apply / Apply & close. The pickers are grid menus and work from the keyboard, the field
  picker has a search box. The dialog is as tall as its content, up to the window, and stays in it;
  min size 360×200.
- Texts reworded: `filter.values.*` ("Search values", "{count} values", "Select all", "Apply", "Only values
  in filtered rows", "Only the first {max} values are shown"), the editor's labels and pickers ("Field",
  "Operator", "Value", "Column") and buttons ("Cancel", "Apply", "Apply & close"), "Search fields".

##### Fixed
- Nested groups in the filter editor ran past the dialog's right edge.
- "Select all" showed checked when values of the column were filtered away.
- The value list's count said "rows found" but counted values.
- Menu separators showed as dots instead of lines.
- The filter editor's focus went to its first button (Chrome 131) instead of the dialog; the focus fell to
  the page when the focused condition was deleted; the footer's Tab order was reversed; the field
  picker's search text carried over between openings.

##### Added
- Texts `filter.filter`, `filter.values.rowsFound.one`, `filter.values.cancel`, `filterEditor.addCondition`,
  `filterEditor.addSubGroup`, `filterEditor.empty`; variables `--simple-html-grid-accent-color`,
  `--simple-html-grid-accent-font-color`, `--simple-html-grid-control-border-color`.

#### Lookup columns: a select or a dropdown grid (user request)

##### Added
- **Lookup columns**: `ColumnConfig.editor: { type: 'select' | 'grid', lookup, set? }` and
  `registerLookup(id, lookup)` - a lookup is `{ datasource, valueField, labelField?, config? }` or
  `{ gridInterface, valueField, labelField? }` (types `Lookup`, `LookupFromDatasource`,
  `LookupFromGridInterface`, `ColumnEditor`). The cell shows the label (a value not in the lookup as
  itself) and a square ▾ button; the list opens with the button, Alt+ArrowDown, F4, F2, Space, a double
  click, or typing (the character is the search). **Select**: a search field over a listbox
  (combobox, `aria-activedescendant`), at most 500 options shown. **Grid**: the lookup's datasource and
  config in a dropdown, its label column's filter focused; or a linked `GridInterface`. A pick and its
  `set` fields are one write, one undo step; Delete empties the cell and its `set` fields. An unknown
  lookup, a bad `set`, a boolean/date field, `focusButton` or `dynamicCellTypeColumn` next to an editor
  throw a `TypeError`.
- Lookup columns sort on their labels, their header filter matches labels (as `IN` of the values), and
  CSV / Excel export, copy, paste (a label becomes its value), clear, fill down, Find and fit widths use
  the labels. The filter menu's value list, group rows and the filter's text show the values.
- Texts `lookup.open`, `lookup.search`, `lookup.noMatch`, `lookup.more`; variables
  `--simple-html-grid-lookup-button-bg-color`, `--simple-html-grid-lookup-icon-color`,
  `--simple-html-grid-lookup-active-bg-color`.
- Guide "Lookups: select and dropdown grid" (20), sample "Lookups"; the "Grid as dropdown" sample is a
  few lines of config now.

#### Find in the grid (item 42)

##### Added
- **Find in the grid** (Ctrl+F / Cmd+F with the focus in the grid): a find bar over the grid's top right
  corner with an input, the count (`3 of 17`), previous / next and close. Typing finds as you go: every
  cell whose shown text (formatted, any case) contains the text gets a tint, the current match a stronger
  tint and a 2px line, and the grid scrolls to it, sideways too. Enter / F3 go to the next match and
  Shift+Enter / Shift+F3 to the previous, wrapping at the ends. Esc closes the bar and puts the focus in
  the current match's cell (its row becomes the current row). Ctrl+F outside the grid stays the
  browser's. While open it follows the data (filter, sort, grouping, edits, upserts, layout), keeping the
  current match while it still matches. Not in checkboxes, group row names, collapsed groups or hidden
  fields.
- API: `gridInterface.find(text)`, `openFind()`, `findNext()`, `findPrevious()`, `closeFind()`, `getFind()`,
  the `find-change` event and the type `FindResult`.
- Texts `find.label`, `find.placeholder`, `find.count`, `find.none`, `find.previous[.tooltip]`,
  `find.next[.tooltip]`, `find.close[.tooltip]`. Variables `--simple-html-grid-find-match-color`,
  `--simple-html-grid-find-current-color`, `--simple-html-grid-find-current-border-color`. Classes
  `simple-html-cell-find-match`, `simple-html-cell-find-current`, `simple-html-grid-find`.
- Accessibility: the bar is a `role="search"` region with a named input, the count is a status, the
  buttons are named with their key in the tooltip. Find keys in the keyboard guide.
- Guide "Find" (19) and sample "Find (Ctrl+F)".

#### The row menu's undo entries in a submenu of their own (user request)

##### ⚠️ Breaking changes
- Undo last change, Redo, Undo cell edit and the two Undo row edits are in the submenu **Undo / Redo ›**
  (`row.edit`, text `row.edit` "Undo / Redo"), first in the row menu, instead of five items and a line at
  its top: the row menu is 9 rows. The entries keep their ids; the line `row.edit.separator` is gone.

#### Fill down: Ctrl+D and the fill handle (item 34)

##### Added
- **Ctrl+D** (Cmd+D) in a cell fills down like a spreadsheet: in every range the values of its top row go
  into the rows under it; a range of one row, or the cell alone, gets the values of the data row above.
  `gridInterface.fillDown()` does the same from code.
- **The fill handle**: a small square at the bottom right corner of the last range (`.simple-html-grid-fill-handle`,
  in the range colour). Dragged down, the range grows with the pointer (the grid scrolls past the
  bottom), and the rows it grew by get the range's rows, repeated from its top.
- Values are copied as they are (a date as a new Date), readonly cells skipped, group rows skipped, one
  undo step; nothing in a readonly grid (no handle, Ctrl+D stays the browser's).

#### The summary of the selected cells in the footer (item 35)

##### Added
- With cell ranges of more than one cell the footer shows **Count, Sum, Average, Min, Max** at its right,
  like a spreadsheet's status bar: the cells with a value (any type, `0` and `false` count), and the
  numbers of the number fields, every cell once, group rows skipped, shown with the formatter of the
  number field furthest left. It follows the ranges and edits of their values. Texts `footer.summary`
  (its name for a screen reader), `footer.summary.count` / `.sum` / `.avg` / `.min` / `.max`; the class
  `.footer-summary`. The filter chips collapse to one box when they would reach under it.

##### Docs
- Guide "Selection and clipboard": The summary in the footer; its known limits said several ranges copy
  the last one - they copy as one table since the clipboard change.

#### Live data: the flash of a merge, the look of a conflict (item 38)

##### Added
- **`GridConfig.mergeHighlight`** (default `true`): a cell whose value `datasource.upsert()` changed
  flashes once - a tint that fades out over a second (`--simple-html-grid-merged-color`); the cell
  element has the class `simple-html-cell-merged` meanwhile. The hook in the "Live data" guide is for a
  look of your own now.
- **The look of a conflict**: a field the server changed while the user had it edited has a larger
  marker in the conflict colour (`--simple-html-grid-conflict-color`), with or without `editedMarker`;
  its tooltip has the server's value and a click takes it (as `resolveConflict(row, field, 'remote')`,
  undoable). The cell element has the class `simple-html-cell-conflict`, the marker
  `simple-html-cell-conflict-marker`.
- **The row number of a row in conflict** shows two arrows (`rowStatus`), its tooltip and the screen
  reader's text say which fields (`Changed on the server too: Price`) or that the server removed the row.
  An error wins the icon, then a conflict, then new / edited; a deleted row keeps its trash can.
- Texts `rowStatus.conflict`, `rowStatus.removedOnServer`, `cell.conflictMarker.tooltip`,
  `cell.conflictMarker.take`.
- The "Live data" sample uses the grid's flash, no hook.

#### Group rows: a +/- box and the lines of the levels, like a tree (user request)

##### Changed
- The `+` / `-` of a group row is a square box with a frame, in the column of its level. The line of an
  expanded group runs from under its box down through its rows, the lines of the groups a row is in go
  through it: where a group ends shows. In a row with aggregates the lines go down the aggregate lines too.
- The grouping columns of the data rows are one column, no line under each row and no inset shadow.
- New variable `--simple-html-grid-group-line-color` (the lines and the box's frame, at least 3:1 to the
  group rows). The group row's elements have classes of their own: `.simple-html-grid-group-toggle`
  (the button), `-group-box` / `-group-box-frame` / `-group-box-sign`, `-group-text`, `-group-levels`,
  `-group-line`; `.simple-html-grid-grouping-row-group` is the header's grouping columns only.

## 5.0.1

Large maintenance release: the whole codebase was refactored, the toolchain and all
dependencies were updated, the test suite was tripled, and several new grid features landed.

### ⚠️ Breaking changes
- **Release strategy changed — no more `npm publish`.** Releases now happen by installing the
  package straight from a git branch, so `standard-version` and its `.versionrc.json` are
  gone, and `dist` is committed to the branch. Update your dependency to point at the git
  ref instead of the npm registry.
- **`lit-html` bumped `^2.6.1` → `^3.3.3`.** Kept as a range so consumers can dedupe, but
  this breaks anyone still on lit-html 2.
- **Published output is now untranspiled es2025.** `scripts/build.js` emits at `target`/`lib`
  `es2025`, so the package raises its runtime floor.
- **Runtime floor also raised to es2022** by `hasOwnProperty` → `Object.hasOwn` (Chrome 93 /
  Firefox 92 / Safari 15.4 or newer).

### Features
- **Filter on a cell's value from the row menu** — the right-click cell menu gains a *Filter:*
  section with **Replace filter (all)** and **Add to filter (and)** (the new condition is
  ANDed in front of the existing filter). Filters on the *source* value (not the displayed
  one), uses `IS_BLANK` for empty cells, clears the header quick-filter inputs so they can't
  disagree with what's applied, and is hidden on group rows.
- **Dim repeated values** — a cell that repeats the value of the row directly above is dimmed
  so only the first row of a run reads at full strength. Off by default; toggle via **View:
  Use dimmed values** in the row menu or `dimRepeatedValues` in the grid config. Compares the
  *displayed* value (so value-formatter output and dates work), grouping resets it at each
  group's first row, blanks are never dimmed, and it stays correct while scrolling.
  `data-repeated-value="true|false"` is written to every cell so the styling can be replaced.
- **Resizable filter editor** — the filter dialog can now be dragged by its titlebar and
  resized from any edge or corner (min 460×240), keeping its position/size across rebuilds.
  Added a close button, button hover/pressed states, and clearer affordances on the clickable
  cells.
- **Tooltips in the filter editor** — every button/icon carries `data-tooltip`. `tooltips`
  grid config toggles the built-in tooltip (default on); `tooltipText` overrides individual
  strings by id; `TOOLTIPS` is exported so ids and defaults can be looked up. `data-tooltip`
  is always written so an external tooltip library can be used instead.
- **Row counts in the filter value list** — the Excel-style value picker shows `VALUE (12)`,
  including a count on the `Blank` entry. Counts are only shown when nothing was truncated, so
  a count never sits next to a cut-off list.
- **Active-filter footer redesigned** — the raw `[COL] <<EQUAL_TO>> 'x'` string in the footer
  is replaced by readable chips (attribute · operator · value), with nested filter groups
  drawn as bracketed clusters so precedence stays visible, and `AND`/`OR` connectors between
  them. Operators show as symbols (`= ≠ < ≤ > ≥`) or short words (`contains`, `is blank`).
  Clicking the chips opens the filter editor pre-loaded with the current filter, and the
  *Clear filter* text became a proper pill button. The `filteredRows/totalRows` count floats
  over the scrollbar so it costs no vertical space, and on a narrow grid (or past the 5-statement
  cap) the chips collapse to a single `N filters — click to edit` box rather than clipping.
  New `Datasource.getFilterTree()` exposes the active filter as a `FilterNode` tree
  (`FilterGroupNode` / `FilterConditionNode`, all exported) for custom rendering.

### Fixes
- **`columnsCenter` default checked the wrong property** in `__parseConfig()` — a config with
  `columnsPinnedLeft` set but `columnsCenter` missing fell through the guard and crashed later.
- **Filter dropdown "showing first 100" warning never fired correctly** — it could only ever
  trigger when a blank pushed the set to 101; a column with 500 distinct values silently
  showed 100 with no warning. Now driven by an explicit `truncated` flag.
- **Dates never cleared the edited flag** — `set()` compared two `Date` objects with `===`
  (always false), so a date edited back to its original stayed flagged as changed forever.
  Now compared by `.getTime()`.
- **Proxy `set` trap returned `value` instead of `true`** — setting `__KEY` to a falsy value
  (`0`, `''`, `null`) threw in strict mode.
- **`row % 0` instead of `row % 2`** in the row selector — even/odd striping always took the
  odd branch, so `simple-html-label-even` was dead.
- **`typecheck.js` swallowed option/global/syntactic errors** — a comma operator meant only
  semantic errors could ever fail the build.
- **Build `spawner()` could hang forever** — a failed child process (ENOENT etc.) never
  settled the promise; now handled.
- Various scroll-handler cleanups (dead `lastLeft` accumulator, wrong `e.top` pre-pass that
  skipped row 0 and mis-set recycled rows).

### Tooling / build
- **ESLint + Prettier → [Biome](https://biomejs.dev/); ts-node → tsx.** Formatter settings
  carried over 1:1; ~500 lint diagnostics driven to zero.
- **TypeScript 5.6 → 6, and all deps updated and pinned** (biome 2.5.4, esbuild 0.28.1,
  lit-html 3.3.3, vitest 4.1.10, typedoc 0.28.20, …). Config migrated for TS6
  (`moduleResolution: node → bundler`, `baseUrl` removed).
- **ES target raised to es2025** across all tsconfigs and build scripts (had drifted between
  es2018/es2020/es2021).
- **Flattened the npm workspace into a single package** — `packages/grid/src` → `src`, the two
  manifests merged into one root `@simple-html/grid`, build/clean/test scripts rewritten for
  the single package.
- **`npm run build` now packs a `.tgz` into `./build`** and adds a `files` allowlist, dropping
  the published tarball from 570 files / 13 MB to 335 kB (`src` included for go-to-definition).
- **Dropped the live docs/demo.** The GitHub Pages demo build is gone and samples run locally
  now, so the dev/demo build configs (deduplicated into `config_shared.ts`, then collapsed
  back into a single `config_devserver.ts`) reduced to one watched, unminified dev server
  writing to `dist_dev`.
- Fixed `typedoc-grid` (was failing with 5 errors, now 0 errors / 0 warnings); stopped Biome
  from reformatting the emitted `dist`.

### Tests
- **128 → 447 tests; statement coverage 12.7% → 40.6%** ahead of the refactor. New coverage
  for the entity proxy, change tracking, the combined filter/sort/group pipeline, every
  date/number formatter, and behaviour-level GUI tests (via happy-dom) for the new features.






----------------------



All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [5.0.0-next.107](https://github.com/simple-html/simple-html/compare/v5.0.0-next.106...v5.0.0-next.107) (2025-10-21)


### Bug Fixes

* close context menu on label/filer actions ([77f2419](https://github.com/simple-html/simple-html/commits/77f2419111337dcfb0148a839de18d7a31bbe1c3))

## [5.0.0-next.106](https://github.com/simple-html/simple-html/compare/v5.0.0-next.105...v5.0.0-next.106) (2025-10-20)


### Bug Fixes

* add carrage return to copy options ([e1639b2](https://github.com/simple-html/simple-html/commits/e1639b2c5c83d26c0b91e1f885d337d3d289ef6a))

## [5.0.0-next.105](https://github.com/simple-html/simple-html/compare/v5.0.0-next.104...v5.0.0-next.105) (2025-10-13)


### Bug Fixes

* add option for setting contextmenu auto removal off ([9e7f173](https://github.com/simple-html/simple-html/commits/9e7f1737f15ed25175ddd3fb746e7dab2e35cc60))
* blur right after focus, so we dont trigger keyboard on pad ([6f72975](https://github.com/simple-html/simple-html/commits/6f72975ad851d329e81602bb61a6998b7de8a6d7))

## [5.0.0-next.104](https://github.com/simple-html/simple-html/compare/v5.0.0-next.103...v5.0.0-next.104) (2025-06-03)


### Bug Fixes

* improve dropdown filter with more use info and max rows ([e9fcffc](https://github.com/simple-html/simple-html/commits/e9fcffc6b26a8e533ed0b2dd0c1de4a326ceb5c1))

## [5.0.0-next.103](https://github.com/simple-html/simple-html/compare/v5.0.0-next.102...v5.0.0-next.103) (2025-03-08)


### Features

* option to display error ([a7e2939](https://github.com/simple-html/simple-html/commits/a7e293994ef9637d60c89005483819feb8737994))

## [5.0.0-next.102](https://github.com/simple-html/simple-html/compare/v5.0.0-next.101...v5.0.0-next.102) (2025-03-07)


### Bug Fixes

* grouping bug ([3f54732](https://github.com/simple-html/simple-html/commits/3f5473218e8b91c7e991ae44d21d3b45ff1739ba))

## [5.0.0-next.101](https://github.com/simple-html/simple-html/compare/v5.0.0-next.100...v5.0.0-next.101) (2025-03-06)


### Features

* add before group in filter editor ([811ef7a](https://github.com/simple-html/simple-html/commits/811ef7a598322e99218c19370b04a89d8104dafa))

## [5.0.0-next.100](https://github.com/simple-html/simple-html/compare/v5.0.0-next.99...v5.0.0-next.100) (2025-03-06)


### Bug Fixes

* remove context menu in filter editor after select ([f6a4dc8](https://github.com/simple-html/simple-html/commits/f6a4dc81b389dd3b072c288deec2ae5292a4802c))

## [5.0.0-next.99](https://github.com/simple-html/simple-html/compare/v5.0.0-next.98...v5.0.0-next.99) (2025-03-06)


### Features

* refactor row state, deleted will be better handled, and option for showing rowstate (N, D, M) ([#60](https://vegarringdal//null/issues/60)) ([b6059b4](https://github.com/simple-html/simple-html/commits/b6059b4fe4251b1a2740d39c8608efafdb5b9cb7))

## [5.0.0-next.98](https://github.com/simple-html/simple-html/compare/v5.0.0-next.97...v5.0.0-next.98) (2025-02-25)


### Features

* add search in column chooser, improve datepicker uage in filter editor and column resize improvement on dates placeholder ([#59](https://vegarringdal//null/issues/59)) ([6677d55](https://github.com/simple-html/simple-html/commits/6677d55287ad0ed4051e945581492e4f43ae5042))

## [5.0.0-next.97](https://github.com/simple-html/simple-html/compare/v5.0.0-next.96...v5.0.0-next.97) (2025-01-13)


### Bug Fixes

* dropdown filter to show null/blank as option ([800b17e](https://github.com/simple-html/simple-html/commits/800b17e33bde4c601954f643a67663fb6507a8a4))

## [5.0.0-next.96](https://github.com/simple-html/simple-html/compare/v5.0.0-next.95...v5.0.0-next.96) (2024-10-26)


### Bug Fixes

* get changes returned new with changes as modified record ([fb8aacb](https://github.com/simple-html/simple-html/commits/fb8aacbb75e2758f92124fa293dd539d9bc2dea4))

## [5.0.0-next.95](https://github.com/simple-html/simple-html/compare/v5.0.0-next.94...v5.0.0-next.95) (2024-09-12)

## [5.0.0-next.94](https://github.com/simple-html/simple-html/compare/v5.0.0-next.93...v5.0.0-next.94) (2024-08-06)


### Bug Fixes

* fix filter, was not able to set equal to number input ([00e0666](https://github.com/simple-html/simple-html/commits/00e0666a0be64cd946a1e55f58950345c4916631))

## [5.0.0-next.93](https://github.com/simple-html/simple-html/compare/v5.0.0-next.92...v5.0.0-next.93) (2024-02-20)


### Bug Fixes

* better value formater control ([c8a696d](https://github.com/simple-html/simple-html/commits/c8a696d61ac8a6ac4941e42e46d4f750ad25a668))

## [5.0.0-next.92](https://github.com/simple-html/simple-html/compare/v5.0.0-next.91...v5.0.0-next.92) (2024-01-15)


### Bug Fixes

* filter using attribute compare when using labels ([7b59fef](https://github.com/simple-html/simple-html/commits/7b59fefc7b414f701a3b69204874d8e0ff7e97d0))

## [5.0.0-next.91](https://github.com/simple-html/simple-html/compare/v5.0.0-next.90...v5.0.0-next.91) (2023-11-15)


### Bug Fixes

* select on header rerendering could mess up layout ([62129c7](https://github.com/simple-html/simple-html/commits/62129c7e89d4a721e3ab6424c33efe73c8d8f3a9))

## [5.0.0-next.90](https://github.com/simple-html/simple-html/compare/v5.0.0-next.89...v5.0.0-next.90) (2023-11-13)


### Features

* cellHeaderLabelHeight ([4b856de](https://github.com/simple-html/simple-html/commits/4b856de2c1693182d4d86f3d7687bd972063a40a))

## [5.0.0-next.89](https://github.com/simple-html/simple-html/compare/v5.0.0-next.88...v5.0.0-next.89) (2023-11-06)


### Bug Fixes

* scrollbars ([9f2c5b7](https://github.com/simple-html/simple-html/commits/9f2c5b7136741979a4d928672d1cabec8f2a2bdf))

## [5.0.0-next.88](https://github.com/simple-html/simple-html/compare/v5.0.0-next.87...v5.0.0-next.88) (2023-11-04)


### Bug Fixes

* inputs for firefox ([0f3922f](https://github.com/simple-html/simple-html/commits/0f3922fadf0083a681e6c7f628b0136580aecdce))

## [5.0.0-next.87](https://github.com/simple-html/simple-html/compare/v5.0.0-next.86...v5.0.0-next.87) (2023-10-11)


### Bug Fixes

* remove console.log messages ([079d291](https://github.com/simple-html/simple-html/commits/079d2913109c2beaa55b74c35a9d8e3d6279e005))
* use sort with grouping on load config ([ec7a88a](https://github.com/simple-html/simple-html/commits/ec7a88a480ae10b978d6fca2e5f976bee7f9a44e))

## [5.0.0-next.86](https://github.com/simple-html/simple-html/compare/v5.0.0-next.85...v5.0.0-next.86) (2023-09-25)


### Bug Fixes

* menu rect bottom when outside window ([409103e](https://github.com/simple-html/simple-html/commits/409103eea184f035044a6de5a7b439fa1a9d531d))

## [5.0.0-next.85](https://github.com/simple-html/simple-html/compare/v5.0.0-next.84...v5.0.0-next.85) (2023-08-23)


### Bug Fixes

* header filter - dropdown failed to open ([aa0c1f6](https://github.com/simple-html/simple-html/commits/aa0c1f60cb9ff60d9a10ffafe8c8cd15d6ff1313))

## [5.0.0-next.84](https://github.com/simple-html/simple-html/compare/v5.0.0-next.83...v5.0.0-next.84) (2023-07-10)


### Bug Fixes

* date on copy/paste so it works better with excel ([966759b](https://github.com/simple-html/simple-html/commits/966759bd24f65ffeb785c9f37673fd52c4c8a160))

## [5.0.0-next.83](https://github.com/simple-html/simple-html/compare/v5.0.0-next.82...v5.0.0-next.83) (2023-07-10)


### Bug Fixes

* improve copy/paste ([c8120a3](https://github.com/simple-html/simple-html/commits/c8120a3d83c4c3dfa42f78e1170f20bd8748c6b9))

## [5.0.0-next.82](https://github.com/simple-html/simple-html/compare/v5.0.0-next.81...v5.0.0-next.82) (2023-07-07)


### Bug Fixes

* date formater clear value ([dfd2221](https://github.com/simple-html/simple-html/commits/dfd22214793988719753c38d9ac088628b5de495))
* remove debugger statement ([b3e6676](https://github.com/simple-html/simple-html/commits/b3e6676c923987e796e3dfbf9bbd61af937242c6))
* use label in copy rows ([04fa63e](https://github.com/simple-html/simple-html/commits/04fa63e02e06ce9b25bd7a6d62fe48c53d77e455))

## [5.0.0-next.81](https://github.com/simple-html/simple-html/compare/v5.0.0-next.80...v5.0.0-next.81) (2023-07-06)


### Bug Fixes

* label when reorder panel grouping ([44596fd](https://github.com/simple-html/simple-html/commits/44596fd45dace7d2f0a2c425b6a50dd4ea1d4459))

## [5.0.0-next.80](https://github.com/simple-html/simple-html/compare/v5.0.0-next.79...v5.0.0-next.80) (2023-07-06)


### Bug Fixes

* label not used in dragdrop/content menus ([18d9bde](https://github.com/simple-html/simple-html/commits/18d9bde709e2b4f4a1d83e78b657759de936b857))

## [5.0.0-next.79](https://github.com/simple-html/simple-html/compare/v5.0.0-next.78...v5.0.0-next.79) (2023-06-30)


### Bug Fixes

* number raw value was not used ([6af0fb7](https://github.com/simple-html/simple-html/commits/6af0fb792c2513c288f615f226a862829b7902ed))

## [5.0.0-next.78](https://github.com/simple-html/simple-html/compare/v5.0.0-next.77...v5.0.0-next.78) (2023-06-28)


### Features

* dynamic column based on additional column to tell us value type ([19e082e](https://github.com/simple-html/simple-html/commits/19e082e1f861183af693326e9cec8785726ba707))

## [5.0.0-next.77](https://github.com/simple-html/simple-html/compare/v5.0.0-next.76...v5.0.0-next.77) (2023-06-19)

## [5.0.0-next.76](https://github.com/simple-html/simple-html/compare/v5.0.0-next.75...v5.0.0-next.76) (2023-06-08)


### Bug Fixes

* default formater when value is undefined/null ([bd03231](https://github.com/simple-html/simple-html/commits/bd0323174bf909d2019e04ffd280dd92c54d64be))
* forgot to remove console.log ([8efd526](https://github.com/simple-html/simple-html/commits/8efd526d0ffee9f8d71ca1e2ce7e78b305476e30))

## [5.0.0-next.75](https://github.com/simple-html/simple-html/compare/v5.0.0-next.74...v5.0.0-next.75) (2023-06-08)


### Features

* custom context menu ([d56ab93](https://github.com/simple-html/simple-html/commits/d56ab93b15abf8e0002cc87a48d0293e13095c16))

## [5.0.0-next.74](https://github.com/simple-html/simple-html/compare/v5.0.0-next.73...v5.0.0-next.74) (2023-06-08)


### Bug Fixes

* key nav when grouped and enter key in edit more trigger keydown ([c27d0c8](https://github.com/simple-html/simple-html/commits/c27d0c8d11e113ae9b26e107e69649af2d36afe9))

## [5.0.0-next.73](https://github.com/simple-html/simple-html/compare/v5.0.0-next.72...v5.0.0-next.73) (2023-06-02)


### Bug Fixes

* more check before rebuild can run ([4f81e2a](https://github.com/simple-html/simple-html/commits/4f81e2a83e37f75467e36a857890fc93f8563a84))

## [5.0.0-next.72](https://github.com/simple-html/simple-html/compare/v5.0.0-next.71...v5.0.0-next.72) (2023-05-31)


### Features

* add event for when grid is connected to interface ([f70bc17](https://github.com/simple-html/simple-html/commits/f70bc17b333d61c95546973d3172fe82d7e1be82))
* open for callback to set class on row lvl and att data attributes to row and header label ([84d420d](https://github.com/simple-html/simple-html/commits/84d420d757c3187d7c071884394aa691d751a24a))

## [5.0.0-next.71](https://github.com/simple-html/simple-html/compare/v5.0.0-next.70...v5.0.0-next.71) (2023-04-13)

## [5.0.0-next.70](https://github.com/simple-html/simple-html/compare/v5.0.0-next.69...v5.0.0-next.70) (2023-03-12)


### Features

* better mandatory background color option ([ce4c0e1](https://github.com/simple-html/simple-html/commits/ce4c0e1cec7f7d7c3629e8392d655a06d79e391c))

## [5.0.0-next.69](https://github.com/simple-html/simple-html/compare/v5.0.0-next.68...v5.0.0-next.69) (2023-03-04)


### Bug Fixes

* add possible fix for react/vitejs issue where it does not cleanup before rebuilding ([7e955fc](https://github.com/simple-html/simple-html/commits/7e955fc62829f82535de072f93eac9524c6af4a8))
* context menu on filter date got reset ([80bd5ea](https://github.com/simple-html/simple-html/commits/80bd5ea0f09e1795ac666a4cce9a32cf6dbcc793))
* remove unwanted console.log with grouplvl ([2dcadb8](https://github.com/simple-html/simple-html/commits/2dcadb8a5b95f351f8032ac7a3851ec36515c527))

## [5.0.0-next.68](https://github.com/simple-html/simple-html/compare/v5.0.0-next.67...v5.0.0-next.68) (2023-03-02)


### Bug Fixes

* prettyprintstring ([1afeb62](https://github.com/simple-html/simple-html/commits/1afeb62cdcb96f2921cb8628245ebdb9c1e1c519))

## [5.0.0-next.67](https://github.com/simple-html/simple-html/compare/v5.0.0-next.66...v5.0.0-next.67) (2023-02-25)


### Bug Fixes

* add grouplvl to all rows in entity controller ([b06b664](https://github.com/simple-html/simple-html/commits/b06b664bc384c3de0c0b68cc8360216b014bb16a))

## [5.0.0-next.66](https://github.com/simple-html/simple-html/compare/v5.0.0-next.65...v5.0.0-next.66) (2023-02-25)


### Bug Fixes

* header grouping border bottom when there should not be any ([c6a4366](https://github.com/simple-html/simple-html/commits/c6a4366f30f55fbdc511212bcfb09bc3fdb78d87))

## [5.0.0-next.65](https://github.com/simple-html/simple-html/compare/v5.0.0-next.64...v5.0.0-next.65) (2023-02-25)


### Bug Fixes

* grouping when multiple lvl had no left margin ([04f4b4d](https://github.com/simple-html/simple-html/commits/04f4b4db5f59f988fbfeac9e59c1ea249fee54f9))

## [5.0.0-next.64](https://github.com/simple-html/simple-html/compare/v5.0.0-next.63...v5.0.0-next.64) (2023-02-22)


### Bug Fixes

* dataSourceUpdated before generateing dom [#50](https://vegarringdal//null/issues/50) ([861c722](https://github.com/simple-html/simple-html/commits/861c72252210f1049756b9c403d53c882bfdac99))

## [5.0.0-next.63](https://github.com/simple-html/simple-html/compare/v5.0.0-next.62...v5.0.0-next.63) (2023-02-05)


### Bug Fixes

* cursor date picker ([5fb55f3](https://github.com/simple-html/simple-html/commits/5fb55f3b2637acd6dbe28a42bcd61bf6c7fa88de))
* datepicker header filter was not using input value ([4e0c02a](https://github.com/simple-html/simple-html/commits/4e0c02a333d51743dcc85420121b14f3e4cff923))

## [5.0.0-next.62](https://github.com/simple-html/simple-html/compare/v5.0.0-next.61...v5.0.0-next.62) (2023-02-05)


### Bug Fixes

* remove unwanted console.log ([a88e6e5](https://github.com/simple-html/simple-html/commits/a88e6e58fc83459a877afd6d8ba7caa5b7b57723))

## [5.0.0-next.61](https://github.com/simple-html/simple-html/compare/v5.0.0-next.60...v5.0.0-next.61) (2023-02-05)


### Features

* date/time picker ([#53](https://vegarringdal//null/issues/53)) ([65a7be4](https://github.com/simple-html/simple-html/commits/65a7be4c38cbceeeaec64a484321ae2ad39b0951))

## [5.0.0-next.60](https://github.com/simple-html/simple-html/compare/v5.0.0-next.59...v5.0.0-next.60) (2023-02-03)

## [5.0.0-next.59](https://github.com/simple-html/simple-html/compare/v5.0.0-next.58...v5.0.0-next.59) (2023-02-03)


### Bug Fixes

* datetime to work in filter also ([76a727a](https://github.com/simple-html/simple-html/commits/76a727ab573f6065756fb3007d0d24d3e031695a))

## [5.0.0-next.58](https://github.com/simple-html/simple-html/compare/v5.0.0-next.57...v5.0.0-next.58) (2023-02-02)


### Features

* add datetime options and rename iso8601 to YYYYMMDD ([#52](https://vegarringdal//null/issues/52)) ([e4dfc21](https://github.com/simple-html/simple-html/commits/e4dfc21d0c2e8775c7c0f6e15fa8849c932adfb4))

## [5.0.0-next.57](https://github.com/simple-html/simple-html/compare/v5.0.0-next.56...v5.0.0-next.57) (2023-02-02)


### Bug Fixes

* bug in readonly ([85ea69f](https://github.com/simple-html/simple-html/commits/85ea69ffd403dfdeedef601cdf1d235c1cfbda54))
* export more inner elements ([4389871](https://github.com/simple-html/simple-html/commits/4389871403bf822efb5d7583d35e9841e2f4eb44))

## [5.0.0-next.56](https://github.com/simple-html/simple-html/compare/v5.0.0-next.55...v5.0.0-next.56) (2023-01-31)


### Features

* improved valueformater, not limited to just number and date ([#51](https://vegarringdal//null/issues/51)) ([8a55b99](https://github.com/simple-html/simple-html/commits/8a55b997416ea12dd853c6b0c6c5506020ca1700))

## [5.0.0-next.55](https://github.com/simple-html/simple-html/compare/v5.0.0-next.54...v5.0.0-next.55) (2023-01-25)


### Bug Fixes

* css border [#49](https://vegarringdal//null/issues/49) and run prettier on css ([feca8d1](https://github.com/simple-html/simple-html/commits/feca8d1476984901f8b5bc510a4aefa06ea098a7))

## [5.0.0-next.54](https://github.com/simple-html/simple-html/compare/v5.0.0-next.53...v5.0.0-next.54) (2023-01-23)


### Bug Fixes

* dynamic readonly Fixes [#47](https://vegarringdal//null/issues/47) ([#48](https://vegarringdal//null/issues/48)) ([cd72379](https://github.com/simple-html/simple-html/commits/cd723793edf12fa66a21dd878d1eddbf5aacb917))

## [5.0.0-next.53](https://github.com/simple-html/simple-html/compare/v5.0.0-next.52...v5.0.0-next.53) (2023-01-22)


### Bug Fixes

* vertical scroll - stop renedering during large scroll ([f813842](https://github.com/simple-html/simple-html/commits/f8138425125003a3510fd4bb37132f08a6c647ea))

## [5.0.0-next.52](https://github.com/simple-html/simple-html/compare/v5.0.0-next.51...v5.0.0-next.52) (2023-01-22)

## [5.0.0-next.51](https://github.com/simple-html/simple-html/compare/v5.0.0-next.50...v5.0.0-next.51) (2023-01-22)


### Bug Fixes

* check if we have rowdata before using it ([01f99b8](https://github.com/simple-html/simple-html/commits/01f99b8229a04ea47b704d4899918969acf874f3))

## [5.0.0-next.50](https://github.com/simple-html/simple-html/compare/v5.0.0-next.49...v5.0.0-next.50) (2023-01-22)


### Bug Fixes

* remove devlopment env - prod will be missing it ([4961751](https://github.com/simple-html/simple-html/commits/49617517d73006a3652c5c4aaf09b6cfb3f3f546))

## [5.0.0-next.49](https://github.com/simple-html/simple-html/compare/v5.0.0-next.48...v5.0.0-next.49) (2023-01-21)


### Bug Fixes

* delayed scroll, it was rendering since I did not update delay ([6659ead](https://github.com/simple-html/simple-html/commits/6659ead5814cc03a2b968f17f709c02165893741))
* remove console log if not dev mode ([a61b095](https://github.com/simple-html/simple-html/commits/a61b0954c0373a383fb159c88ae5b2d38b480aed))
* same dalay to vert scroll ([9fe3553](https://github.com/simple-html/simple-html/commits/9fe3553a79a7f8324be6ddff667817710d4a5b9b))

## [5.0.0-next.48](https://github.com/simple-html/simple-html/compare/v5.0.0-next.47...v5.0.0-next.48) (2023-01-11)


### Features

* event when operator is change from menu ([3c7c7bc](https://github.com/simple-html/simple-html/commits/3c7c7bcfa637fe6290a404ab5da523242f269a08))


### Bug Fixes

* chnage filter with menu needs to trigger filter ([151502d](https://github.com/simple-html/simple-html/commits/151502df97a621e89ed64d179d54dca1bd4667ef))
* copy only cell value ([d0e0f03](https://github.com/simple-html/simple-html/commits/d0e0f035eab6a55be051a7a95375be3ac3df65fb))
* hitting enter in filter should always trigger filter ([6538aa5](https://github.com/simple-html/simple-html/commits/6538aa506a5ebf01767d572755f98e4ca6724e5d))
* paste into cells to skip readonly set by readonly setter ([1a98289](https://github.com/simple-html/simple-html/commits/1a982890f32037f22552adda4973e1a139c616bb))

## [5.0.0-next.47](https://github.com/simple-html/simple-html/compare/v5.0.0-next.46...v5.0.0-next.47) (2023-01-05)


### Features

* remove sorting - easier to work with new rows ([493c360](https://github.com/simple-html/simple-html/commits/493c360363385831d564a3ee7f9f1ba5b23bdea2))

## [5.0.0-next.46](https://github.com/simple-html/simple-html/compare/v5.0.0-next.45...v5.0.0-next.46) (2023-01-05)


### Bug Fixes

* always show scrollbar ([2d42c39](https://github.com/simple-html/simple-html/commits/2d42c39bc9cc2442f4d42e6f2c4795c48ab7c0e0))
* check if intreface datasource is updated ([6a6a3e1](https://github.com/simple-html/simple-html/commits/6a6a3e1c489005f819a1cfe4ec1667430b1cef8e))
* filter editor ([ab5ae33](https://github.com/simple-html/simple-html/commits/ab5ae33dbf524594636b32d170bf16edb554eab7))
* improve aria - needs more work ([17b5630](https://github.com/simple-html/simple-html/commits/17b56304808bea07261ce86cad774c2d26e8b445))

## [5.0.0-next.45](https://github.com/simple-html/simple-html/compare/v5.0.0-next.44...v5.0.0-next.45) (2023-01-04)


### Bug Fixes

* copy columns ([43838bd](https://github.com/simple-html/simple-html/commits/43838bd2caaf1a5dcbd335eab60d4bad6029620c))
* keynav - only active if alt key pressed ([4912a57](https://github.com/simple-html/simple-html/commits/4912a5705f88ab99c04924fa5d97cefd91052c48))
* mandatory color/readonly color ([5302a6e](https://github.com/simple-html/simple-html/commits/5302a6e55ec2fb0d0dc74b5e10a916629b97bb27))

## [5.0.0-next.44](https://github.com/simple-html/simple-html/compare/v5.0.0-next.43...v5.0.0-next.44) (2023-01-03)


### Bug Fixes

* horizontal scroll with no data - headers was not updatig correctly ([eefe95e](https://github.com/simple-html/simple-html/commits/eefe95e7cf5f9cb93ddec7cad07cfcac4a758f8f))

## [5.0.0-next.43](https://github.com/simple-html/simple-html/compare/v5.0.0-next.42...v5.0.0-next.43) (2023-01-02)


### Bug Fixes

* allow paste only, and readonly logic ([b46765c](https://github.com/simple-html/simple-html/commits/b46765c88e5e71f28ce532ad25ca9951661698bd))
* make hide filter/label optional ([fe7b713](https://github.com/simple-html/simple-html/commits/fe7b7132d8b0728bf80c48461b4b9aaa96a5f7b9))

## [5.0.0-next.42](https://github.com/simple-html/simple-html/compare/v5.0.0-next.41...v5.0.0-next.42) (2022-12-30)


### Features

* make it easier to use grid as dropdown ([a9b2f68](https://github.com/simple-html/simple-html/commits/a9b2f6886a5679c66bc75a4c38f1fcec738d31dc))
* option to hide filter or label in header ([6c1b157](https://github.com/simple-html/simple-html/commits/6c1b157bc519752f0dd7ab68ba31a82d16565218))


### Bug Fixes

* navigation to include filter also ([#43](https://vegarringdal//null/issues/43)) ([8b8d5e0](https://github.com/simple-html/simple-html/commits/8b8d5e097c7a453b0692d0f80edfbdeb65b5f1c5))

## [5.0.0-next.41](https://github.com/simple-html/simple-html/compare/v5.0.0-next.40...v5.0.0-next.41) (2022-12-27)


### Bug Fixes

* tab and arrow key navigation in rows cells ([#41](https://vegarringdal//null/issues/41)) ([b6d5094](https://github.com/simple-html/simple-html/commits/b6d509405e200ad4b626148a9a397cddeceb394b))

## [5.0.0-next.40](https://github.com/simple-html/simple-html/compare/v5.0.0-next.39...v5.0.0-next.40) (2022-12-26)


### Bug Fixes

* key navigation ([0148a67](https://github.com/simple-html/simple-html/commits/0148a6792d584f04c505fb3ad7384097114c2e0a))

## [5.0.0-next.39](https://github.com/simple-html/simple-html/compare/v5.0.0-next.38...v5.0.0-next.39) (2022-12-26)


### Features

* navigate with arrow keys ([fcae66d](https://github.com/simple-html/simple-html/commits/fcae66df8bab4655e9ec576b09e681c7d24a30ae))
* use tab to navigate cells ([2afeb49](https://github.com/simple-html/simple-html/commits/2afeb495ee51719370bb79d5bd83d12411efb2a1))


### Bug Fixes

* dimmed background for mandatory and readonly on checkboxes ([89168c2](https://github.com/simple-html/simple-html/commits/89168c28d392072787c7f783b83c450bfafdeca0))
* I forgot to pass selectionmode to datasource, so it was always multiselect ([d597c40](https://github.com/simple-html/simple-html/commits/d597c4084521ccf358119aad26d98bf9ee1aabcd))

## [5.0.0-next.38](https://github.com/simple-html/simple-html/compare/v5.0.0-next.37...v5.0.0-next.38) (2022-12-22)


### Bug Fixes

* readonly setter ([c8b778a](https://github.com/simple-html/simple-html/commits/c8b778a6a6bbf2dbb9b2686fbbef8bce94ed3a75))

## [5.0.0-next.37](https://github.com/simple-html/simple-html/compare/v5.0.0-next.36...v5.0.0-next.37) (2022-12-22)


### Bug Fixes

* copy cell added linebreak ([a97ecf0](https://github.com/simple-html/simple-html/commits/a97ecf013ab8848eb5af34c17542e677b4f0c551))

## [5.0.0-next.36](https://github.com/simple-html/simple-html/compare/v5.0.0-next.35...v5.0.0-next.36) (2022-12-21)


### Features

* add unpinning of columns [#38](https://vegarringdal//null/issues/38) ([cbe4f9b](https://github.com/simple-html/simple-html/commits/cbe4f9b3b7c8d76c8e2eda491bbbabd38e2b6fb6))


### Bug Fixes

* fix [#39](https://vegarringdal//null/issues/39) ([7353b15](https://github.com/simple-html/simple-html/commits/7353b151126e5f67fbbdee153c688b0acf302f3d))

## [5.0.0-next.35](https://github.com/simple-html/simple-html/compare/v5.0.0-next.34...v5.0.0-next.35) (2022-12-20)


### Bug Fixes

* marked for deletion and remove structuredClone (for teams) ([02c62d2](https://github.com/simple-html/simple-html/commits/02c62d240c5baadaea4e121b642faba1b2a72b7f))

## [5.0.0-next.34](https://github.com/simple-html/simple-html/compare/v5.0.0-next.33...v5.0.0-next.34) (2022-12-19)


### Features

* first/prev/next/last trigger scroll event ([f7ce101](https://github.com/simple-html/simple-html/commits/f7ce101e48a80b19e3929d4fa529d8fc1ec0093b))

## [5.0.0-next.33](https://github.com/simple-html/simple-html/compare/v5.0.0-next.32...v5.0.0-next.33) (2022-12-19)


### Bug Fixes

* in operator filter in filter editor ([435ec0c](https://github.com/simple-html/simple-html/commits/435ec0ce2ac23632f1c0c1b9e2838853103582c6))
* windows path issues - it had messed up lower and uppercase ([e9f254c](https://github.com/simple-html/simple-html/commits/e9f254cc49d2c552e061d82c0e2aa0b4cde609fe))

## [5.0.0-next.32](https://github.com/simple-html/simple-html/compare/v5.0.0-next.31...v5.0.0-next.32) (2022-12-18)


### Features

* allowPasteClearOnReadonly ([faa8a53](https://github.com/simple-html/simple-html/commits/faa8a53baef30d530f4f7225955c9a8381bf88cc))
* mandatory backgorund option, to highlight cells ([ac2a2a9](https://github.com/simple-html/simple-html/commits/ac2a2a91a3d17c50c8a8d808f5fc2456645bf670))

## [5.0.0-next.31](https://github.com/simple-html/simple-html/compare/v5.0.0-next.30...v5.0.0-next.31) (2022-12-17)


### Features

* able to trigger scroll event from grid interface update grid cells ([825e2f7](https://github.com/simple-html/simple-html/commits/825e2f762c9cb95049c6506e6929e86abced223d))

## [5.0.0-next.30](https://github.com/simple-html/simple-html/compare/v5.0.0-next.29...v5.0.0-next.30) (2022-12-17)


### Features

* click on number cell summary copies value to clipboard ([5572f7e](https://github.com/simple-html/simple-html/commits/5572f7eab94dfff3e4f553171d47cfe164a97771))
* focus button in cell ([4783a5a](https://github.com/simple-html/simple-html/commits/4783a5aeca806f3e99be9974f8e7d40ee9903bac))
* option control display of placeholder on selected row only ([d703722](https://github.com/simple-html/simple-html/commits/d7037224f2984be3d1ddc011db7e6badb912ff21))
* paste into cells ([24766d9](https://github.com/simple-html/simple-html/commits/24766d9f9a0d44158053d5b1be865fd031b0c123))


### Bug Fixes

* cell copy, need to send current cell to clipboard - not current enity ([f640635](https://github.com/simple-html/simple-html/commits/f6406352ac2bbccda7fa930317a0a3d8b3e2d52f))
* remove console log in mousewheel scroll event ([fb36c3d](https://github.com/simple-html/simple-html/commits/fb36c3d8809aff09af0199cc9b35bcfd8769ad8c))

## [5.0.0-next.29](https://github.com/simple-html/simple-html/compare/v5.0.0-next.28...v5.0.0-next.29) (2022-12-16)


### Bug Fixes

* bug in filter editor, used replace when I should have used replaceAll ([5fc586e](https://github.com/simple-html/simple-html/commits/5fc586ec777e0df637361163ee524b257634157b))

## [5.0.0-next.28](https://github.com/simple-html/simple-html/compare/v4.0.1...v5.0.0-next.28) (2022-12-16)

## [5.0.0-next.27](https://github.com/simple-html/simple-html/compare/v5.0.0-next.26...v5.0.0-next.27) (2022-12-16)

## [5.0.0-next.26](https://github.com/simple-html/simple-html/compare/v5.0.0-next.25...v5.0.0-next.26) (2022-12-16)

## [5.0.0-next.25](https://github.com/simple-html/simple-html/compare/v5.0.0-next.24...v5.0.0-next.25) (2022-12-16)

## [5.0.0-next.24](https://github.com/simple-html/simple-html/compare/v5.0.0-next.23...v5.0.0-next.24) (2022-12-16)

## [5.0.0-next.23](https://github.com/simple-html/simple-html/compare/v5.0.0-next.22...v5.0.0-next.23) (2022-12-16)

## [5.0.0-next.22](https://github.com/simple-html/simple-html/compare/v5.0.0-next.21...v5.0.0-next.22) (2022-12-15)

## [5.0.0-next.21](https://github.com/simple-html/simple-html/compare/v5.0.0-next.20...v5.0.0-next.21) (2022-12-15)

## [5.0.0-next.20](https://github.com/simple-html/simple-html/compare/v5.0.0-next.19...v5.0.0-next.20) (2022-12-15)

## [5.0.0-next.19](https://github.com/simple-html/simple-html/compare/v5.0.0-next.18...v5.0.0-next.19) (2022-12-15)

## [5.0.0-next.18](https://github.com/simple-html/simple-html/compare/v5.0.0-next.17...v5.0.0-next.18) (2022-12-14)

## [5.0.0-next.17](https://github.com/simple-html/simple-html/compare/v5.0.0-next.16...v5.0.0-next.17) (2022-12-14)

## [5.0.0-next.16](https://github.com/simple-html/simple-html/compare/v5.0.0-next.15...v5.0.0-next.16) (2022-12-13)

## [5.0.0-next.15](https://github.com/simple-html/simple-html/compare/v5.0.0-next.14...v5.0.0-next.15) (2022-12-13)

## [5.0.0-next.14](https://github.com/simple-html/simple-html/compare/v5.0.0-next.13...v5.0.0-next.14) (2022-12-13)

## [5.0.0-next.13](https://github.com/simple-html/simple-html/compare/v5.0.0-next.12...v5.0.0-next.13) (2022-12-13)

## [5.0.0-next.12](https://github.com/simple-html/simple-html/compare/v5.0.0-next.11...v5.0.0-next.12) (2022-12-12)

## [5.0.0-next.11](https://github.com/simple-html/simple-html/compare/v5.0.0-next.10...v5.0.0-next.11) (2022-12-12)

## [5.0.0-next.10](https://github.com/simple-html/simple-html/compare/v5.0.0-next.9...v5.0.0-next.10) (2022-12-12)

## [5.0.0-next.9](https://github.com/simple-html/simple-html/compare/v5.0.0-next.8...v5.0.0-next.9) (2022-12-12)

## [5.0.0-next.8](https://github.com/simple-html/simple-html/compare/v5.0.0-next.7...v5.0.0-next.8) (2022-12-12)

## [5.0.0-next.7](https://github.com/simple-html/simple-html/compare/v5.0.0-next.6...v5.0.0-next.7) (2022-12-12)

## [5.0.0-next.6](https://github.com/simple-html/simple-html/compare/v5.0.0-next.5...v5.0.0-next.6) (2022-12-12)

## [5.0.0-next.5](https://github.com/simple-html/simple-html/compare/v5.0.0-next.4...v5.0.0-next.5) (2022-12-12)

## [5.0.0-next.4](https://github.com/simple-html/simple-html/compare/v5.0.0-next.3...v5.0.0-next.4) (2022-12-12)

## [5.0.0-next.3](https://github.com/simple-html/simple-html/compare/v5.0.0-next.2...v5.0.0-next.3) (2022-12-12)

## [5.0.0-next.2](https://github.com/simple-html/simple-html/compare/v5.0.0-next.1...v5.0.0-next.2) (2022-12-11)

## [5.0.0-next.1](https://github.com/simple-html/simple-html/compare/v4.0.1...v5.0.0-next.1) (2022-12-11)
