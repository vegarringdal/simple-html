# Export

The grid exports its rows as CSV: `getCsv()` gives the text, `downloadCsv()` saves it as a file. By
default it is what the user sees - the rows the filter lets through, in the sort order, the columns
of the layout in their order, each value as the cell shows it - with a header line of the column
labels.

## `getCsv()` and `downloadCsv()`

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
- Both take the same options, see [the options](#the-options). The only difference is the
  [BOM](#excel-the-separator-and-the-bom): `downloadCsv()` writes one by default, `getCsv()` does not.
- Both work without the grid on the page: they read the config and the datasource.

```sample export
```

## From the row menu

The row menu (right click a cell) has an **Export:** section with *CSV, all rows* and *CSV, selected
rows* (greyed out when no row is selected): `downloadCsv()` with the default options, as `export.csv`.
The ids are `row.export`, `row.export.csv` and `row.export.csvSelected`. To give them other options -
the `;` separator for Excel in Norway, say - replace their actions with the
[menus hook](10-menus.md):

```ts
import type { GridHooks } from '@simple-html/grid';

const hooks: GridHooks = {
    menus: {
        row: (defaults, context) =>
            defaults.map((entry) =>
                entry.id === 'row.export.csv'
                    ? { ...entry, action: () => context.gridInterface.downloadCsv('export.csv', { separator: ';' }) }
                    : entry
            )
    }
};
gridInterface.updateHooks(hooks);
```

## The rows

`rows: 'all'`, the default, is every row the filter lets through, in the sort order - what
`datasource.getDataRows()` gives:

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
With nothing selected the text is the header line only.

`rows: 'range'` is the selected range of cells - the last of `gridInterface.getRanges()`, the one
the user made last, see [Selection and clipboard](17-selection-and-clipboard.md): its data rows top to
bottom (a group row in it is left out) and, unless `fields` is given, its fields left to right, with
their labels as the header. With no range the text is empty. Ctrl+C copies the same cells as tab
separated text, without the header.

```ts
// the cells the user selected, as a file
gridInterface.downloadCsv('range.csv', { rows: 'range' });
```

## The columns and their labels

By default the columns are the layout's, in the order the user sees them: pinned left, center,
pinned right, as `getLayoutFields()` gives them. A column with stacked fields gives a CSV column for
each of its fields, top to bottom. A hidden column is not in the layout, so it is not exported.

`fields` picks the fields and their order. Any field of the rows can be given, also one the grid has
no column for:

```ts
const text = gridInterface.getCsv({ fields: ['id', 'name', 'email'] });
```

The header line has the labels the grid's header shows: the column's `label`, else the datasource
field's `label`, else the field name prettified (`first_name` is `First Name`). `header: false`
leaves the line out.

## Formatted or raw values

By default (`formatted: true`) each value is written as the cell shows it, the text of the field's
formatter (see [Formatting](08-formatting.md)):

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

## Excel: the separator and the BOM

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

## Formulas (CSV injection)

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

## The file format

The text follows [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180):

- a line per row, after the header line; every line ends with CRLF (`\r\n`), the last one too
- a value with the separator, a double quote, CR or LF is put in double quotes, and a double quote
  in it is doubled: `say "hi"` is written `"say ""hi"""`
- spaces are part of a value: they are kept, without quotes
- a row of a single empty value is written `""`: many programs read an empty line as no value at all
- with no columns the text is empty

## The options

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
