# Editing

The grid is readonly by default. With editing on, the user changes values in the cells, and the
datasource tracks every change: which rows are new, edited or marked for deletion, and what changed.
`getChanges()` collects it for a server, and `acceptChanges()` takes it in once it is saved.

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

In an editable grid, a cell is readonly when the `isReadonly(row, field)` hook returns `true`,
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

Deleting a row marks it, so the delete can be undone:

```ts
datasource.markForDeletion(datasource.getSelectedRows()); // a row or a list of rows
datasource.unmarkForDeletion(datasource.getSelectedRows()); // undo
datasource.markAllForDeletion(); // every row
datasource.unmarkAllForDeletion(); // undo for every row
```

A row marked for deletion stays in the grid, with the state `'D'` - struck through with the css in
[Showing the row state](#showing-the-row-state) - until the changes are saved. It is listed in
`getChanges().deletedEntities`. Unmarked, it is as it was before: its edits are kept.

A new row is marked too. While it is marked it is in none of the lists of `getChanges()`: it was
never saved, there is nothing to send. Unmarked, it is a new row again.

In an editable grid the row menu (right click a cell) has a **Delete:** section: *Rows (selected
rows)* marks the selected rows, *Undo (selected rows)* takes the mark off - shown when a selected row
is marked. A row the `isReadonly` hook returns `true` for in every column is locked: the menu does not
mark it. The columns' `readonly` option does not lock a row, so a grid of readonly columns can still
delete rows. The entries are `row.delete`, `row.delete.rows` and `row.delete.undo`, change or hide
them with the [menus hook](10-menus.md).

- `datasource.acceptChanges()` removes the marked rows once the deletes are saved, see
  [Saving](#saving). `clearMarkedForDeletion()` removes them too, and leaves the other changes.
- `datasource.removeData(rows)` and `removeAllData()` remove rows for good, without marking them:
  no undo, and not listed in `getChanges()`. Use them for rows that never came from a server.

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

After a save, `acceptChanges()` makes the changes the new starting point, see [Saving](#saving).

### Throwing changes away

```ts
datasource.resetData(); // every edit undone, marked rows unmarked, new rows removed
datasource.resetDataSelectionOnly(); // the same, for the selected rows only
```

To undo a delete and keep the edits, use `unmarkForDeletion(rows)`.

### Showing the row state

The row number cell on the left of each row gets the class `row-is-new`, `row-is-modified` or
`row-is-deleted`. `grid.css` does not style them, add your own:

```css
.row-is-modified .simple-html-selector-text { color: #4f46e5; }
.row-is-new .simple-html-selector-text { color: #16a34a; }
.row-is-deleted .simple-html-selector-text { color: #dc2626; text-decoration: line-through; }
```

Or show `__rowState` in a column of its own: put `'__rowState'` in the layout, as the samples do.

## Saving

A save usually sends everything in one transaction: the deleted, edited and new rows of
`getChanges()`. After a successful save, `acceptChanges()` makes the grid show what was saved:

- the rows marked for deletion are removed
- the new rows become ordinary rows
- the values the rows have now become their original values: nothing counts as edited
- the row errors (`setErrors()`) are cleared

The displayed rows are rebuilt once, and `hasChanges()` is `false` after.

**Keys of new rows.** Until it is saved, a new row has a temporary key: a generated negative number,
in the key field (`id: -1`), or as `__KEY` in `getChanges().newEntities` when the datasource has no
`key`. The server gives the row its real key. `acceptChanges({ newKeys })` takes a `Map` from each
temporary key to the server's key, and puts the server's key in the row - in the key field, or as the
row's `__KEY`. Setting it is no edit, and a selected row stays selected.

```ts
import { Datasource } from '@simple-html/grid';

interface Person {
    id: number;
    name: string;
}

// what the server answers: the id it gave each new row
interface SaveResult {
    newIds: { temporaryId: number; id: number }[];
}

const people = new Datasource<Person>({ key: 'id' });
people.setData([
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' }
]);

// the user edits, deletes and adds rows
const [ann, bob] = people.getDataRows();
ann.name = 'Anna';
people.markForDeletion(bob);
people.addNewEmpty({ name: 'Cid' }, { scrollTo: false }); // a temporary id: -1, say

// one transaction
const changes = people.getChanges();
// newEntities:      [{ name: 'Cid', id: -1 }]
// modifiedEntities: [{ id: 1, name: 'Anna' }]
// deletedEntities:  [{ id: 2, name: 'Bob' }]
const response = await fetch('/api/people/save', { method: 'POST', body: JSON.stringify(changes) });
if (response.ok) {
    const result: SaveResult = await response.json();
    people.acceptChanges({ newKeys: new Map(result.newIds.map((row) => [row.temporaryId, row.id])) });
}

people.getDataRows().map((row) => [row.id, row.name]); // [[1, 'Anna'], [7, 'Cid']] - Cid has the server's id
people.hasChanges(); // false
```

- `newKeys` compares the keys as text: `-1` and `'-1'` are the same key, so a map made from the keys
  of a JSON object works too - `new Map(Object.entries(json))`.
- A key in `newKeys` that is not the key of a new row throws, and so does a blank server key - before
  anything changes. A map the wrong way round (server key to temporary key) is caught that way. A
  new row that is not in `newKeys` keeps its key.
- When only some rows were saved, pass them: `acceptChanges({ rows: savedRows, newKeys })`. The
  other rows keep their changes.
- Keep the grid readonly while the save runs - `gridInterface.updateConfig({ readonly: true })`, and
  `false` after - or an edit made in between is accepted without being saved.
- When the save fails, do not call `acceptChanges()`: the changes stay, to be saved again. Show the
  server's errors on the rows with [`setErrors()`](#errors-from-a-server).
- Without a `key`, the server's key becomes the row's `__KEY`: a later edit of the row is sent with
  it, as `__KEY` in `modifiedEntities`.

`hasChanges()` is `true` while there is something to save, for an "unsaved changes" indicator. The
grid sends no event for an edit, so check it when it matters:

```ts
window.addEventListener('beforeunload', (event) => {
    if (datasource.hasChanges()) {
        event.preventDefault();
    }
});
```

Setting the data again with the rows from the server works too: `setData(freshRows)` starts the state
of every row over, and with a `key` the selection is kept. `acceptChanges()` keeps the rows, so the
current row, the scroll position and the expanded groups stay as they are.

```sample saving
```

## Errors from a server

`setErrors()` on the datasource's container puts an error text on rows, by key. It is a `Map` from
the key as text to the message. Every row not in the map gets `null`:

```ts
import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    layout: { center: [{ fields: ['name'], width: 150 }] }
};
const hooks: GridHooks = {
    // .row-error { position: absolute; inset: 0; background: rgba(220, 38, 38, 0.2); }
    cellClass: (row) => (row.__rowError ? { background: 'row-error' } : null)
};
const grid = createGrid(host, { config, datasource, hooks });

datasource.getDataContainer().setErrors(new Map([['2', 'The name is taken']]));
grid.refresh();

const row = datasource.getDataRows()[0];
console.log(row.__rowError); // the message, or null
```

The grid does not show `__rowError` by itself: use the `cellClass` hook as above, and read the
message from the row for a tooltip or a list next to the grid. Call `refresh()` after `setErrors()`.

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
