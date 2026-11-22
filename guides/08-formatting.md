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
[Display formats](#display-formats). A text column can show a template of the row's fields,
`{firstname} {lastname}`, and be a link, `https://crm.example.com/customer/{id}` or `mailto:{email}`:
see [Templates and links](#templates-and-links). The user sets all of them in the
[grid config dialog](#the-grid-config-dialog), the gear in the footer.

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

## Templates and links

A text column has two more parts in its format: `text`, a template of what its cells show, and
`link`, which makes its cells links. Both are templates: text with `{field}` placeholders, each filled
in with the value of a field of the row.

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    columns: {
        // Ann Lee: the text of two fields
        firstname: { format: { text: '{firstname} {lastname}' } },
        // 12 kg: the cell's own value, {value}, and text - weight is a text field: a number field has none
        weight: { format: { text: '{value} kg' } },
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
            { fields: ['weight'], width: 80 },
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
- **`{value}`** is the cell's own value: a template that fits any column. A field named `value` can not
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

The Columns tab:

- **The columns** of the layout are at the left, in their order, each with its label, its type and
  what it has set - *Format*, *Text*, *Link*, *Checkbox*, *Blank / 0*, *Label*, *Placeholder*,
  *Multiline*, *Read only*, or *Error*. The arrows, Home, End, PageUp / PageDown and a letter pick one, a
  click too.
- **Label**, every column: the column's label - empty is the column's own, which the input shows. The ✎ of
  the column chooser sets it too ([The column chooser](10-menus.md#the-column-chooser)). It
  is the label wherever the grid names the column, the exports' headers too.
- **A date, datetime or number column** has its format: a picker that opens the entries of Format ›,
  the same list as the header menu. A number column has *Show blank as 0* and *Show 0 as blank* too,
  one or the other: they start as the column shows them, its `numberOverride` too, and turning the
  column's own off is kept as `'NONE'`.
- **A text column** has *Text shown* (the template, empty for the cell's own text), *Show as link*,
  *Address* and *Open in a new tab*. The `{ }` button beside a template opens a menu of the fields -
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
- **Filter placeholder**, for every column but a checkbox: the placeholder of the column's header
  filter - empty is the one it has without, which the input shows - or *Use the column label*: the
  label is the placeholder, the input is off.
- **Filter operator**, for every column but a checkbox: the operator of the column's header filter, a
  picker of the operators it offers - the same as Filter › Operator › - with *Default:* and the operator
  the column starts with under it (its `operator`, else the type's: `≥` for a number or date, `=` for a
  text). A column with one operator (`filterOperators`) shows it, there is nothing to pick.
- **The preview** shows what the cell shows in the current row (else the first row shown): the text,
  the link - a click opens it in a new tab - and its address, and why the row has no link (a field
  that is empty in it, an address that is not allowed, a field that does not exist).
- **A problem of a template** is shown under it at once: no address, one that does not start with its
  scheme, `javascript:` and the other schemes that are not allowed, a field of the grid's own - and so
  is a problem of the checkbox values. The column is marked *Error*, and Apply does nothing until it is
  fixed.
- **Apply** sets the formats of the state, `setState({ formats })`: `getState()` has them - to save
  them, see [Saving it](03-state.md#saving-it). A filter operator that changed is switched as Operator ›
  does it: the header filter's value is filtered on again with it, the state has it
  (`headerFilters[field].operator`) and the grid sends `filter-operator-change`. *Apply & close* applies
  and closes, *Cancel* (and the ✕, Esc) closes without applying. *Reset column* and *Reset all* go back
  to the formats the grid starts with - `ColumnConfig.format`, or `initialState.formats` - and to the
  column's default operator, in the dialog, until Apply.

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
        company: { label: 'Company', format: { label: 'Firm', placeholderLabel: true } },
        // the header filter's placeholder
        city: { format: { placeholder: 'Search the cities' } },
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
| `placeholder` | any column but a `boolean` one: the placeholder of its empty header filter | `ColumnConfig.placeholderFilter`, and a BETWEEN's `from..to` |
| `placeholderLabel` | `true`: the placeholder is the column's label - not with `placeholder` | the same |
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
