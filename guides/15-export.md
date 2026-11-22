# Export

The grid exports its rows as an Excel file (.xlsx) and as CSV. By default it is what the user sees:
the rows the filter lets through, in the sort order, the columns of the layout in their order, with
a header of the column labels.

- **Excel**: `getExcel()` gives the file as a `Blob`, `downloadExcel()` saves it. The cells are
  typed - numbers, dates, booleans, text - so Excel can sum, sort and filter them. The row menu
  exports Excel.
- **CSV**: `getCsv()` gives the text, `downloadCsv()` saves it. Each value as the cell shows it. In
  the API only, not in the row menu.

## Excel

Every Excel file the grid writes follows two rules, there are no options to change them:

- **The header row is frozen, with an autofilter.** Row 1 has the column labels, bold, and stays
  in place while the rows scroll. The autofilter covers the header and every row (`A1` to the last
  column and the last row), so each column has Excel's filter and sort button.
- **The file is a flat list.** One header row, then one plain row per data row - also when the grid
  is grouped. No group rows or group headers, no Excel outline or row grouping, no subtotal rows,
  no totals row. Grouped, every data row is in the file - the rows of collapsed groups too - in the
  grouped order.

### `getExcel()` and `downloadExcel()`

```ts
// a file: the browser downloads export.xlsx
document.getElementById('export')!.onclick = () => gridInterface.downloadExcel();

// the selected rows, as selected.xlsx, on a sheet named Orders
await gridInterface.downloadExcel('selected.xlsx', { rows: 'selected', sheetName: 'Orders' });

// the file, for code of your own: upload it, attach it to a mail ...
const blob = await gridInterface.getExcel();
await fetch('/api/reports', { method: 'POST', body: blob });
```

- `getExcel(options?)` returns a promise of the `Blob`, of the type
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
- `downloadExcel(filename?, options?)` saves it: the `Blob` downloaded by the click of an
  `<a download>` link, as `downloadCsv()` does. The filename defaults to `export.xlsx`; give it the
  `.xlsx` ending yourself, it is not added. The promise is fulfilled when the download has started.
- Both are async: the file is a ZIP, compressed with the browser's `CompressionStream`. The rows and
  their values are read when they are called, before the promise is returned: an edit while the
  file is being made is not in it.
- Both work without the grid on the page: they read the config and the datasource.
- A bad option is a rejected promise, see [the options](#the-excel-options).

```sample export
```

### From the row menu

The row menu (right click a cell) has an **Export ›** submenu with *Excel, all rows* and *Excel,
selected rows* (greyed out when no row is selected): `downloadExcel()` with the default options, as
`export.xlsx`. It is there in every grid, readonly ones too. The ids are `row.export` (the submenu),
`row.export.excel` and `row.export.excelSelected`. To give them other options - a sheet name, a
file name - replace their actions in the submenu with the [menus hook](10-menus.md):

```ts
import type { GridHooks, MenuEntry } from '@simple-html/grid';

const hooks: GridHooks = {
    menus: {
        row: (defaults, context) =>
            defaults.map((entry): MenuEntry => {
                if (entry.type !== 'submenu' || entry.id !== 'row.export') {
                    return entry;
                }
                const entries = entry.entries.map((inner) =>
                    inner.id === 'row.export.excel'
                        ? { ...inner, action: () => context.gridInterface.downloadExcel('orders.xlsx', { sheetName: 'Orders' }) }
                        : inner
                );
                return { ...entry, entries };
            })
    }
};
gridInterface.updateHooks(hooks);
```

CSV is not in the row menu. To have it there, add an entry of your own to the export submenu, after
the Excel ones:

```ts
import type { GridHooks, MenuEntry } from '@simple-html/grid';

const hooks: GridHooks = {
    menus: {
        row: (defaults, context) => {
            const csv: MenuEntry = {
                id: 'my.export.csv',
                label: 'CSV, all rows',
                action: () => context.gridInterface.downloadCsv('export.csv', { separator: ';' })
            };
            return defaults.map((entry) =>
                entry.type === 'submenu' && entry.id === 'row.export' ? { ...entry, entries: [...entry.entries, csv] } : entry
            );
        }
    }
};
gridInterface.updateHooks(hooks);
```

### Typed cells

The cells hold the values themselves, not the texts the grid shows, so a number is a number in
Excel: it sums, sorts as a number, and is shown with the decimal separator of the user's locale. The
type of the cell is the field's type (see [the datasource](04-datasource.md)), or the row's with
`dynamicCellTypeColumn`:

| field type | value | Excel cell |
| --- | --- | --- |
| `number` | a number | a number, General format: every digit, as the grid's number formatters show them. `numberComma`'s `12,5` is the number 12.5 |
| `date` | a `Date` | a date: the local day, formatted `yyyy-mm-dd` |
| `datetime` | a `Date` | a date and time, to the second, `yyyy-mm-dd hh:mm:ss` |
| `boolean` | `true` / `false` | TRUE / FALSE |
| `text` | text | text; a text with line breaks gets wrapped lines |
| any | `null`, `undefined`, `''`, an invalid `Date` | an empty cell |
| any | a value of another type | text: what the cell shows |

- **A value of another type is text**: the text `'12'` in a number field, a number in a text field, a
  date string in a date field. Excel then marks a number stored as text. Give the fields their type
  (`fields: { amount: 'number' }`) and keep the values of that type to get numbers and dates.
- With `dateDDMMYYYY` or `datetimeDDMMYYYY` as the formatter the dates are `dd.mm.yyyy`, as the grid
  shows them; with any other formatter, your own too, they are `yyyy-mm-dd`. A datetime has a space
  before the time where the grid's formatter has a `T`.
- A column's `numberOverride` is followed, as in the cells: `BLANK_TO_ZERO` writes 0 for a blank,
  `ZERO_TO_BLANK` an empty cell for 0.
- A column's display format (`ColumnConfig.format`, the header menu's Format ›, see
  [Display formats](08-formatting.md#display-formats)) gives its cells an Excel number format like
  it - the value stays the value, a date a date and a number a number. See the table below.
- A number has at most 15 significant digits in Excel: a longer id is better kept as text.
- A text longer than 32 767 characters, what an Excel cell holds, is cut there. Control characters
  (U+0000 to U+001F but tab, CR and LF), which XML can not hold, are left out.
- `formatted` and `escapeFormulas`, the CSV options, have no place here: the values are typed, and
  text is never a formula (see [No formulas](#no-formulas)).

#### Display formats in Excel

| display format | Excel number format |
| --- | --- |
| `{ date: 'iso' }` | `yyyy-mm-dd` |
| `{ date: 'norwegian' }`, `'norwegianShort'` | `dd\.mm\.yyyy`, `dd\.mm\.yy` |
| `{ date: 'us' }`, `'uk'` | `mm\/dd\/yyyy`, `dd\/mm\/yyyy` |
| `{ date: 'isoTime' }`, `'isoSeconds'` | `yyyy-mm-dd hh:mm`, `yyyy-mm-dd hh:mm:ss` |
| `{ date: 'norwegianTime' }`, `'norwegianSeconds'` | `dd\.mm\.yyyy hh:mm`, `dd\.mm\.yyyy hh:mm:ss` |
| `{ date: 'time' }`, `'timeSeconds'` | `hh:mm`, `hh:mm:ss` |
| `{ date: 'weekday' }` | `dddd`: the day's name in Excel's language |
| `{ date: 'month' }`, `'year'` | `yyyy-mm`, `yyyy` |
| `{ date: 'medium' }`, `'long'`, `'full'`, `'weekIso'`, `'weekUs'`, `'quarter'`, `'daysUntil'` | none of Excel's: the date in the field's order, as without a format |
| `{ number: { decimals: 2 } }` | `0.00` |
| `{ number: { decimals: 2, thousands: ' ' } }` (any separator) | `#,##0.00` |
| `{ number: { decimals: 1, percent: true } }` | `0.0%` |
| `{ number: {} }`, a number format without `decimals` | General: every decimal |

The `.` and `/` of a date are escaped: unescaped, they are the decimal mark and the date separator
of the computer's language. A number's separators are Excel's: `,` and `.` in a number format are the
thousands separator and the decimal mark of the computer Excel runs on, so `#,##0.00` is
`1 234 567,89` in a Norwegian Excel and `1,234,567.89` in an English one - the characters picked in
the grid are not written.

### Dates and time zones

A `Date` is a moment in time, an Excel date is a day and a time of day without a time zone. The file
has the date and time **in the user's local time** - what the grid shows them: a date at midnight in
Norway is that day in Excel, not the day before (as `toISOString()` would make it, in UTC). The days
summer time starts and ends are days like any other.

- A `date` field is the day: its time of day, if it has one, is left out - the grid shows and
  filters a date field by the day too.
- A `datetime` field is the date and the time to the second; the milliseconds are left out, as the
  grid leaves them out.
- The workbook uses Excel's 1900 date system, the default. Excel can not hold a date before
  1900-01-01: such a date is written as the text the cell shows.

### Column widths

Each column is as wide as in the grid: a column of stacked fields gives each of its fields its
width, a field that is not in the layout (given in `fields`) gets Excel's default width. The px are
converted to Excel's width with the formulas of the standard (ECMA-376 Part 1, 18.3.1.13), for the
sheet's font, Calibri 11, whose widest digit is 7 px at 96 dpi: 100 px is 13.57 characters. On a
screen with another scale Excel scales the columns with the font.

### The sheet name

`sheetName` names the sheet, default `Sheet1`. Excel's rules apply - 1 to 31 characters, none of
`[ ] : * ? / \`, not starting or ending with `'`, not `History` - and a name that breaks one is a
`TypeError`, not quietly changed:

```ts
await gridInterface.downloadExcel('orders.xlsx', { sheetName: 'Orders 2026' });
```

### No formulas

A CSV file is read by a spreadsheet that takes text starting with `=` as a formula, which is why
`getCsv()` escapes it (see [Formulas](#formulas-csv-injection)). An .xlsx file can not have that
problem: text is written as text (an inline string), and a formula would be an element of its own,
which the grid never writes. A value a user typed, `=HYPERLINK("http://evil.example", "Click me")`,
shows in Excel as exactly that text. Nothing is escaped, nothing is added.

### The Excel options

`ExcelOptions`, every option optional. It is plain JSON: it can be stored, or come from a menu of
your own. An option the grid does not know (`header`: the header row is always there), or a value
an option does not take (`rows: 'some'`, a sheet name Excel does not take), rejects the promise
with a `TypeError`.

| option | default | |
| --- | --- | --- |
| `rows` | `'all'` | `'all'`: the rows the filter lets through, sorted. `'selected'`: the selected rows. `'range'`: the rows of the selected range of cells. See [the rows](#the-rows) |
| `fields` | the layout (`'range'`: the range's) | the fields, in order, see [the columns](#the-columns-and-their-labels) |
| `sheetName` | `'Sheet1'` | the name of the sheet |

```ts
import type { ExcelOptions } from '@simple-html/grid';

const options: ExcelOptions = { rows: 'selected', fields: ['name', 'born'], sheetName: 'People' };
await gridInterface.downloadExcel('people.xlsx', options);
```

### The file

The file is SpreadsheetML (ECMA-376, Office Open XML), what Excel writes, made by the grid itself -
no library: a ZIP of `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml`,
`xl/_rels/workbook.xml.rels`, `xl/worksheets/sheet1.xml` and `xl/styles.xml`. The ZIP is deflated
with the browser's `CompressionStream('deflate-raw')`; a browser without it (before Chrome 103,
Firefox 113, Safari 16.4) stores the parts uncompressed - the same file, about ten times larger
(10 000 rows of 8 columns: 0.44 MB deflated, 4.7 MB stored).

An Excel sheet holds 1 048 576 rows, the header row included, and 16 384 columns: more rejects the
promise with a `RangeError` - export those as CSV.

## The rows

The Excel and the CSV export take the same rows. `rows: 'all'`, the default, is every row the
filter lets through, in the sort order - what `datasource.getDataRows()` gives:

- **Filtered and sorted**: the header filters, the filter editor and a filter set from code all
  count, and so does `filterChangedOnly()`.
- **Grouped**: every data row, in the grouped order. The rows of a collapsed group are exported too,
  the group rows are not.
- **Marked for deletion**: those rows are still rows of the grid (struck through) until they are
  saved, they are exported.
- **No totals**: the totals row (`totalsRow`) and the aggregates of the group rows are not exported, a
  spreadsheet sums the rows up itself - and a line of totals would be read back as a row. See
  [Aggregates](18-aggregates.md).

`rows: 'selected'` is the selected rows, in the same order - what `datasource.getSelectedRows()`
gives. That is the selected rows that are displayed: a selected row in a collapsed group, or one the
filter leaves out, is not exported, as the row menu's actions on the selected rows leave it out.
With nothing selected the export is the header only.

`rows: 'range'` is the selected range of cells - the last of `gridInterface.getRanges()`, the one
the user made last, see [Selection and clipboard](17-selection-and-clipboard.md): its data rows top to
bottom (a group row in it is left out) and, unless `fields` is given, its fields left to right, with
their labels as the header. With no range the CSV text is empty and the Excel sheet has no columns.
Ctrl+C copies the same cells as tab separated text, without the header.

```ts
// the cells the user selected, as a file
await gridInterface.downloadExcel('range.xlsx', { rows: 'range' });
gridInterface.downloadCsv('range.csv', { rows: 'range' });
```

## The columns and their labels

By default the columns are the layout's, in the order the user sees them: pinned left, center,
pinned right, as `getLayoutFields()` gives them. A column with stacked fields gives a column in the
export for each of its fields, top to bottom. A hidden column is not in the layout, so it is not
exported.

`fields` picks the fields and their order. Any field of the rows can be given, also one the grid has
no column for:

```ts
const text = gridInterface.getCsv({ fields: ['id', 'name', 'email'] });
const file = await gridInterface.getExcel({ fields: ['id', 'name', 'email'] });
```

The header has the labels the grid's header shows: the column's `label`, else the datasource
field's `label`, else the field name prettified (`first_name` is `First Name`). The CSV export can
leave its header line out with `header: false`; an Excel file always has its header row.

## CSV

### `getCsv()` and `downloadCsv()`

```ts
// the text, for code of your own: send it to a server, put it on the clipboard ...
const text = gridInterface.getCsv(); // 'Name,Born\r\nAnn,2001-05-17\r\n...'

// a file: the browser downloads export.csv
document.getElementById('export')!.onclick = () => gridInterface.downloadCsv();

// the selected rows, as selected.csv, for Excel in Norway
gridInterface.downloadCsv('selected.csv', { rows: 'selected', separator: ';' });
```

- `getCsv(options?)` returns the text.
- `downloadCsv(filename?, options?)` saves it: a `Blob` downloaded by the click of an
  `<a download>` link, like a link the user clicks. The filename defaults to `export.csv`; give it
  the `.csv` ending yourself, it is not added.
- Both take the same options, see [the CSV options](#the-csv-options). The only difference is the
  [BOM](#csv-in-excel-the-separator-and-the-bom): `downloadCsv()` writes one by default, `getCsv()`
  does not.
- Both work without the grid on the page: they read the config and the datasource.
- They take [the rows](#the-rows) and [the columns](#the-columns-and-their-labels) as the Excel
  export does.

### Formatted or raw values

By default (`formatted: true`) each value is written as the cell shows it, the text of the field's
formatter (see [Formatting](08-formatting.md)) - not a column's display format (`2026-W47`,
`1 234 567,89`): the CSV is the values, a program or a paste reads them back:

| value | field | written |
| --- | --- | --- |
| `12.5` | `number`, `numberComma` | `12,5` |
| a `Date` | `date` | `2026-11-20`, or as its formatter writes it |
| `true` | `boolean` | `true` |
| `null` | any | nothing |

A column's `numberOverride` and `dynamicCellTypeColumn` are followed, as in the cells.

`formatted: false` writes the values as they are stored: for a file a program reads.

| value | written |
| --- | --- |
| a number | with a dot, `String(value)`: `12.5` |
| a `Date` | `toISOString()`: `2026-11-20T08:15:00.000Z` |
| a boolean | `true` / `false` |
| `null`, `undefined`, `''`, an invalid `Date` | nothing |
| text | as it is |

A raw date is UTC: a date at midnight in Norway is the day before at 23:00 (22:00 in summer) in
the file. Export formatted values to get the dates as the user sees them.

### CSV in Excel: the separator and the BOM

For Excel, export [Excel](#excel): a CSV file is text, and Excel guesses the columns and the types.
When it has to be CSV:

Excel opens a `.csv` file with the list separator of the computer's locale. In a locale with a
decimal comma - Norwegian, German, French ... - that is `;`, and a file with `,` opens with every row
in one column. For those users export with `separator: ';'`:

```ts
gridInterface.downloadCsv('export.csv', { separator: ';' });
```

With `;` a formatted `12,5` is written as it is; with `,` it is put in quotes (`"12,5"`).
`separator: '\t'` gives tab separated text.

Excel also needs a UTF-8 byte order mark (BOM, the character U+FEFF) at the start of the file to read
it as UTF-8: without one `æøå` show up garbled. `downloadCsv()` writes one by default, `bom: false`
leaves it out. `getCsv()` does not write one by default, `bom: true` adds it.

### Formulas (CSV injection)

A spreadsheet takes a cell that starts with `=`, `+`, `-` or `@` as a formula. A value a user typed
into the grid - `=HYPERLINK("http://evil.example", "Click me")` - would then run on the computer
of whoever opens the file. That is "CSV injection", see
[OWASP](https://owasp.org/www-community/attacks/CSV_Injection).

So by default (`escapeFormulas: true`) text that starts with `=`, `+`, `-`, `@`, a tab, CR or LF, or
with the full width `＝ ＋ － ＠`, gets a `'` in front: `'=HYPERLINK(...)`, which a spreadsheet shows
as text.

- Only text is escaped: a value that is text in the row (or an object), and the labels. A number, a
  boolean, a `Date` and a blank never are, whatever their formatter writes: `-5` stays `-5`.
- The value decides, not the field's type: a number field holding the text `'-5'` is written as
  `'-5`. Keep the values of a number field numbers.
- Text that only looks like a formula gets the `'` too: a phone number `+47 912 34 567` is written
  `'+47 912 34 567`, a note `- see above` is `'- see above`.
- The `'` is part of the text in the file: a program that reads it gets it too. For a file a
  program reads, not a spreadsheet, turn it off with `escapeFormulas: false`.
- OWASP notes the escaping is not reliable in Excel once the file is saved and opened again: treat a
  file of data users typed with care anyway.

The Excel export has none of this: [no formulas](#no-formulas).

### The file format

The text follows [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180):

- a line per row, after the header line; every line ends with CRLF (`\r\n`), the last one too
- a value with the separator, a double quote, CR or LF is put in double quotes, and a double quote
  in it is doubled: `say "hi"` is written `"say ""hi"""`
- spaces are part of a value: they are kept, without quotes
- a row of a single empty value is written `""`: many programs read an empty line as no value at all
- with no columns the text is empty

### The CSV options

`CsvOptions`, every option optional. It is plain JSON: it can be stored, or come from a menu of your
own. An option the grid does not know, or a value an option does not take (`rows: 'some'`,
`separator: '|'`), throws a `TypeError`.

| option | default | |
| --- | --- | --- |
| `rows` | `'all'` | `'all'`: the rows the filter lets through, sorted. `'selected'`: the selected rows. `'range'`: the rows of the selected range of cells |
| `fields` | the layout (`'range'`: the range's) | the fields, in order |
| `header` | `true` | a first line with the column labels |
| `formatted` | `true` | the values as the cells show them; `false` as they are stored |
| `separator` | `','` | `';'` for Excel in a locale with a decimal comma, `'\t'` tab separated |
| `bom` | `true` for `downloadCsv()`, `false` for `getCsv()` | a UTF-8 BOM first, for Excel |
| `escapeFormulas` | `true` | a `'` in front of text that starts with `=`, `+`, `-`, `@` ... |

```ts
import type { CsvOptions } from '@simple-html/grid';

const forExcel: CsvOptions = { separator: ';' };
const forAProgram: CsvOptions = { formatted: false, escapeFormulas: false };

gridInterface.downloadCsv('for-excel.csv', forExcel);
const text = gridInterface.getCsv(forAProgram);
```
