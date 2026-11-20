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

- [ ] Site build: markdown guides + `sample` blocks + API pages from typedoc's json, in the demo
      shell, published by the existing gh-pages workflow. A small markdown library (`marked` or
      similar) as a devDependency, not a hand written parser. **M**
- [ ] Samples show their real source file. **S**
- [ ] **JSDoc on every public export**, with an `@example` on everything a user calls. **S per item**
- [ ] **Docs checked in CI**, so they can not rot:
  - typedoc validation as an error: every public export documented, no broken `{@link}`s
    (it already runs with 0 errors and 0 warnings - keep it that way)
  - every `@example` and every guide ```` ```ts ```` block is pulled out into a file and
    typechecked against the real API. A breaking change then fails the docs build instead of
    leaving a wrong example behind.

  **S-M**
- [ ] **Guides**, written as each area lands: **M in total**
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
- [ ] README rewritten around the v6 API and pointing to the site, CHANGELOG entry per change. **S**

## Phase 0 - foundations, they make everything after this safer

1. [ ] **`strict: true`** (today `strictNullChecks: false`). Most bugs the review found were
       null/undefined slips: an undefined operator in the footer, a column without `rows`,
       `!__KEY` throwing away a key of 0. Turn it on folder by folder. **L**
2. [ ] **Separate public from internal.** Around 15 `__` methods are public on `GridInterface` and
       `Datasource` (`__parseConfig`, `__getGridConfig`, `__callSubscribers`, `__select` ...), and
       `Grid`, `HTMLCellElement`, `EntityHandler`, `DataContainer` and lit-html's `html`/`render`
       are exported. Mark internals `@internal` + `stripInternal` (or move them off the classes),
       export only what users need. Shrinks what has to be documented and kept stable. **M**
3. [ ] **Package**: an `exports` map (esm, types, `./grid.css`, `./date.css`); stop shipping
       `src/**/__tests__`; decide git-branch install (needs `dist` committed or a `prepare`
       script) vs the tgz. **S**
4. [ ] **One rename pass**, so users fix names once:
       `Formater` -> `Formatter`, `setLocalCompare` -> `setLocaleCompare`,
       `placeHolderRowCurrentEnityOnly`, `deSelectAll` -> `deselectAll`, `selectSizeHeight`
       (it is the selector column's *width*), the `resetSort`/`sortReset` pair,
       `select`/`__select`/`setRowAsCurrentEntity`, mixed event names (see 13). **S-M**

## Phase 1 - datasource

5. [ ] **A schema on the datasource** - the biggest design win. Today types live in three places
       that can disagree: the grid's `attributes[].type`, `datasource.setDates([...])` for
       sorting, and `attributeType` on every filter condition. Give the datasource the field list
       (`new Datasource({ key: 'id', fields: { born: { type: 'date' }, age: { type: 'number' } } })`)
       and let sorting, grouping, filtering, formatting and the grid all read it. **L**
6. [ ] **`date` and `datetime` as separate types**, replacing the `includesTime` flag added in v5.
       A date only field filters on the day, a datetime keeps the time. Comes with 5. **S**
7. [ ] **Formatters per field.** Today there is one `ValueFormater` per datasource that switches on
       type (and on attribute name for anything custom), on top of static formatter classes with
       six methods (`fromSource`, `toSource`, `toFilter`, `fromSourceDisplay`,
       `fromSourceGrouping`, `placeholder`). v6: a field takes a formatter object
       (`format`, `parse`, maybe `placeholder`); the built-ins become configurable objects, not
       static classes. **M-L**
8. [ ] **One filter format.** `FilterArgument` mixes groups and conditions (`type`,
       `logicalOperator: 'NONE'` on conditions, `valueType`, `attributeType`). Use the shape
       `getFilterTree()` already returns - `{ group: 'AND' | 'OR', children }` or
       `{ field, operator, value }` - as the input format too, with small builders
       (`and(...)`, `or(...)`, `eq('name', 'x')`). The type comes from the schema. **M**
9. [ ] **Group rows are not entities.** `getRows()` returns group headers and data rows in one list,
       and group headers are fake entities (`__group`, `__groupID` ...). That caused a whole class
       of bugs: selecting headers, pasting onto them. Return display rows as
       `{ kind: 'group' | 'data' }`, keep the user's objects clean, and keep the edit tracking
       metadata (`__KEY`, `__rowState`, `__controller`) off them or namespaced in one place. **L**
10. [ ] **Decide: is 0 blank?** Today it is for numbers: IS_BLANK matches 0, the value list puts 0
        under "Blank", `BLANK_TO_ZERO` exists. That is consistent, but surprising outside
        ERP style data. Keep it and document it, or separate 0 from blank. **decision, then S-M**
11. [ ] **Change tracking**: `getChanges()` still lists fields edited back to their original value,
        and a time only change on a date is not an edit. Give `getChanges()` a typed result. **S**
12. [ ] **Options objects instead of boolean flags**: `setData(data, add, reRunFilter)`,
        `removeData(data, all, rerunFilters)`, `markForDeletion(data, all)`,
        `deSelectAll(triggerEvent)`, `sort(args, add)`. Call sites then explain themselves. **S**
13. [ ] **Typed events**: today one listener receives every event and switches on a string name,
        payloads are untyped, names mix `collection-filtered` with `selectionChange`, and
        `Datasource`/`GridInterface` each have their own copy of the listener code. v6: one event
        map type, `on('filter', fn)` returning an unsubscribe function, one naming style. The
        events guide is generated from the map. **M**
14. [ ] `getFilterString(ctx?: Grid)` / `getFilterTree(ctx?: Grid)` - the datasource should not
        know the grid. With the schema (5) the labels come from the fields. **S, after 5**

## Phase 2 - grid interface and config

15. [ ] **Config and state apart.** `GridConfig` mixes layout (columns, sizes), column metadata,
        runtime state (`sorting`, `grouping`, `filter`, `expandedGroups`, and `currentFilterValue`
        inside each attribute) and internals (`__attributes`, `__rowHeight` ...). v6: the config is
        what you write. `getState()`/`setState()` cover what the user changes - sort, group,
        filter, expanded groups, column order and widths, header filter text - and replace
        `saveConfig`/`loadConfig`/`loadInitConfig`/`updateInitConfig`. **M**
16. [ ] **Columns declared once.** A column is named in `columnsCenter[].rows` *and* in
        `attributes`. Any column missing from `attributes` is created implicitly in
        `__attributes`, and that split caused the v5 bug where header text survived for unlisted
        columns. One keyed list of columns, with the layout referencing the keys. **M**
17. [ ] **Setup in one call.** The README needs `createElement` + style + class +
        `connectInterface`. v6: `createGrid(container, { config, datasource })`, or the element
        with a property; the grid sets its own class. Drop the `enableCleanup` test flag. **S**
18. [ ] **Callbacks in the config**: `readonlySetter` / `cellAppendClassSetter` become
        `isReadonly(row, field)` / `cellClass(row, field)` in the config, or per column. **S**
19. [ ] **Menus as data.** Row and header menu entries as a list - built-in ones plus custom
        ones - instead of `contextMenuCustom` / `setContextMenuElement`. Users can then hide,
        reorder or add entries. **M**
20. [ ] **Audit the rest of the public methods**: `autoResizeColumns`, `triggerRebuild`,
        `triggerScrollEvent`, `getAttributeColumns(filterSelectedColumns)`,
        `getOptionalAttributes`, `openFilterEditor` - keep and document, rename, or make
        internal. **S**

## Phase 3 - UI

21. [ ] **Every text replaceable.** Menu labels and headings ("Filter:", "Paste:", "Select All",
        "Run Search" ...) are hardcoded English. Only tooltips can be overridden today
        (`tooltipText`). One `texts` map for all of it, with the tooltips folded in. **M**
22. [ ] **Accessibility.** There are 7 aria/role attributes in the whole grid today. Needed:
        `role` grid/row/gridcell/columnheader, `aria-sort`, `aria-selected`,
        `aria-rowcount`/`aria-rowindex` (rows are virtual), visible focus. **M-L**
23. [ ] **Menus and the filter editor on the platform**: `<dialog>` / the popover API give the
        top layer, Esc to close and focus handling, instead of appending to `document.body` by
        hand and cleaning up afterwards (where the v5 leaks came from). **M**
24. [ ] **Pointer events**: column resize and drag/drop listen to mouse events only. Pointer events
        make them work with touch and pen as well. **S-M**
25. [ ] **Theming**: 21 CSS variables, but 17 colors are still hardcoded. Finish the variables,
        document them, ship a dark theme (class and/or `prefers-color-scheme`). Fix the known
        glitches on the way: the resize handle half covered by the filter input, two labels
        stacked on top of each other, paste and clear both called "Cell (selected rows)". **S-M**

## Phase 4 - performance

26. [ ] **Scroll handlers**: binary search instead of scanning from row/column 0 on every scroll
        event, one shared code path instead of three near identical left/middle/right blocks,
        remove the dead `largeScroll` branch. Matters for wide grids. **M**

## Order

Phase 0 first: strict mode and the public/internal split make every later refactor safer, and
the rename pass means users rename once. Then the datasource schema (5-9), which simplifies
almost everything after it. Then config/state (15-16) and events (13), UI, performance.
Documentation goes along with each item.
