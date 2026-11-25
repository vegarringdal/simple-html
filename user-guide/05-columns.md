# Columns

You can change how the columns are laid out: their order, their width, which ones stay in place at
the side, and which ones are shown at all. You do it in the header, with the mouse or a finger, and
in the header menu - right click a column's label. The grid keeps what you change while you work; if
your app saves views, a view keeps it too, see [Views](13-views.md).

## Move a column

1. Press on the column's label and drag it. On a touch screen, hold the label still a moment, then drag.
2. While you drag, the header shows where the column will go.
3. Let go:
   - on the **left or right edge** of another label: the column goes before or after that column
   - on the **top or bottom edge** of another label: the two are stacked in one column, one above the other
   - on the **middle** of another label: the two columns swap places

Drag past the left or right side of the grid and the columns scroll. Drop the label on the panel
above the header and the rows are grouped on it instead, see [Grouping](04-grouping.md).

A short click on a label sorts on it, see [Sorting](03-sorting.md). It only becomes a drag once the
mouse has moved a little.

## Change the width of a column

- **Drag the edge** of the column's label: the right edge, or the left edge for a column pinned right.
  A column is at least 25 pixels wide.
- **Double click the edge** to make the column as wide as its content, like AutoFit in Excel.

## Fit columns to their content

Right click a label and open **Size ›**:

| entry | what it does |
| --- | --- |
| Fit column width | this column as wide as its widest text and its label |
| Fit all columns | every column as wide as its content |
| Reset column width | this column back to the width it started with |
| Reset all column widths | every column back to the width it started with |

Right click a cell and open **Size ›** for **Fit column to this cell**: the column as wide as the text
of that one cell. The same menu makes rows taller for cells with several lines (**Fit row height**,
**Fit all rows**, **Reset row height**, **Reset all row heights**).

## Pin a column to the left or right

A pinned column stays in place while the other columns scroll sideways - handy for a name or a number
you always want to see.

1. Right click the column's label.
2. Open **Pin ›** and pick one:
   - **Pin left** or **Pin right**: the column moves to that side.
   - **Pin left (copy)** or **Pin right (copy)**: a copy is pinned to that side, and the column also
     stays where it was.
   - **Unpin**: the column goes back among the columns that scroll.

You can also drag a label onto the edge of a pinned column's label: it is pinned beside it.

## Hide a column

1. Right click the column's label.
2. Pick **Hide column**.

In a column with two stacked fields, only the field you right clicked is hidden. Hiding a column
changes nothing in the data: the column is just not shown.

## Show a hidden column

Use the column chooser:

1. Right click any label and pick **Column chooser…**.
2. A list opens with every column, by its label. Type in **Search** to find one by its name.
3. Drag the column from the list into the header, to the place where you want it. On a touch screen,
   hold it still a moment first.
4. Click **Close** when you are done.

## Rename a column

1. Open the **Column chooser…** from the header menu.
2. Click the ✎ at the right of the column (it shows when you point at the column).
3. Type the new label and press **Enter**. **Esc** keeps the old one.

Leave the label empty to give the column its own label back. The new label is used everywhere the
grid names the column: the header, the menus, the filter and the exports. You can also set it in
**Grid config**, see [Formatting](06-formatting.md#the-label-and-the-placeholder).

## Select columns with the column numbers

Under the header filters there is a row of numbers, 1, 2, 3 ... one for each column (if your app shows
it). Click them to select whole columns:

| | does |
| --- | --- |
| a click | selects that column only |
| **Ctrl+click** (**⌘**+click on a Mac) | adds the column, or takes it out |
| **Shift+click** | selects the columns from the one you clicked last up to this one |
| **Esc** | no column selected |

On a touch screen a tap adds or removes a column.

Right click a column number for the column menu:

- **Select ›**: **This column**, **Columns from N to here**, **All columns**, **Clear column selection**
  - what Ctrl and Shift do, also for a finger.
- **Copy column**: the column you right clicked, every row shown.
- **Copy selected columns**: the selected columns, every row shown. **Ctrl+C** on a column number does
  the same.
- **Copy header names**, **Copy header name**, **Copy selected header names**: only the labels.

The selection is cleared when you move, pin, hide or add a column. See also
[Selecting and copying](09-selecting-and-copying.md).

## Reset the columns

- **Size › Reset column width** and **Reset all column widths** in the header menu give the columns
  their first widths back.
- To get the whole layout back as it started - order, pinning and hidden columns - pick **Standard**
  in the views menu at the left end of the footer, if your app shows it. Note that Standard also puts
  back the sorting, the filters and the rest of the grid as it started. See [Views](13-views.md).
