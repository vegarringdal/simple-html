# Formatting

A formatter turns the values of a field into text, and text back into values. Every field has one:
its own, or the datasource's default for the field's type.

The datasource's options name a formatter by its id: `formatter: 'numberComma'`. The built-in
formatters are registered under ids from the start, your own you register with
`registerFormatter()`. So the options are plain JSON and can be stored, the formatters stay code.

A formatter gives text. To draw a cell another way - a badge, a bar, a link - give the column a cell
renderer, see [Custom cells](21-custom-cells.md): it gets the formatter's text too.

## What a formatter does

A formatter is a plain object with two methods and two optional parts:

```ts
import type { Formatter } from '@simple-html/grid';

const percent: Formatter = {
    // value -> text: a cell, the edit input, the header filter, a group row, the footer, getFilterString()
    format: (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : ''),
    // text the user typed or pasted -> the value stored in the row
    parse: (text) => (text.trim() === '' ? null : Number(text.replace('%', '').trim()) / 100),
    // optional: text typed in a filter -> the value filtered on. Left out, parse is used
    parseFilter: (text) => Number(text.replace('%', '').trim()) / 100,
    // optional: shown in the empty header filter
    placeholder: '0 %'
};
```

- `format` gets whatever the row holds and returns text: `''` for an empty value.
- `parse` and `parseFilter` always get text from the grid.
- A boolean field is shown as a checkbox from the raw value. Its formatter is used where it is
  shown as text: the filter string, group rows, and text pasted into the column.
- Do not use `this` in the methods: the datasource can call them on their own.

## The defaults per type

| type | default formatter | shows | parses |
| --- | --- | --- | --- |
| `text` | `'text'`, `TextFormatter` | the text, `0` and `false` as `0` and `false` | the text as it is |
| `number` | `'numberDot'`, `NumberFormatterDot` | `1234.5` | `'12.5'` and `'12,5'` as 12.5. Text that is no number, and `''`, as 0 |
| `boolean` | `'boolean'`, `BooleanFormatter` | `true` / `false` | `'true'` (any case) as true, other text as false, `''` as null |
| `date` | `'dateYYYYMMDD'`, `DateFormatterYYYYMMDD` | `2026-11-20` | `'2026-11-20'` as a `Date` |
| `datetime` | `'datetimeYYYYMMDD'`, `DateFormatterYYYYMMDDTHHMMSS` | `2026-11-20T13:45:12` | `'2026-11-20T13:45:12'` as a `Date` |

Every formatter shows `null` and `undefined` as `''`.

An emptied number cell stores `0`, not `null`: the number formatters parse `''` as 0. "Clear" in the
row menu stores `null`. Both count as blank in a filter, see
[0 is blank](06-filtering.md#0-is-blank). For `null` from an emptied cell, give the field a formatter
that parses `''` as `null`:

```ts
import { Datasource, type Formatter, NumberFormatterDot, registerFormatter } from '@simple-html/grid';

const emptyIsNull: Formatter = {
    ...NumberFormatterDot,
    parse: (text) => (text.trim() === '' ? null : NumberFormatterDot.parse(text))
};
registerFormatter('numberEmptyIsNull', emptyIsNull);

const datasource = new Datasource({ fields: { amount: { type: 'number', formatter: 'numberEmptyIsNull' } } });
```

## The built-in formatters

Each is registered under an id, the options use the id. The object is exported too: call it
yourself (`NumberFormatterComma.format(12.5)`), or build a variant of it.

| id | formatter | shows | placeholder |
| --- | --- | --- | --- |
| `'text'` | `TextFormatter` | the text | |
| `'boolean'` | `BooleanFormatter` | `true` / `false` | |
| `'numberDot'` | `NumberFormatterDot` | `1234.5` | |
| `'numberComma'` | `NumberFormatterComma` | `1234,5` | |
| `'dateYYYYMMDD'` | `DateFormatterYYYYMMDD` | `2026-11-20` | `YYYY-MM-DD` |
| `'dateDDMMYYYY'` | `DateFormatterDDMMYYYY` | `20.11.2026` | `DD.MM.YYYY` |
| `'datetimeYYYYMMDD'` | `DateFormatterYYYYMMDDTHHMMSS` | `2026-11-20T13:45:12` | `YYYY-MM-DDTHH:MM:SS` |
| `'datetimeDDMMYYYY'` | `DateFormatterDDMMYYYYTHHMMSS` | `20.11.2026T13:45:12` | `DD.MM.YYYYTHH:MM:SS` |

The date formatters fill in what the typed text leaves out:

- a missing month is the current month, a missing day (or year, for the `DD.MM.YYYY` ones) the
  current one
- `parse` gives the date the current time of day, for the parts of the time the text has not.
  `parseFilter` gives them 0, so a filter starts at the start of the day.
- `''` is `null`, text that is not a date gives `''`

The number formatters read both `12.5` and `12,5`, whichever separator they show.

## A different default for a type

`formatters` in the datasource's options sets the formatter of every field of a type that has none
of its own, by id:

```ts
import { Datasource } from '@simple-html/grid';

const datasource = new Datasource({
    fields: { price: 'number', amount: 'number', born: 'date' },
    formatters: { number: 'numberComma', date: 'dateDDMMYYYY' }
});
```

```sample formatters
```

## A formatter for one field

Give the field a `formatter`, the id of a registered formatter:

```ts
import { Datasource } from '@simple-html/grid';

const datasource = new Datasource({
    fields: {
        price: { type: 'number', formatter: 'numberComma' },
        born: { type: 'date', formatter: 'dateDDMMYYYY' }
    }
});

datasource.getFormatter('price').format(12.5); // '12,5'
```

`datasource.getFormatter(field)` returns the formatter of a field - the object, not the id -
`getField(field).formatter` too.

## A formatter of your own

Register it under an id with `registerFormatter(id, formatter)`, and name the id in the options. A
built-in formatter is a plain object, so a variant is a spread away:

```ts
import { Datasource, type Formatter, NumberFormatterDot, registerFormatter, TextFormatter } from '@simple-html/grid';

// shown in upper case, stored as typed
const upperCase: Formatter = {
    ...TextFormatter,
    format: (value) => TextFormatter.format(value).toUpperCase()
};

// two decimals and a space between the thousands: 12345.6 -> '12 345.60'
const money: Formatter = {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
    parse: (text) => NumberFormatterDot.parse(text.replaceAll(' ', ''))
};

// when the page loads, before a datasource names them
registerFormatter('upperCase', upperCase);
registerFormatter('money', money);

const datasource = new Datasource({
    fields: {
        country: { formatter: 'upperCase' }, // a text field: no type needed
        price: { type: 'number', formatter: 'money' }
    },
    formatters: { date: 'dateDDMMYYYY' } // an id works for the default of a type too
});

datasource.getFormatter('price').format(12345.6); // '12 345.60'
```

- **Register before the datasource is made.** The datasource looks its ids up once, when it is
  made, and keeps the formatters it found. An id that is not registered throws there, and the
  message lists the ids that are.
- **Registering an id again replaces the formatter**, for the datasources made after; one made
  before keeps the formatter it has. A built-in id can be replaced too, and replacing a default
  (`'numberDot'` ...) changes every field of that type without a formatter of its own. Use an id of
  your own unless that is what you want.
- There is one registry for the page, every datasource uses it.
- The id is any text. The options stay plain JSON, so `fields` and `formatters` can be stored - in a
  backend, say - and the formatters registered in code. See
  [Saving the config](02-grid-config.md#saving-the-config).

```sample custom-formatter
```

A formatter that reads a setting of your own (the number of decimals, say) can change what it
shows: call `gridInterface.rebuild()` after the setting changed, so the cells and the header
filters show it.

## The type from another field

For property/value style data - a column of values of different types - a text column can take the
type of each cell from another field of its row, with `dynamicCellTypeColumn`:

```ts
import { Datasource, type GridConfig } from '@simple-html/grid';

const datasource = new Datasource(); // value and valueType are text fields: not listed
datasource.setData([
    { property: 'Name', valueType: 'text', value: 'Ann' },
    { property: 'Age', valueType: 'number', value: 36 },
    { property: 'Born', valueType: 'date', value: new Date(1990, 4, 17) },
    { property: 'Active', valueType: 'boolean', value: true }
]);

const config: GridConfig = {
    readonly: false,
    columns: {
        value: { dynamicCellTypeColumn: 'valueType' }
    },
    layout: {
        center: [
            { fields: ['property'], width: 120 },
            { fields: ['valueType'], width: 100 },
            { fields: ['value'], width: 150 }
        ]
    }
};
```

- The field must be a `text` field, which is what a field not listed in `fields` is.
- The other field holds `'text'`, `'number'`, `'boolean'`, `'date'` or `'datetime'`. Anything else
  leaves the cell text.
- Each cell is shown and edited as its type, with the datasource's default formatter for it:
  `datasource.getFormatter(field, type)`. A date cell gets the date picker, a boolean a checkbox.
- Sorting, grouping and filtering still treat the field as text.

```sample dynamic-cell-types
```

## Showing 0 or an empty cell: `numberOverride`

The column option `numberOverride` changes what a number cell shows, not the value:
`'ZERO_TO_BLANK'` shows 0 as an empty cell, `'BLANK_TO_ZERO'` an empty cell as `0`. See
[Grid config](02-grid-config.md#column-options).
