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
const allNames = datasource.getDataRows().map((row) => row.name);
```

`currentEntity` is a group row when the keyboard moves from the first data row up into the header
filter row while grouped (row 0 becomes current, and that is a group row), or after
`setRowAsCurrentEntity()` with a group row's index. Clicking a group row, `select()`,
`selectNext()` ... never make one current.

The `cell-header-focus` event's `rowData` is not the header's own row: it is the first displayed
row. When grouped that is a group row, and `undefined` when there were no rows. The other cell
events (`cell-click`, `cell-row-focus`, ...) and the config's `isReadonly` / `cellClass` (were
`readonlySetter()` / `cellAppendClassSetter()`, see [The callbacks are in the config](#the-callbacks-are-in-the-config-isreadonly-and-cellclass))
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
    layout: { center: [ ... ] } // no columns needed: name, age and born have no other options
};
```

`attributes` and `columnsCenter` are gone too, see [Grid config](#grid-config).

A column's label is its own `label`, else the field's `label`, else the field name (the header
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

Filters take the type from `fields` too, a condition has no `attributeType` any more - see
[Filters](#filters).

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
import { type FilterExpression, type FilterOperator, where } from '@simple-html/grid';

/** a filter as v5 saved it in GridConfig.filter */
interface V5Filter {
    type?: 'GROUP' | 'CONDITION';
    logicalOperator?: 'AND' | 'OR' | 'NONE';
    attribute?: string | null;
    operator?: FilterOperator | null;
    value?: unknown;
    valueType?: 'VALUE' | 'ATTRIBUTE' | null;
    filterArguments?: V5Filter[];
}

function fromV5(filter: V5Filter): FilterExpression | null {
    if (filter.type === 'GROUP' || Array.isArray(filter.filterArguments)) {
        const children = (filter.filterArguments ?? []).map(fromV5).filter((child): child is FilterExpression => child !== null);
        return { group: filter.logicalOperator === 'OR' ? 'OR' : 'AND', children };
    }
    if (!filter.attribute || !filter.operator) {
        return null; // incomplete, v5 ignored it too
    }
    if (filter.valueType === 'ATTRIBUTE') {
        return { field: filter.attribute, operator: filter.operator, valueField: String(filter.value) };
    }
    return where(filter.attribute, filter.operator, filter.value);
}

const saved = JSON.parse(localStorage.getItem('my-grid-layout') ?? 'null');
if (saved?.filter) {
    gridInterface.setState({ filter: fromV5(saved.filter) });
}
```

`attributeType` is dropped: list the field in `fields`.

### 0 is blank - unchanged, on purpose

A row value of 0 still counts as blank: for number fields `IS_BLANK` matches 0 and `IS_NOT_BLANK`
leaves it out, and the header's value list (text fields) puts a 0 under "Blank". In ERP style data
0 and empty mean the same, and changing it would silently change what existing filters match. It
is documented on `FilterOperator`.

## Options objects instead of boolean flags

No method of `Datasource` or `DataContainer` takes a positional boolean any more. A call like
`setData(rows, true, true)` did not say what the `true`s meant; the options are named now, and a
flag that changed what a method does is a method of its own. Every option is optional and keeps
the default the boolean had.

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
| `setData` `refilter` | `false` | run the current filter on the rows. Without it every row set is shown |
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

TypeScript reports every old call. **In plain js a boolean in place of the options is not an
error: it is ignored, and the defaults apply** - `setData(rows, true)` replaces the rows instead of
adding them, `markForDeletion(null, true)` marks nothing. Search your code for these methods.

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

## Grid config

The config is what you write: the options of each column, where the columns go, sizes and
behaviour. The state is what the user changes while working with the grid: column order, pinning and
widths, sorting, grouping, expanded groups, the filter and what the header filters show. v5 mixed the
two in one `GridConfig`; v6 keeps them apart.

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

// v6
const gridConfig: GridConfig = {
    columns: {
        name: { label: 'Name', placeholderFilter: 'search', mandatory: true },
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
| `dynamicCellTypeColumn`, `readonly`, `numberOverride`, `focusButton`, `mandatory`, `mandatoryOnlyIfEmpty`, `allowPasteClearOnly` | unchanged |

In v5 picking an operator in the header filter's menu wrote it into the column's `operator`, so the
config changed under you (and opening the menu set it to the type's default). In v6 the column's
`operator` is never changed by the grid.

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

This turns a v5 config - one you wrote, or one `saveConfig()` saved - into a v6 one: `attributes`
become `columns`, the `columns*` the `layout`, and the state v5 kept in the config goes into
`initialState`. It uses `fromV5()` from [Saved configs](#saved-configs) for the filter.

```ts
import {
    type ColumnConfig,
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
    for (const { attribute, placeHolderRow, placeHolderFilter, currentFilterValue, type, ...rest } of attributes) {
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
```

```ts
// a config written for v5
const gridInterface = new GridInterface(fromV5Config(v5Config), datasource);

// a state saved with v5's saveConfig(): the layout and the state parts of it
const saved = JSON.parse(localStorage.getItem('my-grid-layout') ?? 'null');
if (saved) {
    const { layout, initialState } = fromV5Config(saved);
    gridInterface.setState({ ...initialState, layout });
}
```

A column's `type` is dropped, list the field's type in the datasource's `fields`. An `operator` the
user had picked in v5 was saved in the attribute, it stays the column's `operator` - the header
filter starts with it.

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

### The callbacks are in the config: `isReadonly` and `cellClass`

`readonlySetter()` and `cellAppendClassSetter()` are removed. The callbacks are options of the
config, so they are there from the first render, and `updateConfig()` sets or removes them later:

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
const gridConfig: GridConfig = {
    layout: { center: [ ... ] },
    isReadonly: (row, field, readonlyByConfig) => (field === 'company' && row.isActive === false ? true : null),
    cellClass: (row, field) =>
        field === 'balance' && row.balance < 0 ? { input: 'negative-text', background: 'negative-background' } : null
};
gridInterface.updateConfig({ isReadonly: undefined }); // removed again
```

| v5 | v6 |
| --- | --- |
| `readonlySetter(callback)` | `GridConfig.isReadonly`, or `updateConfig({ isReadonly })` |
| `cellAppendClassSetter(callback)` | `GridConfig.cellClass`, or `updateConfig({ cellClass })` |
| `readonlySetter(null)` / `cellAppendClassSetter(null)` | `updateConfig({ isReadonly: undefined })` / `updateConfig({ cellClass: undefined })` |
| readonly callback `(attribute, rowData, cellReadOnlyConfig)` | `isReadonly(row, field, readonlyByConfig)` - the row first |
| class callback `(attribute, rowData, cellReadOnly)` | `cellClass(row, field)` - the row first, no third argument |
| `{ inputClass, dimmedClass }` | `{ input, background }` (`CellClass`), both optional. `null` / `undefined` for no classes |

* **`inputClass` is `input`**: the class goes on the cell's `<input>`, the text.
* **`dimmedClass` is `background`**: the class goes on the element behind the input. The input is
  transparent, so it is the cell's background; the grid draws the readonly and mandatory stripes
  there. As in v5 the element has no size on an editable cell (the grid's readonly and mandatory
  classes give it one): give your class `position: absolute; inset: 0`.
* **`cellClass` has no third argument.** v5 passed whether the cell is readonly. Both callbacks are
  yours: call the same check from `cellClass` if you need it.
* **`isReadonly` works as `readonlySetter` did**: `true` / `false` decide, anything else
  (`null`, `undefined`) leaves it to the column's `readonly`, which is passed in as
  `readonlyByConfig`. The grid's `readonly: true` still wins, and the row menu's paste and clear ask
  it for every selected row.
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
* **The rest is kept**: the sorting, grouping, filter and header filters, and the handlers subscribed
  with `on()`.

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
| `gridInterface.readonlySetter(callback)` | removed: `GridConfig.isReadonly`, see [above](#the-callbacks-are-in-the-config-isreadonly-and-cellclass) |
| `gridInterface.cellAppendClassSetter(callback)` | removed: `GridConfig.cellClass`, see [above](#the-callbacks-are-in-the-config-isreadonly-and-cellclass) |
| `element.enableCleanup` | removed, see [`createGrid()`](#creategrid-a-grid-on-the-page-in-one-call) |
| `element.connectedCallback()` / `disconnectedCallback()` | not in the typings: the browser calls them |
| `gridInterface.contextMenuCustom(event, options, cell, callback)` | `openMenu(at, entries)`, see [Menus](#menus) |
| `gridInterface.setContextMenuElement(element)` | `openMenu(at, [{ type: 'block', id, element }])`, see [Menus](#menus) |
| `gridInterface.removeContextMenuElement()` | `closeMenu()` |
| `gridInterface.getContextMenuElement()` | removed, see [Menus](#menus) |
| - | new: `createGrid()`, `gridInterface.updateConfig()`, `gridInterface.destroy()`, `openMenu()`, `closeMenu()`, `GridConfig.menus` |

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
from the config, and `openMenu()` opens one of your own with the same entries. `contextMenuCustom()`,
`getContextMenuElement()`, `setContextMenuElement()` and `removeContextMenuElement()` are removed.

An entry (`MenuEntry`) is one of:

| entry | shown as |
| --- | --- |
| `{ id, label, action, hint?, visible?, disabled?, selected? }` - `MenuItem`, `type: 'item'` can be left out | an item to click: the menu closes, then `action(context)` runs. `hint` is shown in italics after the label |
| `{ type: 'section', id, label }` - `MenuSection` | a section header, "Copy:" |
| `{ type: 'separator', id }` - `MenuSeparator` | a dashed line |
| `{ type: 'block', id, element }` - `MenuBlock` | your element, as it is |

`visible`, `disabled` and `selected` are called with the `MenuContext` when the menu opens: what it was
opened on (`field`, `row`, `rowIndex`, `cell`), the `gridInterface` and the `datasource`.

### The grid's own menus: `GridConfig.menus`

v5 had no way to change the row, header or filter menu. In v6 `GridConfig.menus` has a function per
menu - `row` (a cell), `header` (a header label), `filter` (a header filter). It gets the grid's own
entries and the context, and returns what to show:

```ts
const gridConfig: GridConfig = {
    layout: { center: [ ... ] },
    menus: {
        row: (defaults, context) => [
            // hide built-in entries by id
            ...defaults.filter((entry) => !entry.id.startsWith('row.summary')),
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
```

* **Every built-in entry has an id**, listed with its label in `MENU_IDS` (exported, in the order the
  menus show them): `row.copy.cell`, `row.paste.cell`, `header.column.hide`, `filter.values` ... A
  section is `menu.section`, what is under it `menu.section.entry`.
* **`defaults` always has every entry.** The ones that do not apply have a `visible` callback that
  hides them: paste and clear on a readonly cell, the summary of a column that is not a number, the
  operators of another type. A section header or separator is shown as long as it is in the list:
  hide it with the entries under it.
* **The header filter's value list** (the search box, a checkbox per value and "Run Search") is one
  entry, the block `filter.values`: hide or move it as a whole.
* `updateConfig({ menus })` changes them while the grid is shown, `updateConfig({ menus: undefined })`
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
* A disabled item gets the class `simple-html-grid-menu-item-disabled` and `aria-disabled="true"`.

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

`readonlySetter()` and `cellAppendClassSetter()` are gone, the callbacks are in the config: see
[The callbacks are in the config](#the-callbacks-are-in-the-config-isreadonly-and-cellclass).
