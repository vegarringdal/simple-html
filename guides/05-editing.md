# Editing

The grid is readonly by default. With editing on, the user changes values in the cells, and the
datasource tracks every change: which rows are new, edited or marked for deletion, and what changed.
`getChanges()` collects it for a server.

## Editing on

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false, // the default is true
    columns: {
        id: { readonly: true } // this column stays readonly
    },
    layout: {
        center: [
            { fields: ['id'], width: 60 },
            { fields: ['name'], width: 150 },
            { fields: ['born'], width: 110 }
        ]
    }
};
```

Or turn it on and off while the grid is shown: `gridInterface.updateConfig({ readonly: false })`.

In an editable grid, a cell is readonly when the config's `isReadonly(row, field)` returns `true`,
and editable when it returns `false`. When it returns nothing (or there is none), the column's
`readonly` option decides. See [Grid config](02-grid-config.md#readonly-and-css-classes-from-the-row)
for `isReadonly`. Readonly cells of an editable grid are shown with stripes.

```sample editing
```

## How the user edits

- **Text, number and date cells** are inputs. What the user types is parsed with the field's
  formatter (`parse`) and stored in the row as they type: a number field stores a number, a date
  field a `Date`. See [Formatting](08-formatting.md).
- **Emptying a cell** stores what the formatter's `parse('')` gives: `''` for text, `null` for a
  date, and **`0` for a number** - the number formatters parse text that is no number as 0. The row
  menu's clear (below) stores `null` in any field. For an emptied number cell to store `null`, give
  the field a formatter of your own, see [Formatting](08-formatting.md#the-defaults-per-type).
- **Enter** in an editable cell moves to the cell below.
- **Date cells** also open a date picker on click, when they are editable: "Use" stores the picked
  date and time, "Clear" stores `null`. The picker needs `@simple-html/grid/date.css`.
- **Boolean cells** are checkboxes.
- **Paste and clear** are in the row menu (right click a cell): paste puts the clipboard text into
  that column of every selected row, clear sets it to `null`. Rows where the cell is readonly are
  skipped. The grid sends a `paste` event per row and a `clear` event, see [Events](09-events.md).

A column with `allowPasteClearOnly: true` can not be typed in, only pasted into and cleared. Use it
for a field the user sets with a picker of your own, such as a [dropdown grid](10-menus.md#a-dropdown-grid-as-a-block).

The grid sends no event for a single edit. Read the changes when you need them, with
`getChanges()` or the row's `__rowState` (below).

## Edits from code

Set the value on a row you got from the datasource, then render the cells again:

```ts
const row = datasource.getDataRows()[0];
row.name = 'Anna';
gridInterface.refresh();
```

The datasource wraps your objects in proxies that track the edits. A value set on the object you
gave to `setData()` reaches the row, but it is not tracked as an edit. Always use the rows the
datasource hands out: `getDataRows()`, `getSelectedRows()`, `currentEntity`, the `rowData` of an
event.

## New rows

```ts
datasource.addNewEmpty(); // an empty row at the end, selected, and the grid scrolls to it
datasource.addNewEmpty({ company: 'NEW COMPANY' }); // with values
datasource.addNewEmpty({ company: 'NEW COMPANY' }, { scrollTo: false }); // selection unchanged
```

A new row is listed in `getChanges().newEntities`. When the datasource has a `key`, the key field
of the new row gets a generated negative number. When grouped, the row goes into its group and the
group is expanded.

## Deleting rows

```ts
datasource.markForDeletion(datasource.getSelectedRows()); // a row or a list of rows
datasource.markAllForDeletion(); // every row
```

A row marked for deletion stays in the grid, with the state `'D'`, until you remove it. It is
listed in `getChanges().deletedEntities`. A new row is removed at once instead: there is nothing to
delete on a server.

- `datasource.clearMarkedForDeletion()` removes the marked rows. They are then gone from
  `getChanges()` too: read the changes first.
- `datasource.removeData(rows)` and `removeAllData()` remove rows without marking them. They are
  not listed in `getChanges()`, use them for rows that are not on a server.

## Change tracking

Every row has a state, `row.__rowState`:

| state | the row |
| --- | --- |
| `'N'` | is new: `addNewEmpty()` |
| `'M'` | has a field whose value differs from the original |
| `'D'` | is marked for deletion |
| `undefined` | is as it was set |

`getChanges()` returns copies of the changed rows, what to send to a server:

```ts
import { Datasource } from '@simple-html/grid';

interface Person {
    id: number;
    name: string;
    born: Date | null;
}

const people = new Datasource<Person>({ key: 'id', fields: { born: 'date' } });
people.setData([
    { id: 1, name: 'Ann', born: new Date(1990, 4, 17) },
    { id: 2, name: 'Bob', born: new Date(1985, 0, 2) }
]);

const [ann, bob] = people.getDataRows();
ann.name = 'Anna';
bob.born = new Date(1985, 0, 2, 13, 30); // the same day: no edit on a date field
people.addNewEmpty({ name: 'Cid' }, { scrollTo: false });

const { newEntities, modifiedEntities, deletedEntities } = people.getChanges();
// newEntities:      [{ name: 'Cid', id: -1 }] - a generated key, the number varies
// modifiedEntities: [{ id: 1, name: 'Anna' }] - the key and the changed fields
// deletedEntities:  []
```

- `newEntities` and `deletedEntities` are copies of the whole rows. A row in `modifiedEntities` has
  the key (under the key field's name, or `__KEY` without a key) and only the fields that changed.
- The copies are shallow and keep the types: a `Date` stays a `Date`. `JSON.stringify()` turns it
  into its ISO text.
- A field set back to its original value is not a change any more. Setting an empty field
  (`null` or `undefined`) to `''` is not a change either.
- A `date` field compares on the day: a date typed into a cell gets the current time of day, and
  typing the same day again is no change. A `datetime` field, and a field not listed in `fields`,
  compares to the second: a change of the time only is a change.

There is no method that accepts the changes and keeps the rows. After a save, set the data again
with the rows from the server: the state of every row starts over, and with a `key` the selection
is kept.

```ts
declare function save(changes: object): Promise<object[]>;

const freshRows = await save(datasource.getChanges());
datasource.setData(freshRows);
```

### Throwing changes away

```ts
datasource.resetData(); // every edit undone, marked rows unmarked, new rows removed
datasource.resetDataSelectionOnly(); // the same, for the selected rows only
```

### Showing the row state

The row number cell on the left of each row gets the class `row-is-new`, `row-is-modified` or
`row-is-deleted`. `grid.css` does not style them, add your own:

```css
.row-is-modified .simple-html-selector-text { color: #4f46e5; }
.row-is-new .simple-html-selector-text { color: #16a34a; }
.row-is-deleted .simple-html-selector-text { color: #dc2626; text-decoration: line-through; }
```

Or show `__rowState` in a column of its own: put `'__rowState'` in the layout, as the samples do.

## Errors from a server

`setErrors()` on the datasource's container puts an error text on rows, by key. It is a `Map` from
the key as text to the message. Every row not in the map gets `null`:

```ts
import { createGrid, type GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    layout: { center: [{ fields: ['name'], width: 150 }] },
    // .row-error { position: absolute; inset: 0; background: rgba(220, 38, 38, 0.2); }
    cellClass: (row) => (row.__rowError ? { background: 'row-error' } : null)
};
const grid = createGrid(host, { config, datasource });

datasource.getDataContainer().setErrors(new Map([['2', 'The name is taken']]));
grid.refresh();

const row = datasource.getDataRows()[0];
console.log(row.__rowError); // the message, or null
```

The grid does not show `__rowError` by itself: use `cellClass` as above, and read the message from
the row for a tooltip or a list next to the grid. Call `refresh()` after `setErrors()`.

## Mandatory fields and placeholders

- `mandatory: true` on a column shows its empty cells with stripes, until they have a value. Only
  in an editable grid, and only on editable cells.
- `placeholderRow` is text shown in an empty cell. By default only on the current row, set
  `placeholderRowCurrentEntityOnly: false` in the config to show it on every row.
- `placeholderFilter` is text shown in the empty header filter.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    placeholderRowCurrentEntityOnly: false,
    columns: {
        company: { mandatory: true, placeholderRow: 'required' },
        phone: { placeholderRow: '+47 ...', placeholderFilter: 'search phone' }
    },
    layout: {
        center: [
            { fields: ['company'], width: 150 },
            { fields: ['phone'], width: 120 }
        ]
    }
};
```

```sample mandatory-placeholders
```
