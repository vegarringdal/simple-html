# Selection and clipboard

The grid has two kinds of selection. **Rows** are selected in the datasource: a click on the row
number, the rows a delete or an export works on. **Ranges of cells** are selected in the grid, as in
a spreadsheet: drag over the cells, then copy them (they paste into Excel or Google Sheets), paste
cells copied there into the grid, or empty them with Delete.

```sample ranges
```

## Selecting rows

A click on the row number selects the row, Ctrl+click adds one, Shift+click selects the rows in
between - the datasource's selection, `datasource.getSelectedRows()`. See
[Selection](04-datasource.md#selection). The row menu's Copy, Paste cell, Clear cell, Delete and the
export of the selected rows work on these rows.

A range of cells selects no rows, and selecting rows changes no range: they are two things.

## Ranges of cells

A range is the rectangle between two cells, both included:

- **its rows** are the displayed rows between them (`datasource.getRows()`, 0 based - the `row` of
  the grid events). A group row in between is part of the rectangle, but has no cells: it is left out
  of a copy, a paste and a clear
- **its fields** are the fields between them in the layout: pinned left, center, pinned right, in the
  order of `gridInterface.getLayoutFields()`. A column of two stacked fields is two columns here, the
  top one first - as in the CSV export and for a screen reader
- **it starts** at the cell the mouse was pressed in, or the cell with the focus - and ends at the
  opposite corner, which can be above it or left of it

There can be several ranges: Ctrl+click adds one. The last one is the one made last; where it starts
is the **active cell**, the cell with the focus.

### The mouse

| | does |
| --- | --- |
| press in a cell and drag | a range from that cell to the cell under the pointer, across the pinned sections. Inside the cell pressed it is the input's own text selection; once the pointer is on another cell it is a range, and the text the press selected is not selected any more |
| Shift+click, Shift+drag | the last range from where it starts to the cell clicked - with no range, from the cell with the focus. The focus stays in the active cell |
| Ctrl+click, Cmd+click | another range, of the cell clicked; Ctrl+drag makes it larger. With no range yet the cell with the focus stays selected, as a range of its own (as in Excel) |
| a plain click | clears the ranges, and does what it did before: the cell gets the focus, its row is the current row, a date cell opens its picker |

Dragged past the top or the bottom of the rows the grid scrolls, a row at a time while the pointer
stays out there; past the left or right edge of the grid the middle columns scroll.

A click on a cell does not select its row - it never did: the row number does that. Shift+click does
not make the row clicked the current row (the active cell stays where it was), Ctrl+click and
Shift+click do not open the date picker of a date cell and do not check a checkbox.

**A pen** works as the mouse, where the browser does not take its drag for scrolling. **A finger**
makes no range: a swipe scrolls the grid, and a long press is the browser's own (the menu of the row,
or text selection). Use `setRanges()` from a button of your own, or a keyboard.

### The keyboard

In a cell (see [Keyboard and accessibility](14-accessibility.md#the-keyboard) for every key):

| key | does |
| --- | --- |
| Alt+Shift+arrows | starts a range at the cell, or moves the end of the last range one cell: a row up or down (group rows are skipped), a field left or right in the order of the layout - in a column of two stacked fields, right of the top field is the field under it. The focus stays in the active cell, the grid scrolls to the end |
| Esc | clears the ranges. With a menu open, Esc closes the menu first |
| Ctrl+C, Ctrl+V, Delete | see [Copy](#copy), [Paste](#paste), [Delete](#delete) |

The arrows move the caret in the cell's input and Shift+arrows select text in it, as always; Alt+arrows
move to the next cell. On a Mac, Alt is the Option key: Option+Shift+arrows select a range, not words.

Moving to another cell - Tab, Alt+arrows, Enter, a click - clears the ranges, and so does typing in a
cell: as moving the active cell does in a spreadsheet. A right click does not, the row menu works on
them.

### How a range looks

The cells of a range get a tint, and the range a line around it; the empty cells under a column with
fewer stacked fields than the others go with the field above them, so a range is a rectangle on screen
too. The colours are `--simple-html-grid-range-bg-color` and `--simple-html-grid-range-border-color`,
light and dark, see [Ranges of cells](13-theming.md#ranges-of-cells). The cells have the class
`simple-html-cell-in-range`, the cells at its edges `simple-html-cell-range-top`, `-bottom`, `-left`
and `-right`.

The cells are reused while the grid scrolls: the classes follow the rows and fields they show.

### The summary in the footer

With ranges of more than one cell the footer shows a summary of them at its right, like the status bar
of a spreadsheet: `Count: 20   Sum: 201   Average: 40.2   Min: 26   Max: 53`.

- **Count** is the cells with a value, of any type: a blank (`null`, `''`) is left out, `0` and
  `false` count.
- **Sum, Average, Min, Max** are of the numbers of the number fields (`type: 'number'`) - a text of
  digits is no number. Without numbers only the count shows.
- Every cell once: ranges that overlap count their common cells once; group rows have no cells.
- The numbers are shown with the formatter of the number field furthest left in the ranges, two decimals
  at most.
- It follows the ranges and the values in them: an edit, a paste, an upsert. One cell, or no range,
  shows none.

It is a group named "Selected cells" for a screen reader, its tooltip has all of it when a narrow grid
cuts it. The texts are `footer.summary.*`, see [Texts](12-texts.md). The filter chips collapse to one box
when they would reach under it.

### When the ranges are cleared

The rows of a range are indexes of the displayed rows, and its fields are good for the layout it was
made in. So the grid clears the ranges, and sends `range-change`, when:

- **the displayed rows change**: a filter, a sort, grouping, a group expanded or collapsed, rows set,
  added or removed (`setData()`, `addNewEmpty()`, `removeData()`, an `upsert()` that adds, removes or
  moves rows), rows marked for deletion, `setState()` / `resetState()` with any of these
- **the layout changes**: a column moved, pinned, unpinned, hidden, added, its fields stacked another
  way, `setState({ layout })`, `updateConfig({ layout })`
- **the grid is put back on the page**: its rows may have changed while it was away

They are kept when a value changes (an edit, a paste, `upsert()` of values only), when rows are
selected or the current row changes, when a column is resized, and on `refresh()` and `rebuild()`.

### The API

```ts
import type { CellRange } from '@simple-html/grid';

// rows 0 to 4, every field from name to age in the layout
const range: CellRange = { fromRow: 0, fromField: 'name', toRow: 4, toField: 'age' };
gridInterface.setRanges([range]);

gridInterface.getRanges(); // [{ fromRow: 0, fromField: 'name', toRow: 4, toField: 'age' }]
gridInterface.clearRanges();

gridInterface.on('range-change', ({ ranges }) => {
    console.log(ranges.length ? `${ranges.length} ranges` : 'no cells selected');
});

// the cells of the last range as CSV, with their labels
const csv = gridInterface.getCsv({ rows: 'range' });
```

- **`getRanges()`** gives copies: changing them changes nothing. `[]` when no cells are selected.
- **`setRanges(ranges)`** replaces the ranges, as if the user had selected them. It does not move the
  focus or scroll. A row that is not displayed (0 to `datasource.length() - 1`) or a field that is
  not in the layout throws a `TypeError`.
- **`range-change`** is sent each time they change, with what `getRanges()` gives - while the mouse
  drags, each time the range reaches another cell. Not when nothing changed.
- A range is plain JSON. Its row indexes are only good for the rows as they are displayed now, so a
  range is not part of `getState()`.
- **The export**: `getCsv({ rows: 'range' })` and `downloadCsv(filename, { rows: 'range' })` export
  the last range, see [Export](15-export.md#the-rows).

## Copy

Ctrl+C (Cmd+C) in a cell, with no text selected in it:

- **with a range of more than one cell, or several ranges**: the cells as a table of tab separated
  text - **a header line of the column labels first**, then a line per data row, each ended with CRLF,
  a tab between the fields, as Excel puts cells on the clipboard. A value with a tab, a line break or a
  double quote is put in double quotes, a quote in it doubled. Every value is the text the cell shows,
  through the field's formatter: `12,5` with a decimal comma, a date as its formatter writes it.
- **else**: the value of the cell with the focus, as the cell shows it, without a line end - as the
  row menu's *Copy: Cell Value*. Before v6 this copied nothing.

An html table of the same cells goes on the clipboard too, with the labels as its header row (`<th>`)
and thin borders - Word, Google Docs and Excel paste the html, so the table has its headers there. A
line break in a cell is a `<br>` with the style Excel reads as a line break in the cell
(`mso-data-placement:same-cell`).

**The header line** is there for every copy of more than one cell: Ctrl+C on ranges and the row
menu's *Copy: Column*, *Row*, *Row (selected rows/col)* and *Range*. Not for one cell (Ctrl+C on a
cell, *Copy: Cell Value*): that is a value. `copyHeaders: false` in the config copies the values only:

```ts
gridInterface.updateConfig({ copyHeaders: false });
```

**Text selected in the cell's input** is copied as before: the input's own copy. Making a range ends
the text selection of the active cell, so after a drag or Alt+Shift+arrows Ctrl+C copies the range.

**Several ranges are copied as one table**: the rows of every range, in the order of the grid, and
the fields of every range, in the order of the layout. A cell that is in none of the ranges is
empty. So two ranges side by side (Name and Age, rows 1-2) are one table of Name and Age - the
columns between them are not copied - and two ranges one above the other (City rows 1-2 and row 5)
one longer table; ranges that cross leave the cells they do not cover empty. Excel refuses to copy
ranges that do not make a rectangle together; the grid copies them all.

Text that looks like a formula (`=SUM(A1:A2)`) is copied as it is: what is copied is what is in the
cells, and a paste back into the grid gives the same values. A spreadsheet may take it as a formula
when it is pasted there - the CSV export escapes it (`escapeFormulas`), the clipboard does not.

The row menu (right click a cell) has *Copy: Range* while there are ranges: every range, as Ctrl+C.
*Copy: Column* and *Row* copy the selected rows, with the header line, values as the cells show them.
That also works when the focus is not in a cell, after the wheel scrolled the grid.

## Paste

Ctrl+V (Cmd+V) in a cell of an editable grid reads the plain text of the clipboard as tab separated
cells: what Excel and Google Sheets copy, and what the grid copies. A line per row (CRLF, LF or CR);
a value in double quotes can hold tabs and line breaks, `""` is a quote; the line end Excel puts after
the last row is not a row.

- **A header line is left out**: when every cell of the first line is the label of one of the grid's
  columns (any case, spaces around ignored), it is a copy's header and is not written into cells - so
  a copy of the grid pasted back into it, into the same columns or others, writes the values. A
  first line of data that is all labels is left out too; that is rare, and the paste can be undone.
- **One value, ranges of more than one cell**: every cell of every range gets it - copy one cell,
  select a range, paste.
- **A block of cells**: from the top left cell of the last range - or the cell with the focus when
  there is no range - down and right, a row of the block per data row. With no range the cells pasted
  into become a range, so you see where they went. A block smaller than the range is pasted once, it
  is not repeated to fill the range; a larger one is pasted whole.
- **One value, no range**: the input's own paste, at the caret. Unless the input can not take it: a
  value with a line break (an input has none, the browser would make it a space), a checkbox, a
  multiline cell (its input is readonly, see [Multiline text](05-editing.md#multiline-text)) or a
  column with `allowPasteClearOnly` - the grid writes the value into the cell then.

Every cell is written as typing it does: the text through the field's formatter (`parse`) - `12,5`
is 12.5 in a number field, `2026-11-20` a `Date` in a date field, `true` in a boolean field. An
**empty text empties the cell** (`null`), as Delete does: a blank cell copied in Excel is blank in the
grid, also in a number field.

What is skipped:

- **readonly cells**: the grid's `readonly`, the column's `readonly`, the `isReadonly` hook. A
  readonly grid pastes nothing
- **group rows**: the next row of the block goes to the next data row
- **rows past the last displayed row**: a paste adds no rows. Paste fewer, or add rows first
  (`addNewEmpty()`)
- **fields past the last field of the layout**

The validation runs on every cell written, as for an edit: the errors show on the cells and the row
numbers. The edited markers and the row states follow too. A paste sends no `paste` event (that is the
row menu's *Paste cell*): the rows changed are in `rows-changed`.

The row menu has *Paste: Paste range* while there are ranges: it pastes as Ctrl+V does with ranges.
It reads the clipboard with `navigator.clipboard.readText()`, which the browser may ask the user to
allow first (Ctrl+V needs no permission).

## Delete

Delete or Backspace in a cell, with a range of more than one cell (or several ranges) and no text
selected in the input: every cell of every range is emptied (`null`), the readonly cells skipped, in
an editable grid. In one cell they are the input's own keys, as before. The row menu's *Clear: Clear
range* does the same.

## Undo

A paste, a Delete and a clear of ranges are written in one go: **one Ctrl+Z** takes all of it back,
see [Undo and redo](05-editing.md#undo-and-redo).

```ts
// what a paste or a Delete did, from code: one step
datasource.undo();
```

## Find

Ctrl+F in the grid finds a text in the cells and marks them - a match in a range shows both tints. It
selects nothing: the ranges and the selected rows stay as they are; Esc in the find bar puts the focus in
the cell of the current match, which clears the ranges as moving to another cell does. See
[Find](19-find.md).

## What a screen reader gets

The cells of a range have `aria-selected="true"`; the other cells have none. The keys are in the
table of [Keyboard and accessibility](14-accessibility.md#a-cell), the limits in its
[Known limits](14-accessibility.md#known-limits): a range made with Alt+Shift+arrows is not read out
while it grows, the focus stays in the active cell.

## Known limits

- **No ranges by touch**, see [The mouse](#the-mouse).
- **Copy and paste listen while the focus is in a cell of the grid.** The wheel takes the focus from
  the cell (its row element is reused for other rows), then Ctrl+C goes to the page: use the row
  menu's *Copy: Range*, or Shift+click the cell at the end of the range again - the range stays as it
  is and the cell gets the focus.
- **Cut** (Ctrl+X) is the input's own: it cuts the text selected in the cell, not a range. Copy, then
  Delete.
- **Several ranges** copy as one table (see [Copy](#copy)); a block is pasted into the last one.
- **No fill**: a block is not repeated to fill a larger range, only one value fills it.
- **Checked in Chrome**: the drag over the cells, the text selection it ends, the clipboard. Firefox
  and Safari have not been tried.
