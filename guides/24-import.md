# Import

Rows from a CSV file, an Excel workbook (.xlsx) or a spreadsheet's clipboard become new rows of the
grid: the user picks a file - or drops it, or pastes rows - in the import dialog, sees which field each
column goes to and the problems found, and imports them. From code, `importRows()` does the same without
the dialog. The counterpart of [Export](15-export.md): what the grid exports, it imports back.

```sample import
```

## Turning it on

The import adds rows, so it is for an editable grid where the user may add them - `readonly: false` and
the [edit permission](05-editing.md#edit-permissions-add-change-delete) `add` (the default). The grid's
own menus offer it with `importMenu`:

```ts
import type { GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    readonly: false,
    importMenu: true,
    layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['born'], width: 110 }] }
};
```

- **Header menu** (right click a column label): *Import rows…* (`header.import`) opens the dialog - also
  in a grid without rows, which has no cell to right click.
- **Row menu**, Paste ›: *As new rows…* (`row.paste.newRows`) opens it with the rows on the clipboard,
  their columns from the right clicked cell's column on. The browser may ask the user to let it read the
  clipboard; when it does not give the text, the dialog asks for a paste (Ctrl+V) into it.

`importMenu` is `false` by default: many rows at once is for the app to allow. Without it, a button of
your own opens the dialog - under the same rules, it does nothing in a readonly grid or with
`edit: { add: false }`:

```ts
document.getElementById('import')!.onclick = () => gridInterface.openImport();

// with a file of your own: an <input type="file">, a drop zone
declare const file: File;
gridInterface.openImport(file);

// with text: CSV, or tab separated as a spreadsheet copies it
gridInterface.openImport('Name\tBorn\r\nAnn\t2001-05-17\r\n');
```

## The dialog

The dialog has the filter editor's look: it is moved by its title bar, resized from its edges, Esc closes
it. From the top:

- **Where the rows come from**: *Choose file…*, a file dropped on the dialog, or rows pasted into it.
- **The options**: *First row is a header* - on when the first row names a field; the separator of a CSV
  file, found from its first lines (*Found: Semicolon*) or picked; the sheet of a workbook of more
  sheets; the decimal mark when a number field is picked, the order of dates with `/` when a date field
  is (see [The values](#the-values)).
- **The columns**: the first rows of the file, with a picker over each column - a field, or *Skip*. A
  line over them says how they were matched: *by name*, from the header, or *by position*, from a field.
  A field picked for a second column is taken off the first. A cell with a problem is marked, its
  tooltip says what is wrong.
- **The rows and their problems**: how many rows, how many with problems, the first problems in words -
  *Row 3, Age: Not a number: abc*. The row is the file's: a sheet's row number as Excel shows it, a CSV
  file's record. *Rows with problems*: imported (and marked) or skipped.
- **Import N rows** adds them and closes. Cancel, the ✕ and Esc close without.

Every text comes from the [texts](12-texts.md#import-dialog), the Norwegian ones are in the Translation
sample.

## The columns

Each column of the file goes to a field, or is skipped:

- **By name**, with a header: a header cell that is the label of a column as the grid shows it, the name
  of a field or the label of a datasource field - in any case, spaces around it ignored. A column whose
  name is none of them is skipped, and so is a second column of the same field. The dialog turns the
  header on by itself when the first row names a field; then the columns can be in any order.
- **By position**, without: the columns go to the fields of the layout left to right, from the first -
  from the right clicked cell's column for *Paste › As new rows…*, as a paste puts a block of cells.

A field can be imported when a user could type into it on a new row: any field of the datasource but a
readonly column (`ColumnConfig.readonly`). The pickers list the fields of the layout, then the other
columns of the config (hidden ones). A lookup column (`ColumnConfig.editor`) takes the label its cells
show, as a paste does, and fills the fields of its `set`. The `isReadonly` hook is not asked: it decides
about the rows there are.

## The values

Each value is read as typing reads it - through the field's formatter, the label of a lookup column as
the value of its row - with what a file has that typing has not:

| field | the import reads | a problem |
| --- | --- | --- |
| text | the text as it is - `=1+1` is the text `=1+1`, never a formula | none |
| number | `1234.5`, `-5`, `3e2`, with spaces or `'` between the digits; the decimal mark of the option (default each column's own: `,` for `numberComma`), the other mark between groups of three digits: `1 234,5` and `1.234,5` with a decimal comma, `1,234.5` with a dot. The other mark once and not between groups is the decimal mark: `12,5` is 12.5 also with a dot, as typing reads it. A number cell of a workbook as it is | `12 kg`, `1.2.3`, `=1+1`, `abc` |
| date, datetime | `2026-12-31`, `31.12.2026`, `31/12/2026` (or `12/31/2026` with *Month first*), each with a time `13:45` or `13:45:12` after it - local time; ISO with `Z` or an offset is that instant. Any other form as the field's formatter reads it, when it writes the date back as the text. A date cell of a workbook as it is | `31.02.2026`, `20.11.26`, `tomorrow` |
| boolean | `true` / `false`, `1` / `0`, what the formatter writes for true and false (`yes` / `no`) - in any case. A boolean cell as it is | `maybe` |

A value that is not read is never guessed from a part of it: the field is left empty, and the problem is
listed. An empty cell is an empty field. A row with nothing in it is left out.

The validation runs on each row before it is added, with the rules of every field of the datasource (see
[Validation](05-editing.md#validation)): a required field the file does not have is a problem of every
row, *Required*.

## The rows added

- **New rows**, at the end (`datasource.addNewRows()`): `getChanges().newEntities` lists them, the save
  sends them as rows the user added. The first one is selected, the grid scrolls to it. When grouped they
  go into their groups.
- **Validated**: a rule broken shows on the cell, as after an edit. A value that was not read is in the
  row's error (`__rowError`, *Not imported: Age: Not a number: abc*): its row number shows it, with the
  exclamation mark - until `acceptChanges()`, or `setErrors()` from a save replaces it.
- **One step of the undo history**: Ctrl+Z takes the rows out again - it marks them for deletion, as
  Delete takes out a new row, so they are in none of the lists of `getChanges()` - and Ctrl+Y brings
  them back.
- With *Rows with problems: Skip them* (`invalidRows: 'skip'`) a row with a problem is not added.

## From code

**`importFile(file)`** does it in one call: it reads an Excel workbook (.xlsx) or a CSV file - the first
sheet, unless `sheet` names another - and adds its rows, the first row that is not empty the header.

```ts
declare const file: File;

const result = await gridInterface.importFile(file); // the first sheet, a header row
await gridInterface.importFile(file, { sheet: 'Customers', invalidRows: 'skip' }); // another sheet
```

It takes `sheet` and `separator` of `readImportFile()` and the options of `importRows()` below, `header`
`true` by default. The rows are new rows, one step of the undo history, as the dialog adds them.

`importRows()` imports rows of cells - an array of rows, each an array of text, numbers, booleans, `Date`
or `null`. `readImportFile()` reads a file into such rows:

```ts
import { readImportFile } from '@simple-html/grid';

declare const file: File;

const table = await readImportFile(file); // CSV or .xlsx, the first sheet
const result = gridInterface.importRows(table.rows, { header: true });
console.log(`${result.rows.length} rows imported, ${result.skipped} skipped`);
for (const problem of result.problems) {
    console.log(`row ${problem.row + 1}, ${problem.field}: ${problem.message}`);
}
```

```ts
// no header: the fields by position, null skips a column
gridInterface.importRows(
    [
        ['Ann', 'ignored', '1 234,5'],
        ['Bob', '', '7']
    ],
    { fields: ['name', null, 'balance'], decimalMark: ',', invalidRows: 'skip' }
);
```

| option | default | |
| --- | --- | --- |
| `header` | `false` | the first row that is not empty names the columns, it is not imported |
| `fields` | by the header's names, or by position | the field of each column, `null` skips it |
| `decimalMark` | each number column's own | `'.'` or `','`, see [The values](#the-values) |
| `dateOrder` | `'DMY'` | a date with `/`: `'DMY'` 31/12/2026 or `'MDY'` 12/31/2026 |
| `invalidRows` | `'import'` | `'skip'` leaves out the rows with problems |

The result has the new rows, every problem (`{ row, field, value, kind, message }` - `kind` is `'value'`
for a value that was not read, `'rule'` for a validation rule) and how many rows were skipped. An option
it does not know throws a `TypeError`. Code is not stopped by `readonly` or the edit permissions, as
`addNewEmpty()` is not: check them yourself when the rows come from the user.

`readImportFile(file, { sheet, separator })` reads a sheet by its index or name (default the first) and
a CSV file with the separator given (default the one found). It gives the format, the names of the
sheets, the separator and the rows.

## The files

- **CSV** (`.csv`, `.tsv`, `.txt`): RFC 4180 - a field in double quotes can hold the separator, line
  breaks and `""` for a quote. The separator is `,`, `;` or tab, the one that splits the first lines into
  the same number of fields. UTF-8 (with or without a byte order mark), UTF-16 with its byte order mark
  (Excel's *Unicode text*), else Windows-1252 - what Excel saves as *CSV* in a Western language, so æøå
  come through. Every field is text.
- **Excel** (`.xlsx`): the cells of one sheet, typed - text (shared, inline, rich text), numbers,
  booleans, errors (`#N/A`, as text), a `Date` for a number with a date or time format (the 1900 and the
  1904 date systems). A formula is never run: its value as Excel saved it is read. Reading needs the
  browser's `DecompressionStream('deflate-raw')` - Chrome 103, Firefox 113, Safari 16.4.
- **Not read**: `.xls` (Excel 97-2003, a binary format) and a workbook protected by a password - save
  them as .xlsx or CSV; `.ods`, `.numbers` and anything else.

What a file is, is read from its first bytes, not from its name.

## A file is not trusted

A file a user picks can be anything - made to hurt, or just broken. The import reads it within limits,
and says in words what it does not read (`ImportFileError`, its `problem`):

| limit (`IMPORT_LIMITS`) | |
| --- | --- |
| `fileSize` | 20 MB, checked before a byte is read |
| `unzippedSize` | 100 MB: all the parts of a workbook read, inflated |
| `rows` | 100 000 |
| `columns` | 1 000 |
| `cells` | 1 000 000 |

- **A zip bomb** - kilobytes that inflate to gigabytes - is not inflated: a part larger than the limit is
  refused by its size, and the inflating stops at the size the ZIP gives, so a ZIP that lies about it is
  never held in memory. What comes out must have the size and the CRC-32 the ZIP gives.
- **XML** is read with the browser's `DOMParser`, as XML: no html, no scripts, nothing of the file is put
  in the page as markup - the dialog shows every value as text. A part with a `<!DOCTYPE` is not read at
  all: its entities could expand ("billion laughs"), and a workbook never has one. XML that is not
  well-formed is a damaged file.
- **A CSV file** stops at the limits while it is read: a million empty lines does not become a million
  rows first.
- **Formulas stay text**: `=HYPERLINK(...)` in a cell is imported as the text it is, the grid never runs
  it. When the rows are exported again the CSV export escapes it (see
  [Formulas](15-export.md#formulas-csv-injection)).
