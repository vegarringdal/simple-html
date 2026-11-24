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
| `dataContainer.lenght()` | `length()` |
| config `placeHolderRowCurrentEnityOnly` | `placeholderRowCurrentEntityOnly`, see [Grid config](#grid-config) |

## Removed

| v5 | v6 |
| --- | --- |
| `datasource.sortReset()` | `datasource.resetSort()` - it did the same |
| `import { html, render } from '@simple-html/grid'` | `import { html, render } from 'lit-html'` - it was only re-exported |
| `import { Grid } from '@simple-html/grid'` | not exported, it is the grid's internal class. Use `GridInterface`. |
| `import { EntityHandler } from '@simple-html/grid'` | type only: `import type { EntityHandler }` (it is the type of `Entity.__controller`) |
| `GridConfig.selectionMode` | `new Datasource({ selectionMode })` or `datasource.setSelectionMode()`, see [below](#selectionmode-is-the-datasources) |
| `ColumnConfig.mandatory` | the field's `required` rule, `fields: { name: { validate: ['required'] } }` - see [Validation](#validation-mandatory-is-the-required-rule) |
| `ColumnConfig.mandatoryOnlyIfEmpty` | nothing - it had no effect, `mandatory` marked only the empty cells |
| `GridConfig.tooltipText`, `TOOLTIPS` | `GridConfig.texts` / `setTexts()` and `TEXTS`, the ids end with `.tooltip` - see [Texts](#texts) |
| `OPERATORS` | the texts `filterString.operator.<FilterOperator>` in `TEXTS`, see [Texts](#texts) |
| `IDateConfig.monthHeader`, `IDateConfig.weekHeader` | the texts `datePicker.month.*` and `datePicker.day.*`, see [Texts](#texts) |

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

It used to hand out the grid's internal object and a function to call with it. It also sends the
field, the operator picked and the column's options on their own now, the operator is state - see
[Grid config](#grid-config):

```ts
// v5
gridInterface.addEventListener({
    handleEvent: (e) => {
        if (e.type === 'filter-operator-change') {
            e.data.cellConfig.placeHolderFilter = e.data.cellConfig.operator;
            e.data.rebuildHeaderColumns(e.data.ctx);
        }
        return true;
    }
});

// v6
gridInterface.on('filter-operator-change', (data) => {
    data.column.placeholderFilter = data.operator; // data.field is the column's field
    data.rebuildHeader();
});
```

| v5 | v6 |
| --- | --- |
| `cellConfig` | `column`, the column's `ColumnConfig` as the grid uses it |
| `cellConfig.attribute` | `field` |
| `cellConfig.operator` | `operator`, the operator picked (`getState().headerFilters[field].operator`) |
| `rebuildHeaderColumns(ctx)` | `rebuildHeader()` |

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
| `getRows(true)` | `EntityUnion<T>[]` | `getDataRows()`: `EntityUnion<T>[]`, see [Options objects](#options-objects-instead-of-boolean-flags) |
| `getRow(n)` | `EntityUnion<T>` | `EntityUnion<T> \| GroupRow \| undefined` - `undefined` out of range, as v5 returned too |
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
const allNames = datasource.getDataRows().map((row) => row.name);
```

`currentEntity` is a group row after `setRowAsCurrentEntity()` with a group row's index. Clicking a
group row, `select()`, `selectNext()` ... never make one current, and moving into the header filter row
from the keyboard leaves the current row as it is (v5 made row 0 current - a group row when grouped).

The `cell-header-focus` event's `rowData` is not the header's own row: it is the first displayed
row. When grouped that is a group row, and `undefined` when there were no rows. The other cell
events (`cell-click`, `cell-row-focus`, ...) and the `isReadonly` / `cellClass` hooks (were
`readonlySetter()` / `cellAppendClassSetter()`, see [The callbacks are hooks](#the-callbacks-are-hooks-isreadonly-and-cellclass))
only ever get data rows.

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
        price: { type: 'number', formatter: 'numberComma' } // a formatter, by its id
    },
    formatters: { date: 'dateDDMMYYYY' } // the default for every date field
});

datasource.getField('born'); // { name: 'born', type: 'date', label: 'born', formatter: DateFormatterDDMMYYYY }
datasource.getField('name'); // not listed: { name: 'name', type: 'text', label: 'name', formatter: TextFormatter }
datasource.getFormatter('price').format(12.5); // '12,5'
```

A field that is not listed is `'text'`. List every field that is not text.

The options are plain JSON: a formatter is named by its id, see
[Formatters are named by id](#formatters-are-named-by-id-registerformatter). `getField()` and
`getFormatter()` give the formatter object.

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
    layout: { center: [ ... ] } // no columns needed: name, age and born have no other options
};
```

`attributes` and `columnsCenter` are gone too, see [Grid config](#grid-config).

A column's label is its own `label`, else the field's `label`, else the field name prettified
(`first_name` is `First Name`). The grid shows that label everywhere; in v5 only the header, the
column chooser and the attribute menu prettified the name, while the footer filter, the filter editor,
the group chip and a copied table showed `first_name`.

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

Filters take the type from `fields` too, a condition has no `attributeType` any more - see
[Filters](#filters).

### Formatters are per field

`ValueFormatter`, `DefaultValueFormatter`, `DateAndNumberFormatter`, `setValueFormatter()` /
`getValueFormatter()`, `setDateFormatter()` / `getDateFormatter()` and `setNumberFormatter()` /
`getNumberFormatter()` are removed. A formatter is set when the datasource is made, by its id: one
per field in `fields`, and the default per type in `formatters`.

```ts
// v5
datasource.setNumberFormatter(NumberFormatterComma);
datasource.setDateFormatter(DateFormatterDDMMYYYY);

// v6: every field of the type
const datasource = new Datasource({
    fields: { price: 'number', born: 'date' },
    formatters: { number: 'numberComma', date: 'dateDDMMYYYY' }
});

// v6: one field
const datasource = new Datasource({
    fields: { price: { type: 'number', formatter: 'numberComma' } }
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
registerFormatter('upperCase', upperCase);
const datasource = new Datasource({ fields: { country: { formatter: 'upperCase' } } });
```

v5 had a different text for a readonly cell (`fromSourceDisplay`) and for the edit input
(`fromSource`). In v6 `format` is the text of a cell, and the optional `formatForEdit` the text while
it is edited (its input has the focus) - left out, `format`.

The formatters are fixed once the datasource is made. To switch, make a new datasource - or give
it a formatter that hands every call on to the one picked last (the `samples/grid01` playground
does that).

### Formatters are named by id: `registerFormatter()`

The datasource's options name a formatter by its id, so `fields` and `formatters` are plain JSON and
can be stored, in a backend say. The built-in formatters are registered under ids from the start, a
formatter of your own is registered with `registerFormatter(id, formatter)` before the datasource
that names it is made.

| formatter | id |
| --- | --- |
| `TextFormatter` | `'text'`, the default for `text` |
| `BooleanFormatter` | `'boolean'`, the default for `boolean` |
| `NumberFormatterDot` | `'numberDot'`, the default for `number` |
| `NumberFormatterComma` | `'numberComma'` |
| `DateFormatterYYYYMMDD` | `'dateYYYYMMDD'`, the default for `date` |
| `DateFormatterDDMMYYYY` | `'dateDDMMYYYY'` |
| `DateFormatterYYYYMMDDTHHMMSS` | `'datetimeYYYYMMDD'`, the default for `datetime` |
| `DateFormatterDDMMYYYYTHHMMSS` | `'datetimeDDMMYYYY'` |

```ts
// v5
datasource.setNumberFormatter(MyNumberFormatter);

// v6: registered once, when the page loads, and named by its id
registerFormatter('myNumber', myNumberFormatter);
new Datasource({ fields: { price: { type: 'number', formatter: 'myNumber' } } });
```

* **An id that is not registered throws** when the datasource is made, and the message lists the
  ids that are. So does a formatter object where an id goes.
* **The datasource looks the ids up once**, when it is made. Registering an id again replaces the
  formatter for the datasources made after, a built-in id too: replacing `'numberDot'` changes every
  number field without a formatter of its own. Pick an id of your own unless that is what you want.
* The exported objects stay: call them yourself (`NumberFormatterComma.format(12.5)`), spread them
  into a variant, or register them under an id of your own.

### The formatter methods

The built-in formatters keep their names, but are plain objects now, not classes with static
methods. A `Formatter` has `format`, `parse`, an optional `parseFilter` and an optional
`placeholder`:

| v5 | v6 |
| --- | --- |
| `fromSource(value)` | `format(value)`, or `formatForEdit(value)` for the text while a cell is edited |
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
registerFormatter('myNumber', myNumberFormatter);
const datasource = new Datasource({ fields: { price: { type: 'number', formatter: 'myNumber' } } });
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

## Filters

`FilterArgument` is replaced by one small format, the same for a filter you pass in, the one
`getFilter()` returns and the one in the grid's state (`getState().filter`). A filter is a `FilterExpression`: a
condition, or a group of conditions and groups.

```ts
type FilterExpression = FilterGroup | FilterCondition;
interface FilterGroup { group: 'AND' | 'OR'; children: FilterExpression[] }
interface FilterCondition { field: string; operator: FilterOperator; value?: unknown; valueField?: string }
```

```ts
// v5
datasource.filter({
    type: 'GROUP',
    logicalOperator: 'AND',
    filterArguments: [
        { type: 'CONDITION', logicalOperator: 'NONE', attribute: 'age', attributeType: 'number', operator: 'GREATER_THAN', value: 18, valueType: 'VALUE' },
        {
            type: 'GROUP',
            logicalOperator: 'OR',
            filterArguments: [
                { attribute: 'country', operator: 'EQUAL', value: 'Norway' },
                { attribute: 'country', operator: 'EQUAL', value: 'Sweden' }
            ]
        }
    ]
});

// v6
import { and, or, where } from '@simple-html/grid';

const datasource = new Datasource({ fields: { age: 'number' } }); // the type lives here now
datasource.filter(and(where('age', 'GREATER_THAN', 18), or(where('country', 'EQUAL', 'Norway'), where('country', 'EQUAL', 'Sweden'))));

// the same, written out
datasource.filter({
    group: 'AND',
    children: [
        { field: 'age', operator: 'GREATER_THAN', value: 18 },
        {
            group: 'OR',
            children: [
                { field: 'country', operator: 'EQUAL', value: 'Norway' },
                { field: 'country', operator: 'EQUAL', value: 'Sweden' }
            ]
        }
    ]
});
```

| v5 | v6 |
| --- | --- |
| `FilterArgument` (type) | `FilterExpression` = `FilterGroup \| FilterCondition` |
| `FilterComparisonOperator` (type) | `FilterOperator`, the operator names are the same |
| `attribute` | `field` |
| `operator`, `value` | unchanged |
| `logicalOperator: 'AND' \| 'OR'` on a group | `group: 'AND' \| 'OR'` |
| `filterArguments` | `children` |
| `type: 'GROUP' \| 'CONDITION'` | removed - a group is what has `children` |
| `logicalOperator: 'NONE'` on a condition | removed |
| `valueType: 'VALUE'` | removed |
| `valueType: 'ATTRIBUTE'`, the other field's name in `value` | `valueField: 'name'` |
| `attributeType` | removed - the type comes from the datasource's `fields` |
| `FilterAttributeSimple`, `FilterExpressionType`, `FilterLogicalOperator`, `FilterValueType` (types) | removed |
| `datasource.filter([a, b])` | `datasource.filter(and(a, b))` |
| `datasource.filter({ logicalOperator: 'AND', filterArguments: [] })` to clear | `datasource.filter(null)` |

### Builders

`where(field, operator, value?)` makes a condition, `and(...children)` and `or(...children)` make
groups. They return the plain objects above, so a filter built with them can be stored, compared
and changed like any other. `where` leaves `value` out when it is not given (`IS_BLANK`).

```ts
where('email', 'IS_BLANK'); // { field: 'email', operator: 'IS_BLANK' }
and(where('a', 'EQUAL', 'x'), where('b', 'EQUAL', 'y')); // { group: 'AND', children: [...] }
```

### `filter()`, `setFilter()` and `getFilter()`

* `filter(expression)` sets the filter and runs it, `filter()` runs the current one again, and
  `filter(null)` removes it. In v5 `filter(null)` ran the current filter again, like `filter()`.
* The array form, `filter([a, b])`, is removed. It meant AND: use `and(a, b)`.
* An empty group is kept as it is and filters nothing out. v5 turned
  `filter({ logicalOperator: 'AND', filterArguments: [] })` into no filter; use `filter(null)`.
* `getFilter()` returns the object that was given. v5 wrapped a single condition passed to
  `filter()` in an AND group, v6 keeps it as the root.

### Compare with another field: `valueField`

```ts
// v5
datasource.filter({ attribute: 'changed', operator: 'GREATER_THAN', value: 'approved', valueType: 'ATTRIBUTE' });

// v6
datasource.filter({ field: 'changed', operator: 'GREATER_THAN', valueField: 'approved' });
```

`valueField` wins when `value` is set too. `getFilterString()` and `getFilterTree()` show the other
field by its label, v5 showed its name.

### `attributeType` is gone, the type comes from `fields`

A condition has no type. The datasource compares it as the type of its field in `fields`, and a
field that is not listed is `'text'`. If you set `attributeType` on conditions for fields that are
not in `fields`, list those fields instead:

```ts
// v5
const datasource = new Datasource();
datasource.filter({ attribute: 'planned', operator: 'GREATER_THAN', value: '10', attributeType: 'number' });

// v6
const datasource = new Datasource({ fields: { planned: 'number' } });
datasource.filter(where('planned', 'GREATER_THAN', '10'));
```

Unchanged: a number value still compares as a number and a `Date` value as a date, also on a field
that is not listed.

### A single condition at the root works everywhere

The root of a filter can be a group or one condition. In v5 a condition set with `setFilter()` was
filtered on, but `getFilterString()` returned `''`, `getFilterTree()` returned `null` (so the
footer showed nothing), and the header filter's "Is Blank" dropped it. Now it is shown and kept:
`getFilterString()` puts it in parentheses like a group of one, `getFilterTree()` in an AND group,
and a header filter on another column is ANDed with it.

### Incomplete conditions are still ignored

A condition without `field` or `operator`, a date condition without the value it needs and an
empty group filter nothing out. That is how plain js can hand in a half built filter. Two changes:

* `getFilterTree()` returns `null` when nothing of the filter is shown - the same case where
  `getFilterString()` returns `''`. v5 returned an empty group when every condition was incomplete.
* The filter editor applies only the conditions that are complete: a condition with no field or
  operator picked, or set to compare with a field that is not picked yet, is left out. The open
  dialog keeps it. A `Date` stays a `Date` (v5 applied a JSON copy, so it became text).

### Other changes

* The header filter menu ("Clear Filter", "Set Is Blank") sets a new filter instead of changing the
  current filter object in place.
* An `IN` / `NOT_IN` condition with the list as text (one value per line) is left as it is. v5
  wrote it back as an upper case array while filtering.
* The `operator` of a column in the grid config (`ColumnConfig.operator`) is a `FilterOperator`.

### Saved configs

A `GridConfig.filter` saved by v5 (`saveConfig()`) has the old shape. v6 reads it as an incomplete
condition and ignores it, it does not throw. To keep saved filters, convert them when you load them
(the [whole v5 config](#a-v5-config-converted) has changed too, its converter uses this one):

```ts
import { convertV5Filter, normalizeFilter } from '@simple-html/grid';

const saved = JSON.parse(localStorage.getItem('my-grid-layout') ?? 'null');
if (saved?.filter) {
    gridInterface.setState({ filter: convertV5Filter(saved.filter) });
}

// a link of v5 or v6 (?filter=...), either shape: v6, or null
const fromLink = normalizeFilter(new URLSearchParams(location.search).get('filter'));
```

`convertV5Filter()` makes a group's `logicalOperator: 'OR'` an OR group (anything else AND), `attribute`
the `field`, `valueType: 'ATTRIBUTE'` a `valueField`, and leaves out an incomplete condition as v5 did.
What is no v5 filter throws a `TypeError`. `isV5Filter()` tells the shapes apart. A backend has the same
three in `@simple-html/grid/sql`, see [SQL](guides/22-sql.md#links-and-bookmarks-of-v5).

`attributeType` is dropped: list the field in `fields`.

### 0 is blank - unchanged, on purpose

A row value of 0 still counts as blank: `IS_BLANK` matches a numeric 0 (in any field, not only
number fields) and `IS_NOT_BLANK` leaves it out, and the header's value list (text fields) puts a 0 under "Blank". In ERP style data
0 and empty mean the same, and changing it would silently change what existing filters match. It
is documented on `FilterOperator`.

### Operators per type, and what changed in what they match

Each field type offers its own operators now (`operatorsFor(type)`): text has no `<` / `>`, numbers
and dates have no "contains" / "begins with", booleans have `EQUAL`, `NOT_EQUAL_TO` and the blank ones.
The rules per type, for a backend that filters the same way, are in the filtering guide, "Operators".

* **`ColumnConfig.operator` is checked**: it must be one of the column's type that the header input
  can take - not `IN`, `NOT_IN`, `IS_BLANK`, `IS_NOT_BLANK`, and not `CONTAINS` on a number. Another
  throws a `TypeError` when the config is set. A saved header filter state with an operator the
  column does not offer is skipped, the column's default is used.
* **Saved filters with the old number and date operators still work**: `CONTAINS` / `BEGIN_WITH` on a
  number or date still mean `>=`, `END_WITH` `<=`, `DOES_NOT_CONTAIN` `<`. The menus and the editor no
  longer offer them (the editor keeps one it opens with); use the comparisons or the new `BETWEEN`.
* **A condition with a blank value filters nothing**, for every type (v5: only dates). A text
  condition with value `''` or null used to find the empty rows, a number one the 0s. Use `IS_BLANK`.
* **Booleans**: a blank (null, `''`, 0) compares as false, as the checkbox shows it, so `EQUAL false`
  finds the blank rows too. `NOT_EQUAL_TO` on a boolean is a real not-equal (v5 read it as `EQUAL`).
* **A multi-line text is one text**: `BEGIN_WITH`, `END_WITH` and a wildcard `EQUAL` match the whole
  value, not one of its lines, and `*` / `%` span line breaks.
* **Text `<` / `>`** compare the texts without wildcards (a `*` turned them into `EQUAL`).
* **`_` is a wildcard in a text filter**: one character, any, as in SQL `LIKE` - `p_mp` finds `pump`.
  It was literal. A backend that filtered with `LIKE` and escaped the `_` should no longer escape it
  (`toSqlWhere()` does that for you).
* **`\` escapes a wildcard in a text filter**: `pump\_01` finds `pump_01` only, `50\%` a `%`, `a\*b` a
  `*`, `\\` one backslash. In v5 a `\` was an ordinary character: a saved filter value with `\*`, `\%`,
  `\_` or `\\` in it now finds the character after the `\` as plain text - write the `\` as `\\`. A `\`
  before anything else stays a `\` (`C:\temp`). `escapeTextPattern(text)` does that
  for a text you put in a filter as it is; the row menu's *Filter by this value* does it already.
* **`getFilterTree()`**: every condition node has `caseSensitive` (a boolean), a `BETWEEN` node
  `valueTo`.
* **Menu hooks**: the header menu's Filter › has new entries (Match case, more operators) - see
  `MENU_IDS.filter`.

## Options objects instead of boolean flags

No method of `Datasource` or `DataContainer` takes a positional boolean any more. A call like
`setData(rows, true, true)` did not say what the `true`s meant; the options are named now, and a
flag that changed what a method does is a method of its own. Every option is optional and keeps
the default the boolean had - apart from `setData()`'s `refilter`, which is `true` now, see
[below](#setdata-runs-the-filter-by-default).

TypeScript flags an old call. Plain JavaScript would not, and `setData(rows, true)` would quietly
replace the rows instead of adding them - so an old call **throws a `TypeError`** that shows the
v6 way to write it, e.g. `setData() takes an options object in v6, not a boolean: setData(rows, { add: true })`.

| v5 | v6 |
| --- | --- |
| `datasource.setData(rows, add, reRunFilter)` | `datasource.setData(rows, { add, refilter })` |
| `datasource.sort(args, add)` | `datasource.sort(args, { add })` |
| `datasource.setOrderBy(args, add)` | `datasource.setOrderBy(args, { add })` |
| `datasource.group(groups, add)` | `datasource.group(groups, { add })` |
| `datasource.select(row, triggerSelect)` | `datasource.select(row, { notify })` |
| `datasource.deselectAll(triggerEvent)` | `datasource.deselectAll({ notify })` |
| `datasource.addNewEmpty(row, scrollto)` | `datasource.addNewEmpty(row, { scrollTo })` |
| `datasource.markForDeletion(rows)` | unchanged |
| `datasource.markForDeletion(null, true)` | `datasource.markAllForDeletion()` |
| `datasource.removeData(rows, false, rerunFilters)` | `datasource.removeData(rows, { refilter })` |
| `datasource.removeData(null, true)` | `datasource.removeAllData()` |
| `datasource.getRows(true)` | `datasource.getDataRows()` |
| `datasource.length(true)` | `datasource.getDataRows().length` |
| `container.setData(rows, add, tagAsNew)` | `container.setData(rows, { add, isNew })` |
| `container.markForDeletion(null, true)` | `container.markAllForDeletion()` |
| `container.removeData(null, true)` | `container.removeAllData()` |

| option | default | what it does |
| --- | --- | --- |
| `setData` `add` | `false` | add the rows to the ones there are, instead of replacing them |
| `setData` `refilter` | `true` (v5: `false`) | run the current filter on the rows. `false` shows every row set, also one the filter leaves out |
| `sort` / `setOrderBy` `add` | `false` | add to the current sort, as shift+click on a header does |
| `group` `add` | `false` | add the groups after the current grouping |
| `select` `notify` | `false` | send the `select` event, so the grid scrolls to the row |
| `deselectAll` `notify` | `false` | send the `selection-change` event, so the grid shows it right away |
| `addNewEmpty` `scrollTo` | `true` | select the new row and make it current, the grid scrolls to it |
| `removeData` `refilter` | `true` | rebuild the displayed rows. Pass `false` for all but the last of many calls |
| `container.setData` `isNew` | `false` | make the rows new rows, as `addNewEmpty()` does |

```ts
// v5
datasource.setData(moreRows, true);
datasource.sort({ attribute: 'age', ascending: false }, true);
datasource.deselectAll(true);
datasource.addNewEmpty({ company: 'NEW' }, false);
datasource.markForDeletion(null, true);
const count = datasource.length(true);

// v6
datasource.setData(moreRows, { add: true });
datasource.sort({ attribute: 'age', ascending: false }, { add: true });
datasource.deselectAll({ notify: true });
datasource.addNewEmpty({ company: 'NEW' }, { scrollTo: false });
datasource.markAllForDeletion();
const count = datasource.getDataRows().length;
```

TypeScript reports every old call, and in plain js an old call **throws a `TypeError`** that
shows the v6 form (see the top of this section) - so `setData(rows, true)` can not quietly replace
the rows it was meant to add.

Also changed:

* `getRows()` has no overloads any more: it returns `(EntityUnion<T> | GroupRow)[]`, and
  `getDataRows()` returns `EntityUnion<T>[]`. Where you passed a variable,
  `flag ? datasource.getDataRows() : datasource.getRows()` gives the same type as `getRows(flag)`.
* `markForDeletion()` and `removeData()` take a row or a list of rows, not `null`.
* `removeAllData()` sends the same `collection-changed` event as `removeData(null, true)` did, with
  `data: null`. `markAllForDeletion()` sends `collection-filtered` with `info: 'markForDeletion'`.
* `addNewEmpty(row)` takes `Partial<T>`: on a typed datasource, a new row with some of its fields
  compiles now (v5 wanted every field of `T`).
* `container.setData()` returns `Entity[]`, never `undefined`.
* `EntityHandler`'s constructor takes `{ key, isNew, fieldType }` (was `(keyString, tagAsNew)`). It
  only matters for a handler of your own given to `container.overrideEntityHandler()`.

### `setData()` runs the filter by default

In v5 `setData()` did not run the filter (`reRunFilter` was `false`): rows set while a filter was set
- from code, a header filter or the filter editor - were all shown, also the ones the filter leaves
out, while the header filters and the footer still showed the filter. In v6 the filter applies to
them. Pass `refilter: false` for the v5 behaviour:

```ts
// v5: every new row shown, the filter not run on them
datasource.setData(rows);
datasource.setData(moreRows, true);

// v6: the filter runs on them
datasource.setData(rows);
datasource.setData(moreRows, { add: true });

// v6, as v5 did
datasource.setData(rows, { refilter: false });
```

`setData(rows, { refilter: false })` while there is no filter, sort or grouping still sends
`collection-filtered` with `info: '__internalUpdate, forced'` before `collection-changed`, as v5's
`setData()` did. A `setData()` that runs the filter sends `collection-changed` only.

## Change tracking: `getChanges()`

### The result is typed

`getChanges()` returns `Changes<T>`, with `T` the row type of the datasource. The names are the
v5 ones:

```ts
interface Changes<T> {
    newEntities: T[];                     // rows added with addNewEmpty()
    modifiedEntities: ModifiedEntity<T>[]; // per edited row: its key and the changed fields
    deletedEntities: T[];                 // rows marked for deletion
}
type ModifiedEntity<T> = Partial<T> & { __KEY?: string | number };
```

```ts
const datasource = new Datasource<Person>({ key: 'id', fields: { born: 'date' } });
// ...
const { newEntities, modifiedEntities, deletedEntities } = datasource.getChanges();
modifiedEntities[0]; // { id: 1, name: 'Anna' } - the key, under the key field, and the changed fields
```

A modified entry has the key under the key field's name (`id` above), or `__KEY` when the
datasource has no key - as in v5. `DataContainer.getChanges()` returns `Changes` (rows typed
`Record<string, unknown>`).

### The entries are copies, not JSON

v5 returned a JSON copy: a `Date` was its ISO text, a field set to `undefined` was left out. v6
returns plain shallow copies of the rows, so the values keep their type - a `Date` is a `Date`.
Sending the result as JSON gives the same text as before. If you read the dates as text, convert
the result yourself:

```ts
// v5: changes.modifiedEntities[0].born was '1990-05-17T06:30:00.000Z'
const asV5 = JSON.parse(JSON.stringify(datasource.getChanges()));
```

The copies are shallow: an object in a field is the row's own object, not a copy of it.

### A field edited back is not a change

v5 put every field that was ever edited in a row's modified entry, also a field set back to its
original value - when another field of the row was still edited. Now the entry has only the fields
that differ from the original:

```ts
row.name = 'Anna';
row.city = 'Bergen';
row.name = 'Ann'; // the original

datasource.getChanges().modifiedEntities;
// v5: [{ id: 1, name: 'Ann', city: 'Bergen' }]
// v6: [{ id: 1, city: 'Bergen' }]
```

### Dates are compared by the field's type

v5 compared every `Date` on the day, so changing only the time was no edit. v6 takes the type from
the datasource's `fields`:

* `date` - on the day, as v5. A date typed into a cell gets the current time of day, typing the
  same day again is no edit.
* `datetime` - to the second: **a time only change is an edit now**. The milliseconds are ignored
  (they are not shown, and typing a time stamps the current ones).
* a field that is not listed (a text field) - to the second too. **v5 compared it on the day**:
  list your date only fields as `date`.

A `DataContainer` used without a datasource knows no types, every field compares to the second.

### Datasources that share a container must agree on the field types

The edits are tracked by the container, so it needs one type per field. It takes the types from
the `fields` of every datasource made on it: a field listed by one datasource has that type, and a
field two datasources list must have the same type in both, else the second throws.

```ts
const container = new DataContainer('id');
const left = new Datasource({ container, fields: { born: 'date' } });
const right = new Datasource({ container }); // fine: born is a date field for the edits made in right too
const wrong = new Datasource({ container, fields: { born: 'datetime' } });
// throws: field 'born' is 'datetime' here and 'date' in another datasource on the same container
```

### Deleting a new row marks it

v5 removed a new row (from `addNewEmpty()`) at once when it was marked for deletion - by
`markForDeletion(rows)` and by `markForDeletion(null, true)` - so the delete could not be undone. v6
marks it like any other row:

* while it is marked it is in none of the lists of `getChanges()`, as in v5: it was never saved, there
  is nothing to send
* it stays in `getAllData()`, `getDataRows()` and the grid, with `__rowState` `'D'`, and
  `getMarkedForDeletion()` lists it
* `unmarkForDeletion(rows)` brings it back as a new row
* `acceptChanges()`, `clearMarkedForDeletion()` and `resetData()` remove it

```ts
datasource.addNewEmpty({ name: 'New' }); // selected
const [added] = datasource.getSelectedRows();
datasource.markForDeletion(added);

// v5: gone from the data
// v6: still there, marked, and not sent
datasource.getAllData().includes(added); // true
datasource.getChanges().newEntities; // []
datasource.unmarkForDeletion(added); // a new row again
```

Code that counted on the row being gone - `getAllData().length` after a delete, say - can call
`removeData(rows)` for the new rows, or count the rows that are not marked.

### `newEntities` have the temporary key without a key field

A new row gets a generated key, a negative number. With a `key` it is in the key field, as before.
Without one, v5 left it out of `getChanges().newEntities`; v6 puts it in as `__KEY` - as
`modifiedEntities` always did - so the key the server gives the row can be handed back with
`acceptChanges({ newKeys })`. A server that stores every field it gets should leave `__KEY` out.

### New: undo a delete, accept the changes after a save

| method | what it does |
| --- | --- |
| `unmarkForDeletion(rows)`, `unmarkAllForDeletion()` | undo a delete: the mark is taken off, the edits are kept |
| `acceptChanges({ rows?, newKeys? })` | after a save: the marked rows are removed, new rows become ordinary rows, the edited values become the originals, the row errors are cleared. `newKeys` maps each temporary key to the server's key |
| `hasChanges()` | `true` when `getChanges()` lists a row, for an "unsaved changes" indicator |

They are on `Datasource` and `DataContainer`. v5 had no way to accept the changes and keep the rows,
the data was set again - that still works:

```ts
// v5
const freshRows = await save(datasource.getChanges());
datasource.setData(freshRows);

// v6: keeps the rows. The server answers with the id it gave each new row
const saved = await save(datasource.getChanges());
datasource.acceptChanges({ newKeys: new Map(saved.map((row) => [row.temporaryId, row.id])) });
```

`acceptChanges()` and the unmark methods send `collection-filtered` with the new `info` values
`'acceptChanges'` and `'unmarkForDeletion'`: a `switch` that lists every value of `info` has to add
them. See [the editing guide](guides/05-editing.md#saving) for the whole round trip.

## Validation: `mandatory` is the `required` rule

v5 had `mandatory` on a column: it drew stripes on the empty cells, nothing more - a save went
through with the field empty. v6 validates: the rules are in the datasource's `fields`, as JSON, and
the validators are registered by id, like the formatters. The `required` rule draws the same stripes.

```ts
// v5
const gridConfig: GridConfig = {
    attributes: [{ attribute: 'name', mandatory: true }, { attribute: 'age' }]
    // ...
};
// check the values yourself before a save

// v6
const datasource = new Datasource({
    key: 'id',
    fields: {
        name: { validate: ['required'] },
        age: { type: 'number', validate: ['required', { id: 'min', value: 0 }, { id: 'max', value: 150, message: 'too old' }] }
    }
});
const errors = datasource.validate(); // before a save: [] when every row is valid
```

* **`ColumnConfig.mandatory` is removed.** A config with it throws a `TypeError` that names the
  field and the rule - it would otherwise be dropped without a word, and the field no longer checked.
  That includes a config stored as JSON.
* **What is striped changed a little**: the stripes show where `required` fails, which is where the
  filter's `IS_BLANK` matches - `null`, `undefined`, `''`, an invalid Date, and **0**. A number field
  of 0 is striped now (v5 showed `'0'` as a value). An unchecked checkbox (`false`) is not striped any
  more: `false` is a value. For a checkbox that must be checked, write a rule:
  `registerValidator('checked', (value) => (value === true ? null : 'Must be checked'))`.
* The class of the stripes is still `simple-html-mandatory`, a restyle of it keeps working.

### New: the validation API

| | what it does |
| --- | --- |
| `FieldConfig.validate` | the field's rules: `['required', { id: 'min', value: 0, message: 'at least {value}' }]` |
| `registerValidator(id, validator)` | a validator of your own, `(value, row, rule) => message \| null` |
| built-in validators | `required`, `min`, `max`, `minLength`, `maxLength`, `pattern` (a regular expression as text) |
| the texts `validation.*` | the default messages, texts in `TEXTS` changed with `setTexts()`: `'validation.required'`, `'validation.min'`, `'validation.max'`, `'validation.minLength'`, `'validation.maxLength'`, `'validation.pattern'` |
| `datasource.validate(rows?)` | validates every row, or the rows given, keeps and returns the errors: `{ row, field, messages }[]` |
| `datasource.getErrors(rows?)`, `hasErrors()` | the errors there are now, without validating |
| `getField(name).validate` | the field's rules, written out as objects |
| the `validate` event | sent by `validate()`, the grid shows the errors |

* An edit is validated as it is made, from the grid and from code. The rows from `setData()` and the
  new rows of `addNewEmpty()` are not, until they are edited or `validate()` runs.
* `acceptChanges()` and `resetData()` clear the errors. A row marked for deletion has none.
* An unknown validator id, or a built-in rule with a wrong option, throws when the datasource is
  made. Datasources that share a container must give a field the same rules (or only one of them
  rules), like the types.
* The grid shows a cell with an error with the class `simple-html-cell-error` and the messages as its
  tooltip, and the row number with `simple-html-row-error`. New css variables:
  `--simple-html-grid-error-color`, `--simple-html-grid-error-bg-color`.

### The grid shows the errors of a server

`setErrors()` (`__rowError`) is unchanged and kept apart from the validation errors: it does not
change them, and `validate()` / `hasErrors()` do not read it. But the grid shows it now: the row
number gets `simple-html-row-error`, and the message is the first line of its tooltip. v5 showed
nothing; a `cellClass` hook that colored the row's cells keeps working.

See [the editing guide](guides/05-editing.md#validation).

## Grid config

The config is what you write: the options of each column, where the columns go, sizes and
behaviour. The state is what the user changes while working with the grid: column order, pinning and
widths, sorting, grouping, expanded groups, the filter and what the header filters show. v5 mixed the
two in one `GridConfig`; v6 keeps them apart.

The config is plain JSON in v6: it has no functions, so it can be stored and loaded as it is. The
functions - `isReadonly`, `cellClass`, `menus` - are hooks, given next to it, see
[The callbacks are hooks](#the-callbacks-are-hooks-isreadonly-and-cellclass).

**A v5 option left in a config throws** a `TypeError` that says where it went in v6 - in the
constructor, `createGrid()` and `updateConfig()`. TypeScript catches them, but a config from plain
JavaScript or one stored in a backend before v6 would otherwise lose the option without a word. It
covers `attributes`, `columnsPinnedLeft` / `columnsCenter` / `columnsPinnedRight`, `sorting`,
`grouping`, `expandedGroups`, `filter`, `tooltipText`, `selectionMode`,
`placeHolderRowCurrentEntityOnly`, and on a column `mandatory`, `type`, `attribute`,
`currentFilterValue`, `placeHolderRow`, `placeHolderFilter`.

### `attributes` and `columns*` become `columns` and `layout`

In v5 a column was named twice: in `columnsCenter[].rows` and in `attributes`. A field only named in
the rows got an entry of its own in an internal list, and that split is where the v5 bug came from
where a header filter's text survived for columns not listed in `attributes`. In v6 the options of a
column are in `columns`, keyed by the field name, and the `layout` only names the fields:

```ts
// v5
const gridConfig: GridConfig = {
    columnsPinnedLeft: [{ rows: ['name'], width: 150 }],
    columnsCenter: [
        { rows: ['age', 'born'], width: 100 }, // two fields stacked in one column
        { rows: ['company'], width: 200 }
    ],
    columnsPinnedRight: [{ rows: ['balance'], width: 100 }],
    attributes: [
        { attribute: 'name', label: 'Name', placeHolderFilter: 'search', mandatory: true },
        { attribute: 'age', readonly: true },
        { attribute: 'born' },
        { attribute: 'company' },
        { attribute: 'balance' },
        { attribute: 'phone' } // in no column: the user can add it from the column chooser
    ],
    placeHolderRowCurrentEntityOnly: false
};

// v6 - mandatory is the required rule of the datasource field, see "Validation" below:
// new Datasource({ fields: { name: { validate: ['required'] } } })
const gridConfig: GridConfig = {
    columns: {
        name: { label: 'Name', placeholderFilter: 'search' },
        age: { readonly: true },
        phone: {} // not in the layout: the user can add it from the column chooser
        // born, company and balance have no options: a field in the layout without an entry
        // gets the defaults
    },
    layout: {
        left: [{ fields: ['name'], width: 150 }],
        center: [
            { fields: ['age', 'born'], width: 100 },
            { fields: ['company'], width: 200 }
        ],
        right: [{ fields: ['balance'], width: 100 }]
    },
    placeholderRowCurrentEntityOnly: false
};
```

| v5 | v6 |
| --- | --- |
| `columnsPinnedLeft` | `layout.left` |
| `columnsCenter` | `layout.center` |
| `columnsPinnedRight` | `layout.right` |
| a column's `rows` | `fields` |
| `attributes: [{ attribute: 'x', ... }]` | `columns: { x: { ... } }` |
| `Columns` (type) | `LayoutColumn`, the lists are a `GridLayout` |
| `Attribute` (type) | `ColumnConfig` |
| `Sort` (type) | `SortArgument`, the same shape |
| `placeHolderRowCurrentEntityOnly` | `placeholderRowCurrentEntityOnly` |
| `sorting`, `grouping`, `expandedGroups`, `filter` | `initialState: { sorting, grouping, expandedGroups, filter }`, see [below](#the-state-getstate-setstate-and-resetstate) |
| `__attributes`, `__rowHeight` ... | internal, gone from the type |

An entry that only had `attribute` can be left out. The type and the default label of a column come
from the datasource's `fields` (see [Fields and formatters](#fields-and-formatters)).

### `ColumnConfig`

`Attribute` is `ColumnConfig`. Three options get the casing fixed while the shape changes anyway:

| v5 `Attribute` | v6 `ColumnConfig` |
| --- | --- |
| `attribute` | removed - the key in `columns` is the field |
| `label` | unchanged |
| `placeHolderRow` | `placeholderRow` |
| `placeHolderFilter` | `placeholderFilter` |
| `operator` | unchanged, the operator the header filter starts with. The one the user picks in the header filter's menu is state: `headerFilters[field].operator` |
| `currentFilterValue` | removed - it is state: `headerFilters[field].value` |
| `type` | removed (phase 1) - the type comes from the datasource's `fields` |
| `mandatory` | removed - the field's `required` rule: `fields: { name: { validate: ['required'] } }`, see [Validation](#validation-mandatory-is-the-required-rule). A config with it throws |
| `mandatoryOnlyIfEmpty` | removed - it had no effect: `mandatory` marked only the empty cells |
| `dynamicCellTypeColumn`, `readonly`, `numberOverride`, `focusButton`, `allowPasteClearOnly` | unchanged |

In v5 picking an operator in the header filter's menu wrote it into the column's `operator`, so the
config changed under you (and opening the menu set it to the type's default). In v6 the column's
`operator` is never changed by the grid.

### `selectionMode` is the datasource's

`GridConfig.selectionMode` is removed. v5 had the selection mode in both places, and the grid set its
own (default `'multiple'`) on the datasource every time it was built: `new Datasource({ selectionMode:
'single' })` shown in a grid became `'multiple'`. The datasource owns it now, the grid reads it from
there:

```ts
// v5
const datasource = new Datasource(new DataContainer('id'));
const gridConfig: GridConfig = { selectionMode: 'single', columnsCenter: [{ rows: ['name'], width: 150 }] };

// v6
const datasource = new Datasource({ key: 'id', selectionMode: 'single' });
const gridConfig: GridConfig = { layout: { center: [{ fields: ['name'], width: 150 }] } };
datasource.setSelectionMode('none'); // later, also while a grid shows it
```

`updateConfig({ selectionMode })` is `datasource.setSelectionMode()`. The datasource also takes
`'none'`, which the grid config did not.

### `datePickerConfig` takes only the fields to change

`GridConfig.datePickerConfig` is a `Partial<IDateConfig>` (v5: a whole `IDateConfig`, though the grid
read only some fields and filled in the rest). `{ weekStart: 0, isoWeek: false }` is enough, every
field the grid reads has a default. A whole `IDateConfig` still works, without `monthHeader` and
`weekHeader`: the names of the months and days are texts now, see
[Texts](#the-names-of-the-months-and-days-are-texts).

### The state: `getState()`, `setState()` and `resetState()`

`saveConfig()`, `loadConfig()`, `loadInitConfig()` and `updateInitConfig()` are removed. The state is
read and set on its own:

```ts
interface GridState {
    layout: GridLayout; // column order, pinning and widths
    sorting: SortArgument[];
    grouping: GroupArgument[];
    expandedGroups: string[];
    filter: FilterExpression | null;
    headerFilters: Record<string, { value: unknown; operator?: FilterOperator }>;
}
```

```ts
// v5
const saved = gridInterface.saveConfig();
localStorage.setItem('my-grid-layout', JSON.stringify(saved));
gridInterface.loadConfig(JSON.parse(localStorage.getItem('my-grid-layout')));
gridInterface.loadInitConfig();

// v6
const state = gridInterface.getState();
localStorage.setItem('my-grid-state', JSON.stringify(state));
gridInterface.setState(JSON.parse(localStorage.getItem('my-grid-state')));
gridInterface.resetState();
```

| v5 | v6 |
| --- | --- |
| `saveConfig()` | `getState()` - the state only, not the options |
| `loadConfig(config)` | `setState(state)` - applies what it is given, keeps the rest |
| `loadInitConfig()` | `resetState()` |
| `updateInitConfig(config)` | `GridConfig.initialState`, or `updateConfig({ initialState })` later |
| config `sorting`, `grouping`, `expandedGroups`, `filter` | `GridConfig.initialState` |
| attribute `currentFilterValue` | `headerFilters[field].value` |
| the operator picked in the menu, in the attribute's `operator` | `headerFilters[field].operator` |

A `Date` in a filter is stored in JSON as its ISO text, and `setState()` keeps it as text: a `date`
or `datetime` field filters on it the same, a field not listed with one of those types does not.
See [Dates in a saved state](guides/03-state.md#dates-in-a-saved-state).

A grid that starts sorted, grouped or filtered gets an `initialState`. `resetState()` goes back to it,
with the config's `layout` (or `initialState.layout`, when it has one):

```ts
// v5
const gridConfig: GridConfig = {
    columnsCenter: [ ... ],
    attributes: [{ attribute: 'age', currentFilterValue: 18 }],
    sorting: [{ attribute: 'name', ascending: true }],
    filter: and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 18))
};

// v6
const gridConfig: GridConfig = {
    layout: { center: [ ... ] },
    initialState: {
        sorting: [{ attribute: 'name', ascending: true }],
        filter: and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 18)),
        headerFilters: { age: { value: 18 } } // what the header filter cell shows
    }
};
```

What changes:

* **`setState()` keeps what it is not given.** `setState({ sorting })` changes the sort and nothing
  else, where `loadConfig()` replaced everything (a config without `grouping` removed the grouping).
  Pass a whole state, e.g. one from `getState()`, to set everything. Within a part nothing is merged:
  `layout` replaces the layout, `headerFilters` every header filter.
* **`resetState()` clears what `initialState` leaves out**: no sorting, grouping or filter. An empty
  `sorting` gives the rows back their own order.
* **The state is copied both ways.** `getState()` returns copies, changing them changes nothing in the
  grid, and the grid never changes the object given to `setState()` or the config. `structuredClone`
  copies it, so a `Date` stays a `Date`; the state must be plain data (no functions, no rows from the
  datasource).
* **`filter` is what the rows are filtered by, `headerFilters` only what the header cells show** - as
  in v5, where the filter and `currentFilterValue` were saved apart. `getState()` gives both.
* **Options are config, not state.** `saveConfig()` / `loadConfig()` also carried `readonly`,
  `tooltips`, `cellHeight` and every other option, and a changed copy could be loaded. To change an
  option while the grid is shown, use `updateConfig()`, see
  [`updateConfig()`](#updateconfig-changes-options-while-the-grid-is-shown):

  ```ts
  // v5
  const config = gridInterface.saveConfig();
  config.readonly = true;
  gridInterface.loadConfig(config);

  // v6
  gridInterface.updateConfig({ readonly: true });
  ```

  `dimRepeatedValues`, which the row menu can toggle, is an option too: `getState()` does not have
  it.
* **The constructor applies `initialState` to the datasource**: its sorting, grouping and filter are
  replaced, and cleared when `initialState` leaves them out. v5 cleared the filter and the grouping
  too (and so the sort), but left the rows in the order they were sorted in.

### A v5 config converted

**The grid does it now**: `gridInterface.importConfig(saved)` and `convertGridConfig(saved)` take a v5
config - a saved grid without a `version` is one - and convert it as below; `exportConfig()` saves
`{ version: 2, config, state }`. See the grid config guide, *Exporting with a version*. The code below is
what they do, for a config you want to convert yourself. The export has `views` too - the named views
of the views button, the ones users saved included - and `importConfig()` puts them back; an export
without `views` leaves the grid's views as they are.

This turns a v5 config - one you wrote, or one `saveConfig()` saved - into a v6 one: `attributes`
become `columns`, the `columns*` the `layout`, and the state v5 kept in the config goes into
`initialState`. It uses `fromV5()` from [Saved configs](#saved-configs) for the filter.

```ts
import {
    type ColumnConfig,
    type FieldConfig,
    type GridConfig,
    type GridState,
    type GroupArgument,
    type LayoutColumn,
    type SortArgument
} from '@simple-html/grid';

/** a column of columnsPinnedLeft / columnsCenter / columnsPinnedRight in v5 */
interface V5Column {
    rows: string[];
    width: number;
}

/** an entry of attributes in v5: the v6 ColumnConfig with the old names, the field in `attribute` */
type V5Attribute = Omit<ColumnConfig, 'placeholderRow' | 'placeholderFilter'> & {
    attribute: string;
    placeHolderRow?: string;
    placeHolderFilter?: string;
    currentFilterValue?: unknown;
    type?: string; // removed in v6: list the field's type in the datasource's fields
    mandatory?: boolean; // removed in v6: the field's required rule, see requiredFieldsOfV5()
};

/** a v5 GridConfig, as written or from saveConfig(). The options that did not change come from v6 */
type V5GridConfig = Omit<GridConfig, 'columns' | 'layout' | 'initialState' | 'placeholderRowCurrentEntityOnly'> & {
    attributes?: V5Attribute[];
    columnsPinnedLeft?: V5Column[];
    columnsCenter: V5Column[];
    columnsPinnedRight?: V5Column[];
    placeHolderRowCurrentEntityOnly?: boolean;
    sorting?: SortArgument[] | null;
    grouping?: GroupArgument[] | null;
    expandedGroups?: string[] | null;
    filter?: V5Filter | null; // see fromV5 under "Saved configs"
};

const toLayoutColumns = (columns: V5Column[] = []): LayoutColumn[] =>
    columns.map((column) => ({ fields: [...column.rows], width: column.width }));

/**
 * a v5 config as a v6 one: attributes become columns, columns* the layout, and what the user had
 * changed (sorting, grouping, expanded groups, filter, header filter values) the initialState
 */
function fromV5Config(v5: V5GridConfig): GridConfig {
    const {
        attributes = [],
        columnsPinnedLeft,
        columnsCenter,
        columnsPinnedRight,
        placeHolderRowCurrentEntityOnly,
        sorting,
        grouping,
        expandedGroups,
        filter,
        ...options // cellHeight, readonly ... are unchanged
    } = v5;

    const columns: Record<string, ColumnConfig> = {};
    const headerFilters: GridState['headerFilters'] = {};
    for (const { attribute, placeHolderRow, placeHolderFilter, currentFilterValue, type, mandatory, ...rest } of attributes) {
        const column: ColumnConfig = rest; // label, operator, readonly ... are unchanged
        columns[attribute] = column;
        if (placeHolderRow !== undefined) {
            column.placeholderRow = placeHolderRow;
        }
        if (placeHolderFilter !== undefined) {
            column.placeholderFilter = placeHolderFilter;
        }
        if (currentFilterValue !== null && currentFilterValue !== undefined && currentFilterValue !== '') {
            headerFilters[attribute] = { value: currentFilterValue };
        }
    }

    return {
        ...options,
        columns,
        layout: {
            left: toLayoutColumns(columnsPinnedLeft),
            center: toLayoutColumns(columnsCenter),
            right: toLayoutColumns(columnsPinnedRight)
        },
        placeholderRowCurrentEntityOnly: placeHolderRowCurrentEntityOnly,
        initialState: {
            sorting: sorting ?? [],
            grouping: grouping ?? [],
            expandedGroups: expandedGroups ?? [],
            filter: filter ? fromV5(filter) : null,
            headerFilters
        }
    };
}

/**
 * the fields a v5 config made mandatory, as the datasource fields with the required rule - merge
 * them into the fields you give the datasource
 */
function requiredFieldsOfV5(v5: V5GridConfig): Record<string, FieldConfig> {
    const fields: Record<string, FieldConfig> = {};
    for (const { attribute, mandatory } of v5.attributes ?? []) {
        if (mandatory) {
            fields[attribute] = { validate: ['required'] };
        }
    }
    return fields;
}
```

```ts
// a config written for v5
const datasource = new Datasource({ key: 'id', fields: { age: 'number', ...requiredFieldsOfV5(v5Config) } });
const gridInterface = new GridInterface(fromV5Config(v5Config), datasource);

// a state saved with v5's saveConfig(): the layout and the state parts of it
const saved = JSON.parse(localStorage.getItem('my-grid-layout') ?? 'null');
if (saved) {
    const { layout, initialState } = fromV5Config(saved);
    gridInterface.setState({ ...initialState, layout });
}
```

A column's `type` is dropped, list the field's type in the datasource's `fields`. So is
`mandatory`: it is the field's `required` rule, `requiredFieldsOfV5()` lists the fields that need it.
An `operator` the user had picked in v5 was saved in the attribute, it stays the column's `operator`
- the header filter starts with it.

## Setup, callbacks and methods of the grid

### `createGrid()`: a grid on the page in one call

v5 needed an interface, an element, its size, its css class and `connectInterface()`. In v6
`createGrid()` does it all and returns the interface:

```ts
// v5
const gridInterface = new GridInterface(gridConfig, datasource);
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.style.display = 'flex';
element.classList.add('simple-html-grid');
element.connectInterface(gridInterface);
container.appendChild(element);

// v6
const gridInterface = createGrid(container, { config: gridConfig, datasource });
// with the functions of the grid, see the hooks below
const gridInterface = createGrid(container, { config: gridConfig, datasource, hooks });
```

The element fills the container (width and height 100%), so the container needs a height - as
before.

The `<simple-html-grid>` element stays, for placing and sizing it yourself. It adds its
`simple-html-grid` class itself (v5 did too, when it was put in the page), so that line can go. So
can `display: flex`: the css gives the element `display: block`, and everything in it is positioned
absolute.

```ts
// v6, the element placed by hand
const element = document.createElement('simple-html-grid') as GridElement;
element.style.width = '100%';
element.style.height = '100%';
element.connectInterface(new GridInterface(gridConfig, datasource));
container.appendChild(element);
```

* **`element.enableCleanup` is removed.** It was a test flag: with it `connectInterface()` emptied the
  element and built the grid's dom again. Without it - the default - the dom is kept and rebuilt for
  the new interface, which is what v6 always does.
* **`createGrid()` connects before it returns**, so a `grid-connected` handler subscribed after it
  does not hear that first connect. To size the columns at the start, call `autoResizeColumns()`
  right after `createGrid()`.

### `destroy()`: done with a grid

`gridInterface.destroy()` is new. It removes the element from the page and disconnects the grid
from the datasource and the document, and drops the handlers subscribed with `on()`. The datasource
is not changed. Do not use the interface after it.

```ts
// v5
element.remove();

// v6
gridInterface.destroy();
```

Removing the element still works, and still disconnects the grid: an element you placed yourself
does not need `destroy()`. `destroy()` removes it too, when it is called.

### The callbacks are hooks: `isReadonly` and `cellClass`

`readonlySetter()` and `cellAppendClassSetter()` are removed. The callbacks are hooks, a
`GridHooks` object given next to the config - `createGrid(host, { config, datasource, hooks })` or
`new GridInterface(config, datasource, hooks)` - so they are there from the first render.
`updateHooks()` sets or removes them later. They are not part of the config, so the config stays
plain JSON and can be stored; a config that has them throws a `TypeError`.

```ts
// v5
gridInterface.readonlySetter((attribute, rowData, cellReadOnlyConfig) => {
    if (attribute === 'company' && rowData.isActive === false) {
        return true;
    }
    return null; // the column config decides
});
gridInterface.cellAppendClassSetter((attribute, rowData, cellReadOnly) => {
    if (attribute === 'balance' && rowData.balance < 0) {
        return { inputClass: 'negative-text', dimmedClass: 'negative-background' };
    }
    return { inputClass: '', dimmedClass: '' };
});
gridInterface.readonlySetter(null); // removed again

// v6
const hooks: GridHooks = {
    isReadonly: (row, field, readonlyByConfig) => (field === 'company' && row.isActive === false ? true : null),
    cellClass: (row, field) =>
        field === 'balance' && row.balance < 0 ? { input: 'negative-text', background: 'negative-background' } : null
};
const gridInterface = createGrid(container, { config: gridConfig, datasource, hooks });
gridInterface.updateHooks({ isReadonly: undefined }); // removed again
```

| v5 | v6 |
| --- | --- |
| `readonlySetter(callback)` | `hooks.isReadonly`, or `updateHooks({ isReadonly })` |
| `cellAppendClassSetter(callback)` | `hooks.cellClass`, or `updateHooks({ cellClass })` |
| `readonlySetter(null)` / `cellAppendClassSetter(null)` | `updateHooks({ isReadonly: undefined })` / `updateHooks({ cellClass: undefined })` |
| readonly callback `(attribute, rowData, cellReadOnlyConfig)` | `isReadonly(row, field, readonlyByConfig)` - the row first |
| class callback `(attribute, rowData, cellReadOnly)` | `cellClass(row, field)` - the row first, no third argument |
| `{ inputClass, dimmedClass }` | `{ input, background }` (`CellClass`), both optional. `null` / `undefined` for no classes |

* **`inputClass` is `input`**: the class goes on the cell's `<input>`, the text.
* **`dimmedClass` is `background`**: the class goes on the element behind the input. The input is
  transparent, so it is the cell's background; the grid draws the readonly and required stripes
  there. As in v5 the element has no size on an editable cell (the grid's readonly and required
  classes give it one): give your class `position: absolute; inset: 0`.
* **`cellClass` has no third argument.** v5 passed whether the cell is readonly. Both callbacks are
  yours: call the same check from `cellClass` if you need it.
* **`isReadonly` works as `readonlySetter` did**: `true` / `false` decide, anything else
  (`null`, `undefined`) leaves it to the column's `readonly`, which is passed in as
  `readonlyByConfig`. The grid's `readonly: true` still wins, and the row menu's paste and clear ask
  it for every selected row.
* **`updateHooks()` changes only the keys given**, `undefined` removes a hook. It renders the
  visible cells again once; a menu uses its new function the next time it opens.
* **Typed rows**: with a `Datasource<Person>` the hooks are a `GridHooks<Person>`, the row they get
  has your fields typed.
* **Fixed**: the background class is now separated from the grid's own `simple-html-readonly` /
  `simple-html-mandatory` class by a space. v5 joined them (`simple-html-readonlynegative-background`),
  so on a readonly or mandatory cell of an editable grid neither class applied.

### `updateConfig()` changes options while the grid is shown

v5 changed an option with `saveConfig()`, a change, and `loadConfig()`. In v6 `updateConfig()` takes
the options to change and rebuilds the grid once:

```ts
// v5
const config = gridInterface.saveConfig();
config.readonly = false;
config.cellHeight = 30;
gridInterface.loadConfig(config);

// v6
gridInterface.updateConfig({ readonly: false, cellHeight: 30 });
```

* **Only the keys given change.** A key given as `undefined` goes back to its default
  (`updateConfig({ readonly: undefined })` makes the grid readonly again, its default). `layout`
  excepted: a grid always has one, `layout: undefined` is ignored.
* **`columns` replaces the options of every column**, nothing is merged: a field left out gets the
  defaults.
* **`layout` is shown right away**, the same as `setState({ layout })`: the column order, pinning and
  widths the user made are replaced. It is also the layout `resetState()` goes back to from then on,
  unless `initialState` has a layout.
* **`initialState` changes nothing now**: it is the state the next `resetState()` goes back to. Call
  `resetState()` after `updateConfig({ initialState })` to apply it at once.
* **The rest is kept**: the sorting, grouping, filter and header filters, the handlers subscribed
  with `on()`, and the hooks.
* **No functions**: `isReadonly`, `cellClass` and `menus` are hooks, `updateHooks()` changes them. A
  config given to `updateConfig()` with one of them throws a `TypeError`.

### Renamed and removed methods

No method takes a positional boolean any more, as in the datasource (see
[Options objects instead of boolean flags](#options-objects-instead-of-boolean-flags)).

| v5 | v6 |
| --- | --- |
| `gridInterface.triggerScrollEvent()` | `refresh()` - renders the visible cells again |
| `gridInterface.triggerRebuild()` | `rebuild()` - builds the whole grid again |
| `gridInterface.getAttributeColumns()` / `getAttributeColumns(true)` | `getLayoutFields({ selectedOnly: true })` - `[]` when no column is selected, v5 gave every field then |
| `gridInterface.getAttributeColumns(false)` | `getLayoutFields()` |
| `gridInterface.getOptionalAttributes()` | `getHiddenFields()` |
| `gridInterface.readonlySetter(callback)` | removed: the `isReadonly` hook, see [above](#the-callbacks-are-hooks-isreadonly-and-cellclass) |
| `gridInterface.cellAppendClassSetter(callback)` | removed: the `cellClass` hook, see [above](#the-callbacks-are-hooks-isreadonly-and-cellclass) |
| `element.enableCleanup` | removed, see [`createGrid()`](#creategrid-a-grid-on-the-page-in-one-call) |
| `element.connectedCallback()` / `disconnectedCallback()` | not in the typings: the browser calls them |
| `gridInterface.contextMenuCustom(event, options, cell, callback)` | `openMenu(at, entries)`, see [Menus](#menus) |
| `gridInterface.setContextMenuElement(element)` | `openMenu(at, [{ type: 'block', id, element }])`, see [Menus](#menus) |
| `gridInterface.removeContextMenuElement()` | `closeMenu()` |
| `gridInterface.getContextMenuElement()` | removed, see [Menus](#menus) |
| - | new: `createGrid()`, `gridInterface.updateConfig()`, `gridInterface.updateHooks()`, `gridInterface.destroy()`, `openMenu()`, `closeMenu()`, the `menus` hook |

Kept, and documented now: `autoResizeColumns()`, `openFilterEditor()`, `getDatasource()`, `on()`,
`getState()` / `setState()` / `resetState()` and `element.connectInterface()`. The context menu
methods are replaced by `openMenu()` / `closeMenu()`, see [Menus](#menus).

To keep v5's `getAttributeColumns()` - the selected columns, or every column when none is selected:

```ts
const selected = gridInterface.getLayoutFields({ selectedOnly: true });
const fields = selected.length ? selected : gridInterface.getLayoutFields();
```

In plain JavaScript an old name throws `... is not a function`, and `getLayoutFields(true)` throws a
`TypeError` that shows the v6 way to write it.

`new GridInterface(config, datasource)` takes the row type from the datasource: a
`Datasource<Person>` gives a `GridInterface<Person>`, and so does `createGrid()`. v5 typed the
datasource without its row type.

## Menus

The right click menus are lists of entries now, each with an id: the grid's own menus can be changed
with the `menus` hook, and `openMenu()` opens one of your own with the same entries. `contextMenuCustom()`,
`getContextMenuElement()`, `setContextMenuElement()` and `removeContextMenuElement()` are removed.

An entry (`MenuEntry`) is one of:

| entry | shown as |
| --- | --- |
| `{ id, label, action, hint?, visible?, disabled?, selected? }` - `MenuItem`, `type: 'item'` can be left out | an item to click: the menu closes, then `action(context)` runs. `hint` is shown in italics after the label |
| `{ type: 'section', id, label }` - `MenuSection` | a section header, "Copy:" |
| `{ type: 'separator', id }` - `MenuSeparator` | a dashed line |
| `{ type: 'block', id, element }` - `MenuBlock` | your element, as it is |
| `{ type: 'submenu', id, label, entries, visible? }` - `MenuSubmenu` | an item with a `›`: its entries open beside it on hover, click or the right arrow. Can nest |

The menus work from the keyboard as the WAI-ARIA menu pattern says (arrows, Home/End, Enter, Esc, a
letter), see [Menus](guides/10-menus.md).

`visible`, `disabled` and `selected` are called with the `MenuContext` when the menu opens: what it was
opened on (`field`, `row`, `rowIndex`, `cell`), the `gridInterface` and the `datasource`.

### The grid's own menus: the `menus` hook

v5 had no way to change the row, header or filter menu. In v6 the `menus` hook has a function per
menu - `row` (a cell), `header` (a header label), `filter` (a header filter). It gets the grid's own
entries and the context, and returns what to show. It is a hook, given next to the config (see
[The callbacks are hooks](#the-callbacks-are-hooks-isreadonly-and-cellclass)):

```ts
const hooks: GridHooks = {
    menus: {
        row: (defaults, context) => [
            // hide built-in entries by id: the export submenu, with what is in it
            ...defaults.filter((entry) => !entry.id.startsWith('row.export')),
            // add your own
            { type: 'section', id: 'my.section', label: 'Mine:' },
            { id: 'my.logRow', label: 'Log row', action: () => console.log(context.field, context.row) }
        ],
        // reorder: the value list first
        filter: (defaults) => [
            ...defaults.filter((entry) => entry.id === 'filter.values'),
            ...defaults.filter((entry) => entry.id !== 'filter.values')
        ]
    }
};
const gridInterface = createGrid(container, { config: gridConfig, datasource, hooks });
```

* **Every built-in entry has an id**, listed with its label in `MENU_IDS` (exported, in the order the
  menus show them): `row.copy.cell`, `row.paste.cell`, `header.column.hide`, `filter.values` ... The
  menus are short trees: a submenu is `menu.part` (`row.copy`), what is in it `menu.part.entry`
  (`row.copy.cell`) - change an entry in a submenu through its `entries`, see the guide.
* **`defaults` always has every entry.** The ones that do not apply have a `visible` callback that
  hides them: paste and clear on a readonly cell, the operators of another type. A submenu with
  nothing left to show is hidden; a separator is shown as long as it is in the list.
* **v5's row menu summary** (count, sum, max, min, average of the selected rows) is the summary of the
  selected cells in the footer now, see [Selection and clipboard](guides/17-selection-and-clipboard.md#the-summary-in-the-footer).
* **The header filter's value list** (the search box, a checkbox per value and "Run Search") is one
  entry, the block `filter.values`: hide or move it as a whole.
* `updateHooks({ menus })` changes them while the grid is shown, `updateHooks({ menus: undefined })`
  gives back the defaults.

### A menu of your own: `openMenu()` and `closeMenu()`

`contextMenuCustom()` took a list of `{ value, label, isHeader }` and one callback for all of them. In
v6 each item has its own action:

```ts
// v5
gridInterface.contextMenuCustom(
    data.originalEvent,
    [
        { value: '', label: 'Pick a fruit', isHeader: true },
        { value: 'Apple', label: 'Apple', isHeader: false },
        { value: 'Banana', label: 'Banana', isHeader: false }
    ],
    data.cell,
    (value) => {
        data.rowData.fruit = value;
        gridInterface.triggerScrollEvent();
    }
);

// v6
const pick = (fruit: string) => {
    data.rowData.fruit = fruit;
    gridInterface.refresh();
};
gridInterface.openMenu(data.originalEvent, [
    { type: 'section', id: 'fruit', label: 'Pick a fruit:' },
    { id: 'fruit.apple', label: 'Apple', action: () => pick('Apple') },
    { id: 'fruit.banana', label: 'Banana', action: () => pick('Banana') }
]);

gridInterface.closeMenu(); // v5: removeContextMenuElement()
```

* **Where it opens**: `openMenu()` takes a mouse event (its top left corner at the mouse), a position
  `{ x, y }` in px from the window's edges (`MenuPosition`), or an element (under it, lined up with
  its left edge). v5 always opened under the cell, around the mouse: pass the cell,
  `openMenu(data.cell, entries)`, to open under it. Like the grid's own menus it is kept in the
  window.
* **Clicking an item closes the menu.** v5 kept it open unless the callback returned `true`.
* **Labels are shown as given.** v5 ran them through a "pretty print" (`APPLE_PIE` -> `Apple Pie`)
  and added a colon to a header. Write `'Pick a fruit:'` for a section that looks like the grid's own.
* **Opened from a click handler it stays open**: the click that opened it does not count as a click
  outside it. v5 closed it right away, a dropdown had to be registered with `setContextMenuElement()`
  in a `setTimeout`.
* The context the items get has `menu: 'custom'`, no field, row or cell: close over what you need, as
  above.

### A dropdown as a menu: a block

`setContextMenuElement(element)` made an element you had placed yourself close with the grid's menus:
on a click outside, on scroll, when another menu opened. In v6 the element is a block of a menu:
`openMenu()` puts it on the page and places it, and the grid closes it as any menu.

```ts
// v5
dropdown.style.position = 'fixed';
dropdown.style.top = `${rect.bottom}px`; // and code to keep it in the window
dropdown.style.left = `${rect.left}px`;
document.body.appendChild(dropdown);
setTimeout(() => gridInterface.setContextMenuElement(dropdown));
// after a pick
gridInterface.removeContextMenuElement();

// v6
gridInterface.openMenu(data.cell, [{ type: 'block', id: 'company-picker', element: dropdown }]);
// after a pick
gridInterface.closeMenu();
```

* The element is shown in the menu's frame (border and shadow), so drop your own position and shadow;
  set its size.
* **A click in the block does not close the menu**. In v5 a click in the element closed it, unless the
  element was in a `simple-html-grid-menu` element.
* **`getContextMenuElement()` is removed.** The grid keeps the open menu to itself; keep a reference
  to your own element if you need it.

### Other changes to the menus

* The header and filter menus open above the cell when they do not fit below it, as the row menu
  did. Every menu is moved left when it sticks out on the right of the window.
* The entries carry their id in a `data-menu-id` attribute, for css and tests.
* The labels are texts, looked up by the id of the entry: translate them with `setTexts()` or
  `GridConfig.texts`, see [Texts](#texts). The `menus` hook gets them looked up already.
* A disabled item gets the class `simple-html-grid-menu-item-disabled` and `aria-disabled="true"`.
* **The row menu can delete rows**: an editable grid has a "Delete:" section - `row.delete`,
  `row.delete.rows` marks the selected rows for deletion, `row.delete.undo` takes the mark off. A row
  the `isReadonly` hook returns `true` for in every column is not marked. Where the user should not
  delete rows, hide it with the `menus` hook:
  `row: (defaults) => defaults.filter((entry) => !entry.id.startsWith('row.delete'))`.

### The menus are popovers, the filter editor is a modal dialog

The browser shows the menus and the filter editor in the top layer now, over everything on the page:
a container with `overflow: hidden` does not cut a menu off, and no z-index puts anything over it.
The popover methods the grid uses (`showPopover()`, `hidePopover()`) are in every browser since April
2024.

* **The menus are `popover="manual"`** - the right click menus, `openMenu()`, the column chooser, the
  filter editor's pickers and the date picker - with the class `simple-html-grid-popover`. Their
  `position: absolute` is in that class, not an inline style; the z-indexes are gone. A z-index of
  yours meant to go over or under a menu does nothing now.
* **A menu opened from an element in a `<dialog>` or a popover of yours is put inside it**, not on the
  body, so it can be used there. Code that looked for the menu as a child of `document.body` should
  look it up by its class.
* **Esc closes a menu**, and the filter editor. A menu item does not take the focus from the cell.
* **The filter editor is `<dialog class="simple-html-grid filter-editor-content">`**, opened with
  `showModal()`. Css and tests that used its elements:

```css
/* v5 */
.filter-editor-container {
    background-color: rgba(0, 0, 0, 0.4); /* the grey layer */
}
.simple-html-grid .filter-editor-content {
    width: 800px;
}

/* v6: the grey layer is the dialog's ::backdrop, .filter-editor-content is the dialog itself */
.simple-html-grid.filter-editor-content::backdrop {
    background: rgba(0, 0, 0, 0.4);
}
.simple-html-grid.filter-editor-content {
    width: 800px;
}
```

* The grid behind the editor can not be used while it is open - as before - and the keyboard can not
  reach it now either. The focus moves to the dialog when it opens and goes back when it closes.
* The editor is dragged and resized with pointer events (mouse, finger, pen). A test that moved it with
  `mousedown` / `mousemove` / `mouseup` sends `pointerdown` / `pointermove` / `pointerup`, see
  [Column drag/drop and resizing use pointer events](#column-dragdrop-and-resizing-use-pointer-events).

## Texts

Every text of the grid has an id now, and every one can be changed: the menus, the filter editor, the
column chooser, the footer, the tooltips, the date picker, and the texts the datasource makes (the
validation messages, `getFilterString()`). `TEXTS` has them all with their English text;
`setTexts(texts)` changes them for the page, `GridConfig.texts` for one grid. v5 could only change the
tooltips of the filter editor. See [the texts guide](guides/12-texts.md).

### `tooltipText` is `texts`, the ids end with `.tooltip`

The tooltips are texts like the others. `GridConfig.tooltipText` and `TOOLTIPS` are removed: give the
texts in `GridConfig.texts` (or `setTexts()` for every grid), with `.tooltip` after the v5 id.

```ts nocheck
// v5
const gridConfig: GridConfig = {
    // ...
    tooltipText: { 'filterEditor.addCondition': 'Legg til betingelse', 'filterEditor.close': 'Lukk' }
};
console.log(TOOLTIPS);
```

```ts
// v6
import { type GridConfig, setTexts, TEXTS } from '@simple-html/grid';

const gridConfig: GridConfig = {
    layout: { center: [{ fields: ['name'], width: 150 }] },
    texts: { 'filterEditor.addCondition.tooltip': 'Legg til betingelse', 'filterEditor.close.tooltip': 'Lukk' }
};
// or for every grid of the page
setTexts({ 'filterEditor.addCondition.tooltip': 'Legg til betingelse' });

console.log(Object.keys(TEXTS).filter((id) => id.endsWith('.tooltip')));
```

Every v5 tooltip id is the v6 id without `.tooltip`: `filterEditor.title`, `filterEditor.close`,
`filterEditor.filterAndClose`, `filterEditor.filterOnly`, `filterEditor.closeButton`,
`filterEditor.pickAttribute`, `filterEditor.pickOperator`, `filterEditor.pickValueAttribute`,
`filterEditor.deleteCondition`, `filterEditor.deleteGroup`, `filterEditor.clearAll`,
`filterEditor.addCondition`, `filterEditor.addSubGroup`, `filterEditor.wrapGroup`,
`filterEditor.operatorAnd`, `filterEditor.operatorOr`, `filterEditor.useValue`,
`filterEditor.useAttribute`. Some of those ids without `.tooltip` are now the text of the element:
`filterEditor.title` is `Filter Editor`, `filterEditor.closeButton` is `Close`.

`updateConfig({ texts })` replaces the grid's texts as a whole, as `tooltipText` was.

### `OPERATORS` is the texts `filterString.operator.*`

The text `getFilterString()` shows for an operator is a text, `OPERATORS` is removed:
`OPERATORS.EQUAL` is `TEXTS['filterString.operator.EQUAL']` (`'equal_to'`, still shown as
`<<EQUAL_TO>>`). `AND` and `OR` are `filterString.and` and `filterString.or`. The string is the same
as in v5 with the default texts.

### The names of the months and days are texts

`IDateConfig.monthHeader` and `weekHeader` are removed, and the grid no longer reads them from
`datePickerConfig`: each name is a text, `datePicker.month.january` ... `datePicker.month.december`
and `datePicker.day.sunday` ... `datePicker.day.saturday` (Sunday first, as `weekHeader` was).

```ts nocheck
// v5
const gridConfig: GridConfig = {
    // ...
    datePickerConfig: { monthHeader: ['Januar', 'Februar' /* ... */], weekHeader: ['Sø', 'Ma' /* ... */] }
};
```

```ts
// v6
import { setTexts } from '@simple-html/grid';

setTexts({ 'datePicker.month.january': 'Januar', 'datePicker.month.february': 'Februar', 'datePicker.day.sunday': 'Sø' });
```

A `DateInterface` of your own takes its texts in `texts`, or uses the page's: drop `monthHeader` and
`weekHeader` from its `IDateConfig`.

## Column drag/drop and resizing use pointer events

Moving, resizing and sorting in the header work with a mouse, a pen and a finger now, see
[Moving and resizing columns](guides/02-grid-config.md#moving-and-resizing-columns). Two things change
for code that drives the header:

* **Send pointer events, not mouse events.** The header labels, the group chips, the fields of the
  column chooser and the resize handles listen to `pointerdown` / `pointermove` / `pointerup` /
  `pointercancel`. `mousedown` / `mousemove` / `mouseup` from a test or a script do nothing now. A
  browser driver that sends real input (Playwright's `page.mouse` ...) sends pointer events already.
* **A click is a press that does not move.** It sorts however long it is held; a press that moves 5px
  is a drag. In v5 a press held for 200ms was a drag, and a quick drag was a click that sorted.

```ts
// a click on a label, from a test: the primary pointer, the left button
const options = { bubbles: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0 };
label.dispatchEvent(new PointerEvent('pointerdown', options));
label.dispatchEvent(new PointerEvent('pointerup', options));
```

A drag finds its drop target with `document.elementFromPoint()` (once a press is a drag, the dragged
cell captures the pointer, so the target of the events is always that cell). A test environment
without layout - jsdom, happy-dom - has to stub `elementFromPoint` to drag and drop.

## Theming

The variables keep their names and their light colours, a theme of your own still works. What
changes, see [Theming](guides/13-theming.md):

* **The colours are `light-dark()`.** Each variable has a light and a dark colour, and the grid
  follows the `color-scheme` of the page: `:root { color-scheme: dark }` turns it dark, `light dark`
  follows the OS. Set it on `:root` or `body`, not only on the grid's container: the menus, tooltips
  and the filter editor are on the body. Remove your own dark overrides if you had them.
* **It needs a browser with `light-dark()`**: Chrome/Edge 123, Firefox 120, Safari 17.5. In an older
  browser every colour is invalid; give the variables plain colours inside
  `@supports not (color: light-dark(white, black))` if you have to support one.
* **The keyboard focus is a 2px inset outline on `:focus-visible`** in
  `--simple-html-grid-focus-color`. The dashed border on a focused input and the dashed outline on a
  focused checkbox (`:focus`) are gone, and a click in a text cell shows the same ring as the keyboard.
* **`grid.css` only styles the grid's inputs.** It set `z-index: 1000` and `pointer-events: all` on
  every `input` of the page; now only on `.simple-html-grid input`.
* **The header has no scrollbar.** v5 gave the header a scrollbar of its own to line it up with the
  rows, so css that styled or hid that scrollbar does nothing now. The header leaves the room of the
  rows' scrollbar at its end instead, and an element fills that corner: `.simple-html-grid-header-gutter`,
  coloured like the scrollbar's track. On a phone, where scrollbars take no room, the header lines up too.
* The colours that were written in the css (17: stripes, shadows, the backdrop, the warning and danger
  reds) are variables now, see the tables in the guide.

## Accessibility

The grid is a WAI-ARIA `grid` now (a `treegrid` while grouped), see
[Keyboard and accessibility](guides/14-accessibility.md). Code and tests that read the old attributes
change:

* **`role="table"` is gone from `<simple-html-grid>`.** The grid role is on a new element,
  `.simple-html-grid-aria`, that owns the rows with `aria-owns` (the rows and columns are a pool that is
  reused while scrolling, so the dom order is not the order of the rows).
* **Only the row element of the row selector is `role="row"`**, with `aria-rowindex`, `aria-selected`
  and (grouped) `aria-level` / `aria-expanded`. The row elements of the other sections are
  `role="none"`. `aria-rowindex` counts the header rows: with labels and filters shown, the first data
  row is 3 (it was 1). A test that found a row by `[aria-rowindex]` on any section has to find it
  another way.
* **A cell input has no `role="cell"`**: the cell element around it is the `gridcell`, with
  `aria-colindex`. The input's `aria-label` is the column label (`First Name`), not the field name.
* **Elements get ids** `simple-html-grid-<n>-...` for `aria-owns`, one `<n>` per grid.
* **Texts**: `grid.focusHelper` is removed (the focus helper is hidden from screen readers). New:
  `grid.label` (the grid's name, `Grid` - give each grid its own in `GridConfig.texts`),
  `grid.filter`, `grid.groupToggle`, `grid.removeGroup`. `row.paste.cell` / `row.clear.cell` are
  `Paste cell` / `Clear cell` (both were `Cell`).
* **Tab leaves the grid at its ends**: Tab on the last cell of the last row and Shift+Tab on the first
  header filter used to keep the focus in the grid.

## Cell ranges and the clipboard

New in v6, see [Selection and clipboard](guides/17-selection-and-clipboard.md). What changes for
existing users and code:

* **Alt+Shift+arrows select a range** - they moved between cells like Alt+arrows. Alt+arrows still move.
* **Shift+click** on a cell selects a range: it no longer makes the row current or opens the date
  picker. **Ctrl/Cmd+click** adds a range: it no longer opens the date picker. Modified clicks on a
  checkbox no longer toggle it.
* **Esc** in a cell clears the ranges when there are some, and is cancelled then.
* **Ctrl+C** with no text selected copies the cell's value; with a range, the range as TSV.
* **Ctrl+V** of cells copied from a spreadsheet pastes them into the grid's cells (it put the whole
  text into one cell).
* `MENU_IDS.row` has three more ids (`row.copy.range`, `row.paste.range`, `row.clear.range`).

## Reactive cells and live data

New in v6, see [Live data](guides/16-live-data.md). What changes for existing code:

* **`refresh()` is not needed after an edit from code.** A value set on a row, an undo, a revert, a
  deletion mark or `setErrors()` shows in the next animation frame (the datasource's `rows-changed`).
  The calls do no harm.
* **A vertical scroll renders only the rows that scroll in.** Something the cells show that changed
  outside the datasource - what the `isReadonly` / `cellClass` hooks read, a value on an object of your
  own - needs `gridInterface.refresh()`, as documented; in v5 the next scroll showed it by accident.
* **No render, `refresh()` included, renders the cell input the user has typed in** while it has the
  focus: its text is kept, it is rendered once the focus leaves it.
* `collection-changed` can have `info: 'upsert'`; `history-changed` `'remove'` is also sent by
  `upsert()`.
* `setData(rows, { add: true })` works with any number of rows (it threw for ~300 000).

## Text of several lines

See [Multiline text](guides/05-editing.md#multiline-text).

* **A text cell whose value has a line break is not typed in directly any more**: its input is
  readonly and shows the first line, with a marker; Enter, F2, a double click or typing opens an editor
  over the cell (Ctrl/Cmd+Enter saves, Esc cancels). Enter in such a cell no longer moves down. In v5
  editing it silently dropped the line breaks (an `<input>` strips them).
* New field option `multiline: true` (text fields only) makes a field always use the editor.
* `datasource.getField()` returns `multiline` too: code comparing the whole object needs it.
* A text saved from the editor has LF line breaks.

## Row state and edited cells are built in

See [Showing the row state](guides/05-editing.md#showing-the-row-state).

* **The row number shows the row's state** (`GridConfig.rowStatus`, default `true`): an icon for new,
  edited, marked for deletion and error, and the state as the first line of its tooltip. The row
  number column is 14px wider. `rowStatus: false` gives the plain number and the old width.
* **A row marked for deletion has its cells struck through** (with `rowStatus`).
* **An edited cell has a corner marker** (`GridConfig.editedMarker`, default `true`): its tooltip shows
  the original value, a click reverts the cell.
* The classes `row-is-new`, `row-is-modified`, `row-is-deleted` and `simple-html-cell-edited` are still
  there: css of your own that styled them keeps working, and can take the place of the built-in look
  with the options off. A `__rowState` column of your own is not needed any more.
* Tests that read the row number's tooltip: it starts with the state ("Edited") before the errors.

## Undo and redo

New in v6, see [Undo and redo](guides/05-editing.md#undo-and-redo). What can change for existing code:

* **A custom entity handler's `onEdit` gets the old value**: `onEdit(row, field, oldValue)`. The
  history records `oldValue` as the value before the edit; a handler of your own given to
  `container.overrideEntityHandler()` that leaves it out records `undefined`, and an undo writes that.
* **Edits from code are in the history** like the user's: a loop that sets values is one undo step (the
  changes of one synchronous run are one step). `setData()` without `add`, `removeAllData()`,
  `resetData()` and `acceptChanges()` clear it.
* **`resetDataSelectionOnly()` is an undo step** (the selected new rows it removes are not brought back
  by an undo - new rows are never in the history).
* **The row menu has an "Edit:" section** (Undo, Redo, Revert cell, Revert rows) after Delete. Code that
  finds an entry by its id is not affected; code that counted on the order is.

## Other behaviour changes

* **Group rows with aggregates are taller**: the name on a line of its own, a line for each function
  of the column with the most. `aggregate` takes a list (`['sum', 'avg']`), the header menu turns them
  on and off, and `getState()` has `aggregates` and `totalsRow` - a saved state from before has neither,
  `setState()` then keeps what the grid has.

* **`autoResizeColumns()` is `fitColumns()`** (the old name still works, deprecated): it measures what
  the cells show, the filtered rows only. `fitColumns(['name'])` fits one column, `resetColumnWidths()`
  goes back. Rows can be fitted to their multiline text: `fitRows()` / `resetRowHeights()`.

* **Copies of more than one cell start with a header line** of the column labels (text and html), and
  several ranges copy as one table. `copyHeaders: false` gives the values only. The row menu's copies
  write what the cells show (not ISO dates / raw numbers).

* **The date picker's class names are prefixed** (`.year` -> `.simple-html-date-year`, `.side` ->
  `.simple-html-date-time-field`, `.date-flex-col` -> `.simple-html-date-actions` ..., see the
  changelog) - css of your own that styled the old names needs the new ones. `datepickerHeight`
  defaults to 282.

* **The row menu exports Excel**: `row.export.csv` / `row.export.csvSelected` are now
  `row.export.excel` / `row.export.excelSelected` (texts too). CSV is still `getCsv()` /
  `downloadCsv()`; a `menus` hook can add a CSV entry back.

* **The wheel over the grid no longer scrolls the page**: the grid cancels it. Ctrl+wheel (zoom) is
  the browser's as before. A test that sent a `wheel` event with `wheelDeltaY` has to send
  `deltaY` (`new WheelEvent('wheel', { deltaY: 40 })` scrolls the rows down 40px).

* **An empty text or number header filter shows `Text` / `Number`**, not 🔍 - the texts
  `filter.placeholder.text` / `filter.placeholder.number`. A test that looked for the 🔍 placeholder
  has to look for those; `placeholderFilter` on a column still wins.

Also found while writing the v6 docs: each did not do what its name or its docs said.

* **`setData()` clears `currentEntity`** (to `null`, and sends `current-entity`) when the current row
  is no longer in the data. Replaced rows are new objects, so this is the case after every
  `setData(rows)` - also when a row with the same key comes back. v5 kept pointing at the old row.
  Rows added with `{ add: true }`, or the same row objects set again, keep it.
* **The methods that remove rows let go of them**: `removeData()`, `removeAllData()`,
  `clearMarkedForDeletion()`, `acceptChanges()` (the rows marked for deletion) and `resetData()` /
  `resetDataSelectionOnly()` (the new rows). When the current row is removed, `currentEntity` is set
  to `null`; a removed row leaves the selection. `current-entity` and `selection-change` are sent
  after the method's own event. v5 kept both pointing at the removed row - a row added later with the
  same key came back selected.
* **`selectAll()` only works in the `'multiple'` selection mode.** In `'single'` and `'none'` it
  selects nothing and sends no `selection-change` (v5 sent the event anyway). The same for a click on
  the grid's top left corner.
* **`removeGroup(group)` finds the level by its field**: a copy of the grouping, e.g. from a saved
  state, removes it. v5 compared the object, so a copy removed nothing but still regrouped and sent
  the events. A field that is not grouped on now changes nothing and sends no event.
* **`expandGroup(id)` of a sub group expands the groups above it** too, so it is shown. In v5 it did
  nothing while its parent was collapsed.
* **The rows are always sorted on the grouped fields before they are grouped.** `setGrouping()`
  followed by `filter()` (or `setData()` ...), and `setOrderBy()` or `resetSort()` while grouped,
  grouped unsorted rows in v5: a group showed up once for each run of equal values. The grouped
  fields now come first in the sort (`getLastSorting()` shows it), each keeping its direction.
* **`DateInterface.setSelected(dates)` shows the dates selected.** v5 kept the `Date` objects, while a
  day is matched by timestamp, so nothing showed. The dates are kept as timestamps now, and a day is
  selected when a date falls on it, whatever its time. `getSelected()` returns `number[]` (v5:
  `unknown[]`), and `selected` is a `Set<number>`.

```ts
// v5: a copy of the grouping removed nothing
datasource.removeGroup(datasource.getGrouping()[0]); // the object itself was needed

// v6: by field
datasource.removeGroup({ attribute: 'country', title: 'Country' });
```

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

* `datasource.getFilter()` returns `FilterExpression | null` - it is `null` when no filter is set.
  `setFilter(null)` is allowed. See [Filters](#filters) for the new format.
* `getState().filter` is `null` when no filter is set (`saveConfig()` is gone, see
  [Grid config](#grid-config))
* `HTMLCellElement.$attribute` is `string | null` - group and selector cells have none
* `IDateConfig.datepickerDate` is `Date | null | undefined` - empty opens on today
* `getFilterString()` / `getFilterTree()` no longer take the grid, see
  [Fields and formatters](#getfilterstring-and-getfiltertree-take-a-label-function)

Types that public signatures use are now exported, so you can name them: `ColType`, `EntityUnion`,
`DataEntity`, and the grid config's `ColumnConfig`, `GridLayout`, `LayoutColumn`, `GridState` and
`HeaderFilter` (see [Grid config](#grid-config)).

`readonlySetter()` and `cellAppendClassSetter()` are gone, the callbacks are hooks (`GridHooks`): see
[The callbacks are hooks](#the-callbacks-are-hooks-isreadonly-and-cellclass).
