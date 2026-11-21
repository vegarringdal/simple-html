# Datasource

The `Datasource` holds the rows. It sorts, filters and groups them, keeps the selection and the
current row, and tracks the edits. The grid shows what the datasource gives it, and most of what you
do from code goes through the datasource.

## Making one

Every option is optional, `new Datasource()` works.

```ts
import { Datasource } from '@simple-html/grid';

const datasource = new Datasource({
    key: 'id', // the field that identifies a row
    fields: {
        age: 'number',
        born: { type: 'date', label: 'Born' },
        lastLogin: 'datetime',
        active: 'boolean'
    },
    formatters: { date: 'dateDDMMYYYY' }, // the default formatter of every date field, by its id
    selectionMode: 'multiple' // the grid showing it uses this
});
```

| option | what it is |
| --- | --- |
| `key` | the field that identifies a row, see [Keys](#keys) |
| `fields` | the type, label and formatter id of each field that is not plain text, see [Fields and types](#fields-and-types) |
| `formatters` | the id of the default formatter per type, see [Formatting](08-formatting.md) |
| `selectionMode` | `'multiple'` (default), `'single'` or `'none'`. A grid showing the datasource uses it, see [Selection](#selection) |
| `container` | a `DataContainer` to share the rows with another datasource, see [Sharing the rows](#sharing-the-rows-between-two-datasources) |

All but `container` are plain JSON: a formatter is named by its id (`'dateDDMMYYYY'`, or one of your
own registered with `registerFormatter()`), so the options can be stored, see
[Saving the config](02-grid-config.md#saving-the-config).

With TypeScript, give it the type of your rows. The rows it hands out are then typed:

```ts
import { Datasource } from '@simple-html/grid';

interface Person {
    id: number;
    name: string;
    born: Date | null;
}

const people = new Datasource<Person>({ key: 'id', fields: { born: 'date' } });
const names = people.getDataRows().map((row) => row.name); // string[]
```

## Data in: `setData()`

```ts
declare const rowsFromServer: object[];
declare const moreRows: object[];

datasource.setData(rowsFromServer); // replaces the rows
datasource.setData(moreRows, { add: true }); // adds them after the rows there are
datasource.setData(moreRows, { add: true, refilter: false }); // shown even if the filter leaves them out
```

The new rows are filtered, sorted and grouped the way the datasource is: a filter that is set - from
code, the header filters or the filter editor - applies to them too. `refilter: false` shows every row
set, also one the filter would leave out, while the filter stays set (the header filters and the
footer still show it) until it runs again. v5 did that by default.

The datasource wraps each of your objects in a proxy that tracks its edits. The rows it hands out
are those proxies, not your objects: set values on the rows you get from the datasource, a change
made on your original object is not seen as an edit. See [Editing](05-editing.md).

Dates must be `Date` objects, numbers must be numbers. Convert values from JSON when you load them:

```ts
interface OrderJson {
    id: number;
    amount: string;
    ordered: string;
}
declare const json: OrderJson[];

datasource.setData(json.map((row) => ({ ...row, amount: Number(row.amount), ordered: new Date(row.ordered) })));
```

To delete rows, mark them: `markForDeletion(rows)` keeps them, struck through, so the delete can be
undone (`unmarkForDeletion(rows)`), and `getChanges()` sends it to the server - see
[Deleting rows](05-editing.md#deleting-rows) and [Saving](05-editing.md#saving).
`removeData(rows)` and `removeAllData()` remove rows for good, without tracking: for rows that never
came from a server.

```sample rows-data
```

## Data out

| method | returns |
| --- | --- |
| `getAllData()` | every row, unfiltered and in the order they were set. Rows marked for deletion included |
| `getDataRows()` | the rows that pass the filter, sorted. No group rows, and the rows of collapsed groups included |
| `getRows()` | the rows as the grid shows them: when grouped, a group row in front of each group, and the rows of a collapsed group left out |
| `getRow(n)` | one row of `getRows()`, 0 based. `undefined` out of range |
| `length()` | `getRows().length` |
| `getSelectedRows()` | the selected rows, in displayed order |
| `currentEntity` | the current row, see below |

`getRows()` and `getRow()` can return a group row when the datasource is grouped. `isGroupRow(row)`
tells them apart, see [Sorting and grouping](07-sorting-grouping.md#group-rows).

```ts
import { isGroupRow } from '@simple-html/grid';

for (const row of datasource.getRows()) {
    if (isGroupRow(row)) {
        console.log(row.__groupName, row.__groupTotal);
    } else {
        console.log(row.name);
    }
}

const visibleNames = datasource.getDataRows().map((row) => row.name);
```

`getDataRows()` and `getRows()` return the datasource's own lists. Read them, do not change them.

### The current row

`datasource.currentEntity` is the current row: the one the user clicked, or moved to with the
keyboard, or the last one selected from code. It is `null` until a row is made current. Use it for a
detail form next to the grid:

```ts
import { isGroupRow } from '@simple-html/grid';

datasource.on('current-entity', () => {
    const row = datasource.currentEntity;
    if (row && !isGroupRow(row)) {
        console.log('show in the form', row);
    }
});

datasource.setRowAsCurrentEntity(0); // the first displayed row, 0 based
```

When grouped it can be a group row: moving the focus with the keyboard from the first data row up
into the header filters makes row 0 current, and that is a group row. Check with `isGroupRow()`.

`setData()` sets `currentEntity` to `null`, and sends `current-entity`, when the current row is no
longer in the data: replaced rows are new objects, also when a row with the same key comes back. Rows
added with `add: true`, or the same row objects set again, keep it.

## Keys

`key` names the field that identifies a row, e.g. `'id'`. With a key:

- the selection follows the key, so it survives `setData()` with fresh rows from the server
- `getChanges()` gives each edited row by its key, see [Editing](05-editing.md#change-tracking)
- a row without a value in the key field gets a generated one, a negative number, written into
  that field. A new row from `addNewEmpty()` gets one too, until the server gives it its own:
  `acceptChanges({ newKeys })`, see [Saving](05-editing.md#saving)

Without a key every row gets a generated key that is not written into the row (`row.__KEY` reads
it). It is new every time the data is set, so the selection is lost on `setData()`.

## Fields and types

`fields` lists the fields that are not plain text, with their type. Writing only the type
(`born: 'date'`) is the same as `born: { type: 'date' }`. A field that is not listed is `'text'`,
labelled with its name.

| type | value | sorts and filters | shown as | edited with |
| --- | --- | --- | --- | --- |
| `'text'` | string | as text, filters ignore case | the text | an input |
| `'number'` | number | as numbers | `12.5`, right aligned | an input |
| `'boolean'` | boolean | true / false | a checkbox | the checkbox |
| `'date'` | `Date` | on the day, the time is ignored | `2026-11-20` | an input and a date picker |
| `'datetime'` | `Date` | on the full timestamp | `2026-11-20T08:15:00` | an input and a date picker |

**`date` or `datetime`?** Both hold a `Date`. A `date` field is about the day: a filter
`born = 2026-11-20` matches any time on that day, sorting and grouping ignore the time, and a change
of the time only is not an edit. A `datetime` field keeps the time everywhere: filters, sorting,
grouping, and a change of the time is an edit (to the second).

A `FieldConfig` can also have a `label` (the grid's column label falls back to it, and so does
`getFilterString()`), a `formatter`: the id of a registered formatter, see
[Formatting](08-formatting.md), and `validate`: the field's validation rules, see below.
`getField()` and `getFormatter()` give the formatter object.

```ts
import { Datasource } from '@simple-html/grid';

const datasource = new Datasource({
    fields: {
        born: { type: 'date', label: 'Born' },
        price: { type: 'number', formatter: 'numberComma', validate: ['required', { id: 'min', value: 0 }] }
    }
});

datasource.getField('born'); // { name: 'born', type: 'date', label: 'Born', formatter: DateFormatterYYYYMMDD, validate: [] }
datasource.getField('name'); // { name: 'name', type: 'text', label: 'name', formatter: TextFormatter, validate: [] }
datasource.getField('price').validate; // [{ id: 'required' }, { id: 'min', value: 0 }]
datasource.getFormatter('born').format(new Date(2026, 10, 20)); // '2026-11-20'
datasource.getFormatter('price').format(12.5); // '12,5'
```

### Validation rules

`validate` lists the field's rules: the id of a validator as text (`'required'`), or an object with
the id, its options and a message of its own (`{ id: 'max', value: 150, message: 'too old' }`). The
built-ins are `required`, `min`, `max`, `minLength`, `maxLength` and `pattern`; your own are
registered by id with `registerValidator()`, like the formatters, so the fields stay plain JSON. An
id that is not registered throws when the datasource is made.

```ts
import { Datasource } from '@simple-html/grid';

const people = new Datasource({
    key: 'id',
    fields: {
        name: { validate: ['required'] },
        age: { type: 'number', validate: ['required', { id: 'min', value: 0 }, { id: 'max', value: 150, message: 'too old' }] },
        zip: { validate: [{ id: 'pattern', value: '^[0-9]{4}$', message: 'Four digits' }] }
    }
});

people.setData([{ id: 1, name: 'Ann', age: 36, zip: '0150' }]);
people.getDataRows()[0].age = -1; // an edit is validated
people.getErrors(); // [{ row: <Ann>, field: 'age', messages: ['Must be at least 0'] }]
people.validate(); // every row, before a save
people.hasErrors(); // true
```

An edit is validated as it is made, `validate()` checks every row, and the grid shows the errors on
the cells and the row numbers. See [Validation](05-editing.md#validation) for the rules, the
messages, when they run and rules of your own.

To sort text with the rules of a language, set a collator: `datasource.setLocaleCompare('nb')`.

## Selection

The user selects rows by clicking them: ctrl+click adds a row, shift+click a range. A click on the
top left corner of the grid selects every row, ctrl+click there deselects them. That is the default
`'multiple'` mode, see [below](#the-selection-mode) for the others. From code:

```ts
datasource.select(1); // the first displayed row: select() counts from 1, getRow() from 0
datasource.select(5, { notify: true }); // and the grid scrolls to it
datasource.selectNext(); // also selectFirst(), selectPrev(), selectLast()
datasource.selectAll(); // 'multiple' mode only
datasource.deselectAll({ notify: true }); // notify: the grid shows it at once

const selected = datasource.getSelectedRows();
```

`select()` and the `select*()` methods make the row current too. A group row can not be selected,
`select()` takes the first data row after it.

### The selection mode

The datasource has the selection mode, the grid uses it - a grid has no option for it. Give it to
`new Datasource()`, or change it later, also while a grid shows the datasource:

```ts
import { createGrid, Datasource, type GridConfig } from '@simple-html/grid';

const people = new Datasource({ key: 'id', selectionMode: 'single' });
const config: GridConfig = { layout: { center: [{ fields: ['name'], width: 150 }] } };
createGrid(host, { config, datasource: people });

people.setSelectionMode('none'); // a click makes the row current, selects nothing
```

| mode | a click | ctrl+click, shift+click | `selectAll()`, the top left corner |
| --- | --- | --- | --- |
| `'multiple'` (default) | selects the row | adds a row, selects a range | selects every displayed row |
| `'single'` | selects the row | selects the row, as a click does | does nothing, sends no event |
| `'none'` | selects nothing | selects nothing | does nothing, sends no event |

In every mode a click makes the row current.

```sample selection
```

## Sharing the rows between two datasources

Two datasources can share their rows through one `DataContainer`, e.g. two grids that show the same
data with a different filter. Each has its own filter, sort, grouping and selection. The key goes to
the container:

```ts
import { DataContainer, Datasource } from '@simple-html/grid';

const container = new DataContainer('id');
const left = new Datasource({ container, fields: { born: 'date' } });
const right = new Datasource({ container, fields: { born: 'date' } });

left.setData([{ id: 1, name: 'Ann', born: new Date(1990, 4, 17) }]);
right.reloadDatasource(); // right shows the new rows once it rebuilds its own
```

- The rows and their edits are the container's: an edit is the same edit in both, and
  `getChanges()` gives the same result on both.
- Each datasource keeps its own list of displayed rows. After `setData()`, `removeData()`,
  `acceptChanges()` or `clearMarkedForDeletion()` on one, call `reloadDatasource()` (or `filter()`)
  on the other. Its selection is kept by key: a new row that `acceptChanges({ newKeys })` gave the
  server's key is no longer selected there.
- A field listed in both must have the same type in both, the second datasource throws if not.
  The validation rules are the container's too: a field with rules in one datasource is validated
  on every edit of the rows, and two datasources that both give a field rules must give it the same.
  The errors are the container's, like the changes - `validate()` on one sends its event on that one
  only: `refresh()` the other grid.
- A `key` given to a datasource with a `container` must be the container's key, or it throws.

## Events

The datasource sends events when its rows change, are sorted, filtered or grouped, and when the
selection or the current row changes. Subscribe with `datasource.on()`, see [Events](09-events.md).
