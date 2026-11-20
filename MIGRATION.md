# Migrating from v5 to v6

Every breaking change in v6, with what to change in your code. Ordered by area, not by date.

## Package

### Css is imported from the package root

The package now has an `exports` map, so files inside it can only be imported through the paths
it lists. The css moved from `dist/` to the root:

```ts
// v5
import '@simple-html/grid/dist/grid.css';
import '@simple-html/grid/dist/date.css';

// v6
import '@simple-html/grid/grid.css';
import '@simple-html/grid/date.css';
```

The same applies to any other deep import (`@simple-html/grid/dist/...`): import from
`@simple-html/grid` instead.

### Installing from a git branch builds `dist`

`dist` is not committed. Installing straight from a git branch now works because the `prepare`
script builds it on install. The tgz is made with `npm run build:tgz` (was part of `npm run build`).

## Renamed

`Formater` is spelled `Formatter` everywhere, and a few other typos in public names are fixed.
Search and replace is enough for all of them.

| v5 | v6 |
| --- | --- |
| `DateFormaterDDMMYYYY` | `DateFormatterDDMMYYYY` |
| `DateFormaterDDMMYYYYTHHMMSS` | `DateFormatterDDMMYYYYTHHMMSS` |
| `DateFormaterYYYYMMDD` | `DateFormatterYYYYMMDD` |
| `DateFormaterYYYYMMDDTHHMMSS` | `DateFormatterYYYYMMDDTHHMMSS` |
| `NumberFormaterComma` | `NumberFormatterComma` |
| `NumberFormaterDot` | `NumberFormatterDot` |
| `ValueFormater` (type) | removed, see [Fields and formatters](#fields-and-formatters) |
| `datasource.setValueFormater()` / `getValueFormater()` | removed, see [Fields and formatters](#fields-and-formatters) |
| `datasource.setDateFormater()` / `getDateFormater()` | removed, see [Fields and formatters](#fields-and-formatters) |
| `datasource.setNumberFormater()` / `getNumberFormater()` | removed, see [Fields and formatters](#fields-and-formatters) |
| `DataTypes` (type) | `FieldType`, with `'datetime'` added |
| `datasource.setLocalCompare()` | `setLocaleCompare()` |
| `datasource.deSelectAll()` | `deselectAll()` |
| config `placeHolderRowCurrentEnityOnly` | `placeHolderRowCurrentEntityOnly` |

## Removed

| v5 | v6 |
| --- | --- |
| `datasource.sortReset()` | `datasource.resetSort()` - it did the same |
| `import { html, render } from '@simple-html/grid'` | `import { html, render } from 'lit-html'` - it was only re-exported |
| `import { Grid } from '@simple-html/grid'` | not exported, it is the grid's internal class. Use `GridInterface`. |
| `import { EntityHandler } from '@simple-html/grid'` | type only: `import type { EntityHandler }` (it is the type of `Entity.__controller`) |

## Events

`addEventListener` and `removeEventListener` are removed from `Datasource`, `GridInterface` and
`DateInterface`. `on(name, handler)` subscribes to one event and returns a function that
unsubscribes. The handler gets the event's payload, typed from the event name:

```ts
// v5
const listener = {
    handleEvent: (e) => {
        if (e.type === 'collection-filtered') {
            console.log('filtered by', e.data.info);
        }
        if (e.type === 'selectionChange') {
            updateToolbar();
        }
        return true; // keep listening
    }
};
datasource.addEventListener(listener);
// later
datasource.removeEventListener(listener);

// v6
const offFiltered = datasource.on('collection-filtered', (data) => {
    console.log('filtered by', data.info);
});
const offSelection = datasource.on('selection-change', () => {
    updateToolbar();
});
// later
offFiltered();
offSelection();
```

* the handler gets the payload, not `{ type, data }`: `e.data.cell` is `data.cell`
* there is no listener for every event any more, subscribe to each event you need
* the handler must be a function, a `{ handleEvent }` object throws
* `DatasourceEvents`, `GridEvents` and `DateEvents` list every event and its payload. To type a
  handler you write on its own, use `EventHandler`:

```ts
import type { EventHandler, GridEvents } from '@simple-html/grid';

const onCellClick: EventHandler<GridEvents['cell-click']> = (data) => {
    console.log(data.attribute, data.rowData);
};
gridInterface.on('cell-click', onCellClick);
```

### No more "return true" to keep listening

In v5 a listener was only kept when it returned something truthy - one that returned nothing was
removed after the first event it got. In v6 what the handler returns is ignored, it stays
subscribed until you call the function `on()` returned. Remove the `return true`s.

If you relied on the v5 behaviour to listen only once, unsubscribe in the handler:

```ts
// v5: returned nothing, so it was dropped after the first event
gridInterface.addEventListener({
    handleEvent: (e) => {
        if (e.type === 'gridConnected') {
            gridInterface.autoResizeColumns();
        }
    }
});

// v6
const off = gridInterface.on('grid-connected', () => {
    off(); // only the first time
    gridInterface.autoResizeColumns();
});
```

### Renamed events

Every event name is kebab case now. The others already were and keep their names.

| v5 | v6 |
| --- | --- |
| `selectionChange` (datasource) | `selection-change` |
| `currentEntity` (datasource) | `current-entity` |
| `gridConnected` (grid interface) | `grid-connected` |

### `filter-operator-change` has a `rebuildHeader()` function

It used to hand out the grid's internal object and a function to call with it:

```ts
// v5
data.rebuildHeaderColumns(data.ctx);

// v6
data.rebuildHeader();
```

### Also removed

* the `Listener` type
* `DateInterface.callSubscribers()` is internal (`__callSubscribers`), like the datasource's and the
  grid interface's

## Group rows are not entities

When the datasource is grouped, `getRows()` has a group header row in front of each group. In v5
these were entities with `__group: true`. In v6 they have their own type, `GroupRow`, and
`isGroupRow(row)` tells them from a data row. The `__group*` fields keep their names.

```ts
import { isGroupRow } from '@simple-html/grid';

// v5
datasource.getRows().forEach((row) => {
    if (row.__group) {
        console.log(row.__groupName, row.__groupTotal);
    } else {
        console.log(row.name);
    }
});

// v6
datasource.getRows().forEach((row) => {
    if (isGroupRow(row)) {
        console.log(row.__groupName, row.__groupTotal);
    } else {
        console.log(row.name);
    }
});
```

`row.__group` still works, at runtime and for the type, `isGroupRow()` is the readable way. It
takes `null`/`undefined` too, so `isGroupRow(datasource.currentEntity)` is fine.

### `Entity` no longer has the group fields

`Entity` (and `DataEntity`) lost `__groupID`, `__groupName`, `__groupTotal`, `__groupChildren` and
`__groupExpanded` - they are on `GroupRow` now. `__groupLvl` stays on `Entity`.

`__group` is typed `never` on `Entity`: a data row never has it. That keeps the two types apart, so
a group row can no longer be passed where an entity is expected:

```ts
const row = datasource.getRow(0);
if (isGroupRow(row)) {
    datasource.markForDeletion(row); // compiled in v5, a type error in v6
    const entity: Entity = row; // a type error in v6
}
```

### The row types say when a row can be a group row

| | v5 | v6 |
| --- | --- | --- |
| `getRows()` | `EntityUnion<T>[]` | `(EntityUnion<T> \| GroupRow)[]` |
| `getRows(true)` | `EntityUnion<T>[]` | `EntityUnion<T>[]` - the return type follows the argument |
| `getRow(n)` | `EntityUnion<T>` | `EntityUnion<T> \| GroupRow` |
| `currentEntity` | `EntityUnion<T> \| null` | `EntityUnion<T> \| GroupRow \| null` |
| `getSelectedRows()` | `Entity[]` | `EntityUnion<T>[]` - never a group row |
| `cell-header-focus` event, `rowData` | `Entity` | `Entity \| GroupRow \| undefined` |

With a typed datasource (`new Datasource<Person>()`), reading your fields off `getRows()`,
`getRow()` or `currentEntity` is a type error until the group rows are ruled out:

```ts
// v5
const names = datasource
    .getRows()
    .filter((row) => !row.__group)
    .map((row) => row.name);

// v6: filtering with isGroupRow narrows the type (TypeScript 5.5 or newer)
const names = datasource
    .getRows()
    .filter((row) => !isGroupRow(row))
    .map((row) => row.name);

// or all data rows, without the group rows - the rows of collapsed groups included
const allNames = datasource.getRows(true).map((row) => row.name);
```

`currentEntity` is a group row when the keyboard moves from the first data row up into the header
filter row while grouped (row 0 becomes current, and that is a group row), or after
`setRowAsCurrentEntity()` with a group row's index. Clicking a group row, `select()`,
`selectNext()` ... never make one current.

The `cell-header-focus` event's `rowData` is not the header's own row: it is the first displayed
row. When grouped that is a group row, and `undefined` when there were no rows. The other cell
events (`cell-click`, `cell-row-focus`, ...), `readonlySetter()` and `cellAppendClassSetter()` only
ever get data rows, their types are unchanged.

## Fields and formatters

The datasource knows its fields now: their type, label and formatter. In v5 a type lived in three
places that could disagree - the grid's `attributes[].type`, `datasource.setDates([...])` for
sorting, and `attributeType` on every filter condition. In v6 it is set once, in the datasource's
`fields`, and sorting, grouping, filtering, formatting and the grid all read it from there.

```ts
const datasource = new Datasource({
    key: 'id',
    fields: {
        born: 'date', // the type only
        lastLogin: 'datetime',
        age: { type: 'number', label: 'Age' },
        price: { type: 'number', formatter: NumberFormatterComma }
    },
    formatters: { date: DateFormatterDDMMYYYY } // the default for every date field
});

datasource.getField('born'); // { name: 'born', type: 'date', label: 'born', formatter: DateFormatterDDMMYYYY }
datasource.getField('name'); // not listed: { name: 'name', type: 'text', label: 'name', formatter: TextFormatter }
datasource.getFormatter('price').format(12.5); // '12,5'
```

A field that is not listed is `'text'`. List every field that is not text.

### The constructor takes one options object

```ts
// v5
const datasource = new Datasource(new DataContainer('id'), { selectionMode: 'single' });

// v6
const datasource = new Datasource({ key: 'id', selectionMode: 'single' });
```

To share the rows between two datasources, pass the container. Its key is the key, a `key` that is
not the container's throws:

```ts
// v5
const container = new DataContainer('id');
const left = new Datasource(container);
const right = new Datasource(container);

// v6
const container = new DataContainer('id');
const left = new Datasource({ container, fields: { born: 'date' } });
const right = new Datasource({ container, fields: { born: 'date' } });
```

`DatasourceConfigOptions` is replaced by `DatasourceOptions`.

### Column types move from the grid config to `fields`

`Attribute.type` is removed. The grid takes a column's type from the datasource.

```ts
// v5
const datasource = new Datasource();
const gridConfig: GridConfig = {
    columnsCenter: [ ... ],
    attributes: [
        { attribute: 'name' },
        { attribute: 'age', type: 'number' },
        { attribute: 'born', type: 'date', label: 'Born' }
    ]
};

// v6
const datasource = new Datasource({
    fields: {
        age: 'number',
        born: { type: 'date', label: 'Born' } // or keep the label on the column, that still wins
    }
});
const gridConfig: GridConfig = {
    columnsCenter: [ ... ],
    attributes: [{ attribute: 'name' }, { attribute: 'age' }, { attribute: 'born' }]
};
```

A column's label is its own `label`, else the field's `label`, else the attribute name (the header
shows that one prettified, as before).

`dynamicCellTypeColumn` stays. It needs a text field, and a field that is not listed is text now -
in v5 the column needed `type: 'text'` set. Each row is formatted with the default formatter of its
type (`datasource.getFormatter(field, type)`), and `'datetime'` is a type it can name.

### `setDates()` is removed

A `date` field sorts on the day. A `datetime` field, and a field that is not listed, sort on the
full timestamp, like v5 did for the attributes not passed to `setDates()`.

```ts
// v5
datasource.setDates(['born']);

// v6
const datasource = new Datasource({ fields: { born: 'date' } });
```

### `date` and `datetime` replace `includesTime`

v5 decided per date formatter whether date filters compare with time: `includesTime` on the date
formatter, or `dateIncludesTime(attribute)` on a custom `ValueFormatter`. Both are removed. The type
decides:

* `date` - filters on the day: the time of day is ignored on the row value and the filter value.
  Sorts and groups on the day too.
* `datetime` - filters, sorts and groups on the full timestamp (the milliseconds are ignored by
  the filter). Its default formatter is `DateFormatterYYYYMMDDTHHMMSS`.

```ts
// v5: date filters with time
datasource.setDateFormatter(DateFormatterYYYYMMDDTHHMMSS);

// v6
const datasource = new Datasource({ fields: { changed: 'datetime' } });
```

The value stored is unchanged: a date typed into a cell still gets the current time of day.

Filter conditions still have `attributeType` until the filter format changes. A field listed in
`fields` always compares as its own type, `attributeType` is only used for a field that is not
listed.

### Formatters are per field

`ValueFormatter`, `DefaultValueFormatter`, `DateAndNumberFormatter`, `setValueFormatter()` /
`getValueFormatter()`, `setDateFormatter()` / `getDateFormatter()` and `setNumberFormatter()` /
`getNumberFormatter()` are removed. A formatter is set when the datasource is made: one per field in
`fields`, and the default per type in `formatters`.

```ts
// v5
datasource.setNumberFormatter(NumberFormatterComma);
datasource.setDateFormatter(DateFormatterDDMMYYYY);

// v6: every field of the type
const datasource = new Datasource({
    fields: { price: 'number', born: 'date' },
    formatters: { number: NumberFormatterComma, date: DateFormatterDDMMYYYY }
});

// v6: one field
const datasource = new Datasource({
    fields: { price: { type: 'number', formatter: NumberFormatterComma } }
});
```

A `ValueFormatter` that switched on the attribute name becomes a formatter on that field:

```ts
// v5
const formatter = datasource.getValueFormatter();
const original = formatter.fromSourceDisplay;
formatter.fromSourceDisplay = (value, type, attribute, isFilter) => {
    if (attribute === 'country' && value) {
        return String(value).toUpperCase();
    }
    return original.apply(formatter, [value, type, attribute, isFilter]);
};

// v6
const upperCase: Formatter = {
    ...TextFormatter,
    format: (value) => TextFormatter.format(value).toUpperCase()
};
const datasource = new Datasource({ fields: { country: { formatter: upperCase } } });
```

v5 had a different text for a readonly cell (`fromSourceDisplay`) and for the edit input
(`fromSource`). v6 has one, `format`, for both.

The formatters are fixed once the datasource is made. To switch, make a new datasource - or give
it a formatter that hands every call on to the one picked last (the `samples/grid01` playground
does that).

### The formatter methods

The built-in formatters keep their names, but are plain objects now, not classes with static
methods. A `Formatter` has `format`, `parse`, an optional `parseFilter` and an optional
`placeholder`:

| v5 | v6 |
| --- | --- |
| `fromSource(value)` | `format(value)` |
| `fromSourceDisplay(value)` | `format(value)` |
| `fromSourceGrouping(value)` | `format(value)` |
| `toSource(value)` | `parse(text)` |
| `toFilter(value)` | `parseFilter(text)` - optional, `parse` when left out |
| `placeholder()` | `placeholder` - a property, optional |
| `includesTime` | removed, use the `date` / `datetime` type |

`format` always returns text: `''` for a blank, where v5 could return null, a number or a boolean.
The new `TextFormatter` and `BooleanFormatter` are the defaults for `text` and `boolean` fields.

A formatter of your own is an object:

```ts
// v5: a class with six static methods
class MyNumberFormatter {
    static fromSource(value) { ... }
    static toSource(value) { ... }
    static toFilter(value) { return MyNumberFormatter.toSource(value); }
    static fromSourceDisplay(value) { ... }
    static fromSourceGrouping(value) { return MyNumberFormatter.fromSourceDisplay(value); }
    static placeholder() { return ''; }
}
datasource.setNumberFormatter(MyNumberFormatter);

// v6
const myNumberFormatter: Formatter = {
    format: (value) => (typeof value === 'number' ? value.toFixed(2) : ''),
    parse: (text) => (text.trim() === '' ? null : Number(text))
};
const datasource = new Datasource({ fields: { price: { type: 'number', formatter: myNumberFormatter } } });
```

The grid calls `parse` and `parseFilter` with text only. The checkbox of a boolean field shows the
raw value, it does not go through `format`.

### `getFilterString()` and `getFilterTree()` take a label function

They no longer take the grid. The labels come from the fields; pass a function to use other ones.
The grid's footer passes its column labels.

```ts
// v5
datasource.getFilterString({ gridInterface });

// v6
datasource.getFilterString(); // the field labels, else the field names
datasource.getFilterString((field) => myLabels[field] ?? field);
```

### Formatter fixes that change results

* `NumberFormatterComma.parse()` (was `toSource`) threw on null, undefined and a number. Now null
  and undefined give null and a number passes through, the same as `NumberFormatterDot`.
* The `*THHMMSS` formatters' `parseFilter()` (was `toFilter`) put the current milliseconds on a
  filter boundary. They are 0 now.
* `parse()` and `parseFilter()` of the date formatters gave null for a `Date`. A `Date` passes
  through now, and the date only formatters' `parseFilter()` moves it to the start of its day. In
  the grid this fixes changing the operator of a date column's header filter, which dropped the
  filter.
* The date formatters' `format()` gives `''` for a value that is not a `Date`, text or a number
  (v5 turned `true` into `1970-01-01`).

Other results that change:

* text shows 0 and false: a text field (every field not listed) shows `0` and `false` where the v5
  default formatter showed an empty cell
* a field that is not listed groups on its value as text. A `Date` in it used to be grouped by
  day - list it as a `date` field
* pasting `true` or `false` into a boolean column stores a boolean (v5 stored the pasted text, and
  false for an empty one - now null), and a boolean typed into the filter editor matches the rows
* copying a `datetime` cell from the row menu copies the time too

## Internals are no longer in the typings

Members meant for the grid itself were public and showed up in autocomplete. They are tagged
`@internal` and left out of the published `.d.ts` files, so calling them is now a type error:

* `GridInterface`: `connectGrid`, `handleEvent`, `__parseConfig`, `__getGridConfig`,
  `__disconnectGrid`, `__setSelectedColumn`, `__isColumnSelected`, `__selectedColumns`,
  `__isConnected`, `__dataSourceUpdated`, `__getScrollState`, `__callReadonlySetter`,
  `__callCellAppendClass`, `__callSubscribers`
* `Datasource`: `__select`, `__callSubscribers`, `getSelection`

Use `datasource.setRowAsCurrentEntity(row)` instead of `__select(row)`, and the selection methods
on the datasource (`select`, `selectAll`, `getSelectedRows` ...) instead of `getSelection()`.

## Types are stricter

The library is compiled with TypeScript `strict` now, and the types say what the code really
does. With `strict` on in your project, you may have to handle these:

* `datasource.getFilter()` returns `FilterArgument | null` - it is `null` when no filter is set.
  `setFilter(null)` is allowed.
* the state fields of a `GridConfig` from `saveConfig()` can be `null`: `sorting`, `grouping`,
  `filter`, `expandedGroups`, and `Attribute.currentFilterValue`
* `HTMLCellElement.$attribute` is `string | null` - group and selector cells have none
* `IDateConfig.datepickerDate` is `Date | null | undefined` - empty opens on today
* `getFilterString()` / `getFilterTree()` no longer take the grid, see
  [Fields and formatters](#getfilterstring-and-getfiltertree-take-a-label-function)

Types that public signatures use are now exported, so you can name them: `Columns`, `Sort`,
`ColType`, `EntityUnion`, `DataEntity`.

`readonlySetter(null)` and `cellAppendClassSetter(null)` were always allowed at runtime (they
remove the callback). The types say so now.
