# Editing

If your app allows it, you can change values right in the cells, add rows and delete rows. Your app
decides what you may do: some grids are read only, some let you add rows but not change the ones that
are there. The grid keeps track of every change until it is saved, and **saving is done by your app** -
usually with a Save button of its own. Until then, every change can be undone.

```tryit editing
```

## Edit a cell

1. Click the cell. It is ready to type in at once, with the cursor where you clicked.
2. Type. The value is written to the row as you type: a number column takes a number, a date column a
   date.
3. Move on with **Enter** (the cell below), **Tab** (the next cell) or **Shift+Tab** (the cell before).

In a cell the arrow keys, **Home** and **End** move the cursor in the text. To move to another cell
with the arrows, hold **Alt** (**⌥** on a Mac): **Alt+↓** is the cell below. There is no **Esc** to
cancel what you typed: press **Ctrl+Z** (**⌘Z** on a Mac) instead.

A cell with stripes (red in the normal look) is **read only**: you can not change it. A whole column can
be read only, or only some cells, as your app decides.

## Edit text of several lines

A cell with notes or an address can hold several lines. It shows the first line, with a small marker
when there are more; point at it to see more lines in its tooltip.

1. Press **Enter** or **F2**, double click the cell, or just start typing. A bigger editor opens over
   the cell.
2. In the editor **Enter** starts a new line.
3. **Ctrl+Enter** (**⌘Enter** on a Mac) saves and closes. So do **Tab**, a click outside the editor
   and the **✕** under it, at the right. **Esc** closes it without saving.

In a read only cell the editor opens too, to read the whole text; **Esc** closes it. To make rows tall
enough for all their lines, right click a cell and pick **Size › Fit row height** or **Fit all rows**.

## Pick a date

Click a date cell and a date picker opens under it:

1. Click a day. Use the arrows beside the month and the year to go to another month or year.
2. For a date with a time, set the hours (**HH**) and minutes (**MM**).
3. Click **Use**. **Now** goes to the current date and time, **Clear** empties the cell.

You can also type the date in the cell, as the cells show dates.

## Pick a value from a list

Some columns take their value from a list - a customer, a country, a status. The cell shows a name,
and is not typed in. To open the list:

- click the small triangle at the right of the cell, or
- press **Alt+↓**, **F4**, **F2** or **Space**, or just start typing - what you type searches the list.

Type to search, use **↑** and **↓** to move, and **Enter** or a click to pick. **Tab** picks and moves on
to the next cell. **Esc** closes the list and keeps the value as it was. A long list shows its first
500 entries: type to find the rest. Some lists are a small grid of their own, with more columns and a
filter: type in its filter, then pick a row.

**Delete** in the cell empties it. Picking a value may fill in other fields of the row too.

## Tick a checkbox

Click a checkbox, or press **Space** in it, to check or uncheck it.

## Add a row

The grid has no add button of its own: if your app allows adding rows, it has a button for it. A new
row has a **+** on its row number. Rows can also be added from a spreadsheet or a file, see
[Import](12-import.md).

## Delete rows

Deleting a row only **marks it for deletion**: it stays in the grid, struck through, with a trash can
on its row number, until your app saves. Until then you can take the mark off.

- Right click a cell and open **Delete ›**: **Row** marks the row you right clicked, **Rows (selected
  rows)** marks the selected rows, **Undo (selected rows)** takes the mark off again.
- Or click a row number to select the row and press **Delete** or **Backspace**.

**Ctrl+Z** also takes a delete back.

## Undo and redo

- **Ctrl+Z** (**⌘Z** on a Mac) undoes the last change, and takes you to the cell it changed.
- **Ctrl+Y** or **Ctrl+Shift+Z** (**⇧⌘Z** on a Mac) does it again.

One undo takes back one step: what you typed in one cell, a whole paste, a fill down, a clear or a
delete. The last 100 steps are kept. After a save there is nothing to undo.

The row menu (right click a cell) starts with **Undo / Redo ›**:

| entry | what it does |
| --- | --- |
| Undo last change | as **Ctrl+Z** |
| Redo | as **Ctrl+Y** |
| Undo cell edit | puts back the original value of the cell you right clicked |
| Undo row edits | puts back every value of the row you right clicked |
| Undo row edits (selected rows) | the same for the selected rows |

## See what you changed

- An **edited cell** has a small triangle in its top left corner. Point at it to see **Original value:**
  and the value it had. Click the triangle to put that value back.
- The **row number** shows the state of the row: **+** a new row, a pencil an edited row, a trash can a
  row marked for deletion, **!** a row with an error. Point at it for the details.
- To see only the changed rows before you save, right click a cell and pick **View › Changed rows
  only**. Pick it again to see every row.

## Fill down

- **Ctrl+D** (**⌘D** on a Mac) fills down, as in a spreadsheet. In a range of cells, the top row is
  copied into the rows under it. In a single cell, the value of the cell above is copied in.
- Or drag the **fill handle**, the small square at the bottom right corner of a range, down over the
  rows to fill. The values of the range are repeated.

The row menu has **Paste › Fill down** too. Read only cells are skipped.

## Paste a block of cells

Copy cells in Excel, Google Sheets or the grid, click a cell and press **Ctrl+V** (**⌘V** on a Mac).
The block is pasted from that cell down and to the right. One value pasted over a selected range of
cells fills every cell of it.

- Read only cells are skipped.
- A paste adds no rows: rows past the last row are left out. To paste rows as new rows, use **Paste ›
  As new rows…** in the row menu, if your app allows it, see [Import](12-import.md).
- A whole paste is one step: one **Ctrl+Z** takes it back.

See [Selecting and copying](09-selecting-and-copying.md) for how to select ranges of cells.

## Clear cells

- Select a range of cells and press **Delete** or **Backspace**: every cell in it is emptied.
- Or right click a cell and open **Clear ›**: **Clear cell**, **Clear cell (selected rows)** for that
  column in the selected rows, or **Clear range**.

Read only cells are skipped. In a single cell **Delete** just deletes text, as in any text box. In a
number cell, deleting all the text may give 0; **Clear › Clear cell** leaves it truly empty.

## Errors in what you typed

Your app can have rules for the values: a field that must be filled in, a number that must be at least
1 or a whole number, a text of at most 50 characters, one of a list of values, an email address, a
value no other row has. You can not change them, but you can see them: in the grid config dialog, on a
column's **General** tab, under **Validation**.

- An **empty cell that must be filled in** has stripes (blue in the normal look) until it has a value.
  Only spaces count as empty.
- A **value that must be unique**: when two rows have it, both cells show the error **Another row has
  the same value**. Change one of them, or delete the row, and it goes from both.
- A **cell with an error** has a red border. Point at it to read the message, such as **Required** or
  **Must be at least 1**.
- The **row number** of a row with an error has a red bar and **!**. Point at it to see every error of
  the row.

Fix the value and the error goes away. Your app may not save rows with errors, and it can show errors
from the server on the row numbers too.
