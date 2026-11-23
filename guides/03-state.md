# State

The config is what you write. The state is what the user changes while working with the grid. Read
it with `getState()`, give it back with `setState()`, and go back to the start with `resetState()`.

## What the state is

`gridInterface.getState()` returns a `GridState`:

| part | what it is |
| --- | --- |
| `layout` | the column order, pinning and widths: the user drags, pins, hides and resizes columns, see [Moving and resizing columns](02-grid-config.md#moving-and-resizing-columns). The widths `fitColumns()` gives are here too; the row heights of `fitRows()` are not part of the state, see [Column widths and row heights](02-grid-config.md#column-widths-and-row-heights) |
| `sorting` | the sort, as `datasource.getLastSorting()`. When grouped, the grouped fields come first |
| `grouping` | the grouping, as `datasource.getGrouping()` |
| `expandedGroups` | the ids of the expanded groups |
| `filter` | the filter the rows are filtered by, as `datasource.getFilter()`. `null` when there is none |
| `headerFilters` | what each header filter cell shows: the value, the operator picked in its menu and its Match case |
| `aggregates` | the aggregate functions of the columns, keyed by field (`{ balance: ['sum', 'avg'] }`): what `ColumnConfig.aggregate` starts with and the header menu changes, see [Aggregates](18-aggregates.md#from-the-header-menu) |
| `totalsRow` | whether the totals row is shown: `GridConfig.totalsRow`, turned on and off in the header menu |
| `formats` | the display formats of the columns, keyed by field (`{ born: { date: 'weekIso' } }`, `{ email: { link: { url: 'mailto:{email}' } } }`): what `ColumnConfig.format` starts with and the header menu's Format ›, the grid config dialog and the column chooser's ✎ (a label) change, see [Display formats](08-formatting.md#display-formats) and [Templates and links](08-formatting.md#templates-and-links) |
| `calculatedColumns` | the calculated columns, keyed by field (`{ total: { formula: '{price} * {qty}', label: 'Total' } }`): what `GridConfig.calculatedColumns` starts with and the grid config dialog adds, changes and removes, see [Calculated columns in the state](#calculated-columns-in-the-state) |
| `detailForm` | the detail form: whether it is shown, its fields in their order, its width (dragged too) and its least and most width, expanded or collapsed (`{ show: true, fields: ['name', 'notes'], width: 300 }`) - what `GridConfig.detailForm` starts with and the grid config dialog, the form's edge and its title change, see [The detail form](02-grid-config.md#the-detail-form) |

```ts
const state = gridInterface.getState();
state.layout.center.map((column) => column.fields); // [['name'], ['age', 'born']]
state.sorting; // [{ attribute: 'name', ascending: true }]
state.filter; // { group: 'AND', children: [{ field: 'age', operator: 'GREATER_THAN_OR_EQUAL_TO', value: 30 }] }
state.headerFilters; // { age: { value: 30 } }
```

`filter` is what the rows are filtered by. `headerFilters` is only what the header cells show: the
conditions a header filter made are in `filter` already. Keep both, as `getState()` gives them, so
the header shows what the rows are filtered by.

These are **not** state: the options (`readonly`, `dimRepeatedValues`, sizes ... see
[Grid config](02-grid-config.md)), the data and its edits, the selected rows, the current row, the
selected columns and the scroll position.

## `getState()`, `setState()` and `resetState()`

```ts
const saved = gridInterface.getState();

// ... the user sorts, filters and moves columns around

gridInterface.setState(saved); // back to what it was
gridInterface.resetState(); // back to the state the grid started in
```

- `getState()` returns a copy. Changing it changes nothing in the grid, and what the user does
  later does not change it.
- `setState()` applies the parts it is given and **keeps the rest**. Within a part nothing is
  merged: `layout` replaces the whole layout, `headerFilters` every header filter.
- `setState()` copies what it is given with `structuredClone`, so a `Date` stays a `Date`. The
  state must be plain data: no functions, no rows from the datasource.
- `resetState()` goes back to `initialState` (below), with the config's `layout`. What
  `initialState` leaves out is cleared: no sorting, no grouping, no filter.

```ts
gridInterface.setState({ sorting: [{ attribute: 'age', ascending: false }] }); // only the sort
gridInterface.setState({ grouping: [{ attribute: 'country', title: 'Country' }], expandedGroups: [] });
gridInterface.setState({ filter: null, headerFilters: {} }); // no filter, empty header filters
```

An empty `sorting` gives the rows back the order they were set in.

## Saving it

The state is plain data, so it can be stored as JSON - with the config, see
[Saving the config](02-grid-config.md#saving-the-config).

```ts
import type { GridState } from '@simple-html/grid';

const KEY = 'orders-grid-state';

// e.g. when the page is left
window.addEventListener('beforeunload', () => {
    localStorage.setItem(KEY, JSON.stringify(gridInterface.getState()));
});

// when the grid is made
const saved: GridState | null = JSON.parse(localStorage.getItem(KEY) ?? 'null');
if (saved) {
    gridInterface.setState(saved);
}
```

A saved layout is the layout the user had. When you add a column to the config later, a state saved
before does not have it. Put a version in the key, and change it when the layout in the config
changes.

### Dates in a saved state

JSON has no dates: a `Date` in the filter or in a header filter is stored as its ISO text,
`'2026-11-20T08:15:00.000Z'`, and comes back as that text. `setState()` does not turn it back into a
`Date`, it keeps what it is given. What that means:

- A `date` or `datetime` field reads the text as the same moment. The same rows are filtered, and
  the header filter and `getFilterString()` show the same date. `getState()` gives the text from
  then on, not a `Date`.
- A field that is not a `date` or `datetime` field in the datasource's `fields` filters on a `Date`
  as a date only while it is a `Date`. After JSON it is compared as text, and other rows are
  filtered. List the type of every date field in `fields`.

The same goes for a `Date` in the config's `initialState`, when the config is stored as JSON.

```sample grid-state
```

## The state the grid starts in

`initialState` in the config is the state the grid starts in, and the one `resetState()` goes back
to. It takes the same parts as `setState()`. The layout comes from the config's `layout`, unless
`initialState` has one.

```ts
import { type GridConfig, where } from '@simple-html/grid';

const config: GridConfig = {
    layout: {
        center: [
            { fields: ['name'], width: 150 },
            { fields: ['age'], width: 80 }
        ]
    },
    initialState: {
        sorting: [{ attribute: 'name', ascending: true }],
        filter: where('age', 'GREATER_THAN_OR_EQUAL_TO', 18),
        headerFilters: { age: { value: 18 } } // what the age header filter shows
    }
};
```

The grid applies `initialState` to the datasource when it is made: a filter, sort or grouping
set on the datasource before is replaced, and **cleared when `initialState` leaves it out**. Set
them in `initialState`, or on the datasource after the grid is made.

`updateConfig({ initialState })` changes what the next `resetState()` goes back to, it changes
nothing now. Call `resetState()` after it to apply it at once.

## Display formats in the state

`formats` is keyed by field: how each column shows its values - a view setting of the user, like a
column's width. Only the columns with a format are listed; a column left out shows its field's
formatter (the menu's *Default*).

```ts
import type { GridState } from '@simple-html/grid';

const formats: GridState['formats'] = {
    born: { date: 'norwegian' }, // 22.11.2026
    due: { date: 'weekIso' }, // 2026-W47
    balance: { number: { decimals: 2, thousands: ' ', decimal: ',' } }, // 1 234 567,89
    name: { text: '{name} ({id})' }, // Ann (12)
    company: { link: { url: 'https://crm.example.com/customer/{id}', newTab: true } } // a link
};
gridInterface.setState({ formats });
```

- It starts as the columns' `format` in the config (or `initialState.formats`), and `resetState()`
  goes back to it. `updateConfig({ columns })` gives the columns new options: their formats are the
  new config's from then on.
- The user changes it in the header menu (Format ›) and the grid config dialog (the gear in the
  footer): its Apply is a `setState({ formats })`. Save `getState()` to keep what the user set, see
  [The grid config dialog](08-formatting.md#the-grid-config-dialog).
- **A saved state runs nothing**: the templates of a text column (`text`, `link.url`) are text with
  `{field}` placeholders, not code. A state from storage or another user can have a link to
  `javascript:` in it - `setState()` throws a `TypeError` for it - or a field that holds one, which is
  shown as text, not as a link. See [Templates, not code](08-formatting.md#templates-not-code).
- `setState({ formats })` replaces every column's format - start from `getState().formats` to change
  one. A format that does not fit its field throws a `TypeError`, and nothing of the state changes.
- It is plain JSON: a state saved with `JSON.stringify` gives the same formats back.
- The rest of what the user sets in the grid config dialog is in a column's format too - its
  `label`, the header filter's `placeholder` / `placeholderLabel`, a number column's `numberOverride`,
  `checkbox`, `multiline`, `readonly`, the colour `rules` - so it is saved and given back with the formats, see
  [Label, placeholder, blank / 0, checkboxes, multiline, read only](08-formatting.md#label-placeholder-blank--0-checkboxes-multiline-read-only) and
  [Colour rules](08-formatting.md#colour-rules). A rule's value is text as it is typed in the header
  filter (`'2026-11-22'`), so a saved rule reads the same.

## The detail form in the state

`detailForm` is the detail form at the right of the rows: whether it is shown, the fields it shows in
their order, its width and its least and most width, and whether it is expanded or collapsed - a view
setting of the user, like the columns.

```ts
gridInterface.setState({ detailForm: { show: true, fields: ['company', 'notes', 'orderDate'], width: 300 } });
gridInterface.getState().detailForm; // { show: true, fields: ['company', 'notes', 'orderDate'], width: 300 }

// collapsed to a strip, dragged between 200 and 500px
gridInterface.setState({
    detailForm: { show: true, fields: ['company', 'notes'], width: 300, expanded: false, minWidth: 200, maxWidth: 500 }
});
```

- It starts as `GridConfig.detailForm` (or `initialState.detailForm`), none by default
  (`{ show: false, fields: [] }`), and `resetState()` goes back to it. `updateConfig({ detailForm })`
  sets it, `updateConfig()` without it keeps the user's.
- The user changes it in the grid config dialog, tab *Detail form*: its Apply is a
  `setState({ detailForm })`. Save `getState()` to keep it.
- And on the form itself: the width dragged at its left edge (or its arrow keys) is `width`, the button
  of its title sets `expanded` - `false` collapsed, `true` expanded; left out it is expanded. The
  dialog's *Expanded* is the same `expanded`: one setting, what the form is now.
- `width` is laid out between `minWidth` (at least 150) and `maxWidth`, the state keeps what it was
  given. `minWidth` and `maxWidth` are left out when they are none, `expanded` when it was not set.
- A field is listed once; a field that is no column is shown too, labelled as the column chooser
  labels it. `show` or `expanded` that is not a boolean, `fields` that is not a list of names, a
  `width`, `minWidth` or `maxWidth` that is no number of px, or a `minWidth` more than the `maxWidth`
  throws a `TypeError`, and nothing of the state changes.
- It is plain JSON.

## Calculated columns in the state

`calculatedColumns` is keyed by field: the columns whose value a formula computes from the row, see
[Calculated columns](23-calculated-columns.md).

```ts
const saved = gridInterface.getState().calculatedColumns; // { total: { formula: '{price} * {qty}', label: 'Total' } }

// one more, at the end of the layout
const layout = gridInterface.getState().layout;
layout.center.push({ fields: ['half'], width: 90 });
gridInterface.setState({ calculatedColumns: { ...saved, half: { formula: '{price} / 2' } }, layout });
```

- It starts as `GridConfig.calculatedColumns` (or `initialState.calculatedColumns`), and `resetState()`
  goes back to it. `updateConfig({ calculatedColumns })` shows new ones at once.
- The user changes it in the grid config dialog: its Apply is a `setState({ calculatedColumns })`, with
  the layout of a new one.
- `setState({ calculatedColumns })` replaces all of them, and the rows are filtered, sorted and grouped
  again with their values. One left out is taken out of the layout, the sort, the grouping, the filter,
  the header filters and the detail form; its format and aggregates go.
- **A saved state runs nothing**: a formula is text read by the grid's own small language - no `eval`.
  A formula with a problem, a name that is a field of the rows, anything that is no calculated column
  throws a `TypeError`, and nothing of the state changes. See
  [Security](23-calculated-columns.md#security).
- It is applied before the formats and aggregates of the same state: a `format` of a calculated column
  is checked against its type.
- It is plain JSON.

## Header filters in the state

`headerFilters` is keyed by field. Only the columns whose header filter has a value, an operator
picked in its menu, Match case on or filter as you type turned on or off by the user are listed:

```ts
import type { GridState } from '@simple-html/grid';

const headerFilters: GridState['headerFilters'] = {
    name: { value: 'ann*' }, // typed in the name column
    age: { value: 30, operator: 'LESS_THAN_OR_EQUAL_TO' }, // the operator picked in the menu
    city: { value: 'Oslo', caseSensitive: true }, // Match case on in its menu: OSLO is left out
    balance: { value: [1000, 5000], operator: 'BETWEEN' }, // typed as 1000..5000
    active: { value: true }, // a boolean column's checkbox
    notes: { value: null, filterOnType: true }, // filter as you type turned on in its operator choice
    due: { value: new Date(2026, 10, 16), operator: 'EQUAL' } // `2026-W47` typed, the column shown as weekIso
};
```

The operator picked in a header filter's menu is state. The column's `operator` in the config is
only the operator its header filter starts with, the grid never changes it. An operator of the state the
column does not offer (its `filterOperators` changed since it was saved) is passed by: the column's
`operator` is used. Match case (`caseSensitive`) is state too, `true` or left out; a column with
`filterCaseSensitive` always matches case, whatever the state has. A `BETWEEN`'s value is
`[from, to]`, an open end `null`. See [Filtering](06-filtering.md#header-filters).

Filter as you type (`filterOnType`) is the user's, `true` or `false`: listed only when it differs from
the column's default (its `filterOnType`, else the grid's), so `resetState()` goes back to the config's.
See [Filter as you type](06-filtering.md#filter-as-you-type).

A column that filters as shown - a display format such as `weekIso`, see
[Filter as shown](08-formatting.md#filter-as-shown) - stores its value as any date column does: a
`Date`, the **start of the period typed**. `2026-W47` is Monday 2026-11-16 00:00, `2026-11` November 1,
`2026-W40..2026-W47` the Mondays of both weeks (`[from, to]`). The cell shows it in the format again,
`2026-W47`; through JSON the Date is its ISO text (`'2026-11-15T23:00:00.000Z'` in Oslo), which the cell
reads the same. The conditions of the whole week are in `filter`: the state has both, as `getState()`
gives them. A state of a week typed when the column was shown as weeks, set after its format changed,
shows the date in the new format - the filter is what was saved until the header filter runs again.

To set a filter from code that the header also shows, set both:

```ts
import { and, where } from '@simple-html/grid';

gridInterface.setState({
    filter: and(where('country', 'EQUAL', 'Norway')),
    headerFilters: { country: { value: 'Norway' } }
});
```
