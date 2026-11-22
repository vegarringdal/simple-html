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

// a value the user has to fill in is a rule of the field: required
const datasource = new Datasource({ fields: { name: { validate: ['required'] }, age: 'number', born: 'date', balance: 'number' } });

const config: GridConfig = {
    columns: {
        name: { label: 'Name' },
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
[Datasource](04-datasource.md#fields-and-types). So do the validation rules: a field the user has to
fill in has the `required` rule, which also shows its empty cells with stripes - see
[Validation](05-editing.md#validation). The `mandatory` column option of v5 is gone.

### Moving and resizing columns

The user changes the layout in the header, with a mouse, a pen or a finger:

- **Move**: drag a label. While it is dragged the header shows where it can go: the left or right
  edge of a label makes the field a column of its own on that side, the top or bottom edge stacks it
  in that column, the middle swaps the two fields. Dropped on the panel above the header, the rows
  are grouped on it, see [Grouping](07-sorting-grouping.md#grouping). Dragged past the left or right
  side of the grid, the columns scroll.
- **Resize**: drag the edge of a column's header - the right edge, the left one for a column pinned
  right. A column is at least 25px wide. A double click on the edge fits the column to its content,
  as in Excel: see [Column widths and row heights](#column-widths-and-row-heights).
- **Sort**: click a label, see [Sorting](07-sorting-grouping.md#sorting).

A press on a label is a click until it is a drag: with a mouse or a pen once it has moved 5px, with a
finger once it has been held still for 200ms. A finger that moves sooner scrolls the grid, as a swipe
on the rows does. A finger still held at 500ms is a long press: the header menu opens, the drag ends
and nothing moves. Only the left mouse button, the first finger or the pen's tip drag and resize. The
column chooser's list scrolls with a finger, a field held still for 200ms is dragged out of it, see
[Touch](01-getting-started.md#touch).

What the user makes of the layout is part of the grid's [state](03-state.md): `getState().layout`.

### Column widths and row heights

Like Excel's AutoFit, a column can be made as wide as its content, and a row as high as its
[multiline](05-editing.md#multiline-text) cells need - and both go back to their size:

```ts
gridInterface.fitColumns(); // every column
gridInterface.fitColumns(['company', 'notes']); // the columns of these fields
gridInterface.resetColumnWidths(); // the widths of the config again

gridInterface.fitRows(); // every row as high as its multiline cells need
gridInterface.fitRows(datasource.getSelectedRows());
gridInterface.resetRowHeights(); // every row one line again
```

| method | what it does |
| --- | --- |
| `fitColumns(fields?, { rows? })` | each column as wide as the widest text of its fields - every line of a multiline text, the widest field of a column with stacked fields - and its header label. 25px to 750px. Without fields: every column |
| `fitColumns([field], { rows: [row] })` | the column as wide as the text of these rows' cells, the label left out: a column fitted to a cell |
| `resetColumnWidths(fields?)` | the width the column has in the layout `resetState()` goes back to (`initialState.layout`, else the config's `layout`). A column added from the column chooser: 100px |
| `fitRows(rows?)` | each row as many lines high as its tallest column needs: a multiline cell the lines of its text, every other cell a line, stacked fields added up. At most 20 lines. The lines of the layout's row are `cellHeight` each, every line more `multilineLineHeight` (a line of text). Without rows: every row the filter lets through |
| `resetRowHeights(rows?)` | the rows back to the height of the layout. Without rows: every row |

The user does the same with the mouse:

- **The header menu** (right click a label), "Size ›": Fit column width, Fit all columns, Reset column
  width, Reset all column widths.
- **The row menu** (right click a cell), "Size ›": Fit column to this cell, Fit row height, Fit row
  height (selected rows) - the selected rows and the rows of the [ranges of cells](17-selection-and-clipboard.md) -
  Fit all rows, Reset row height, Reset all row heights.
- **A double click on the edge** of a column's header fits that column.

What to know:

- **The text measured** is what the cells show: formatted, with `numberOverride`. It is measured
  with the grid's font on a canvas - for each field the 20 longest texts by their number of
  characters, as measuring every text of 100 000 rows takes the browser half a second per field.
  Fitting every column of a grid of 100 000 rows and 10 columns takes about 0.2s, the rebuild
  included. A column with nothing to measure keeps its width.
- **The widths** are part of the [state](03-state.md), `getState().layout`, as a resize with the mouse.
- **A row's height** is a number of lines. Fitting counts the line breaks of the cells' text, nothing
  is measured: about 0.1s for every row of 100 000. A long line is not wrapped, it is cut at the
  edge of the cell as in a row of one line.
- **A line of text** after the first is `multilineLineHeight` px (15), not a whole `cellHeight`: the
  first line of a cell is its input, `cellHeight` high, the lines under it read as a paragraph. A note
  of three lines makes a row of 22 + 15 + 15 = 52px. With a larger font make both larger, e.g.
  `cellHeight: 28, multilineLineHeight: 18` for `--simple-html-grid-font-size: 13px`.
- **In a taller row** a multiline cell shows as many lines as it has room for, under its first line,
  and its marker when some are not shown. Every other cell has its text on the first line. Editing
  is the same: Enter, F2 or a double click opens the editor over the cell.
- **The heights are kept by the row's key** (`DatasourceOptions.key`, or the key the datasource
  generates without one), so they follow a row through a sort, a filter, grouping and new data with
  the same keys. A row keeps its height when its text changes: fit it again. A full `fitRows()` drops
  the heights of rows that are no longer in the data.
- **The heights are not part of the state**: they belong to the rows loaded now, and a saved state is
  given to other rows. `resetState()` does not change them.

The [Multiline text](#sample/multiline) sample has buttons for each, and the menus.

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
| `placeholderRow` | text shown in an empty cell, by default on the current row only (`placeholderRowCurrentEntityOnly`) |
| `placeholderFilter` | text shown in the empty header filter. Default: the formatter's placeholder (`YYYY-MM-DD` for dates), else the field's type - `Text` or `Number` (texts `filter.placeholder.*`) |
| `operator` | the operator the header filter starts with. Default `EQUAL` for text (the whole text: `ann` does not find `Anna`), `GREATER_THAN_OR_EQUAL_TO` for a number or date. One of the column's operators the header filter's input takes - not `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK` - else a `TypeError`. See [Filtering](06-filtering.md#header-filters) |
| `filterOperators` | the operators the column offers in the header filter's menu and the filter editor, e.g. `['CONTAINS', 'BEGIN_WITH', 'IS_BLANK']`: some of its type's (`operatorsFor(type)`), with one the header filter takes. Default: all of its type's. A `TypeError` for an operator of another type. See [Filtering](06-filtering.md#the-operators-a-column-offers) |
| `filterCaseSensitive` | `true`: the grid's conditions on the column match case - the header filter, its value list, the row menu's filter and the filter editor. Its Match case is on and can not be turned off. Text columns only, else a `TypeError`. See [Filtering](06-filtering.md#match-case) |
| `numberOverride` | number fields only: `'ZERO_TO_BLANK'` shows 0 as an empty cell, `'BLANK_TO_ZERO'` shows an empty cell as 0. The value is not changed |
| `format` | how the cells show the value, a display format: `{ date: 'norwegian' }` (22.11.2026), `{ date: 'weekIso' }` (2026-W47) for a date or datetime field, `{ number: { decimals: 2, thousands: ' ', decimal: ',' } }` (1 234 567,89) for a number field. Only the text shown: editing, filtering, sorting and copy keep to the field's formatter. Where the grid starts - the user picks another in the header menu (Format ›), it is state (`GridState.formats`). A `TypeError` for a format that does not fit the field. See [Display formats](08-formatting.md#display-formats) |
| `allowPasteClearOnly` | typing in the cell does nothing, paste and clear from the row menu work. For a field you set from a dropdown of your own |
| `editor` | the value is picked from a list: `{ type: 'select' \| 'grid', lookup: '<id>', set? }`, a select or a dropdown grid of a lookup registered with `registerLookup()`. The cell shows the label. See [Lookups](20-lookups.md) |
| `focusButton` | shows a `...` button in the focused cell, see [Events](09-events.md#cell-events). Not with `editor`, it has its own button |
| `dynamicCellTypeColumn` | another field of the row holds the type of this cell, see [Formatting](08-formatting.md#the-type-from-another-field) |
| `aggregate` | sums the column up in the group rows and the totals row: `'sum'`, `'avg'`, `'min'`, `'max'` (number fields) or `'count'`. See [Aggregates](18-aggregates.md) |

`focusButton` takes `'ALWAYS'`, `'SHOW_IF_GRID_NOT_READONLY'` or
`'SHOW_IF_GRID_AND_CELL_NOT_READONLY'`.

```sample required-placeholders
```

## Grid options

Every option is optional.

| option | default | what it does |
| --- | --- | --- |
| `readonly` | `true` | the whole grid is readonly. Set `false` to edit, see [Editing](05-editing.md) |
| `cellHeight` | `22` | height of a cell in px |
| `multilineLineHeight` | `15` | the height in px of a line of text after the first in a multiline cell of a row made taller (`fitRows()`), and in its editor. A whole number of 1 or more, see [Column widths and row heights](#column-widths-and-row-heights) |
| `cellHeaderLabelHeight` | `cellHeight` | height of a header label cell, make it taller for labels that wrap |
| `panelHeight` | `25` | height of the grouping panel above the header |
| `footerHeight` | `45` | height of the footer: the row count and the filter, or the button "No filter" without one, see [Filtering](06-filtering.md#the-footer). `0`: no footer, nothing in it for Tab |
| `selectSizeHeight` | `18` | height of the row of column numbers under the header filters (click one to select a column). `0` hides the row |
| `hideLabels` | `false` | hides the row of header labels |
| `hideFilter` | `false` | hides the row of header filters |
| `filterOperatorIndicator` | `true` | shows the operator of each header filter as a small symbol in its cell (`=`, `≥`, `*a*` ...): on the right of a text filter, on the left of a number or date filter. A click (F4 in the filter) opens the operator choice. Not on a boolean column nor on a column under 60px. See [Filtering](06-filtering.md#the-operator-in-the-cell) |
| `dimRepeatedValues` | `false` | dims a cell that has the same value as the row above. The row menu can toggle it |
| `rowStatus` | `true` | shows the state of each row on its row number: new, edited, marked for deletion, an error. The row numbers are 14px wider for the icon. See [Showing the row state](05-editing.md#showing-the-row-state) |
| `copyHeaders` | `true` | a copy of more than one cell starts with a line of the column labels (Word and Excel show the headers); pasted into the grid that line is skipped. See [Selection and clipboard](17-selection-and-clipboard.md) |
| `editedMarker` | `true` | a marker in the corner of an edited cell: its tooltip has the original value, a click puts it back. See [Showing the row state](05-editing.md#showing-the-row-state) |
| `mergeHighlight` | `true` | a cell whose value `datasource.upsert()` changed flashes once. See [Live data](16-live-data.md#how-the-grid-shows-them) |
| `placeholderRowCurrentEntityOnly` | `true` | shows `placeholderRow` on the current row only. `false` shows it on every row |
| `autoRemoveContextMenuOnScrollEvent` | `false` | closes the open menu when the grid scrolls |
| `tooltips` | `true` | the built-in tooltips: on the buttons of the filter editor, and the validation messages on a cell and its row number |
| `multilineTooltipLines` | `5` | the lines of a multiline cell's text its tooltip shows, then `… 7 more lines`. A whole number of 1 or more, see [Multiline text](05-editing.md#multiline-text) |
| `texts` | | the texts of this grid by id, e.g. `{ 'row.copy': 'Kopier' }`: they win over the page's (`setTexts()`). The tooltips are texts too, their ids end with `.tooltip`. See [Texts](12-texts.md) |
| `datePickerConfig` | | week start and sizes of the date picker: only the fields to change (`Partial<IDateConfig>`), e.g. `{ weekStart: 0, isoWeek: false }`. The rest are the defaults: weeks from monday with their numbers. The names of the months and days are texts |
| `initialState` | | the sorting, grouping and filter the grid starts with, see [State](03-state.md#the-state-the-grid-starts-in) |
| `groupAggregates` | `true` | the group rows show the columns' `aggregate`s. `false`: the name of the group only. See [Aggregates](18-aggregates.md) |
| `totalsRow` | `false` | a row under the rows with the columns' `aggregate`s over the rows the filter lets through. See [Aggregates](18-aggregates.md#the-totals-row) |

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
| `rowClass` | adds css classes to whole rows from their values, [below](#css-classes-for-a-whole-row-rowclass) |
| `menus` | changes the right click menus, see [Menus](10-menus.md) |

```ts
import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';

declare const config: GridConfig;

const hooks: GridHooks = {
    menus: { row: (defaults) => defaults.filter((entry) => !entry.id.startsWith('row.export')) }
};

const gridInterface = createGrid(host, { config, datasource, hooks });
```

Every hook is optional. `new GridInterface(config, datasource, hooks)` takes them too, for an
element you place yourself. A config that has `isReadonly`, `cellClass`, `rowClass` or `menus` throws:
they are hooks.

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

### CSS classes for a whole row: `rowClass`

`rowClass(row, rowIndex)` returns class names for the whole row - one or more, separated by spaces -
or `null` for none: a late order, a blocked customer, a row to look at. The classes go on the row's
element in every section (the row number, the pinned left, middle and pinned right columns), so one
selector reaches the whole row:

```ts
import type { GridHooks } from '@simple-html/grid';

interface Order {
    due: Date;
    shipped: boolean;
}

// .simple-html-grid-row-even.late, .simple-html-grid-row-odd.late { background-color: #fdecec; }
// .late .simple-html-grid-col-cell input { font-style: italic; }
const hooks: GridHooks<Order> = {
    rowClass: (row) => (!row.shipped && row.due < new Date() ? 'late' : null)
};
```

- The row element is behind the cells - their inputs are transparent - so a background on it shows.
  Give it with the even/odd class (`.simple-html-grid-row-even.late`), as above: that leaves a selected
  row its own colour, and it is more specific than the grid's row colours.
- The classes follow the row: it is called when the row is rendered - scrolled in, `refresh()` - and
  after its values changed (an edit, a paste, an upsert, an undo), in the next frame. A group row gets
  none, it is not called for one.
- The grid's own classes of the row element stay.

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
- The texts are JSON too: `texts` in the config for one grid, `setTexts()` with the texts of the page -
  see [Texts](12-texts.md).
- `container` is the one datasource option that is not data: a `DataContainer` is made in code.
- A `Date` does not come back from JSON as a `Date`, but as its ISO text: a `Date` in a filter of
  the state, or of `initialState`. See [Dates in a saved state](03-state.md#dates-in-a-saved-state) for what the grid does
  with it.

## Rendering again

The grid renders again by itself when the datasource changes: new data, sorting, filtering,
selection - and a value set on a row from code, in the next animation frame (see
[Live data](16-live-data.md#values-show-on-their-own)). When something changes that it can not see,
tell it:

- `gridInterface.refresh()` renders the visible cells again. Call it when what the `isReadonly` /
  `cellClass` hooks read has changed. It is cheap.
- `gridInterface.rebuild()` builds the whole grid again: sizes, header, rows, footer. Call it when a
  formatter shows values differently now, after `setTexts()` (see [Texts](12-texts.md#when-a-changed-text-shows)),
  or after you changed the size of the grid's container without a resize event.
- `gridInterface.fitColumns()` fits every column to its content (at most 750px) and rebuilds, see
  [Column widths and row heights](#column-widths-and-row-heights). It measures with the grid's font,
  so call it once the grid is on the page. `autoResizeColumns()` is the same, and deprecated.

```ts
let highlighted = 'ACME CORP';
gridInterface.updateHooks({ cellClass: (row) => (row.company === highlighted ? { input: 'highlight' } : null) });

highlighted = 'GLOBEX'; // the hook reads it, the grid does not know
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
