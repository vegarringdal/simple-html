# Getting started

A grid shows rows of data in columns, like a spreadsheet. You can filter, sort and group the rows,
find a text, copy cells and export to Excel - and, when your app allows it, edit the rows. This page
shows the parts of a grid and how to move around in it.

On a Mac, **Ctrl** is **⌘** (Cmd) and **Alt** is **⌥** (Option).

## Know the parts of a grid

From the top:

- **The grouping panel**: a thin strip above the column headers. Drag a column header to it to group
  the rows, see [Grouping](04-grouping.md). Your app may hide it.
- **The column headers**: the name of each column. Click one to sort, see [Sorting](03-sorting.md).
  An arrow shows the sort, with a small number when you sort by more than one column.
- **The filter row**: a box under each header. Type in it to filter the rows, see
  [Filtering](02-filtering.md). A small symbol in the box (`=`, `≥`, `*a*` ...) shows how it
  compares.
- **The column numbers**: a row of numbers under the filters. Click one to select the whole column,
  see [Selecting and copying](09-selecting-and-copying.md).
- **The rows**: one line per record. Each cell is an input box, so you can put the cursor in it.
- **The row numbers**: at the left of each row. Click one to select the row. A small icon on the
  number shows a row that is new, changed, marked for deletion or has an error. The corner above
  them selects all rows.
- **The footer**, under the rows:
  - at the left, the **views** button, if your app shows it: the name of the view you are on, see
    [Views](13-views.md)
  - the **row count**, such as `12/500`: 12 rows shown of 500
  - the **filter** as small chips, with **✕ Clear** - or the button **No filter** when nothing is
    filtered
  - at the right, a **summary** (count, sum, average ...) of the cells you have selected
  - the **gear ⚙**, which opens **Grid config**: how each column shows its values, the detail form
    and more, see [Grid config](14-grid-config.md)

Some columns can be pinned to the left or right side, so they stay in place while you scroll
sideways. You can also move, resize, hide and pin columns yourself, see [Columns](05-columns.md).

## Scroll through the rows

- The **mouse wheel** scrolls the rows up and down.
- A **trackpad** swipe sideways, or **Ctrl+Shift** with the wheel, scrolls the columns sideways.
- The **scrollbars** at the right and the bottom work as usual.
- On a **touch screen**, swipe with one finger. Let go while moving and it coasts on; touch to stop it.
- From the keyboard: **PageUp** / **PageDown** scroll a page of rows, **Ctrl+Home** / **Ctrl+End** go
  to the first / last cell. See [Keyboard](16-keyboard.md) for all keys.

Only the rows on screen are drawn, so even many thousands of rows scroll fast.

## Pick a cell

- **Click** a cell to put the cursor in it. Its row becomes the current row.
- **Tab** / **Shift+Tab** go to the next / previous cell.
- **Alt** with an arrow key moves to the cell beside, above or below. The plain arrow keys move the
  cursor inside the cell's text, as in a spreadsheet cell you are editing.
- Whether you can change a value depends on your app: many grids are read only, or have only some
  columns you can edit. See [Editing](08-editing.md).

## Open a right-click menu

Right-click a part of the grid to see what you can do there. Most menu items are in submenus, marked
with `›`: point at one to open it.

| Right-click on | Menu | What is in it |
| --- | --- | --- |
| a cell or a row number | row menu | Undo / Redo, Select, Copy, Paste, Clear, Delete, Filter, View, Size, Export |
| a column header | header menu | Pin, Hide column, Remove sorting, Column chooser…, Size, Format, Column settings…, Keyboard shortcuts…, Aggregate, Grouping |
| a filter box | filter menu | Filter (the operator, Match case, Blank, Clear Filter, Advanced Filter…) and a list of values or a date and number range |
| a column number | column menu | Select, Copy column, Copy header names |

Menu items you can not use right now are greyed out. Items for editing are only there in a grid you
can edit. Your app may also hide items or add its own.

From the keyboard, **Shift+F10** (or the menu key) opens the menu of the cell, header or filter that
has the focus. The arrow keys move in the menu, **Enter** picks, **Esc** closes it.

## Use a touch screen

- **Long press** (hold your finger still for half a second) on a cell, a row number, a header, a
  filter box or a column number: the same menu a right-click opens.
- **Tap** a header to sort. Hold a header for a moment, then drag it to move the column.
- **Tap** a row number to select or unselect the row. A finger has no Shift or Ctrl key: use
  **Select ›** in the row menu to select several rows or a range of cells.

## Read the tooltips

Hold the mouse pointer still over a button or a symbol to see a short tip on what it does. A tooltip
also shows:

- the error message of a cell or row with a value that is not valid
- the original value of a changed cell (the small marker in its corner)
- the rest of the text of a cell that has more lines than it shows
- the operator of a filter box, such as `Operator: Contains (F4)`

## See all keyboard shortcuts

Press **Ctrl+/** (⌘/ on a Mac) anywhere in the grid, or **?** where the key types nothing (a read only
cell, a column header). You can also pick **Keyboard shortcuts…** in the header menu.

The **Keyboard shortcuts** window lists every key of the grid in groups. Type in its search box to
find one, such as `undo` or `F3`. **Esc** closes it. It only lists keys that work in your grid. See
also [Keyboard](16-keyboard.md).

## Know what your app decides

The grid can do much more than a given app may want. The app you use decides, among other things:

- whether you can edit, add or delete rows - or only look at them
- which columns are read only
- whether **Import rows…** is in the menus, see [Import](12-import.md)
- whether the views button is in the footer, see [Views](13-views.md)
- whether the grouping panel, the footer or the gear ⚙ are shown

If a menu item or button in this guide is missing in your grid, your app has turned it off.
