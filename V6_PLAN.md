# v6 plan

v6 may break the API. This is the list of what to change, in the order it makes sense to do it.
Each item says why, and how big it is: **S** an afternoon, **M** a few days, **L** a week or more.

Bugs still open from the v5 review are in `IMPORVEMENT.md` under *Candidates*. Most of them
disappear with the items below, the rest get fixed along the way.

## Documentation - part of every item, not a phase at the end

An item is only done when its docs are.

### One site: the demo grows into the docs

typedoc's html is a generic reference: no live grids, nothing that shows what an option looks
like, and a second look and feel next to the demo. The demo already has what a docs site needs -
a sidebar, live samples, a code panel, a highlighter - and it is already published to gh-pages on
every push. So the docs become the demo app, with three kinds of pages in the sidebar:

- **Guides** - markdown files in the repo, rendered into the shell.
  A fenced block like ```` ```sample filtering ```` renders that live sample in the page: the
  running grid plus its source. Plain ```` ```ts ```` blocks are just highlighted code.
- **Samples** - what the demo is today, one per feature (about 20). They show the sample's real
  source file, not the hand copied `code` string they have now. That string sits next to a
  separate `run()` and the two can drift apart. esbuild's text loader can import the file itself.
- **API** - generated, not hand written, so it can not drift from the code. typedoc stays, but
  only as the parser: `typedoc --json` gives every export with its signature and JSDoc, and our
  own pages render that in the same shell. That means the `@example` blocks get the same
  highlighting, and each symbol can link to its samples and guide sections, e.g. a `@sample
  filtering` tag rendered as "see it running".

Tasks:

- [x] Site build: markdown guides + `sample` blocks + API pages from typedoc's json, in the demo
      shell, published by the existing gh-pages workflow. A small markdown library (`marked` or
      similar) as a devDependency, not a hand written parser. **M**
- [x] Samples show their real source file. **S**
- [x] **JSDoc on every public export**, with an `@example` on everything a user calls. **S per item**
- [x] **Docs checked in CI**, so they can not rot:
  - typedoc validation as an error: every public export documented, no broken `{@link}`s
    (it already runs with 0 errors and 0 warnings - keep it that way)
  - every `@example` and every guide ```` ```ts ```` block is pulled out into a file and
    typechecked against the real API. A breaking change then fails the docs build instead of
    leaving a wrong example behind.

  **S-M**
- [x] **Guides**, written as each area lands: **M in total** - 11 written after phase 2; texts,
      theming and keyboard/accessibility (12-14) with phase 3. Later phases add to them
  - getting started - install, css, first grid
  - config reference - every option, its default, and a sample showing it
  - datasource - data, editing, change tracking, keys
  - filtering - the filter format, every operator, header filter vs filter editor vs value list
  - formatting - dates, numbers, custom formatters
  - events - every event and its payload, generated from the typed event map (see 13)
  - theming - table of every CSS variable, dark theme
  - keyboard - every shortcut
  - texts / translation, and accessibility
- [ ] **Migration guide v5 -> v6** - every breaking change with before/after code. Collected while
      working, not reconstructed at the end. **S per item**
- [x] README rewritten around the v6 API and pointing to the site, CHANGELOG entry per change. **S**

## Phase 0 - foundations, they make everything after this safer

1. [x] **`strict: true`** (today `strictNullChecks: false`). Most bugs the review found were
       null/undefined slips: an undefined operator in the footer, a column without `rows`,
       `!__KEY` throwing away a key of 0. Turn it on folder by folder. **L**
2. [x] **Separate public from internal.** Around 15 `__` methods are public on `GridInterface` and
       `Datasource` (`__parseConfig`, `__getGridConfig`, `__callSubscribers`, `__select` ...), and
       `Grid`, `HTMLCellElement`, `EntityHandler`, `DataContainer` and lit-html's `html`/`render`
       are exported. Mark internals `@internal` + `stripInternal` (or move them off the classes),
       export only what users need. Shrinks what has to be documented and kept stable. **M**
3. [x] **Package**: an `exports` map (esm, types, `./grid.css`, `./date.css`); stop shipping
       `src/**/__tests__`; decide git-branch install (needs `dist` committed or a `prepare`
       script) vs the tgz. **S**
4. [x] **One rename pass**, so users fix names once:
       `Formater` -> `Formatter`, `setLocalCompare` -> `setLocaleCompare`,
       `placeHolderRowCurrentEnityOnly`, `deSelectAll` -> `deselectAll`, the
       `resetSort`/`sortReset` pair. Event names are renamed with the event redesign (13).
       (`selectSizeHeight` turned out to be right: it is the height of the column selector row.) **S-M**

## Phase 1 - datasource

5. [x] **A schema on the datasource** - the biggest design win. Today types live in three places
       that can disagree: the grid's `attributes[].type`, `datasource.setDates([...])` for
       sorting, and `attributeType` on every filter condition. Give the datasource the field list
       (`new Datasource({ key: 'id', fields: { born: { type: 'date' }, age: { type: 'number' } } })`)
       and let sorting, grouping, filtering, formatting and the grid all read it. **L**
6. [x] **`date` and `datetime` as separate types**, replacing the `includesTime` flag added in v5.
       A date only field filters on the day, a datetime keeps the time. Comes with 5. **S**
7. [x] **Formatters per field.** Today there is one `ValueFormater` per datasource that switches on
       type (and on attribute name for anything custom), on top of static formatter classes with
       six methods (`fromSource`, `toSource`, `toFilter`, `fromSourceDisplay`,
       `fromSourceGrouping`, `placeholder`). v6: a field takes a formatter object
       (`format`, `parse`, maybe `placeholder`); the built-ins become configurable objects, not
       static classes. Its parameters should say what the grid passes: an optional type, and no
       attribute for a new filter editor condition - 5 `!` in the grid exist only for that. **M-L**
8. [x] **One filter format.** `FilterArgument` mixes groups and conditions (`type`,
       `logicalOperator: 'NONE'` on conditions, `valueType`, `attributeType`). Use the shape
       `getFilterTree()` already returns - `{ group: 'AND' | 'OR', children }` or
       `{ field, operator, value }` - as the input format too, with small builders
       (`and(...)`, `or(...)`, `eq('name', 'x')`). The type comes from the schema. **M**
9. [x] **Group rows are not entities.** `getRows()` returns group headers and data rows in one list,
       and group headers are fake entities (`__group`, `__groupID` ...). That caused a whole class
       of bugs: selecting headers, pasting onto them. Return display rows as
       `{ kind: 'group' | 'data' }`, keep the user's objects clean, and keep the edit tracking
       metadata (`__KEY`, `__rowState`, `__controller`) off them or namespaced in one place. **L**
10. [x] **Decide: is 0 blank?** Today it is for numbers: IS_BLANK matches 0, the value list puts 0
        under "Blank", `BLANK_TO_ZERO` exists. That is consistent, but surprising outside
        ERP style data. Keep it and document it, or separate 0 from blank. **decision, then S-M**
11. [x] **Change tracking**: `getChanges()` still lists fields edited back to their original value,
        and a time only change on a date is not an edit. Give `getChanges()` a typed result. **S**
12. [x] **Options objects instead of boolean flags**: `setData(data, add, reRunFilter)`,
        `removeData(data, all, rerunFilters)`, `markForDeletion(data, all)`,
        `deSelectAll(triggerEvent)`, `sort(args, add)`. Call sites then explain themselves. **S**
13. [x] **Typed events**: today one listener receives every event and switches on a string name,
        payloads are untyped, names mix `collection-filtered` with `selectionChange`, and
        `Datasource`/`GridInterface` each have their own copy of the listener code. v6: one event
        map type, `on('filter', fn)` returning an unsubscribe function, one naming style. The
        events guide is generated from the map. Also removes a trap found in phase 0: a listener is
        only kept if it returns something truthy, one that returns nothing is dropped after the
        first event. **M**
14. [x] `getFilterString(ctx?: Grid)` / `getFilterTree(ctx?: Grid)` - the datasource should not
        know the grid. With the schema (5) the labels come from the fields. **S, after 5**

### Phase 1 design

Decided before coding, so the steps fit together. Names may still change in review.

**Schema (5, 6, 14)** - the datasource knows its fields:

```ts
type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

interface FieldConfig {
    type?: FieldType;      // default 'text'
    label?: string;        // default: the field name. The grid's column label falls back to it
    formatter?: Formatter; // default: the datasource's formatter for the type
}

new Datasource({
    key?: string,                                        // was new DataContainer('id')
    fields?: Record<string, FieldType | FieldConfig>,    // { born: 'date', age: { type: 'number', label: 'Age' } }
    formatters?: Partial<Record<FieldType, Formatter>>,  // the default per type
    selectionMode?: SelectionMode,
    container?: DataContainer                            // share data between datasources
});
```

- the grid's `Attribute.type` is removed, the grid reads the type from the datasource. Sorting,
  grouping, filtering and edit tracking read it too, so `setDates()` and the `includesTime` flag
  go away.
- `date` compares on the day (filter, sort, edit tracking), `datetime` on the full timestamp
- `dynamicCellTypeColumn` stays: the grid resolves the type per row and asks for that type's
  formatter, `datasource.getFormatter(field, type?)`
- `getFilterString()` / `getFilterTree()` take no grid any more, labels come from the fields

**Formatters (7)** - one small interface, per field:

```ts
interface Formatter {
    format(value: unknown): string;     // value -> text: cells, group headers, value list, filter string
    parse(text: string): unknown;       // typed text -> value to store. Blank -> null
    parseFilter?(text: string): unknown; // typed filter text -> value to filter on. Default: parse
    placeholder?: string;
}
```

- the built-ins keep their names (`DateFormatterYYYYMMDD` ...) but become plain objects with these
  methods. Defaults: text, `NumberFormatterDot`, `DateFormatterYYYYMMDD`,
  `DateFormatterYYYYMMDDTHHMMSS`, boolean.
- `ValueFormatter`, `setValueFormatter()`, `setDateFormatter()`, `setNumberFormatter()` and their
  getters are removed - a custom formatter goes on the field, a different default in `formatters`
- booleans are not formatted for the checkbox, the grid uses the raw value

**Filter format (8)**:

```ts
type FilterExpression = FilterGroup | FilterCondition;
interface FilterGroup { group: 'AND' | 'OR'; children: FilterExpression[] }
interface FilterCondition { field: string; operator: FilterOperator; value?: unknown; valueField?: string }

datasource.filter(and(where('age', 'GREATER_THAN', 18), or(where('a', 'EQUAL', 'x'), where('a', 'EQUAL', 'y'))));
```

- `valueField` compares to another field (was `valueType: 'ATTRIBUTE'`). No `type`,
  `logicalOperator: 'NONE'`, `attributeType` - the type comes from the schema.
- operator names stay as they are
- incomplete conditions (the filter editor's drafts) are still ignored at runtime
- `getFilterTree()` keeps returning the display tree (labels, formatted values) for the footer

**Group rows (9)** - their own type, not entities:

- `GroupRow` with the `__group*` fields; `Entity` loses them (keeps `__groupLvl`, data rows use it
  for indentation)
- `getRows()` returns `(Entity | GroupRow)[]`, `getRows(true)` `Entity[]`; `isGroupRow(row)`
- selection and editing only ever take entities

**Change tracking (11)**: `getChanges()` gets a typed result, leaves out props edited back to
their original value, and tracks a time change on a `datetime` field.

**Options objects (12)**: no positional booleans. `setData(rows, { add, refilter })`,
`sort(args, { add })`, `group(groups, { add })`, `select(row, { notify })`,
`deselectAll({ notify })`, `addNewEmpty(row, { scrollTo })`. The `all` flags become their own
methods: `markAllForDeletion()`, `removeAllData()`.

**Events (13)** - one `Emitter` used by the datasource, grid interface and date interface:

```ts
const off = datasource.on('collection-filtered', (data) => { ... }); // typed payload
off(); // unsubscribe
```

- an event map type per class, so the payload is typed; the events guide is generated from it
- the return value of a handler is ignored (no more "return true to keep listening")
- one naming style, kebab case: `selectionChange` -> `selection-change`,
  `currentEntity` -> `current-entity`, `gridConnected` -> `grid-connected`
- `addEventListener` / `removeEventListener` are removed

**0 is blank (10)**: kept as it is and documented.

**Order of work**: events, group rows, schema + formatters, filter format, change tracking +
options objects. Each step updates the grid, the samples (they are the docs), the tests, JSDoc
with `@example` on new public API, and `MIGRATION.md`.

## Phase 2 - grid interface and config

15. [x] **Config and state apart.** `GridConfig` mixes layout (columns, sizes), column metadata,
        runtime state (`sorting`, `grouping`, `filter`, `expandedGroups`, and `currentFilterValue`
        inside each attribute) and internals (`__attributes`, `__rowHeight` ...). v6: the config is
        what you write. `getState()`/`setState()` cover what the user changes - sort, group,
        filter, expanded groups, column order and widths, header filter text - and replace
        `saveConfig`/`loadConfig`/`loadInitConfig`/`updateInitConfig`. **M**
16. [x] **Columns declared once.** A column is named in `columnsCenter[].rows` *and* in
        `attributes`. Any column missing from `attributes` is created implicitly in
        `__attributes`, and that split caused the v5 bug where header text survived for unlisted
        columns. One keyed list of columns, with the layout referencing the keys. **M**
17. [x] **Setup in one call.** The README needs `createElement` + style + class +
        `connectInterface`. v6: `createGrid(container, { config, datasource })`, or the element
        with a property; the grid sets its own class. Drop the `enableCleanup` test flag. **S**
18. [x] **Callbacks in the config**: `readonlySetter` / `cellAppendClassSetter` become
        `isReadonly(row, field)` / `cellClass(row, field)` in the config, or per column. **S**
19. [x] **Menus as data.** Row and header menu entries as a list - built-in ones plus custom
        ones - instead of `contextMenuCustom` / `setContextMenuElement`. Users can then hide,
        reorder or add entries. **M**
20. [x] **Audit the rest of the public methods**: `autoResizeColumns`, `triggerRebuild`,
        `triggerScrollEvent`, `getAttributeColumns(filterSelectedColumns)`,
        `getOptionalAttributes`, `openFilterEditor` - keep and document, rename, or make
        internal. **S**

### Phase 2 design

**Columns and layout (16)** - a column's options are declared once, keyed by field, and the
layout only references the keys:

```ts
const config: GridConfig = {
    columns: {
        // options per field; a field in the layout without an entry gets the defaults
        name: { label: 'Name', placeholderFilter: 'search', mandatory: true },
        age: { readonly: true }
    },
    layout: {
        left: [{ fields: ['name'], width: 150 }],     // pinned left
        center: [{ fields: ['age', 'born'], width: 100 }], // two fields stacked in one column
        right: []                                      // pinned right
    },
    cellHeight: 22,
    ...
};
```

- `Attribute` becomes `ColumnConfig` (no `attribute` field, the key is the field), `attributes`
  and `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight` are gone, so is `__attributes`
- the type and default label come from the datasource `fields` (phase 1)

**Config and state (15)** - the config is what you write; the state is what the user changes:

```ts
interface GridState {
    layout: GridLayout;              // column order, pinning and widths
    sorting: SortArgument[];
    grouping: GroupArgument[];
    expandedGroups: string[];
    filter: FilterExpression | null;
    headerFilters: Record<string, { value: unknown; operator?: FilterOperator }>;
}

grid.getState(); grid.setState(state); grid.resetState(); // back to the config's start state
```

- `saveConfig` / `loadConfig` / `loadInitConfig` / `updateInitConfig` are replaced
- `GridConfig.initialState?: Partial<GridState>` for a grid that starts sorted, grouped or filtered
- `currentFilterValue` moves out of the column config into `headerFilters`

**Setup in one call (17)**: `createGrid(host, { config, datasource })` creates the element,
sizes it, connects it and returns the grid interface. The `simple-html-grid` element stays for
people who want to place it themselves. `enableCleanup` is dropped.

**Callbacks in the config (18)**: `isReadonly(row, field, readonlyByConfig)` and
`cellClass(row, field)` in `GridConfig` replace `readonlySetter` / `cellAppendClassSetter`.

**Menus as data (19)**: `menus?: { row?, header?, filter? }`, each a function that gets the
default entries and returns the entries to show - hide, reorder, or add
`{ label, action(context), visible?(context) }`. `contextMenuCustom` / `setContextMenuElement`
are replaced by `openMenu(event, entries)`.

**Public methods (20)**: no positional booleans (as in phase 1). `triggerScrollEvent()` ->
`refresh()` (re-render visible cells), `triggerRebuild()` -> `rebuild()`. Everything else is kept
and documented, renamed, or made internal - each decision listed in `MIGRATION.md`.

**Order of work**: columns + layout + state (15, 16), then setup + callbacks + methods (17, 18,
20), then menus (19). Then the docs site.

## Phase 2b - save workflow, validation, config as JSON (from review)

Asked for after phase 2, done before phase 3: they change the API, so they go in before more is
built on it.

43. [x] **Formatters registered by id**: `registerFormatter('dateNO', formatter)`, and a field
        refers to it by id - `fields: { born: { type: 'date', formatter: 'dateNO' } }`, defaults per
        type too (`formatters: { date: 'dateNO' }`). The built-ins are registered under ids. A
        config with functions in it can not be stored in a backend; with ids it is plain JSON. **M**
44. [x] **The grid config is plain JSON**: the functions in `GridConfig` (`isReadonly`,
        `cellClass`, `menus`) move to a separate `hooks` object -
        `createGrid(host, { config, datasource, hooks })`, `updateHooks()`. The config and the state
        can then be saved and loaded as JSON; a test checks the JSON round trip of both. **S-M**
45. [x] **Delete is a tag by default**: deleting rows marks them (`markForDeletion`), so it can be
        undone - `restoreRows(rows)` takes the mark off again. The samples and the row menu delete
        this way; `removeData()` stays for rows that never came from the server. **S**
46. [x] **Save workflow**: `getChanges()` already gives deleted, modified and new rows together -
        one transaction on the server. After a successful save, `acceptChanges()` (all, or given
        rows) drops the deleted rows, makes new rows ordinary rows and makes the edited values the
        new originals. A guide shows the whole round trip, including new rows getting their key
        from the server. **S-M**
47. [x] **Validation layer** (was item 31): validators registered by id like formatters
        (`registerValidator`), built-ins `required`, `min`, `max`, `minLength`, `maxLength`,
        `pattern`; rules on the field as JSON (`validate: ['required', { id: 'min', value: 0 }]`).
        `datasource.validate()` returns the errors per row and field; the grid shows them on the
        cell and the row; a save can check first. Replaces the grid's `mandatory` options. **M**

## Phase 3 - UI

21. [x] **Every text replaceable.** Menu labels and headings ("Filter:", "Paste:", "Select All",
        "Run Search" ...) are hardcoded English. Only tooltips can be overridden today
        (`tooltipText`). One `texts` map for all of it, with the tooltips folded in. **M**
22. [x] **Accessibility.** There are 7 aria/role attributes in the whole grid today. Needed:
        `role` grid/row/gridcell/columnheader, `aria-sort`, `aria-selected`,
        `aria-rowcount`/`aria-rowindex` (rows are virtual), visible focus. **M-L**
23. [x] **Menus and the filter editor on the platform**: `<dialog>` / the popover API give the
        top layer, Esc to close and focus handling, instead of appending to `document.body` by
        hand and cleaning up afterwards (where the v5 leaks came from). **M**
24. [x] **Pointer events**: column resize and drag/drop listen to mouse events only. Pointer events
        make them work with touch and pen as well. **S-M**
25. [x] **Theming**: 21 CSS variables, but 17 colors are still hardcoded. Finish the variables,
        document them, ship a dark theme (class and/or `prefers-color-scheme`). Fix the known
        glitches on the way: the resize handle half covered by the filter input, two labels
        stacked on top of each other, paste and clear both called "Cell (selected rows)". **S-M**

## Phase 4 - performance

26. [x] **Scroll handlers**: binary search instead of scanning from row/column 0 on every scroll
        event, one shared code path instead of three near identical left/middle/right blocks,
        remove the dead `largeScroll` branch. Matters for wide grids. **M**

## Phase 5 - editing

27. [ ] **Edited cell marker**: a small corner marker on a cell whose value differs from the
        original (the datasource already tracks this per field). Hovering it shows the original
        value. **S-M**
28. [x] **Undo**: per cell (from the marker or the row menu, restores the original), per row
        (revert row), and an undo/redo history - Ctrl+Z / Ctrl+Y - covering edits, paste and
        clear. **M**
29. [ ] **Row status built in**: the row selector shows the row's state - new, edited, deleted
        (struck through), error (with its message) - with proper icons and theme variables. Plus a
        "changed rows only" filter. **S-M**
30. [ ] **Multiline text**: a field option `multiline`, and automatic for text containing a newline.
        The cell shows the first line with a marker when there is more; editing opens an overlay
        editor anchored at the cell - a bigger textarea, Esc cancels, Ctrl+Enter saves. Rows keep
        a fixed height, virtual scrolling depends on it. **M**
31. [ ] **(moved to item 47)** **Validation in the schema**: `required`, `min`/`max`, `pattern`, a custom
        `validate(value, row)`. The error shows on the cell and in the row status. Replaces the
        grid's `mandatory` options. **M**

## Phase 6 - selection and clipboard

32. [ ] **Cell ranges**: click-drag, shift+click and shift+arrows select a rectangle of cells, across
        columns and pinned sections; Ctrl/Cmd adds another range. **M-L**
33. [ ] **Clipboard like a spreadsheet**: copy a range as tab separated text (pastes into
        Excel/Sheets), paste one into a range (several rows and columns, respecting readonly and
        validation, one undo step), Delete clears a range. **M**
34. [ ] **Fill down** (Ctrl+D) and a drag-fill handle. **M**
35. [ ] **Summary of the selection** in the footer: count, sum, average, min, max. Replaces the row
        menu summary, which has known bugs. **S**

## Phase 7 - live data

36. [ ] **Reactive cells**: setting a property from code (`row.price = 10`) re-renders the visible
        cells on its own, batched per frame - no `triggerScrollEvent()` after edits from code. **S-M**
37. [ ] **Merge by key**: `datasource.upsert(rows, { removeMissing })` updates rows by key, adds new
        ones, keeps selection, scroll position and expanded groups, and runs filter/sort/group
        once. For polling or push updates from a server. **M**
38. [ ] **Show what changed**: a short highlight on cells a merge changed. A merge that hits a cell
        the user is editing, or has edited and not saved, is marked as a conflict instead of
        overwriting it. **M**

Needs phase 4: a merge every second on a large grid has to stay cheap.

## Phase 8 - more

39. [ ] **Custom cell rendering** per column (a lit-html template: badges, links, progress bars,
        icons) and conditional formatting (cell/row classes from a function or simple rules). **M**
40. [ ] **Aggregates**: sum/count/average in each group row, and a totals row in the footer. **M**
41. [ ] **Export** the filtered and sorted rows, or the selected range, as CSV. xlsx later if
        needed. **S**
42. [ ] **Find** (Ctrl+F) in the grid: highlight matches, next/previous. **M**

Every feature gets a demo sample and a guide page.

## Order

**Now:** phase 5 (phase 4 and item 28 are done).

Phase 0 first: strict mode and the public/internal split make every later refactor safer, and
the rename pass means users rename once. Then the datasource schema (5-9), which simplifies
almost everything after it. Then config/state (15-16) and events (13), UI, performance.

The features (phases 5-8) come after, because they build on those: validation and the multiline
type need the schema, reactive cells need the events, ranges and the overlay editor need pointer
events and the popover/dialog work, live data needs the performance work. Editing first (the
most asked for), then selection and clipboard, then live data, then the rest.

Documentation goes along with each item: the migration guide and changelog in every phase, JSDoc
for what the phase adds or changes. The docs *site* is built once the API stops moving, after
phase 2 - building it around names and shapes that phase 1 and 2 replace would be wasted.
