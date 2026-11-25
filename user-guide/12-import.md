# Import

Import adds rows from a CSV file, an Excel workbook (.xlsx) or rows copied in a spreadsheet as new
rows of the grid. Before anything is added, you see which column goes to which field and which
values could not be read. Import is only there if your app allows it, and only where you may add rows.

## Open the import dialog

- **From a file**: right click a column name in the header and choose **Import rows…**.
- **From the clipboard**: copy rows in Excel or Google Sheets, right click a cell of the grid and
  choose **Paste › As new rows…**. The browser may ask you to allow the page to read the clipboard.

The dialog *Import rows* opens. You can move it by its title bar and make it larger from its edges.

## Pick the rows

Do one of these:

- Click **Choose file…** and pick a file.
- Drag a file from your computer and drop it on the dialog.
- Copy rows in a spreadsheet and press **Ctrl+V** (**⌘V** on a Mac) in the dialog.

The grid reads these files:

| file | read |
| --- | --- |
| CSV (.csv, .tsv, .txt) | yes. The separator (comma, semicolon or tab) is found by itself |
| Excel workbook (.xlsx) | yes. With more than one sheet, pick the sheet under **Sheet** |
| Excel 97-2003 (.xls) | no: open it in Excel and save it as .xlsx or CSV |
| A workbook protected by a password | no: save it without the password |
| OpenDocument (.ods), Numbers and others | no: save it as .xlsx or CSV |

- For a CSV file, **Separator** shows the one it found, for example *Found: Semicolon*. Pick
  *Comma*, *Semicolon* or *Tab* if the columns look wrong.
- CSV files saved by Excel, also as *Unicode text*, are read with their letters intact, such as æ, ø
  and å.
- In a workbook, formulas are not run: the value Excel saved is read.

## The first row as a header

Tick **First row is a header** when the first row has the column names. The dialog turns it on by
itself when the first row names fields of the grid. The header row is not imported.

## Match columns to fields

The dialog shows the first rows of the file, with a picker over each column. In each picker, choose
the field the column goes to, or **Skip** to leave the column out. A line above says how the columns
were matched:

- **By name**: with a header, a column goes to the field with the same name, as the grid's column
  names it. Upper and lower case do not matter. A column with a name the grid does not know is skipped.
  The columns can be in any order.
- **By position**: without a header, the first column goes to the first field of the grid, the second
  to the second, and so on. With **Paste › As new rows…** it starts at the column you right clicked.

A field can go to one column only: pick it for a second column and the first one is set to **Skip**.
Read-only columns can not be picked.

## Numbers and dates

Values are read as if you typed them into the grid. When a number or date field is picked, two more
options show:

- **Decimal mark**: *As the columns* (the default, each column's own decimal mark), *Dot: 1,234.5*
  or *Comma: 1 234,5*. Pick the one the file uses.
- **Dates with /**: *Day first: 31/12/2026* (the default) or *Month first: 12/31/2026*.

| field | read | not read |
| --- | --- | --- |
| number | 1234.5, -5, 1 234,5, 1.234,5 | 12 kg, abc |
| date | 2026-12-31, 31.12.2026, 31/12/2026, also with a time 13:45 after it | 31.02.2026, 20.11.26, tomorrow |
| yes / no | true / false, 1 / 0, yes / no | maybe |
| text | any text, also text that starts with = (it stays text) | |

A value that can not be read is never guessed: the field is left empty and the problem is listed.
Empty cells give empty fields, and empty rows are left out.

## Rows with problems

Under the columns the dialog shows how many rows it read and how many have problems, for example
*120 rows, 3 with problems*, followed by the first problems in words:

*Row 3, Age: Not a number: abc*

The row number is the row in the file, as Excel numbers it. A cell with a problem is marked in the
preview; point at it to see what is wrong. A required field the file does not have is a problem of
every row.

Under **Rows with problems**, choose:

- **Import them, marked**: the rows are added, the values that could not be read are left empty, and
  the row is marked so you can fix it.
- **Skip them**: those rows are not added.

## Import the rows

Click **Import N rows**. The button counts the rows that will be added. **Cancel**, the **✕** and
**Esc** close the dialog without importing.

After the import:

- The rows are added as new rows at the end, or in their groups when the grid is grouped. The first new
  row is selected and the grid scrolls to it.
- A row that had a problem has an exclamation mark on its row number. Point at it to see what was not
  imported, for example *Not imported: Age: Not a number: abc*. Other errors show on the cells, as
  after an edit.
- The rows are new rows, like rows you add yourself: they are saved when you save in your app.

## Undo an import

Press **Ctrl+Z** (**⌘Z** on a Mac) once, or use **Undo last change** in the row menu: all imported rows
are taken out again. **Ctrl+Y** (**⇧⌘Z** on a Mac) brings them back. See [Editing](08-editing.md).

## Limits

The import refuses a file that is too large. It reads at most:

- a file of 20 MB
- 100 000 rows
- 1 000 columns
- 1 000 000 cells

Some browsers can not read Excel files. The dialog then says so: save the file as CSV instead. A file
that is damaged, or is not CSV or Excel, gives a message too. The file's name does not matter: the
grid looks at what is in it.

To get rows out of the grid into a file, see [Export](11-export.md).
