# Formatting

A formatter turns the values of a field into text, and text back into values. Every field has one:
its own, or the datasource's default for the field's type.

The datasource's options name a formatter by its id: `formatter: 'numberComma'`. The built-in
formatters are registered under ids from the start, your own you register with
`registerFormatter()`. So the options are plain JSON and can be stored, the formatters stay code.

A formatter gives text. To draw a cell another way - a badge, a bar, a select - give the column a cell
renderer, see [Custom cells](21-custom-cells.md): it gets the formatter's text too.

How a column *shows* its values - a date as `22.11.2026` or as the week `2026-W47`, a number as
`1 234 567,89` - the user can pick in the header menu, without a formatter of your own: see
[Display formats](#display-formats). A column can show a template of the row's fields,
`{firstname} {lastname}`, and be a link, `https://crm.example.com/customer/{id}` or `mailto:{email}`:
see [Templates and links](#templates-and-links). A cell can take a colour from its value - red text
below 0, an orange background for `waiting`: see [Colour rules](#colour-rules). A number column can draw
a bar, a colour scale or an icon by the value's place among its numbers, as a spreadsheet's conditional
formatting: see [Data bars](#data-bars), [Colour scales](#colour-scales) and [Icon sets](#icon-sets). The
user sets all of them in the [grid config dialog](#the-grid-config-dialog), the gear in the footer.

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
stays as it is - an edited cell shows the value. The header filter takes the text as the cells show it:
`2026-W47` in a column shown as weeks is that week, see [Filter as shown](#filter-as-shown). It is part
of the state, so `getState()` keeps it.

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
| the header filter, its placeholder, the range block of its menu, the date pickers | the display format - **you type a week**, `2026-W47`, and the filter is the whole week (`filterAsShown`, see [Filter as shown](#filter-as-shown)). `filterAsShown: false`, the day of the week and a time of day: the field's formatter, `2026-11-22` |
| the filter chips, the filter editor, `getFilterString()` | the field's formatter: a filter is on the value - `2026-W47` typed is a BETWEEN of `2026-11-16` and `2026-11-22` there |
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

### Filter as shown

The header filter of a column with a display format takes the text **as the cells show it**, and
filters on what it stands for - a week, a month, a minute is the whole of it. It is on by default:
`filterAsShown: false` in the column's format turns it off, the grid config dialog has it as a checkbox.

| format | typed | filters on |
| --- | --- | --- |
| `weekIso`, `weekUs` | `2026-W47` | the week: Monday 16 to Sunday 22 November (US: Sunday to Saturday, within the year) |
| `month`, `quarter`, `year` | `2026-11`, `2026 Q4`, `2026` | the month, the quarter, the year |
| `iso`, `norwegian`, `norwegianShort`, `us`, `uk` | `22.11.2026`, `11/22/2026` | the day - a whole day of a `datetime` column too |
| `medium`, `long`, `full` | `Nov 22, 2026`, `22. november 2026` | the day, the names in the language of `format.locale` |
| `daysUntil` | `5` | the day in 5 days: `≤ 5` is up to then - overdue too, `≥ 0` from today |
| `isoTime`, `norwegianTime` | `2026-11-22 13:45` | the minute, 13:45:00 to 13:45:59 |
| `isoSeconds`, `norwegianSeconds` | `2026-11-22 13:45:12` | the second |
| a number format | `1 234,5`, `50 %` | the number read with the format's separators: 1234.5; a percent is a hundredth, 0.5 |
| `weekday`, `time`, `timeSeconds` | | not filtered as shown: a Sunday and 13:45 are of any week, any day - typed as the field's formatter reads it (`2026-11-22`) |

The operator works on the whole period, and the filter is made of ordinary date conditions:

| typed | the filter |
| --- | --- |
| `= 2026-W47` | `BETWEEN` 2026-11-16 and 2026-11-22 |
| `≥ 2026-W47` | from Monday, `≥ 2026-11-16` |
| `> 2026-W47` | after Sunday, `> 2026-11-22` |
| `< 2026-W47` | before Monday, `< 2026-11-16` |
| `≤ 2026-W47` | to Sunday, `≤ 2026-11-22` |
| `≠ 2026-W47` | an OR group: `< 2026-11-16` or `> 2026-11-22` or blank - as `≠` a day, a blank date is not in it |
| `2026-W40..2026-W47` (Between) | Monday of week 40 to Sunday of week 47 - an end left out is open |

The end of a period is its last day for a `date` column, its last second (23:59:59) for a `datetime`
column. A period of one day on a `date` column, one second on a `datetime` column, is the condition as
without a format: `EQUAL 2026-11-22`.

- **No date functions in SQL.** The filter is plain conditions on dates, so
  [`toSqlWhere()`](22-sql.md#a-week-typed-in-the-grid) makes a range of the column of them - an index on
  it works, in every dialect - and so does a backend of your own.
- **The cell keeps what was typed.** The state has the value as before: a date, the start of the period
  typed - `2026-W47` is stored as Monday 2026-11-16 00:00, a BETWEEN as the starts of its two ends - and
  the cell shows it in the format again, `2026-W47`, after a render and after a saved state. See
  [Header filters in the state](03-state.md#header-filters-in-the-state).
- **The text in full**, as shown: `2026-W4` is week 4, `2026-W` is no week and no filter, a column of
  minutes takes the minute. A leading 0 can be left out (`22.1.2026`), case does not matter
  (`2026-w47`, `2026 q4`), a week and a quarter are written as the texts `format.weekIso`,
  `format.weekUs` and `format.quarter` have them (`uke 47 2026`). An ISO date is read too: `2026-11-18`
  typed in a column of weeks is its week.
- **The placeholder** of the empty header filter is an example, today in the format: `2026-W47`,
  `1 234,5`; *Days from today* for `daysUntil` (the text `filter.placeholder.daysUntil`). A column's own
  `placeholderFilter` wins.
- **The date pickers** write the format: a day picked in a column of weeks is `2026-W47`, the range
  picker of Between `2026-W40..2026-W47`, and it opens from Monday of the first week to Sunday of the
  last. The range block of the filter menu reads and writes it too.
- **The format changed** by the user - Format › in the header menu, the grid config dialog - runs a
  header filter with a value again, as the cell shows it then: `2026-W47` switched to *Month* is
  `2026-11`, November; to *Default* `2026-11-16`, that day. `setState({ formats })` from code leaves the
  filter as it is.
- The footer's chips, the filter editor and `getFilterString()` show the conditions: the dates.
- A number format reads the number only, the operators are as without it: `≥ 1 234,5` is `≥ 1234.5`.
  The cell shows the number with the format's separators and the decimals it has: `12.34` typed in a
  column of one decimal stays `12.34`.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        due: { format: { date: 'weekIso' }, operator: 'EQUAL' }, // `2026-W47` is the week
        born: { format: { date: 'norwegian', filterAsShown: false } }, // typed as YYYY-MM-DD
        balance: { format: { number: { thousands: ' ', decimal: ',' } } } // `1 234,5`
    },
    layout: {
        center: [
            { fields: ['due'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['balance'], width: 120 }
        ]
    }
};
```

## Templates and links

A column has two more parts in its format: `text`, a template of what its cells show - a text, number,
date or datetime column - and `link`, which makes its cells links - a text or number column. Both are
templates: text with `{field}` placeholders, each filled in with the value of a field of the row.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // Ann Lee: the text of two fields
        firstname: { format: { text: '{firstname} {lastname}' } },
        // 1 234,5 kg: the cell's own value, {value}, in the column's number format, and text
        weight: { format: { number: { decimals: 1, thousands: ' ', decimal: ',' }, text: '{value} kg' } },
        // a link from an order number: order 1042, to https://shop.example.com/order/1042
        order: { format: { text: 'order {value}', link: { url: 'https://shop.example.com/order/{value}' } } },
        // due 2026-W47: the column's date format in the template
        due: { format: { date: 'weekIso', text: 'due {value}' } },
        // a link to the customer, its text the company and the id: Acme Corp (12)
        company: {
            format: { text: '{company} ({id})', link: { url: 'https://crm.example.com/customer/{id}', newTab: true } }
        },
        // a link that writes an email, one that calls, one to the address the field holds
        email: { format: { link: { url: 'mailto:{email}' } } },
        phone: { format: { link: { url: 'tel:{phone}' } } },
        website: { format: { link: { url: '{website}', newTab: true } } }
    },
    layout: {
        center: [
            { fields: ['firstname'], width: 140 },
            { fields: ['weight'], width: 100 },
            { fields: ['order'], width: 100 },
            { fields: ['due'], width: 100 },
            { fields: ['company'], width: 160 },
            { fields: ['email'], width: 180 },
            { fields: ['phone'], width: 120 },
            { fields: ['website'], width: 180 }
        ]
    }
};
```

```sample full-grid
```

### The placeholders

- **`{field}`** is the value of a field of the row, as text: as the field's formatter writes it -
  `2026-11-22` for a date, `1234.5` for a number - not in a display format, and the value of a lookup
  field, not its label. The field does not have to be a column: `{id}` can be a field the grid does not
  show. A field the row does not have is empty.
- **`{value}`** is the cell's own value: a template that fits any column. In a number or date column
  with a display format (`number`, `date`) it is written in that format - `1 234,5`, `2026-W47` -
  except in the address of a link, where it is the field's formatter's (`1042`). An edited cell shows
  the value, not the template. A field named `value` can not
  be reached from another column.
- **A brace that is not a placeholder is text**: `{}`, `{a` and `}` are shown as they are. A name is
  everything between the braces, spaces too: `{ id }` is the field ` id `.
- **A name that starts with `__`** is the grid's own (`{__rowState}`): a template with one throws a
  `TypeError`.
- `text` is not `''`: leave it out for the cell's own text.

### Templates, not code

The formats are part of the state, and a saved state can come from storage, a backend or another user.
So a template runs nothing: there are no expressions, no `eval`, no `new Function`, no html. A value is
always text - `<img src=x onerror=...>` in a field is shown as those characters - and the text of a
cell and of a link is put in the page as text, never as html.

### The address of a link

`link.url` is where the cells link to. The grid builds it for each row, and checks it:

| `url` | Acme Corp, id 12, ann@example.com, +47 123 45 678 | |
| --- | --- | --- |
| `'https://crm.example.com/customer/{id}'` | `https://crm.example.com/customer/12` | |
| `'https://duckduckgo.com/?q={company}'` | `https://duckduckgo.com/?q=Acme%20Corp` | the values are encoded |
| `'mailto:{email}'` | `mailto:ann@example.com` | the `@` of a mailto: stays |
| `'tel:{phone}'` | `tel:+47%20123%2045%20678` | the `+` of a tel: stays |
| `'{website}'` | the address the field holds, `https://acme.example.com` | one placeholder alone |

- **It starts with its scheme, written out**: `https://`, `http://`, `mailto:` or `tel:`. Or it is one
  placeholder alone, a field that holds the whole address. Anything else throws a `TypeError` when the
  grid is made or `setState()` / `updateConfig()` is given it: `javascript:...`, `data:...`, `ftp:...`,
  a relative `/customer/{id}`, a scheme from a value `{scheme}://...`, `{base}/customer/{id}`.
- **The values are encoded** with `encodeURIComponent`: a value can not end the path, add a query or a
  header, or change the host - `a/b?c` is `a%2Fb%3Fc`. In a `mailto:` and a `tel:` address the `@` and
  the `+` stay as they are: they are part of the address and add nothing (a header or a parameter needs
  `?`, `&`, `=` or `;`, which are encoded).
- **A whole address from a field** is taken as it is, its spaces at the ends trimmed.
- **Then it is checked** with `new URL()`: it is an absolute address of one of the four schemes - after
  the browser's own clean up (tabs and line breaks taken out, the scheme in lower case: `java
script:`
  is `javascript:`). The address linked to is the one `new URL()` gives, so what was checked is what the
  browser opens; an international host is written as punycode, a lookalike `exаmple.com` (with a
  Cyrillic `а`) shows as `xn--exmple-4nf.com` where the browser shows the address.
- **A row whose address is not one of those shows its text, no link**: a field of the address that is
  empty in the row, a value `.` or `..` (the browser would step up the path), a field whose whole
  address is `javascript:alert(1)`, `data:...` or relative, text that is no address.

A field that holds a whole address can link anywhere on the web. When the data is not yours to trust,
write the site in the template - `https://crm.example.com/customer/{id}` - and the field only fills in
a part of it.

### A link cell

The cell shows an `<a>` with the cell's text (its template's, with `text`), underlined in
`--simple-html-grid-link-color`. In a new tab with `newTab: true` (`target="_blank"`,
`rel="noopener noreferrer"`), else in the page.

| what | does |
| --- | --- |
| a click on the text | opens the link, and makes the row the current row |
| Ctrl/Cmd+click, a middle click on the text | the browser's: opens it in a new tab - no range of cells |
| Shift+click on the text | a range of cells, as on any cell: does not open it |
| Alt+click, the second click of a double click | does not open it |
| a click beside the text | the cell, as any cell: the focus, the current row |
| Alt+Enter on the cell | opens the link, as a click on it (Google Sheets' key) |
| Enter, F2, a character typed, a double click beside the text | edit the cell's value - not the text of the template - in the grid's editor of one line over the cell, Enter saves, Esc cancels |
| a right click | the row menu |

The cell is a custom cell the grid draws itself (see [Custom cells](21-custom-cells.md)): it has the
focus - the link in it is out of the tab order and a press on its text focuses the cell - so the
arrows, Tab, the ranges, copy, paste, Delete, Ctrl+D, Ctrl+Z and Find work on it as on any cell. In a
readonly grid the cells are links too, and nothing opens the editor. A screen reader finds the link in
the cell, its name its text; the cell has `aria-keyshortcuts="Alt+Enter"`.

A column with a `renderer` of its own draws its cells: it gets the template's text as `text`, the
grid draws no link. The default cell's `focusButton` and `placeholderRow` are not on a link cell.

### What a template and a link change

As a display format: only what the cells show, and what follows the cells.

| where | |
| --- | --- |
| the cells | the template's text; the link with its address |
| a cell being edited | the value, as the field's formatter writes it: a cell shown as `Acme Corp (12)` is edited as `Acme Corp` |
| Find, the fitted width, the dimmed repeated values | the text the cells show: Find finds `(12)` |
| the edited marker's tooltip, "Original value" | the template with the original value as `{value}` |
| a renderer of your own | `text` is the template's text |
| copy, paste, the CSV export, the Excel export | the value - no template, no link: a paste reads it back. Excel gets text, not a `HYPERLINK` |
| the filter menu's value list, the header filter, the filter chips | the value: a template with other fields would show one value two ways in two rows |
| sorting, grouping | the value |

A template and a link are for a `text` field, and not for a lookup column (`editor`): a format with
them on another type throws a `TypeError`. A cell of another type in a `dynamicCellTypeColumn` is
shown as its type, without them.

## The grid config dialog

The gear at the right end of the footer opens it - and *Column settings…* in the header menu, on that
column, and `gridInterface.openColumnSettings(field)` from a button of your own. `settingsButton: false`
hides the gear ([Grid config](02-grid-config.md#grid-options)).

Its title is *Grid config*. Under the title bar are two tabs:

- **Columns**, below: the settings of each column. `openColumnSettings()` opens the dialog on it.
- **Detail form**: the detail form at the right of the rows - *Show the detail form*, *Expanded*, its
  width with its *Min width* and *Max width* (empty: none; the one typed keeps its value, the others
  follow it), and the fields it shows in their order - each with a drag handle at its right that drags
  it to another place, a line showing where. `openDetailFormSettings()` opens the dialog on it. See
  [The detail form](02-grid-config.md#the-detail-form).

The tabs are a tab list: Tab comes to the tab shown, ArrowLeft / ArrowRight (Home / End) show another.
The footer is the dialog's: *Apply* applies both tabs, *Cancel* drops what was changed on both. Its
left end has the resets of the tab shown.

The Columns tab has the columns at the left and the settings of the one picked at the right - those
in tabs of their own, under the column's name:

| tab | the settings |
| --- | --- |
| **General** | Label - or a calculated column's field name, label and formula - Multiline, Read only, Placeholder |
| **Display** | what the cells show: the format, Filter as shown, blank / 0, Text shown, Show as link, Show as checkbox. Not for a checkbox or a lookup column: General says they have no format |
| **Header filter** | Filter operator, Filter as you type. Not for a checkbox column |
| **Colours** | Colour rules; Data bars, scales, icons for a number column |

A tab with a problem in it has a small red square after its name (*Error* for a screen reader): *Apply*
waits for it. The tab picked stays when another column is picked - General for a column without it. A
calculated column waiting for *Apply* has its own settings only, no tabs. The preview is under every
tab. The tabs are a tab list too: Tab comes to the tab shown, ArrowLeft / ArrowRight (Home / End) show
another.

The settings, from the top:

- **The columns** of the layout are at the left, in their order, each with its label, its type and
  what it has set - *Calculated*, *Format*, *Text*, *Link*, *Checkbox*, *Blank / 0*, *Label*, *Placeholder*,
  *Multiline*, *Read only*, *Colours*, *Bar*, *Scale*, *Icons*, or *Error*. The arrows, Home, End, PageUp / PageDown and a letter pick one, a
  click too.
- **Add calculated column**, under the list: a column whose value a formula computes from the row. A
  calculated column has its field name, label and formula at the top of its settings, the type it gives
  and its value in the row of the preview, its problems at once, and *Remove calculated column*. See
  [Calculated columns](23-calculated-columns.md#in-the-grid-config-dialog).
- **Label**, every column: the column's label - empty is the column's own, which the input shows. The ✎ of
  the column chooser sets it too ([The column chooser](10-menus.md#the-column-chooser)). It
  is the label wherever the grid names the column, the exports' headers too.
- **A date, datetime or number column** has its format: a picker that opens the entries of Format ›,
  the same list as the header menu. Under it, with a format, *Filter as shown* (on): the header filter
  takes the text as the cells show it, see [Filter as shown](#filter-as-shown) - off, the format has
  `filterAsShown: false`. It is off and greyed out for the day of the week and a time of day, the hint
  under it says why. A number column has *Show blank as 0* and *Show 0 as blank* too,
  one or the other: they start as the column shows them, its `numberOverride` too, and turning the
  column's own off is kept as `'NONE'`.
- **A text column** has *Text shown* (the template, empty for the cell's own text), *Show as link*,
  *Address* and *Open in a new tab*. A number column has them too, under its format; a date column
  *Text shown*. The `{ }` button beside a template opens a menu of the fields -
  the columns' and those of the row, by their labels, with a search - and puts the one picked in at the
  caret: no need to know the names of the fields.
- **Show as checkbox**, a text or number column: its cells are checkboxes - for a flag of `1` / `0`.
  The *Checked value* (`1`) and the *Unchecked value* (`0`, empty empties the cell) are under it. A
  checkbox shows no text: while it is on, the template and the link of a text column, the format and
  blank / 0 of a number column are gone from the column and from the dialog. A checked value that is
  empty, the same two values, a value of a number column that is no number are problems.
- **Multiline**, a text column that is not shown as checkboxes: its cells are text of several lines -
  the first line shown, the text editor to edit it (Enter a new line), taller rows with `fitRows()`. It
  starts as the field has it (`multiline` of its field); off, only a value with a line break is shown
  as several lines, as always.
- **Read only**, every column: its cells can not be edited, also in an editable grid - or, unchecked, a
  column that is `readonly` in the config can. It starts as the column has it. The `isReadonly` hook
  still has the last word.
- **Placeholder**, for every column but a checkbox: the placeholder of the column's empty cells, the
  text an empty cell shows greyed - empty is the column's own (`placeholderRow`), which the input shows -
  or *Use the column label*: the label is the placeholder, the input is off. As the column's own it is
  shown on the current row only, unless `placeholderRowCurrentEntityOnly: false`. The header filter
  keeps its own placeholder (`placeholderFilter`).
- **Filter operator**, for every column but a checkbox: the operator of the column's header filter, a
  picker of the operators it offers - the same as Filter › Operator › - with *Default:* and the operator
  the column starts with under it (its `operator`, else the type's: `≥` for a number or date, `=` for a
  text). A column with one operator (`filterOperators`) shows it, there is nothing to pick.
- **Filter as you type**, after the operator, every column but a checkbox: the header filter filters
  after a short pause in typing, see [Filter as you type](06-filtering.md#filter-as-you-type). It starts
  as the column has it (its `filterOnType`, the grid's, or the user's from the operator choice).
- **Colour rules**, every column: the [colour rules](#colour-rules) of its cells, in their order - the
  first that matches wins. Each rule is a group. Its first line: the kind of its condition - *Value*,
  *Conditions* or *Formula*, radio buttons - and *Move up*, *Move down* and *Remove rule* at its right.
  *Value*: its operator (a picker of the operators the column's filter offers, not In / Not In) and its
  value as it is typed in the header filter - *From* and *To* for Between, none for Is Blank, a checkbox
  *Checked* for a checkbox column. *Conditions*: a line for each - its field (a picker of the columns and
  the calculated columns, with a search), its operator and value as for that field, a ✕ - *Add
  condition* under them, and over two or more *All of them* / *Any of them*. *Formula*: a formula that
  is true or false, with the `{ }` button, and under it whether it is true in the row of the preview.
  Then *Text colour* and *Background*, a row of square swatches each (*None* and the palette; one stop
  of Tab, the arrows pick, each named by its colour for a screen reader and in its tooltip) with the
  colour picker of a custom colour after them (a `+` until one is picked), and *Bold*. *Add rule* under
  the rules (red text on a red background, the column's header filter operator; the focus goes to its
  operator). A rule without its value, without a condition, with a condition on a field the grid does
  not know, with a formula that has a problem or is not true / false, or with nothing to colour, is a
  problem; a value the column does not read (a date of another format) and a custom text colour under
  4.5:1 are said, they hold nothing back.
- **Data bars, scales, icons**, a number column not shown as checkboxes: *Data bar*, *Colour scale* and
  *Icons*, a checkbox each - on, its settings in a box under it: the colour swatches (of the palette's
  backgrounds, a custom colour), *Min*, *Midpoint* and *Max* (empty: *Automatic*, from the rows), the
  *Icon set* (radio buttons that show its icons), *Middle from* and *High from*, *Thresholds* in *% of
  the range* or *Values*, where the *Icon* goes and *Reverse*. Under them five cells from the lowest
  value of the rows to the highest, drawn as the column will be. See [Data bars](#data-bars) and
  [Bars, scales, icons and the colour rules](#bars-scales-icons-and-the-colour-rules).
- **The preview** shows what the cell shows in the current row (else the first row shown), in the
  colours of the rule its value matches - with its bar, scale colour and icon: the text, the link - a click opens it in a new tab - and its
  address, and why the row has no link (a field that is empty in it, an address that is not allowed, a
  field that does not exist). A checkbox and a lookup column have one when they have rules.
- **A problem of a template** is shown under it at once: no address, one that does not start with its
  scheme, `javascript:` and the other schemes that are not allowed, a field of the grid's own - and so
  is a problem of the checkbox values, of a colour rule and of the numbers of a bar, a scale or the icons. The column is marked *Error*, and Apply
  does nothing until it is fixed.
- **Apply** sets the formats of the state, `setState({ formats })`: `getState()` has them - to save
  them, see [Saving it](03-state.md#saving-it). A filter operator that changed is switched as Operator ›
  does it: the header filter's value is filtered on again with it, the state has it
  (`headerFilters[field].operator`) and the grid sends `filter-operator-change`. A header filter whose
  column reads its text in another way now (another format filtered as shown, *Filter as shown* turned
  on or off) runs again, as the cell shows it. *Filter as you type* is state too
  (`headerFilters[field].filterOnType`). *Apply & close* applies and closes, *Cancel* (and the ✕, Esc)
  closes without applying. *Reset column* and *Reset all* go back to the formats the grid starts with -
  `ColumnConfig.format`, or `initialState.formats` - and to the column's default operator and filter as
  you type, in the dialog, until Apply.

It is a modal dialog of the filter editor's kind: the focus goes into it when it opens and back to
where it was when it closes, it is moved by its title bar and resized from every edge and corner. The
texts are `columnSettings.*`, see [Texts](12-texts.md#grid-config-dialog).

A developer sets the formats the grid starts with in `ColumnConfig.format`; what the user sets in the
dialog is the state. To keep the user's settings, save `getState()` (or its `formats`) and give it back
with `setState()` the next time.

## Label, placeholder, blank / 0, checkboxes, multiline, read only

The rest of what the grid config dialog sets is in the column's format too - so the state keeps it
with the formats, and a developer can start a column with it in `ColumnConfig.format`:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // the header, and wherever the grid names the column: Firm
        company: { label: 'Company', format: { label: 'Firm', placeholderRowLabel: true } },
        // the placeholder of an empty cell
        city: { format: { placeholderRow: 'Name of the city' } },
        // a number column: a blank cell shows 0
        discount: { format: { numberOverride: 'BLANK_TO_ZERO' } },
        // '1' / '0' (text) or 1 / 0 (a number field) as checkboxes
        newsletter: { format: { checkbox: { checked: '1', unchecked: '0' } } }
    },
    layout: {
        center: [
            { fields: ['company'], width: 150 },
            { fields: ['city'], width: 120 },
            { fields: ['discount'], width: 80 },
            { fields: ['newsletter'], width: 90 }
        ]
    }
};
```

| part | for | wins over |
| --- | --- | --- |
| `label` | any column: the label wherever the grid names the column - the header, the menus, the column chooser, the filter editor, the footer's filter, copy with headers, the headers of the CSV and Excel exports | `ColumnConfig.label` |
| `placeholderRow` | any column but a `boolean` one: the placeholder of its empty cells | `ColumnConfig.placeholderRow` |
| `placeholderRowLabel` | `true`: the placeholder of the empty cells is the column's label - not with `placeholderRow` | the same |
| `numberOverride` | a `number` column: `'BLANK_TO_ZERO'`, `'ZERO_TO_BLANK'`, or `'NONE'` - neither | `ColumnConfig.numberOverride`: `'NONE'` turns it off |
| `checkbox` | a `text` or `number` column: its cells are checkboxes, see below | |
| `multiline` | a `text` column: `true` text of several lines, `false` one line (a value with a line break is shown as several lines still) - not with `checkbox` | the field's `multiline` (`FieldConfig`) |
| `readonly` | any column: `true` its cells are not edited, also in an editable grid; `false` they are | `ColumnConfig.readonly` - the `isReadonly` hook gets this and has the last word |

Each is checked as the rest of a format: an empty label or placeholder, a placeholder of a checkbox
column, `numberOverride` on another type, checkboxes on a date column throw a `TypeError` when the grid
is made, or `updateConfig()` or `setState()` is given it. A lookup column (`editor`) takes a label,
a placeholder and `readonly`, not the rest.

### Checkboxes

`checkbox: { checked?, unchecked? }` makes each cell of a text or number column a checkbox: for a flag
a database keeps as `1` / `0`, `'Y'` / `'N'`.

- A cell is **checked** when its value is the checked value (`'1'` left out): its text trimmed, `' 1 '`
  too, or a number equal to it - `1` in a number field. Anything else is unchecked, a blank too.
- A click, or Space, on an editable cell **writes the other value**: the checked value, or the unchecked
  one (`'0'` left out) - a number in a number field (`1`, `0`), else the text. An unchecked value `''`
  empties the cell (null), as Delete does. Shift+click and Ctrl+click make ranges, as on a boolean
  cell; a readonly grid or cell and `allowPasteClearOnly` write nothing. Undo takes it back.
- **The value stays the value**: copy, paste, the CSV and Excel exports, sorting, grouping, the header
  filter (typed: `1`) and the filter menu's value list have `1` and `0`. Find does not look in a
  checkbox, `fitColumns()` gives it a checkbox's room.
- A checkbox shows no text: not with `text`, `link`, `number` or `numberOverride` (a `TypeError`), and a
  number column with checkboxes has no Format ›. A renderer of your own (`renderer`) wins, and a cell of
  another type in a `dynamicCellTypeColumn` is shown as its type.
- The checked value is not `''`, the two are not the same, and a number field takes numbers - `'1'`,
  `'-1'`, `''` for the unchecked one: else a `TypeError`.

## Colour rules

A column's colour rules colour a cell from its row - its text, its background, bold: a negative
balance in red, the orders that wait on an orange background, the name of a customer who is late and
owes. No code: a rule is a condition and a style from a palette (or a custom colour). The condition is
one of three kinds:

- **Value** (`operator`, `value`): the cell's own value, as the column's header filter tests it - below.
- **Conditions** (`conditions`, `combine`): conditions on fields of the row - the column's own, others, a
  [calculated column](23-calculated-columns.md) - each tested as the header filter of its field tests
  it; all of them (`combine: 'AND'`, the default) or any (`'OR'`).
- **Formula** (`expression`): a [formula](23-calculated-columns.md#the-formulas) that is true or false -
  `{balance} < 0 AND {status} = "late"`, `DAYS({due}, TODAY()) > 7`. True colours the cell; a row where
  it can not be computed is not coloured.

The user makes them in the [grid config dialog](#the-grid-config-dialog) (*Colour rules*), a developer
starts a column with them in `ColumnConfig.format`:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // red text below 0
        balance: { format: { rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }] } },
        // the first rule that matches wins
        status: {
            format: {
                rules: [
                    { operator: 'EQUAL', value: 'waiting', background: 'orange' },
                    { operator: 'CONTAINS', value: 'late', color: 'red', bold: true }
                ]
            }
        },
        // both ends included, an end '' is open
        due: { format: { rules: [{ operator: 'BETWEEN', value: ['2026-11-01', '2026-11-30'], background: 'yellow' }] } },
        // empty - or 0, as in the filter
        notes: { format: { rules: [{ operator: 'IS_BLANK', background: 'grey' }] } },
        // conditions on other fields: late AND owing; a formula with a custom colour
        name: {
            format: {
                rules: [
                    {
                        conditions: [
                            { field: 'status', operator: 'EQUAL', value: 'late' },
                            { field: 'balance', operator: 'GREATER_THAN', value: '0' }
                        ],
                        background: 'red',
                        bold: true
                    },
                    { expression: 'DAYS({due}, TODAY()) > 30', background: '#c4b5fd' }
                ]
            }
        }
    },
    layout: {
        center: [
            { fields: ['balance'], width: 100 },
            { fields: ['status'], width: 100 },
            { fields: ['due'], width: 100 },
            { fields: ['notes'], width: 150 },
            { fields: ['name'], width: 150 }
        ]
    }
};
```

| part of a rule | |
| --- | --- |
| `operator` | how the value is compared: an operator of the column's type - `EQUAL`, `NOT_EQUAL_TO`, `CONTAINS`, `BEGIN_WITH`, `LESS_THAN`, `GREATER_THAN_OR_EQUAL_TO`, `BETWEEN`, `IS_BLANK`, `IS_NOT_BLANK` ... ([Operators](06-filtering.md#operators)). Not `IN` / `NOT_IN`: a rule compares one value, give each value a rule |
| `value` | what it is compared with, text as it is typed in the header filter: `'100'`, `'late'`, `'2026-11-22'`, `'true'` / `'false'` for a checkbox column. `[from, to]` for `BETWEEN`. Left out for `IS_BLANK` / `IS_NOT_BLANK` |
| `datePreset` | a date column: a quick date in place of `value` - `'today'`, `'thisWeek'`, `'lastWeek'`, `'thisMonth'`, `'lastMonth'`, `'thisQuarter'`, `'lastQuarter'`, `'thisYear'`, `'lastYear'`, `'last7Days'`, `'last30Days'`, `'next7Days'`, `'overdue'` - its days today. Not with `BETWEEN` |
| `week` | a date column: `'iso'` (Monday, ISO 8601 numbers) or `'us'` (Sunday, week 1 has January 1) - the weeks of a `value` like `'2026-W47'` and of a quick date's week. Left out: the column's `weekIso` / `weekUs` format, else the date picker's `weekStart` |
| `conditions` | the kind *Conditions*, in place of `operator`: 1 to 20 of `{ field, operator, value? }` - a field of the grid, an operator of its type, a value as typed in its header filter |
| `combine` | with `conditions`: `'AND'` (the default) all of them, `'OR'` one of them |
| `expression` | the kind *Formula*, in place of `operator`: a formula that is true or false |
| `color` | the text colour: `'red'`, `'orange'`, `'amber'`, `'yellow'`, `'lime'`, `'green'`, `'teal'`, `'cyan'`, `'blue'`, `'indigo'`, `'purple'`, `'pink'`, `'brown'`, `'grey'` - or a custom colour, `'#rrggbb'` |
| `background` | the background, a colour of the same palette or `'#rrggbb'` |
| `bold` | `true`: bold text |

- **The condition is the header filter's.** The value is read as the column's header filter reads what
  is typed in it: a text as it is - `*`, `%` and `_` are wildcards, case is ignored unless the column
  has `filterCaseSensitive` - a number or a date with the field's formatter (`1,5` with a decimal comma,
  `2026-11-22`, the day of a date), a Between's two ends each. Then the datasource's own filter tests
  it: `≥ 100` or *Contains* `late` keeps the cells the header filter would keep, and 0 is blank as there
  ([0 is blank](06-filtering.md#0-is-blank)) - a blank number is 0, `< 1` colours it.
- **A date takes a period, as the header filter of a column shown as weeks or months does** - and a
  quick date, as its filter menu offers them:

  ```ts
  import type { ColorRule } from '@simple-html/grid';

  const rules: ColorRule[] = [
      // a due date this week: Sunday to Saturday
      { operator: 'EQUAL', datePreset: 'thisWeek', week: 'us', background: 'green' },
      // before this week's Monday
      { operator: 'LESS_THAN', datePreset: 'thisWeek', week: 'iso', color: 'red', bold: true },
      // ISO week 47 of 2026, Monday 16 to Sunday 22 November
      { operator: 'EQUAL', value: '2026-W47', week: 'iso', background: 'yellow' },
      // November, the fourth quarter, from week 40 to the end of November
      { operator: 'EQUAL', value: '2026-11', background: 'blue' },
      { operator: 'EQUAL', value: '2026 Q4', background: 'teal' },
      { operator: 'BETWEEN', value: ['2026-W40', '2026-11'], background: 'purple' }
  ];
  ```

  | operator | on a period (a week, a month, a quick date ...) |
  | --- | --- |
  | `EQUAL` | in it |
  | `NOT_EQUAL_TO` | not in it, or blank |
  | `LESS_THAN` / `LESS_THAN_OR_EQUAL_TO` | before its first day / to its last |
  | `GREATER_THAN` / `GREATER_THAN_OR_EQUAL_TO` | after its last day / from its first |
  | `BETWEEN` | from the first day of the one to the last of the other (typed values; an end may be a day) |

  A week, a month (`2026-11`), a quarter (`2026 Q4`) and a year (`2026`) are read whatever the column
  shows; a week and a quarter also as the grid's texts write them (`format.weekIso`, `format.quarter`:
  `uke 47 2026` in Norwegian) - `2026-W47` is read in every language, a saved rule means the same. A day
  is a day, as before. On a `datetime` a period ends at 23:59:59 of its last day. **ISO or US weeks**:
  `week: 'iso'` - Monday to Sunday, week 1 has the year's first Thursday; `'us'` - Sunday to Saturday,
  week 1 has January 1 (Excel's `WEEKNUM`). A rule without `week` takes the column's week format
  (`weekIso`, `weekUs`), else the date picker's first day (`datePickerConfig.weekStart`: Sunday is US).
  **A quick date is today's**: the cells are rendered with today's days; the grid renders them again on
  a new day when the window gets the focus back, or the page is shown again
  (`refreshDatePresets()`). In the dialog: *Compare with* - *A date or period typed* or a quick date
  (picked after a typed value it is Equal, in it) - and *Weeks*: as the column, *ISO - Monday*,
  *US - Sunday*. A condition on a date field (*Conditions*) takes both too.
- **A lookup column** (`editor`) compares the label its cells show, with a text's operators - as its
  header filter does; a value no row of the lookup has matches no rule that compares. Is Blank / Is Not
  Blank look at the value.
- **The first rule that matches wins**: the order of the list, *Move up* / *Move down* in the dialog. A
  cell no rule matches has the grid's colours.
- **A value the column does not read** - a date of another format, `22.11.2026` in a `YYYY-MM-DD`
  column - matches no cell (the header filter filters nothing with it); the dialog says so.
- **A condition on another field** (*Conditions*) is that field's header filter's: its type, its
  formatter, a lookup column's label, its Match case. A calculated column is a field like the others.
- **The palette is the theme's**: 14 colours, each a text colour and a background, css variables with a
  light and a dark colour, in both themes - readable: a text colour has 4.5:1 to the rows, the selected
  rows and every background of the palette, the grid's text 4.5:1 to the backgrounds. A theme changes
  the palette, see [Theming, colour rules](13-theming.md#colour-rules).
- **A custom colour** is `#` and six hex digits - nothing else (`'red;'`, `'url(...)'`, `'#fff'` throw a
  `TypeError`). It is one colour in light and in dark, so the grid keeps it readable: a custom
  background without a text colour gets black or white text, whichever reads better on it; a custom
  text colour is the colour picked in light and lighter in dark, until it has 4.5:1 to the rows. The
  dialog warns when a custom text colour has less than 4.5:1 to the light rows or to its background.
  It reaches the page as a css custom property, never as css text.
- **Where**: every cell of the column - an input, a multiline cell, a link (the rule's text colour in
  place of the link's, still underlined), a template, a custom cell (its text takes the colour; a
  renderer that sets a colour of its own keeps it), a checkbox (its background). The values of the
  [detail form](02-grid-config.md#the-detail-form) and the dialog's preview have them too. The Excel
  export writes them as the cells' own colours ([Excel, colours](15-export.md#colours)); not the CSV -
  text has no colours - nor a group row or the totals row.
- **What wins over a rule**: a cell with a validation error and a match of Find show as without it -
  their tint and the grid's text - so they stand out; a range's tint is laid over the rule's
  background. A selected row keeps its colour in the other cells; the rule's background is the cell's,
  over it. The focus outline, the marker of an edited cell and of more lines are on top. Bold stays.
- **Checked** as the rest of a format: no kind of condition or two, an operator the type does not
  have, `IN` / `NOT_IN`, a rule without the value its operator needs, a `datePreset` or `week` on a
  column that is no date, a `datePreset` with a value or with `BETWEEN`, a condition on a field the grid
  does not know, a formula with a problem or that is not true / false, one that colours nothing, a
  colour that is neither of the palette nor `#rrggbb` throw a `TypeError` when the grid is made, or
  `updateConfig()` or `setState()` is given it.
- **It is state** with the rest of the column's format: Apply in the dialog, `getState()`, a state
  saved as JSON (the value is text, a date too), Reset column / Reset all to the config's.

## Data bars

A number column can draw a bar in each cell, as long as the value's place among the column's numbers -
a spreadsheet's data bar. The number stays where it is, over a light tint of the bar's colour (a dark one
in dark mode), so it reads as without the bar.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // from the smallest number of the rows to the largest, and 0: a bar starts at 0
        sales: { format: { bar: { color: 'green' } } },
        // a fixed range: 50 is half a cell, a value over 100 a whole one
        progress: { format: { bar: { color: '#0f766e', min: 0, max: 100 } } }
    },
    layout: {
        center: [
            { fields: ['sales'], width: 100 },
            { fields: ['progress'], width: 100 }
        ]
    }
};
```

| part of `bar` | |
| --- | --- |
| `color` | a colour of the [palette](#colour-rules) - its background - or a custom colour `'#rrggbb'`, drawn as a tint of it. Left out: `'blue'` |
| `min` | the value of the bar's low end. Left out: the smallest value of the rows, or 0 when that is above 0 |
| `max` | the value of a whole bar. Left out: the largest value of the rows, or 0 when that is below 0 |

- **The range** is the rows the filter lets through - grouped, every one of them, the rows of collapsed
  groups too, as the [totals row](18-aggregates.md) counts them. A filter changes it, so does an edit
  of the largest value: every cell on screen is drawn again. The datasource keeps the smallest and the
  largest value (`datasource.aggregate(field, 'min')`) until a value of the field changes or other rows
  are filtered: 100 000 rows are read once, not for every cell.
- **0 is in the range** when it is left out: a bar starts at 0. With negative values the axis is where 0
  is, a negative value's bar goes to the left of it, a positive one's to the right. A fixed range without
  0 (`min: 900`) starts at its low end. A value out of a fixed range is drawn as its end.
- **No bar** for a cell without a number, a group row and the totals row.
- **A calculated column** of numbers can have one too ([Calculated columns](23-calculated-columns.md)).
- **Square**, as everything of the grid: no rounded corners.

## Colour scales

A colour scale gives the cell's background a colour by the value's place from the smallest number to the
largest: two colours mixed (`minColor`, `maxColor`), or three with a midpoint (`midColor`) - red, yellow,
green as a spreadsheet's heat map.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // red for the smallest number of the rows, yellow halfway, green for the largest
        margin: { format: { scale: { minColor: 'red', midColor: 'yellow', maxColor: 'green' } } },
        // a fixed range and the midpoint at 80
        load: { format: { scale: { minColor: 'grey', midColor: 'amber', maxColor: 'red', min: 0, mid: 80, max: 100 } } }
    },
    layout: {
        center: [
            { fields: ['margin'], width: 100 },
            { fields: ['load'], width: 100 }
        ]
    }
};
```

| part of `scale` | |
| --- | --- |
| `minColor` | the colour of the smallest value: a colour of the palette - its background - or `'#rrggbb'` |
| `midColor` | the colour of the midpoint: three colours. Left out: two |
| `maxColor` | the colour of the largest value |
| `min`, `max` | the values of `minColor` and `maxColor`. Left out: the smallest and the largest value of the rows the filter lets through |
| `mid` | with `midColor`, the value of the midpoint. Left out: halfway between `min` and `max` |

- **The colours are the palette's backgrounds**, mixed in the cell (`color-mix()`): light tints in light
  mode, dark ones in dark mode, in both themes. The grid's text reads on every one of them and on their
  mixes - the theme tests compute it. **A custom colour** is a tint of it: a fifth of the colour and the
  rest white in light mode, black in dark mode - whatever colour is picked, the text reads on it.
- **The range** is the one of the [data bars](#data-bars) - the rows the filter lets through, kept by the
  datasource - without 0 in it. A range of one value has the middle: the midpoint's colour, or halfway.

## Icon sets

An icon before the value (or after it) by two thresholds: from the second the high icon, from the first
the middle one, under it the low one - in percent of the range from the smallest number of the rows to the
largest, or as numbers.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // ▲ from 67 % of the range, ► from 33 %, ▼ under
        growth: { format: { icons: { set: 'arrows' } } },
        // a green light from 50 in stock, amber from 10, red under - after the number
        stock: { format: { icons: { set: 'traffic', thresholds: [10, 50], unit: 'number', position: 'after' } } },
        // the other way round: a high cost has the red cross
        cost: { format: { icons: { set: 'symbols', reverse: true } } }
    },
    layout: {
        center: [
            { fields: ['growth'], width: 100 },
            { fields: ['stock'], width: 100 },
            { fields: ['cost'], width: 100 }
        ]
    }
};
```

| set | high | middle | low |
| --- | --- | --- | --- |
| `'arrows'` | ▲ green | ► amber | ▼ red |
| `'traffic'` | ● green | ● amber | ● red |
| `'flags'` | ⚑ green | ⚑ amber | ⚑ red |
| `'symbols'` | ✓ green | ! amber | ✕ red |

| part of `icons` | |
| --- | --- |
| `set` | the icons, above |
| `thresholds` | `[middle, high]`: from the first the middle icon, from the second the high one (`>=`, as a spreadsheet's). Left out: `[33, 67]`, the thirds |
| `unit` | `'percent'` (the default): the thresholds are percent of the range, 0 to 100. `'number'`: values of the column |
| `reverse` | `true`: the icons the other way round - the high values have the low icon, for a column where lower is better |
| `position` | `'before'` (the default): at the left of the cell; `'after'`: at its right. The number moves clear of it |

- **Svg icons** in the theme's icon colours, `--simple-html-grid-icon-green-color`, `-amber-` and `-red-`:
  3:1 or more to the rows, the selected rows and the palette's backgrounds, light and dark, in both themes
  ([Theming](13-theming.md#data-bars-colour-scales-and-icons)). The shapes differ too - but the traffic
  lights and the flags, said in words for a screen reader.
- **For a screen reader** the cell says the level after its value: *High*, *Middle* or *Low* (the texts
  `cell.icon.*`), the description of its input.
- **The range** is the one of the [data bars](#data-bars), without 0.
- **Not in a custom cell** (`ColumnConfig.renderer`): the renderer draws the cell. A bar and a scale are
  the cell's background, a custom cell has them.

## Bars, scales, icons and the colour rules

A column can have colour rules, a data bar, a colour scale and an icon set together. What wins:

- **A rule's background wins over the scale**: a cell whose rule has a background has the rule's - the
  rule is the exception the user asked for. A rule's text colour and bold show over the scale.
- **The bar is drawn over a rule's background** and the scale's colour, under a range's tint: both are
  seen. The grid's text and the palette's text colours read on all of them.
- **The icons show with any rule.**
- **An error and a match of Find** show as without a bar and a scale - as without a rule's colours - so
  they stand out. The icons stay.
- **The detail form** shows a value in its rule's colours, without a bar, a scale or an icon.

In the grid config dialog a number column has *Data bars, scales, icons* under its colour rules: a
checkbox each, the colour swatches, Min / Max (empty: *Automatic*), the icon set, the thresholds and what
they are, Reverse and where the icon goes - and five cells from the lowest value of the rows to the
highest, drawn as the column will be. A number typed that is no number, a min not below the max, a
midpoint out of them or thresholds the wrong way round are said at once: Apply waits.

They are **state** with the rest of the column's format (`getState().formats`), and **checked** as it is -
a `TypeError` when the grid is made, or `updateConfig()` or `setState()` is given one that does not fit: a
column that is not a number column (a lookup column neither), a part with `checkbox`, a key it does not
know, a colour that is neither of the palette nor `#rrggbb`, a number that is not finite, a min not below
the max, a `mid` without `midColor` or out of the range, thresholds that are not two numbers - the first
above the second, out of 0 to 100 in percent - and a `set`, `unit` or `position` it does not have.

The [Excel export](15-export.md#colours) writes them as Excel's own conditional formatting.

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
[Grid config](02-grid-config.md#column-options). The user sets it in the grid config dialog (*Show
blank as 0*, *Show 0 as blank*): `format.numberOverride` in the state, which wins over the column's -
`'NONE'` turns it off, see [Label, placeholder, blank / 0, checkboxes, multiline, read only](#label-placeholder-blank--0-checkboxes-multiline-read-only).
With a display format the 0 is the format's: `'BLANK_TO_ZERO'` with two decimals shows `0,00`, and
`'ZERO_TO_BLANK'` empties what shows as `0,00`.
