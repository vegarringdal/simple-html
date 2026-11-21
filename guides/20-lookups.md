# Lookups: select and dropdown grid

A column whose value is picked from a list: a country stored as `NO` and shown as `Norway`, a customer
stored as its id and shown as its name. Register the list once as a **lookup**, with an id, and name
it in the column's `editor` - the config stays plain JSON. The cell shows the label, and a button at its
right opens the list: a **select** (a search field over the options) or a **dropdown grid** (a small
grid of the rows, with a filter row). Picking writes the value, and other fields of the picked row if
you like, as one step of the undo history.

```sample lookups
```

## Registering a lookup

`registerLookup(id, lookup)` when the page loads, before the grid that names it is made. A lookup is
the rows to pick from, the field stored in the cell (`valueField`) and the field shown
(`labelField`, default `valueField`):

```ts
import { Datasource, registerLookup } from '@simple-html/grid';

const countries = new Datasource();
countries.setData([
    { code: 'NO', name: 'Norway' },
    { code: 'SE', name: 'Sweden' },
    { code: 'DK', name: 'Denmark' }
]);
registerLookup('countries', { datasource: countries, valueField: 'code', labelField: 'name' });

const customers = new Datasource({ fields: { id: 'number' } });
customers.setData([{ id: 1, name: 'ACME CORP', city: 'Oslo' }]);
registerLookup('customers', {
    datasource: customers,
    valueField: 'id',
    labelField: 'name',
    // the dropdown grid: its columns and options, plain JSON
    config: {
        layout: {
            center: [
                { fields: ['id'], width: 60 },
                { fields: ['name'], width: 190 },
                { fields: ['city'], width: 110 }
            ]
        }
    }
});
```

- **A grid looks its lookups up when it is made**, and when `updateConfig()` is given `columns`: an id
  that is not registered throws a `TypeError` then, naming the ids that are. It keeps the lookups it
  found: registering an id again changes the grids made after. There is one registry for the page.
- **The lookup follows its datasource**: rows set, added, removed or changed show in the cells right
  away. The rows can come from a server after the grid is shown - the cells show the values until they
  do.
- **A value is found by `===`**: the number `17` is not the text `'17'`. A lookup column is a `text`
  or `number` field; the first row with the value wins.

### A grid interface of your own

The dropdown grid can be a `GridInterface` you made, with its own config and hooks (a `cellClass` that
greys out blocked customers, say): link it instead of a datasource and a config.

```ts
import { Datasource, GridInterface, registerLookup } from '@simple-html/grid';

const customers = new Datasource({ fields: { id: 'number' } });
const picker = new GridInterface(
    {
        columns: { name: { operator: 'CONTAINS' } },
        layout: { center: [{ fields: ['name'], width: 200 }] },
        panelHeight: 0
    },
    customers,
    { cellClass: (row) => (row.blocked ? { input: 'blocked' } : null) }
);
registerLookup('customers', { gridInterface: picker, valueField: 'id', labelField: 'name' });
```

**Show it in the dropdown only.** An interface shows one grid at a time: while the dropdown is open,
the interface is connected to the dropdown's grid element, and when it closes it is disconnected
again. One that is shown in a grid on the page when the dropdown opens throws an `Error` - taking it
would leave that grid without its datasource. Each time the dropdown opens, the interface goes back to
the state it started in (`resetState()`): the filter typed the last time is gone.

## The column option

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    columns: {
        country: { label: 'Country', editor: { type: 'select', lookup: 'countries' } },
        customerId: {
            label: 'Customer',
            editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name', customerCity: 'city' } }
        },
        customerName: { readonly: true }
    },
    layout: {
        center: [
            { fields: ['country'], width: 120 },
            { fields: ['customerId'], width: 180 },
            { fields: ['customerName'], width: 180 }
        ]
    }
};
```

| key | what it is |
| --- | --- |
| `type` | `'select'`: a list with a search field. `'grid'`: a dropdown grid |
| `lookup` | the id of a registered lookup |
| `set` | optional, more fields to copy from the picked row: `{ <field of the row>: <field of the picked row> }`. `{ customerName: 'name' }` gives the row's `customerName` the picked customer's `name`. Emptying the cell empties them too. They are written as data, also where those cells are readonly |

What is wrong throws a `TypeError` when the grid is made (or `updateConfig()` is given the column),
naming the column: an editor that is no object, a `type` that is no `'select'` or `'grid'`, a lookup
that is not registered, a `set` that is no object of field names or sets the column's own field, a
field that is no `text` or `number`, and a `focusButton` or `dynamicCellTypeColumn` next to it - the
editor has its own button, the column one type.

## The cell

- **It shows the label** of the row whose value it has, as the lookup's datasource formats the label
  field. A value no row has is shown as it is (the field's formatter), a blank as nothing.
- **It is not typed in**: the input is readonly. A character typed opens the list with the character as
  its search - the way a multiline cell opens its editor.
- **The button** at its right opens the list: a small triangle, shown while the pointer is over the
  cell and while the cell has the focus. A click on it again closes the list.
- **In a readonly grid or cell** (`readonly`, the column's `readonly`, the `isReadonly` hook) it shows
  the label only: no button, no list, the keys are those of any cell.

## The keys

In a lookup cell that can be edited:

| key | does |
| --- | --- |
| Alt+ArrowDown, F4 | opens the list, as in Excel and Windows. Not Alt+ArrowDown's "the cell below" here: Enter or Tab move on |
| F2, Space, a double click | opens the list |
| a character | opens the list with the character as its search |
| Delete, Backspace | empties the cell, and the fields of `set`: one step of the undo history |
| Enter | the cell below, as in any cell that can be edited |
| Ctrl+Z | undoes the last pick |

In the select, the focus is in the search field:

| key | does |
| --- | --- |
| typing | finds the options whose label has the text, ignoring case. The first one found is the active one |
| ArrowDown / ArrowUp | the next / previous option |
| PageDown / PageUp | ten options down / up |
| Home / End | the first / last option. The caret of the search moves with ArrowLeft / ArrowRight |
| Enter | picks the active option. With no option, it closes the list |
| Tab / Shift+Tab | picks the active option and goes on to the next / previous cell |
| Esc | closes the list, the value as it was |

A click on an option picks it; the pointer over an option makes it the active one. The list opens with
the cell's value active and marked with a check.

In the dropdown grid, the focus is in the filter of the label's column:

| key | does |
| --- | --- |
| typing | filters the rows as you type, with the filter's operator. The first row is the highlighted one |
| Enter in a filter | picks the highlighted row: the cell's value when it opened, the first row after a search |
| ArrowDown in a filter | goes to the highlighted row |
| ArrowDown / ArrowUp in the rows | the row below / above. Up from the first row: the filter |
| Enter in a row | picks the row |
| Tab | the grid's own: the next filter or cell of the dropdown grid |
| Esc | closes it, the value as it was |

A click on a row picks it.

The list closes, the value as it was, on a click outside it, when the grid scrolls, when a menu opens
and when the grid leaves the page. One list is open at a time. After a pick, Enter and Esc, the focus is
back in the cell.

## The select

A list under the cell, at least as wide as the cell, kept in the window: above the cell when there is
no room under it, moved in from the right edge. It has the options of the rows the lookup's datasource
displays - its filter and sort decide which and in what order; the labels of the cells are found in all
of its rows.

**At most 500 options are shown**, with a line under them: `500 of 10000 shown, type to search` - the
search finds the rest. Rendering is what costs: in Chrome, a list of 10 000 options took 190ms to open
and 50ms for each arrow key, cut at 500 it is 14ms and 11ms (a search 10-15ms).

## The dropdown grid

A grid of the lookup under the cell, kept in the window like the select. Made from the lookup's
datasource and `config` - each time it opens, and done with when it closes - or the lookup's own grid
interface, shown as it is.

- **The config**: without one, a column of the label, or of the value and the label when they differ.
  What the config leaves out is set for a picker: no grouping panel (`panelHeight: 0`), no footer
  (`footerHeight: 0`), no column numbers (`selectSizeHeight: 0`), no row state (`rowStatus: false`),
  and a column without an `operator` searches anywhere in the text (`CONTAINS`). It is readonly, as
  every grid by default.
- **Its size** follows its columns, and it is nine rows high (fewer when the lookup has fewer rows, at
  least three) with its header.
- **It filters and sorts the datasource**: a grid applies its state to its datasource, its config's
  `initialState` or none. Give a lookup a datasource of its own, or one that shares the rows of another
  through a `DataContainer`, so a grid on the page that shows the same datasource keeps its filter.
- **The row of the cell's value is selected** and scrolled to when it opens; after a search the first
  row found is.
- It has no right click menus: they are left out in a picker.

## Picking

A pick writes the value of the picked row to the cell, and the fields of `set` from it, in one run of
code: **one step of the undo history**, Ctrl+Z in the cell takes all of it back. Picking the value the
cell has changes nothing, there is no step. The fields are validated as an edit, the row is edited
(`__rowState`), the edited marker shows the label of the original value.

While the list is open the cell counts as being edited: an `upsert()` from a server does not overwrite
it, a value for it is a conflict - see [Live data](16-live-data.md).

## Value and label

What the user sees is the label; the rows hold the value. The grid uses the label where the user
works with what the cell shows:

- **Sorting** the column sorts on the labels: `Denmark, Norway, Sweden`, not `DK, NO, SE`. Two values
  with the same label are sorted on the value after it. The grid gives the datasource the labels to sort
  on (`datasource.sort()` from code too); `destroy()` takes them back.
- **The header filter** is a text filter on the labels, also for a number field: the text typed finds
  the lookup rows whose label matches with the column's operator (`EQUAL` by default, the whole label
  ignoring case; set `operator: 'CONTAINS'` to search in it), and the rows are filtered on their values
  - the condition is `IN` the values found. A value no lookup row has does not match a typed text. The
  filter menu offers the operators of a text; its Is blank / Is not blank are on the cell's value.
- **The value list of the filter menu** lists the labels (`Denmark`, `Norway`, `Sweden`), in their
  order, and its search searches them - also on a number field, which has no value list without a
  lookup. Two values with one label are one entry. Apply filters on the values behind the checked
  labels, as the header filter does: `IN ['NO']`, or `NOT_IN` the unchecked ones. A value no lookup
  row has is listed as the cell shows it (`XX`). See [the value list](06-filtering.md#the-value-list).
- **The footer's filter chip** shows the labels of an `IN` / `NOT_IN` of values (`Country in Norway`)
  and of a condition's value (the grid gives `getFilterTree()` the column's formatter).
- **The CSV and Excel export** write the label, as text. `formatted: false` writes the value.
- **Copy** gives the labels. **Paste** takes a label (ignoring case) and writes its value, and the
  fields of `set`; a text no label has is written as it is. **Clear** (the row menu, Delete in a range)
  empties the fields of `set` too, and so does **fill down** copy them with the value.
- **Find** (Ctrl+F) and fitting the column widths read the labels.

Where the value shows, and not the label:

- **Grouped** on a lookup column, the rows are grouped on the value and the group row shows it
  (`Country: NO (12)`). The groups are in the order of the labels.
- **The filter** the header filter and the value list make is an `IN` (or `NOT_IN`) of values: the
  filter editor - where they can be edited - `getFilterString()` and the state have the values.
- **The row menu's "Filter: Replace / Add to filter"** filters on the cell's value (`EQUAL NO`).

## Doing it yourself

For a picker of your own - a dialog, a tree, a search on a server - give the column a `focusButton`
and open it from the `cell-focus-button-click` event, as a block of `openMenu()`: see
[A dropdown grid as a block](10-menus.md#a-dropdown-grid-as-a-block). The button is a `...`, Space in the
cell clicks it, and writing the value back is yours: one write in one run of code is one step of the
undo history. `allowPasteClearOnly: true` keeps the cell from being typed in. A column has either a
`focusButton` or an `editor`.

## For a screen reader

The cell's input has `aria-haspopup` - `listbox` for the select, `grid` for the dropdown grid - and the
button is named "Open the list" (the text `lookup.open`); it is no stop of Tab. The select is the
WAI-ARIA combobox pattern: its search field is a `combobox` (`aria-expanded`, `aria-controls`, named with
the column's label) with the list as its `listbox`, and the focus stays in the search field - the active
option is its `aria-activedescendant`, and the one with `aria-selected="true"`. "No matches" is a
`status`. The dropdown grid is a grid, see [Keyboard and accessibility](14-accessibility.md).

## Texts

`lookup.open`, `lookup.search` (the placeholder of the search), `lookup.noMatch` and `lookup.more`, see
[Texts](12-texts.md#lookup-columns). The dropdown grid has the texts of a grid.

## Theming

The button is `--simple-html-grid-lookup-button-bg-color` with its triangle in
`--simple-html-grid-lookup-icon-color` (at least 3:1 to it), the pointer over it
`--simple-html-grid-main-bg-selected-even`. The active option of the select is
`--simple-html-grid-lookup-active-bg-color`; the rest are the colours of the menus. See
[Theming](13-theming.md#lookup-columns).
