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
stored in a backend and given back as they are. What is code - formatters and the grid's functions -
is registered or given next to the config.

#### ⚠️ Breaking changes
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

#### Added
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

#### Docs
- **A `Date` in a stored state**: JSON turns it into its ISO text, and `setState()` keeps the text (it
  does not turn it back into a `Date`); `getState()` then gives the text. A `date` or `datetime` field
  reads the text as the same moment - the same rows, the same date in the header filter and
  `getFilterString()`. A field that is not listed as `date` / `datetime` filters on a `Date` as a date
  only while it is a `Date`: after JSON it compares the text and filters other rows. The same goes for
  a `Date` in `initialState`. Pinned by tests, written in the state guide.

#### Internal
- the grid reads the hooks from the interface (`__getHooks()`), not from the parsed config
- tests: `configJson.test.ts` - a config with every option, a `getState()` result and the datasource
  `fields` + `formatters` go through `JSON.parse(JSON.stringify())` unchanged, and a grid made from the
  copy shows the same (state, rows, markup); the Date cases above. `formatterRegistry.test.ts` - the
  built-in ids, registering, replacing, the errors. Hook tests moved to `GridHooks` / `updateHooks()`
  (`cellCallbacks.test.ts`, `gridMenus.test.ts`), plus the `TypeError` for a hook in the config
  (`createGrid.test.ts`, `updateConfig.test.ts`). Tests that register a formatter use an id of their
  own, and the one that replaces a built-in id puts it back in `afterAll`
- typings consumer: `registerFormatter`, formatter ids, hooks, `updateHooks`, typed hook rows,
  `@ts-expect-error` checks that a formatter object in the options and `isReadonly` / `cellClass` /
  `menus` in `GridConfig` no longer compile, and a type-level check that `GridConfig`, `GridState` and
  the `fields` + `formatters` options hold no function anywhere

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
