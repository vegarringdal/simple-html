# Grid config

The `GridConfig` is what you write: which columns go where, the options of each column, and the
options of the grid. What the user changes while working - column order and widths, sorting,
filters - is the [state](03-state.md), not the config.

The config is plain JSON: it has no functions, so it can be stored and loaded, see
[Saving the config](#saving-the-config). The functions of a grid - readonly and css classes from the
row, the menus - are [hooks](#hooks), given next to the config.

The grid does not change the config object you pass in. It keeps its own copy.

## Columns and layout

A config has two parts for the columns:

- `layout` says where the columns go and how wide they are
- `columns` has the options of a column, keyed by the field name

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';

const datasource = new Datasource({ fields: { age: 'number', born: 'date', balance: 'number' } });

const config: GridConfig = {
    columns: {
        name: { label: 'Name', mandatory: true },
        age: { readonly: true },
        phone: { label: 'Phone' } // not in the layout: the user can add it from the column chooser
    },
    layout: {
        left: [{ fields: ['name'], width: 150 }], // pinned left, does not scroll sideways
        center: [
            { fields: ['age', 'born'], width: 100 }, // two fields stacked in one column
            { fields: ['company'], width: 200 }
        ],
        right: [{ fields: ['balance'], width: 100 }] // pinned right
    }
};

const gridInterface = createGrid(host, { config, datasource });
```

```sample column-layout
```

- `layout.center` is required, `left` and `right` can be left out.
- Each entry of a list is one column, from left to right. `width` is in px.
- A column with more than one field shows them stacked, top to bottom. Every column gets as many
  cells as the column with the most fields, a column with fewer fields leaves the rest empty.
- A field in the layout without an entry in `columns` gets the default options. `company` and
  `born` above have none.
- A field in `columns` that is not in the layout is not shown. The column chooser in the header
  menu lists every field the grid knows, and the user can drag one from it into the header.
  `gridInterface.getHiddenFields()` returns these fields (`['phone']` above).

The type of a column comes from the datasource's `fields`, not from the config, see
[Datasource](04-datasource.md#fields-and-types).

### The column label

A column's header shows the first of:

1. its `label` in `columns`
2. the field's `label` in the datasource's `fields`
3. the field name, with the first letter in upper case and `_` as a space: `first_name` shows as
   `First Name`, but `firstName` as `Firstname`. Give such a field a label.

### Column options

Every option of a `ColumnConfig` is optional.

| option | what it does |
| --- | --- |
| `label` | the header text |
| `readonly` | the cell can not be edited, also when the grid can. Shown with stripes |
| `mandatory` | an empty editable cell is shown with stripes, until it has a value |
| `placeholderRow` | text shown in an empty cell, by default on the current row only (`placeholderRowCurrentEntityOnly`) |
| `placeholderFilter` | text shown in the empty header filter. Default: the formatter's placeholder (`YYYY-MM-DD` for dates), else a search icon |
| `operator` | the operator the header filter starts with. Default `EQUAL` for text (the whole text: `ann` does not find `Anna`), see [Filtering](06-filtering.md#header-filters) |
| `numberOverride` | number fields only: `'ZERO_TO_BLANK'` shows 0 as an empty cell, `'BLANK_TO_ZERO'` shows an empty cell as 0. The value is not changed |
| `allowPasteClearOnly` | typing in the cell does nothing, paste and clear from the row menu work. For a field you set from a dropdown of your own |
| `focusButton` | shows a `...` button in the focused cell, see [Events](09-events.md#cell-events) |
| `dynamicCellTypeColumn` | another field of the row holds the type of this cell, see [Formatting](08-formatting.md#the-type-from-another-field) |

`focusButton` takes `'ALWAYS'`, `'SHOW_IF_GRID_NOT_READONLY'` or
`'SHOW_IF_GRID_AND_CELL_NOT_READONLY'`.

```sample mandatory-placeholders
```

## Grid options

Every option is optional.

| option | default | what it does |
| --- | --- | --- |
| `readonly` | `true` | the whole grid is readonly. Set `false` to edit, see [Editing](05-editing.md) |
| `cellHeight` | `22` | height of a cell in px |
| `cellHeaderLabelHeight` | `cellHeight` | height of a header label cell, make it taller for labels that wrap |
| `panelHeight` | `25` | height of the grouping panel above the header |
| `footerHeight` | `45` | height of the footer: the row count and the filter |
| `selectSizeHeight` | `18` | height of the row of column numbers under the header filters (click one to select a column). `0` hides the row |
| `hideLabels` | `false` | hides the row of header labels |
| `hideFilter` | `false` | hides the row of header filters |
| `dimRepeatedValues` | `false` | dims a cell that has the same value as the row above. The row menu can toggle it |
| `placeholderRowCurrentEntityOnly` | `true` | shows `placeholderRow` on the current row only. `false` shows it on every row |
| `autoRemoveContextMenuOnScrollEvent` | `false` | closes the open menu when the grid scrolls |
| `tooltips` | `true` | the built-in tooltips on the buttons of the filter editor |
| `tooltipText` | | your own tooltip texts, keyed by the ids in `TOOLTIPS` |
| `datePickerConfig` | | names of months and days, week start and sizes of the date picker: only the fields to change (`Partial<IDateConfig>`), e.g. `{ weekStart: 0, isoWeek: false }`. The rest are the defaults: English names, weeks from monday with their numbers |
| `initialState` | | the sorting, grouping and filter the grid starts with, see [State](03-state.md#the-state-the-grid-starts-in) |

How rows are selected is not a grid option: the datasource has the selection mode, see
[Datasource](04-datasource.md#the-selection-mode). Readonly cells and css classes from the row, and
changes to the menus, are not options either: they are functions, see [Hooks](#hooks).

```sample misc-options
```

```sample tooltips
```

## Hooks

The hooks are the functions of a grid, the parts of it that can not be written as data. They are a
`GridHooks` object, given next to the config:

| hook | what it does |
| --- | --- |
| `isReadonly` | makes cells readonly, or editable, from their row, [below](#readonly-and-css-classes-from-the-row) |
| `cellClass` | adds css classes to cells from their row, [below](#readonly-and-css-classes-from-the-row) |
| `menus` | changes the right click menus, see [Menus](10-menus.md) |

```ts
import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';

declare const config: GridConfig;

const hooks: GridHooks = {
    menus: { row: (defaults) => defaults.filter((entry) => !entry.id.startsWith('row.summary')) }
};

const gridInterface = createGrid(host, { config, datasource, hooks });
```

Every hook is optional. `new GridInterface(config, datasource, hooks)` takes them too, for an
element you place yourself. A config that has `isReadonly`, `cellClass` or `menus` throws: they are
hooks.

With a typed datasource the hooks get typed rows: `GridHooks<Person>` for a `Datasource<Person>`.

### Readonly and css classes from the row

`isReadonly` and `cellClass` are called for every cell when it is rendered, with the cell's row
and field. Keep them fast.

- `isReadonly(row, field, readonlyByConfig)` returns `true` (readonly) or `false` (editable).
  `null` or `undefined` leaves it to the column's `readonly` option, which is passed in as
  `readonlyByConfig`. A readonly grid (`readonly: true`) stays readonly, whatever it returns.
- `cellClass(row, field)` returns `{ input, background }`: classes for the cell's `<input>` (the
  text) and for the element behind it (the background). Both are optional, `null` adds nothing.

```ts
import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    layout: {
        center: [
            { fields: ['company'], width: 150 },
            { fields: ['balance'], width: 100 },
            { fields: ['isActive'], width: 80 }
        ]
    }
};

// .negative { position: absolute; inset: 0; background: rgba(239, 68, 68, 0.2); }
const hooks: GridHooks = {
    // company can not be edited on an inactive row, the other cells follow the config
    isReadonly: (row, field) => (field === 'company' && row.isActive === false ? true : null),
    cellClass: (row, field) => (field === 'balance' && row.balance < 0 ? { background: 'negative' } : null)
};

const gridInterface = createGrid(host, { config, datasource, hooks });
```

The background element has no size on an editable cell: give its class
`position: absolute; inset: 0`, as above.

The row is always a data row, a group row has no cells. When what the hooks read changes, call
`gridInterface.refresh()` to render the cells again.

```sample cell-styling
```

### Changing the hooks: `updateHooks()`

`updateHooks()` changes the hooks while the grid is shown:

```ts
gridInterface.updateHooks({ cellClass: (row, field) => (field === 'balance' && row.balance < 0 ? { input: 'red' } : null) });
gridInterface.updateHooks({ isReadonly: undefined }); // removed: the column's readonly decides again
gridInterface.updateHooks({ menus: undefined }); // the menus show their defaults
```

- Only the keys you pass change, the other hooks stay. A key passed as `undefined` removes that
  hook.
- The visible cells are rendered again once. A menu uses its new function the next time it opens.

## Changing options: `updateConfig()`

`updateConfig()` changes options while the grid is shown and builds the grid again once:

```ts
gridInterface.updateConfig({ readonly: false });
gridInterface.updateConfig({ hideFilter: true, cellHeight: 30 });
gridInterface.updateConfig({ tooltips: undefined }); // back to the default
```

- Only the keys you pass change. A key passed as `undefined` goes back to its default:
  `updateConfig({ readonly: undefined })` makes the grid readonly again.
- `columns` replaces the options of every column, nothing is merged. A field you leave out gets
  the defaults.
- `layout` is shown at once and replaces the column order, pinning and widths the user made. It is
  also the layout `resetState()` goes back to from then on. `layout: undefined` is ignored.
- `initialState` changes nothing now, it is what the next `resetState()` goes back to.
- The sorting, grouping, filter and header filters stay as they are, and so do the handlers you
  subscribed with `on()` and the hooks. Change a hook with [`updateHooks()`](#changing-the-hooks-updatehooks).

## Saving the config

The config, the datasource's fields and formatters, and the [state](03-state.md) are plain JSON.
They can be stored - in a backend, say - and given back as they are. What is code stays in the
app: the hooks, and the formatters of your own, registered by id with `registerFormatter()` (see
[Formatting](08-formatting.md#a-formatter-of-your-own)).

```ts
import {
    createGrid,
    Datasource,
    type DatasourceOptions,
    type GridConfig,
    type GridHooks,
    type GridState,
    NumberFormatterDot,
    registerFormatter
} from '@simple-html/grid';

// what is stored, as JSON
interface SavedGrid {
    config: GridConfig;
    datasource: Pick<DatasourceOptions, 'key' | 'fields' | 'formatters' | 'selectionMode'>;
    state: GridState | null;
}

// code: the formatters the stored fields name, registered before the datasource is made
registerFormatter('money', {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? value.toFixed(2) : '')
});

// code: the hooks
const hooks: GridHooks = {
    isReadonly: (row, field) => (field === 'balance' && row.locked === true ? true : null)
};

// e.g. { "config": { "layout": ... }, "datasource": { "fields": { "balance": { "formatter": "money" ... } } } ... }
const saved: SavedGrid = await (await fetch('/api/grids/accounts')).json();

const datasource = new Datasource(saved.datasource);
const gridInterface = createGrid(host, { config: saved.config, datasource, hooks });
if (saved.state) {
    gridInterface.setState(saved.state);
}

// later: store what the user changed
const body: SavedGrid = { ...saved, state: gridInterface.getState() };
await fetch('/api/grids/accounts', { method: 'PUT', body: JSON.stringify(body) });
```

- A formatter id that is not registered throws when the datasource is made, with the ids that are.
- `container` is the one datasource option that is not data: a `DataContainer` is made in code.
- A `Date` does not come back from JSON as a `Date`, but as its ISO text: a `Date` in a filter of
  the state, or of `initialState`. See [Dates in a saved state](03-state.md#dates-in-a-saved-state) for what the grid does
  with it.

## Rendering again

The grid renders again by itself when the datasource changes: new data, sorting, filtering,
selection. When something changes that it can not see, tell it:

- `gridInterface.refresh()` renders the visible cells again. Call it after you set a value on a row
  from code, or when what the `isReadonly` / `cellClass` hooks read has changed. It is cheap.
- `gridInterface.rebuild()` builds the whole grid again: sizes, header, rows, footer. Call it when a
  formatter shows values differently now, or after you changed the size of the grid's container
  without a resize event.
- `gridInterface.autoResizeColumns()` sizes every column to its content (at most 750px) and
  rebuilds. It measures with the grid's font, so call it once the grid is on the page.

```ts
const row = datasource.getDataRows()[0];
row.company = 'NEW NAME';
gridInterface.refresh();
```

## The fields in the layout

`getLayoutFields()` lists the fields in the layout now, in the order the user sees them: pinned
left, center, pinned right. With `{ selectedOnly: true }` it lists only the fields of the columns
the user selected by clicking the column numbers under the header filters (ctrl+click for more).
It is `[]` when none is selected.

```ts
const selected = gridInterface.getLayoutFields({ selectedOnly: true });
const fieldsToExport = selected.length ? selected : gridInterface.getLayoutFields();
```

## Done with a grid: `destroy()`

`gridInterface.destroy()` removes the grid's element from the page and disconnects the grid: from
the datasource, the document and the handlers subscribed with `on()`. The datasource is not
changed. Do not use the interface after it, make a new one with `createGrid()`.
