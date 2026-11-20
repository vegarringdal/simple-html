# Formatting

A formatter turns the values of a field into text, and text back into values. Every field has one:
its own, or the datasource's default for the field's type.

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
| `text` | `TextFormatter` | the text, `0` and `false` as `0` and `false` | the text as it is |
| `number` | `NumberFormatterDot` | `1234.5` | `'12.5'` and `'12,5'` as 12.5. Text that is no number, and `''`, as 0 |
| `boolean` | `BooleanFormatter` | `true` / `false` | `'true'` (any case) as true, other text as false, `''` as null |
| `date` | `DateFormatterYYYYMMDD` | `2026-11-20` | `'2026-11-20'` as a `Date` |
| `datetime` | `DateFormatterYYYYMMDDTHHMMSS` | `2026-11-20T13:45:12` | `'2026-11-20T13:45:12'` as a `Date` |

Every formatter shows `null` and `undefined` as `''`.

An emptied number cell stores `0`, not `null`: the number formatters parse `''` as 0. "Clear" in the
row menu stores `null`. Both count as blank in a filter, see
[0 is blank](06-filtering.md#0-is-blank).

## The built-in formatters

| formatter | shows | placeholder |
| --- | --- | --- |
| `TextFormatter` | the text | |
| `BooleanFormatter` | `true` / `false` | |
| `NumberFormatterDot` | `1234.5` | |
| `NumberFormatterComma` | `1234,5` | |
| `DateFormatterYYYYMMDD` | `2026-11-20` | `YYYY-MM-DD` |
| `DateFormatterDDMMYYYY` | `20.11.2026` | `DD.MM.YYYY` |
| `DateFormatterYYYYMMDDTHHMMSS` | `2026-11-20T13:45:12` | `YYYY-MM-DDTHH:MM:SS` |
| `DateFormatterDDMMYYYYTHHMMSS` | `20.11.2026T13:45:12` | `DD.MM.YYYYTHH:MM:SS` |

The date formatters fill in what the typed text leaves out:

- a missing month is the current month, a missing day (or year, for the `DD.MM.YYYY` ones) the
  current one
- `parse` gives the date the current time of day, for the parts of the time the text has not.
  `parseFilter` gives them 0, so a filter starts at the start of the day.
- `''` is `null`, text that is not a date gives `''`

The number formatters read both `12.5` and `12,5`, whichever separator they show.

## A different default for a type

`formatters` in the datasource's options sets the formatter of every field of a type that has none
of its own:

```ts
import { Datasource, DateFormatterDDMMYYYY, NumberFormatterComma } from '@simple-html/grid';

const datasource = new Datasource({
    fields: { price: 'number', amount: 'number', born: 'date' },
    formatters: { number: NumberFormatterComma, date: DateFormatterDDMMYYYY }
});
```

```sample formatters
```

## A formatter for one field

Give the field a `formatter`. A built-in formatter is a plain object, so a variant is a spread away:

```ts
import { Datasource, type Formatter, NumberFormatterDot, TextFormatter } from '@simple-html/grid';

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

const datasource = new Datasource({
    fields: {
        country: { formatter: upperCase }, // a text field: no type needed
        price: { type: 'number', formatter: money }
    }
});

datasource.getFormatter('price').format(12345.6); // '12 345.60'
```

`datasource.getFormatter(field)` returns the formatter of a field, `getField(field).formatter` too.

```sample custom-formatter
```

The formatters are set when the datasource is made. A formatter that reads a setting of your own
(the number of decimals, say) can change what it shows: call `gridInterface.rebuild()` after the
setting changed, so the cells and the header filters show it.

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
