# Selecting and copying

You can select whole rows, whole columns, or a block of cells, much as in a spreadsheet. What you
select can be copied to Excel, Google Sheets or Word, and cells copied there can be pasted into the
grid. Rows, columns and cells are selected separately: selecting cells does not select their rows.

```tryit selecting-and-copying
```

## Select rows

- **One row**: click the row number at the left of the row. The row turns a selected colour.
- **One more row**: hold **Ctrl** (**⌘** on a Mac) and click another row number. Ctrl+click a
  selected row to take it out again.
- **Rows next to each other**: click the first row number, then hold **Shift** and click the last one.
  Every row between them is selected.
- **All rows**: click the empty top left corner of the grid, above the row numbers. **Ctrl+click** the
  corner to select no rows.

The row menu (right click a cell or a row number) has **Select › All rows** too. Many actions in the
row menu work on the selected rows: they say *(selected rows)* after their name.

Some apps let you select only one row at a time, or none. Then Ctrl and Shift select nothing more.

## Select columns

Under the header filters there is a row of numbers, 1, 2, 3 ... one for each column. Click a number to
select that column. **Ctrl+click** adds or removes a column, **Shift+click** selects the columns between
the one you clicked first and this one.

Right click a column number to open the column menu:

| entry | copies |
| --- | --- |
| Copy column (all rows) | this column, every row shown |
| Copy selected columns (all rows) | the selected columns, every row shown |
| Copy header names | the names of all columns, on one line |
| Copy header name | the name of this column |
| Copy selected header names | the names of the selected columns |

With the focus on a column number, **Ctrl+C** copies the selected columns and **Esc** selects none.
Moving, hiding or adding a column clears the selected columns.

## Select a range of cells

A range is a block of cells. It is shown with a tint and a line around it.

- **Drag**: press the mouse in a cell and drag to another cell. Past the edge of the grid it scrolls.
- **Shift+click**: click a cell, then hold **Shift** and click another cell. The range goes from the
  first cell to the one you Shift+clicked.
- **Several ranges**: hold **Ctrl** (**⌘** on a Mac) and click or drag to add another range.
- **With the keyboard**: in a cell, press **Alt+Shift+arrow keys** (**Option+Shift+arrow keys** on a
  Mac) to make the range one cell larger each time. Plain **Shift+arrow keys** select text inside the
  cell, as in any text box.

More keys that make the range larger:

| key | the range reaches |
| --- | --- |
| **Shift+PageDown** / **Shift+PageUp** | a page of rows down / up |
| **Ctrl+Shift+End** / **Ctrl+Shift+Home** | the last cell / the first cell of the grid |
| **Alt+Shift+End** / **Alt+Shift+Home** | the last / first cell of the row |
| **Ctrl+Shift+Arrow Down** / **Ctrl+Shift+Arrow Up** | the end of the data in the column |

**Esc** clears the ranges. So does a plain click in a cell, moving to another cell, typing, and any
change to which rows are shown (a filter, a sort, grouping).

## The summary of the selected cells

When a range has more than one cell, the footer shows a summary at its right, like the status bar of
a spreadsheet:

*Count: 20   Sum: 201   Average: 40.2   Min: 26   Max: 53*

- **Count** is the number of cells with a value. Empty cells are not counted.
- **Sum**, **Average**, **Min** and **Max** are of the number columns only. Without numbers only the
  count shows.
- The summary follows the cells: edit or paste a value and it changes.

## Copy cells

1. Select the cells: a range, or just click one cell.
2. Press **Ctrl+C** (**⌘C** on a Mac).
3. Paste into Excel, Google Sheets, Word or the grid.

With a range, the copy is a table: **the column names come first**, then a line per row. Excel and
Google Sheets put each value in its own cell; Word makes a table. With one cell, only its value is
copied, without a column name. Several ranges are copied as one table.

Values are copied as the cells show them, for example a date as the grid writes it. A column shown
in a special format (such as 1 234 567,89) is copied with its plain value, so it can be pasted back.

Text you have selected inside a cell is copied as plain text, as in any text box.

If **Ctrl+C** does nothing, the focus has left the grid, for example after you scrolled with the mouse
wheel. Shift+click the last cell of the range again, or use the row menu (below).

## The Copy menu

Right click a cell and open **Copy ›**:

| entry | copies |
| --- | --- |
| Cell Value | the value of the cell you right clicked |
| Column (selected rows) | this column, for the selected rows |
| Row (selected rows) | the selected rows, every column |
| Row (selected rows/col) | the selected rows, in the selected columns only (every column when none is selected) |
| Range | the selected ranges, as **Ctrl+C** does |

An entry is greyed out when there is nothing to copy, for example no selected rows. Every copy of more
than one cell starts with a line of column names. Your app may have turned that line off.

## Paste cells

If your app allows editing, you can paste cells copied in the grid or in a spreadsheet:

- **A block of cells**: click the top left cell where it should go and press **Ctrl+V** (**⌘V** on a
  Mac). The block fills the cells down and to the right, and is shown as a range afterwards.
- **One value into many cells**: copy one cell, select a range, press **Ctrl+V**. Every cell of the
  range gets the value.
- **From the menu**: right click a cell, **Paste › Paste range** pastes into the selected ranges, and
  **Paste › Paste cell (selected rows)** pastes into this column of every selected row. The browser
  may ask you to allow the page to read the clipboard.

Good to know:

- A first line of column names, as the grid copies it, is left out: only the values are pasted.
- Each value is read as if you typed it. An empty cell in the copy empties the cell in the grid.
- Read-only cells and group rows are skipped. A paste does not add rows: values past the last row are
  left out. To add copied rows as new rows, see [Import](12-import.md).
- One **Ctrl+Z** undoes the whole paste. See [Editing](08-editing.md).

**Delete** in a range empties every cell of it, if your app allows editing.

## Select with a finger

On a phone or tablet there is no Shift or Ctrl, so:

- **Tap a row number** to add the row to the selection, tap again to take it out. A column number works
  the same way.
- **Press and hold** a cell or a row number to open the row menu. Its **Select ›** submenu does what
  Shift and Ctrl do:

| entry | does |
| --- | --- |
| This row | adds the row to the selection, or takes it out |
| Rows from N to here | selects the rows from row N (the one you selected last) to this one |
| All rows | selects every row |
| Range from the active cell to here | makes a range from the cell you tapped last to this cell |
| Add this cell to the ranges | adds this cell as a range of its own |
| Clear selection | selects no rows and no cells |

To make a range: tap the first cell, press and hold the last cell, then choose **Select › Range from
the active cell to here**. Hold a column number for the column menu, which has its own **Select ›**.
