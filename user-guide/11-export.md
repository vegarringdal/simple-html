# Export

You can save the rows of the grid as an Excel file (.xlsx). Some apps also offer CSV, a plain text
file most programs can read. The file has what you see: the rows your filter lets through, in your
sort order, and the columns in the order you placed them.

## Export to Excel

1. Right click any cell of the grid.
2. Open **Export ›**.
3. Choose **Excel, all rows** or **Excel, selected rows**.

The browser downloads a file named *export.xlsx*, to where it saves downloads. **Excel, selected rows**
is greyed out until you select rows: see [Selecting and copying](09-selecting-and-copying.md#select-rows).

Export works in every grid, also one you can not edit. Your app may have its own export button, or
name the file differently.

## Which rows are exported

| you choose | the file has |
| --- | --- |
| Excel, all rows | every row the filter lets through, in the sort order |
| Excel, selected rows | the selected rows that are shown, in the same order |

- **Filters count**: the header filters, the filter editor and *Changed rows only* all decide which
  rows are exported. Clear the filter first to export everything. See [Filtering](02-filtering.md).
- **Grouped rows**: the file is a plain list, without group rows. Every row is in it, also the rows
  of collapsed groups, in the grouped order.
- **No totals**: totals and group sums are not exported. Excel can sum the rows itself.
- **Rows marked for deletion** are still exported until they are saved.

To get just a block of cells into Excel, select the cells and copy them with **Ctrl+C** (**⌘C** on a
Mac), then paste in Excel. See [Copy cells](09-selecting-and-copying.md#copy-cells).

## Which columns are exported

- The columns of the grid, in the order you see them: pinned columns on the left first, then the
  others, then the columns pinned on the right.
- A hidden column is not exported. Show it first if you need it. See [Columns](05-columns.md).
- The first row has the column names as the grid shows them, also names you gave the columns.
- A column with two fields stacked in it becomes two columns in Excel.
- Each column is as wide in Excel as in the grid.

## What the Excel file looks like

- **The header row** is bold and stays in place while you scroll. Each column has Excel's filter and
  sort button.
- **Numbers are numbers and dates are dates**, so Excel can sum, sort and filter them. Numbers show with
  the decimal mark of your computer. Dates show as year-month-day (2026-11-20), or as day.month.year
  when the grid shows them that way - your local dates, as in the grid.
- **Formats**: a column you set to a special format (Format › in the column header menu) gets a
  matching Excel format, such as two decimals, a thousands separator, a percent or a date style. The
  value in the cell stays the real number or date. See [Formatting](06-formatting.md).
- **Colours**: the colours of colour rules are copied to the cells, as they were when you exported.
  Data bars, colour scales and icons become Excel's own, and Excel updates them when you change a
  value. The colours are always those of the light look of the grid.
- **Links and templates**: a column that shows a link or a text made from a template is exported with
  its value, not the text shown.
- **Calculated columns** are exported like any other column, with their values.

An Excel sheet holds about one million rows. A larger export fails: ask for CSV instead.

## Text that looks like a formula

A value such as *=SUM(A1:A2)* or *+47 912 34 567* could be taken as a formula by a spreadsheet.

- **In the Excel file** it is always plain text. Excel shows it exactly as it was in the grid and never
  runs it.
- **In a CSV file** such text gets an apostrophe in front ('=SUM(A1:A2)), so a spreadsheet shows it as
  text. The apostrophe is part of the file.
- **When you copy** cells, the text is copied as it is. Excel may take it as a formula when you paste.

## Export to CSV

CSV is not in the grid's menus. If your app has a button or menu entry for it, the CSV file has:

- the same rows and columns as the Excel export, with a first line of column names
- each value as the cell shows it, for example *12,5* or a date as the grid writes it
- no formats and no colours: it is text

## Open a CSV file in Excel

If you can, export to Excel instead: Excel then gets the numbers, dates and columns right. When you
open a CSV file in Excel:

- **Everything in one column**: Excel splits the columns with the list separator of your computer. In
  countries that write a decimal comma (Norway, Germany, France ...) that is a semicolon. A file with
  commas then opens with each row in one cell. Ask whoever set up your app for a CSV with semicolons,
  or open the file with Excel's *Data › From Text/CSV* and pick the separator there.
- **Letters such as æ, ø, å look wrong**: the grid's CSV download marks the file as UTF-8, which Excel
  reads correctly. If you still see odd characters, import it with *Data › From Text/CSV* and choose
  UTF-8.
- **Dates and numbers**: Excel guesses the type of each column, and may read a date or a decimal
  number differently than the grid shows it.

## Bring the rows back

A file exported from the grid can be read back in as new rows, if your app allows it. See
[Import](12-import.md).
