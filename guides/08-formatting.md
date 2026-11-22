# Formatting

A formatter turns the values of a field into text, and text back into values. Every field has one:
its own, or the datasource's default for the field's type.

The datasource's options name a formatter by its id: `formatter: 'numberComma'`. The built-in
formatters are registered under ids from the start, your own you register with
`registerFormatter()`. So the options are plain JSON and can be stored, the formatters stay code.

A formatter gives text. To draw a cell another way - a badge, a bar, a link - give the column a cell
renderer, see [Custom cells](21-custom-cells.md): it gets the formatter's text too.

How a column *shows* its values - a date as `22.11.2026` or as the week `2026-W47`, a number as
`1 234 567,89` - the user can pick in the header menu, without a formatter of your own: see
[Display formats](#display-formats).

## What a formatter does

A formatter is a plain object with two methods and three optional parts:

```ts
import type { Formatter } from '@simple-html/grid';

const percent: Formatter = {
    // value -> text: a cell, the header filter, a group row, the footer, getFilterString()
    format: (value) => (typeof value === 'number' ? `${Math.round(value * 100)} %` : ''),
    // optional: the text while a cell is edited, the plain value to type over. Left out, format is used
    formatForEdit: (value) => (typeof value === 'number' ? String(Math.round(value * 100)) : ''),
    // text the user typed or pasted -> the value stored in the row
    parse: (text) => (text.trim() === '' ? null : Number(text.replace('%', '').trim()) / 100),
    // optional: text typed in a filter -> the value filtered on. Left out, parse is used
    parseFilter: (text) => Number(text.replace('%', '').trim()) / 100,
    // optional: shown in the empty header filter
    placeholder: '0 %'
};
```

- `format` gets whatever the row holds and returns text: `''` for an empty value.
- `formatForEdit` is what a cell shows while it is edited - from when its input gets the focus until it
  loses it - and the text the editor over a cell starts from. Give the plain value where `format` is
  hard to type over: thousands separators, a currency sign, a `%`. `parse` must read it back. The cell
  shows `format` again when it loses the focus. A readonly cell always shows `format`.
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

// two decimals and a space between the thousands: 12345.6 -> '12 345.60', edited as '12345.6'
const money: Formatter = {
    ...NumberFormatterDot,
    format: (value) => (typeof value === 'number' ? value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''),
    formatForEdit: (value) => NumberFormatterDot.format(value),
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

## Display formats

A display format is how a column shows its values, picked by the user: right click a column label,
**Format ›**. A date column shows its dates as ISO, Norwegian, US ... or a part of them - the week,
the day of the week, the days until; a number column picks its decimals, its thousands separator and
its decimal mark. It is a view setting, like a column's width: only the text shown changes, the value
stays as it is - an edited cell shows the value, the header filter is typed as before. It is part of
the state, so `getState()` keeps it.

Give a column the format it starts with in the config, `ColumnConfig.format`: an object with a part
for the field's type, `date` for a `date` or `datetime` field, `number` for a `number` field.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        born: { format: { date: 'norwegian' } }, // 22.11.2026
        due: { format: { date: 'daysUntil' } }, // 3: in three days
        updated: { format: { date: 'norwegianTime' } }, // 22.11.2026 13:45 (a datetime field)
        balance: { format: { number: { decimals: 2, thousands: ' ', decimal: ',' } } } // 1 234 567,89
    },
    layout: {
        center: [
            { fields: ['born'], width: 100 },
            { fields: ['due'], width: 80 },
            { fields: ['updated'], width: 130 },
            { fields: ['balance'], width: 120 }
        ]
    }
};
```

A format that does not fit the field throws a `TypeError` when the grid is made, or `updateConfig()`
or `setState()` is given it: an id that is not a date format, a part for another type (`date` on a
number field), a time format on a `date` field, a number format with a part it does not have, and a
format on a lookup column (`editor`: its cells show a label). Text and boolean columns have no
format, and no Format › in their header menu.

```sample full-grid
```

### The date formats

What 2026-11-22 13:45:12, a Sunday, is shown as. The time formats are for a `datetime` field only.

| `date` | shows | |
| --- | --- | --- |
| `'iso'` | `2026-11-22` | |
| `'norwegian'` | `22.11.2026` | |
| `'norwegianShort'` | `22.11.26` | |
| `'us'` | `11/22/2026` | |
| `'uk'` | `22/11/2026` | |
| `'medium'` | `Nov 22, 2026` | `22. nov. 2026` with `format.locale` `nb-NO` |
| `'long'` | `November 22, 2026` | `22. november 2026` |
| `'full'` | `Sunday, November 22, 2026` | `søndag 22. november 2026` |
| `'isoTime'` | `2026-11-22 13:45` | `datetime` |
| `'isoSeconds'` | `2026-11-22 13:45:12` | `datetime` |
| `'norwegianTime'` | `22.11.2026 13:45` | `datetime` |
| `'norwegianSeconds'` | `22.11.2026 13:45:12` | `datetime` |
| `'time'` | `13:45` | `datetime` |
| `'timeSeconds'` | `13:45:12` | `datetime` |
| `'weekday'` | `Sunday` | `søndag` |
| `'weekIso'` | `2026-W47` | ISO 8601, see below |
| `'weekUs'` | `2026-W48` | see below |
| `'month'` | `2026-11` | |
| `'quarter'` | `2026 Q4` | |
| `'year'` | `2026` | |
| `'daysUntil'` | `0` | whole days from today, see below |

The local day and time are shown, as the date formatters show them. A `datetime` column with a date
format shows the date only: `'norwegian'` is `22.11.2026`.

- **Week, ISO** (ISO 8601, as in Norway and most of Europe): a week starts on Monday, week 1 is the
  week with the year's first Thursday. A week belongs to one year, the year of its Thursday: the first
  days of January can be the last week of the year before, the last days of December week 1 of the
  next. 2027-01-01 is `2026-W53`, 2024-12-30 is `2025-W01`. A year has 52 or 53 weeks.
- **Week, US** (as Excel's `WEEKNUM`): a week starts on Sunday, week 1 is the week of January 1, and
  a week across New Year is split - 2026-12-31 is `2026-W53`, 2027-01-01 `2027-W01`. 53 weeks, 54
  in a leap year that starts on a Saturday (2000).
- **Days until**: the whole days from today to the date - `1` tomorrow, `0` today, `-1` yesterday.
  The time of day and summer time do not count. Today is the day the cell is rendered: a grid left
  open over midnight shows yesterday's count until its cells are rendered again - a scroll, an edit,
  `gridInterface.refresh()`. It has no timer of its own; call `refresh()` from one of yours to keep it
  up to date.

#### The language of the names

The names of the months and the days - `medium`, `long`, `full`, `weekday` - are made by
`Intl.DateTimeFormat` in the language of the text `format.locale`, `'en-US'` by default. It is set
with the other texts (see [Texts](12-texts.md#display-formats)): the Norwegian texts of an app give
`'nb-NO'`, and the dates follow. A tag Intl does not take (`'nb_NO'`) shows English.

How a week and a quarter are written are texts too, with `{year}`, `{week}` (two digits) and
`{quarter}` filled in:

```ts
import { setTexts } from '@simple-html/grid';

setTexts({
    'format.locale': 'nb-NO', // søndag 22. november 2026
    'format.weekIso': 'uke {week} {year}', // uke 47 2026
    'format.quarter': '{quarter}. kvartal {year}' // 4. kvartal 2026
});
```

### The number formats

A `number` part has four optional parts; `{}` shows the number as it is, without separators:

| part | takes | left out |
| --- | --- | --- |
| `decimals` | `0` to `4` | the decimals the number has, as the field's formatter shows them |
| `thousands` | `' '`, `','`, `'.'` or `"'"` | none |
| `decimal` | `'.'` or `','` | `'.'` |
| `percent` | `true`: the number times 100, with ` %` after it | `false` |

What 1234567.891 is shown as:

| `number` | shows |
| --- | --- |
| `{ thousands: ' ', decimal: ',' }` | `1 234 567,891` (the menu's Norwegian) |
| `{ thousands: ',' }` | `1,234,567.891` (English) |
| `{ thousands: "'" }` | `1'234'567.891` (Swiss) |
| `{}` | `1234567.891` (Plain) |
| `{ decimals: 2, thousands: ' ', decimal: ',' }` | `1 234 567,89` |
| `{ decimals: 0 }` | `1234568` |
| `{ decimals: 1, percent: true }` on 0.256 | `25.6 %` |

- **Rounded half away from zero, of the number as it is written**: `2.5` is `3`, `-2.5` is `-3`,
  `1.005` with two decimals is `1.01` - `toFixed(2)` gives `1.00`, of the binary value
  1.00499999.... A negative number rounded to 0 has no minus: `-0.001` is `0.00`.
- **The decimals as is** are the ones the number has, at most 20, as the field's formatter writes
  them: `0.1 + 0.2` is `0.30000000000000004`. No exponent: `1e21` is a 1 and 21 zeros.
- **The characters are plain ASCII**: the space is U+0020, not the no-break space
  `Intl.NumberFormat('nb-NO')` writes - a cell is one line, and Find finds a space typed. The minus
  is `-`, not the `−` (U+2212) of `nb-NO`. The apostrophe is `'`, not the `’` of Chromium's `de-CH`.
- **One character can not be both separators**: `{ thousands: ',', decimal: ',' }` throws a
  `TypeError`, and so does `{ thousands: '.' }` (the decimal mark is `.` when it is left out). In
  the menu a separator the other one has is greyed out.
- **From the menu**, a column without a format starts with the decimal mark its formatter shows:
  *Decimals › 2* on a `numberComma` field gives `{ decimals: 2, decimal: ',' }`.
- A value that is no finite number, and a blank, is shown by the field's formatter - a blank as an
  empty cell. So is a date column's value that is no date.

### What a display format changes

Only what the grid shows as the cell's text, and what follows the cells. The value, and everything
that reads or writes it, keep to the field's formatter:

| where | shows |
| --- | --- |
| the cells, a readonly cell with the focus too | the display format |
| a cell being edited (it has the focus) | the value, as the field's formatter writes it for editing (`formatForEdit`): a cell shown as `2026-W47` is edited as `2026-11-22`, `1 234 567,89` as `1234567.891`. What is typed is parsed by the field's formatter |
| a renderer of your own (`ColumnConfig.renderer`) | `text` is the display format, `value` the value |
| the edited marker's tooltip, "Original value" | the display format |
| the aggregates in the group rows and the totals row | the display format of a number column, see [Aggregates](18-aggregates.md#how-they-are-shown) |
| the summary of the selected cells in the footer | the display format of the first number field, its decimals - as is: two at most |
| Find, the fitted width (`fitColumns()`), the dimmed repeated values | the text the cells show |
| the header filter, its placeholder | the field's formatter: **you type a date, not a week** - `2026-11-22`, not `2026-W47` |
| the filter chips, the filter editor, `getFilterString()` | the field's formatter: a filter is on the value |
| the names of the group rows | the field's formatter, made by the datasource |
| sorting, grouping | the value: a column shown as weeks sorts and groups by its dates |
| copy (Ctrl+C, Copy ›) and the CSV export | the field's formatter: the value, so a paste reads it back - `2026-W47` and `1 234 567,89` it could not |
| the Excel export | the value, with an Excel number format like the display format where Excel has one, see [Export](15-export.md#typed-cells) |

### In the state

The formats are `GridState.formats`, keyed by field: what the columns' `format` starts with and the
menu changes. `setState({ formats })` replaces them all - to change one column, start from the ones
there are:

```ts
const { formats } = gridInterface.getState(); // { born: { date: 'norwegian' } }

gridInterface.setState({ formats: { ...formats, balance: { number: { decimals: 2 } } } });
gridInterface.setState({ formats: {} }); // every column shows its field's formatter
gridInterface.resetState(); // the formats of the config again
```

See [State](03-state.md#display-formats-in-the-state).

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
[Grid config](02-grid-config.md#column-options). With a display format the 0 is the format's:
`'BLANK_TO_ZERO'` with two decimals shows `0,00`, and `'ZERO_TO_BLANK'` empties what shows as `0,00`.
