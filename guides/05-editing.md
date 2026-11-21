# Editing

The grid is readonly by default. With editing on, the user changes values in the cells, and the
datasource tracks every change: which rows are new, edited or marked for deletion, and what changed.
The rules of the fields validate the edits, `validate()` checks every row before a save.
`getChanges()` collects the changes for a server, and `acceptChanges()` takes them in once they are
saved.

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
Before it, `validate()` checks the rows, see [Validation](#validation).

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

A row with an error gets `simple-html-row-error` on its row number cell, which `grid.css` does
style, see [How the grid shows the errors](#how-the-grid-shows-the-errors).

## Validation

The rules are part of the datasource's fields, plain JSON like the rest of them - they can be
stored in a backend with the fields. A field lists its rules in `validate`: the id of a validator as
text, or an object with the id, its options and a message of its own.

```ts
import { Datasource } from '@simple-html/grid';

const people = new Datasource({
    key: 'id',
    fields: {
        name: { validate: ['required', { id: 'maxLength', value: 50 }] },
        age: { type: 'number', validate: ['required', { id: 'min', value: 0 }, { id: 'max', value: 150, message: 'too old' }] },
        email: { validate: [{ id: 'pattern', value: '^[^@\\s]+@[^@\\s]+$', message: 'Not an email address' }] }
    }
});
```

The validators are named by id, like the formatters: the built-in ones below, and your own with
`registerValidator()`. An id that is not registered throws when the datasource is made, and so does
a built-in rule with a wrong option (`min` without a number, a `pattern` that is no regular
expression). `getField(name).validate` gives the rules of a field, written out as objects.

```sample validation
```

### The built-in rules

They take their option as `value`:

| rule | the value fails when | message |
| --- | --- | --- |
| `'required'` | it is `null`, `undefined`, `''`, an invalid Date, or 0 | `Required` |
| `{ id: 'min', value: 0 }` | it is a number below `value` | `Must be at least {value}` |
| `{ id: 'max', value: 150 }` | it is a number above `value` | `Must be at most {value}` |
| `{ id: 'minLength', value: 2 }` | it is text shorter than `value` | `Must be at least {value} characters` |
| `{ id: 'maxLength', value: 50 }` | it is text longer than `value` | `Must be at most {value} characters` |
| `{ id: 'pattern', value: '^[A-Z]{2}$' }` | it is text the regular expression does not find | `Not in the expected format` |

- **0 fails `required`.** The filter takes 0 as blank too (see [0 is blank](06-filtering.md#0-is-blank)),
  and an emptied number cell stores 0 - the number formatters parse `''` as 0 - so with 0 as a value
  a required number would never fail in the grid. `false` passes: it is a value, and a checkbox has
  no empty state. For a number where 0 is a real value, use a rule of your own (`present` below).
- **The other rules pass an empty value** (`null`, `undefined`, `''`): an optional field can be
  empty, add `'required'` to make it fail. They check the values of their kind only - `min` and
  `max` numbers, the others text - and pass the rest.
- **`pattern` is not anchored**: `'[0-9]'` finds a digit anywhere in the text, `'^[0-9]+$'` is
  digits only. Written as text, so it stays JSON. In TypeScript a `\` is written twice.
- Every rule runs: a value can fail more than one, and gets a message for each.

### Messages

A rule's `message` replaces the default, and `{name}` in it is replaced by the rule's option `name`:
`{ id: 'max', value: 150, message: 'at most {value}' }` gives `at most 150`.

The default messages are texts: `'validation.required'`, `'validation.min'`, `'validation.max'`,
`'validation.minLength'`, `'validation.maxLength'` and `'validation.pattern'` in `TEXTS`. Translate
them with `setTexts()` - for the page, the datasource has no grid, so a grid's `texts` do not change
them. A rule's `message` can be a text id as well, see [Texts](12-texts.md#messages-of-your-own).

```ts
import { setTexts } from '@simple-html/grid';

setTexts({ 'validation.required': 'Må fylles ut', 'validation.max': 'Kan være høyst {value}' });
```

A message is made when the value is validated: after `setTexts()` an error already there keeps its
text until the field is validated again.

### Rules of your own

A validator is a function `(value, row, rule) => message | null`: `null` when the value is valid,
else the message - or a text id, the way the built-ins return `'validation.required'`. An id of your
own gets its text from `setTexts()`, so it can be translated. `rule` is
the rule written out, so a rule can carry options of its own. Register it before the datasource that
names it is made:

```ts
import { Datasource, registerValidator } from '@simple-html/grid';

// a number that must be there, 0 included
registerValidator('present', (value) => (value === null || value === undefined ? 'validation.required' : null));

// { id: 'oneOf', values: [...] }: the options come from the rule
registerValidator('oneOf', (value, _row, rule) => {
    if (value === null || value === undefined || value === '') {
        return null; // an empty value is the required rule's job
    }
    return Array.isArray(rule.values) && rule.values.includes(String(value)) ? null : 'Must be one of {values}';
});

// another field of the row: the end can not be before the start
registerValidator('afterStart', (value, row) =>
    value instanceof Date && row.start instanceof Date && value < row.start ? 'Before the start' : null
);

const datasource = new Datasource({
    fields: {
        discount: { type: 'number', validate: ['present'] },
        country: { validate: [{ id: 'oneOf', values: ['Norway', 'Sweden'] }] },
        start: 'date',
        end: { type: 'date', validate: ['afterStart'] }
    }
});
```

Keep a validator fast, it runs on every key the user types. Registering an id again replaces it, for
the datasources made after.

### When it runs

- **An edit is validated**, from the grid as the user types and from code (`row.age = -1`): the
  field's rules run, and so do the rules of the row's fields that have an error - an error that
  depends on the edited value (`afterStart` above) clears once it is fixed. An edit that makes the
  field valid clears its error.
- **The rows set with `setData()` are not validated, and neither are the fields of a new row from
  `addNewEmpty()`** until they are edited: an empty new row would be all errors before the user
  typed anything. The stripes of the required fields show what to fill in, and `validate()` before
  the save checks the fields never edited.
- **`validate()` checks every row**, or the rows given: every field with rules. It keeps the errors,
  the grid shows them, and returns them - one `{ row, field, messages }` per field with an error.
- `getErrors(rows?)` and `hasErrors()` read the errors there are now, without validating.
- `acceptChanges()` and `resetData()` clear the errors, `resetDataSelectionOnly()` those of the
  selected rows.
- A row marked for deletion is not saved, so it has no errors: `validate()` skips it, `getErrors()`
  and `hasErrors()` leave it out. Its errors are back when it is unmarked.

Validate before a save:

```ts
declare function showErrors(lines: string[]): void;

const errors = datasource.validate();
if (errors.length) {
    showErrors(errors.map(({ row, field, messages }) => `${row.name}, ${datasource.getField(field).label}: ${messages.join(', ')}`));
} else {
    const response = await fetch('/api/save', { method: 'POST', body: JSON.stringify(datasource.getChanges()) });
    if (response.ok) {
        datasource.acceptChanges();
    }
}

// only what a save sends: the new and edited rows
datasource.validate(datasource.getAllData().filter((row) => row.__rowState === 'N' || row.__rowState === 'M'));
```

`validate()` checks every row, also the rows the filter leaves out and the rows that were not
edited: data from a server that breaks a rule blocks the save too. Pass the new and edited rows to
check what the save sends only.

### How the grid shows the errors

- **A cell with an error** gets the class `simple-html-cell-error` - a red border inside the cell
  and a tint - and its messages as the tooltip, one per line.
- **The row number** of a row with an error gets `simple-html-row-error` - a red bar on its left and
  a tint - and the tooltip lists the server's error first, then a line per field:
  `Age: Must be at least 0`.
- The colors are css variables: `--simple-html-grid-error-color` and
  `--simple-html-grid-error-bg-color`.
- The tooltips are the grid's own, as on the filter editor's buttons: `tooltips: false` in the
  config turns them off. The `data-tooltip` attribute is written either way, for a tooltip library
  of your own.
- An edit in the grid shows its errors at once, and so does `validate()`. After an edit from code,
  call `gridInterface.refresh()`, as for its value.
- A field with the `required` rule shows stripes on its empty editable cells, see
  [Required fields and placeholders](#required-fields-and-placeholders).

## Saving

A save usually sends everything in one transaction: the deleted, edited and new rows of
`getChanges()`. After a successful save, `acceptChanges()` makes the grid show what was saved:

- the rows marked for deletion are removed
- the new rows become ordinary rows
- the values the rows have now become their original values: nothing counts as edited
- the row errors (`setErrors()`) and the validation errors are cleared

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
- Validate first: `validate()` returns the errors, see [Validation](#validation).
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

`setErrors()` on the datasource's container puts an error text on rows, by key - what a server said
about a save it refused. It is a `Map` from the key as text to the message. Every row not in the map
gets `null`:

```ts
import { createGrid, type GridConfig, type GridHooks } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    layout: { center: [{ fields: ['name'], width: 150 }] }
};
const hooks: GridHooks = {
    // the cells of the row too: .row-error { position: absolute; inset: 0; background: rgba(220, 38, 38, 0.2); }
    cellClass: (row) => (row.__rowError ? { background: 'row-error' } : null)
};
const grid = createGrid(host, { config, datasource, hooks });

datasource.getDataContainer().setErrors(new Map([['2', 'The name is taken']]));
grid.refresh();

const row = datasource.getDataRows()[0];
console.log(row.__rowError); // the message, or null
```

The grid shows `__rowError` on the row number, with the row's validation errors: the class
`simple-html-row-error`, and the message as the first line of its tooltip. Call `refresh()` after
`setErrors()`. To mark the cells of the row too, use the `cellClass` hook as above.

**Server errors and validation errors are kept apart.** A server error is the row's `__rowError`,
set with `setErrors()`; a validation error is a field's, from the rules (`getErrors()`). `setErrors()`
does not change the validation errors, and `validate()`, `getErrors()` and `hasErrors()` do not read
`__rowError` - a row the server refused is not invalid by the rules, and the next save may well work.
`acceptChanges()` clears both.

## Required fields and placeholders

- A field with the `required` rule (`validate: ['required']` in the datasource's `fields`, see
  [Validation](#validation)) shows its empty cells with stripes, until they have a value - empty as
  the rule sees it, so 0 too. Only in an editable grid, and only on editable cells. Restyle the
  stripes with the `simple-html-mandatory` class. It replaces the `mandatory` column option of v5.
- `placeholderRow` is text shown in an empty cell. By default only on the current row, set
  `placeholderRowCurrentEntityOnly: false` in the config to show it on every row.
- `placeholderFilter` is text shown in the empty header filter.

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';

const companies = new Datasource({ fields: { company: { validate: ['required'] } } });

const config: GridConfig = {
    readonly: false,
    placeholderRowCurrentEntityOnly: false,
    columns: {
        company: { placeholderRow: 'required' },
        phone: { placeholderRow: '+47 ...', placeholderFilter: 'search phone' }
    },
    layout: {
        center: [
            { fields: ['company'], width: 150 },
            { fields: ['phone'], width: 120 }
        ]
    }
};
createGrid(host, { config, datasource: companies });
```

```sample required-placeholders
```
