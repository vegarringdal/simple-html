# Keyboard and accessibility

The grid follows the WAI-ARIA [grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/): a
screen reader gets one grid of rows and cells, with column headers, where each row and column is in
the whole grid, how the rows are sorted and which are selected. Grouped, it is a
[treegrid](https://www.w3.org/WAI/ARIA/apg/patterns/treegrid/): the group rows expand and collapse.
This page has what the grid exposes, every key, and what it does not do (yet).

## What a screen reader gets

This is Chrome's accessibility tree of the column layout sample (a pinned column on each side, a
column of two fields), scrolled down and to the right: columns 3 and 4 are scrolled away, and the
numbers in parentheses are the `aria-colindex`es.

```text
grid "Grid"  aria-rowcount=503  aria-colcount=10
  row  aria-rowindex=1
    columnheader "row selector" (1), "Company" (2), "Phone" (5), "date" (6) ... "Balance" (10)
  row  aria-rowindex=2
    gridcell (2) > textbox "Filter Company", gridcell (5) > textbox "Filter Phone" ...
  row  aria-rowindex=3
    gridcell "1" (2) selected=false, gridcell "4" (5, colspan 2) selected=false ... gridcell "8" (10) selected=false
  row  aria-rowindex=72  selected=false
    gridcell "69" (1), gridcell (2) > textbox "Company": MASSIVE DYNAMIC,
    gridcell (5) > textbox "Phone": +47 45911795 ... gridcell (10) > textbox "Balance": 2178.34
```

- **The grid** has `role="grid"`, `role="treegrid"` while the rows are grouped. Its name is the text
  `grid.label` (see [Labels](#labels-and-translating)). `aria-rowcount` is the number of header rows
  plus the displayed rows (after the filter, the group rows that are shown included), `aria-colcount`
  the row numbers plus every field of the layout. `aria-multiselectable="true"` with the selection
  mode `'multiple'`.
- **The header rows**: the labels are `columnheader`s, the header filters are `gridcell`s with the
  filter input in them. The top left corner is the column header of the row numbers. A hidden row of
  labels or filters (`hideLabels`, `hideFilter`) is not counted.
- **The column numbers** under the filters (a click selects a column, see
  [Selecting columns](17-selection-and-clipboard.md#selecting-columns)) are the last header row: a
  `gridcell` per column of the layout, at the `aria-colindex` of its first field - a column of two
  stacked fields is one number, `aria-colspan="2"` - with `aria-selected` `true` or `false`. Cells
  and not column headers, as the row numbers are cells: the label stays the one header of a column.
  A number can have the focus, see [A column number](#a-column-number). `selectSizeHeight: 0` hides
  the row, it is not counted then.
- **The column header of the sorted column** has `aria-sort="ascending"` or `"descending"`. Sorted on
  more columns, only the first one has it: a grid has one sorted column for a screen reader.
- **A row** has `aria-rowindex`: where it is in the whole grid, the header rows included - the first
  data row is 4 under a header of labels, filters and column numbers. With a selection mode it has `aria-selected`,
  `true` or `false`; with `'none'` it has none. A group row can not be selected.
- **A cell** is a `gridcell` with `aria-colindex`; the input (or checkbox) in it is named with the
  column's label, the same as the header shows. The row number is the first cell of a row. A column of
  two fields (`fields: ['a', 'b']`) is two columns here, one per field.
- **A cell in a range of cells** (see [Selection and clipboard](17-selection-and-clipboard.md)) has
  `aria-selected="true"`: `gridcell "Company" selected`. The other cells have no `aria-selected`, see
  [Known limits](#known-limits).
- **The state of a row** is text in its row number cell, hidden on screen (`simple-html-visually-hidden`):
  `gridcell "3 Marked for deletion"`, `"2 Edited, Error: Age: Must be at least 18"`, `"5 New row"`. A
  row as it was is its number only. The icons on screen are hidden from a screen reader, the text says
  the same - the texts `rowStatus.*`, see [Texts](12-texts.md#row-state-and-edited-cells). Without the
  row status (`rowStatus: false`) the row number is the number only: show the state another way, a
  column of `__rowState` say.
- **An edited cell**: its marker is hidden from a screen reader and is no stop of Tab; the row's state
  says the row is edited. Ctrl+Z takes an edit back, the row menu's *Undo cell edit* and a click on the
  marker are for the mouse.
- **A cell of several lines** (`FieldConfig.multiline`, or a value with a line break) is a readonly
  textbox with its first line as the value. When it has more lines, its description
  (`aria-describedby`) says so: `textbox "Notes" readonly: "Call back on Monday"`, described "More
  lines, Enter shows all" (the text `cell.multiline.more`). The marker on screen is hidden from a
  screen reader. Enter opens the editor, see [The editor of a multiline cell](#the-editor-of-a-multiline-cell).
  In a row made taller (`fitRows()`, the row menu's "Fit row height") the cell shows its other lines
  under the first one: they are for the eye and hidden from a screen reader, which reads the cell as
  in a row of one line - its first line and the description - and Enter shows all of the text. A
  taller row changes nothing else: the same cells, the same keys.
- **A lookup cell** (`ColumnConfig.editor`) is a readonly textbox with the label as its value, and
  `aria-haspopup` - `listbox` or `grid` - where it can be edited: `textbox "Country" readonly:
  "Norway"`. Its button, `button "Open the list"`, is no stop of Tab; the cell's name is made of
  both, `gridcell "Norway Open the list"`. See
  [The list of a lookup column](#the-list-of-a-lookup-column).
- **The state is not colour only** (WCAG 1.4.1): each state has a shape of its own - a plus, a pencil,
  a trash can, an exclamation mark - and a row marked for deletion is struck through.
- **A group row**, grouped, is a row with `aria-level` (1 for the first grouping) and
  `aria-expanded`; a data row is one level below the last grouping. Its one cell spans the columns
  after the row number, with a button that expands and collapses it: named with the text the row
  shows (`Country: Norway (12)`), `aria-expanded` says its state.
- **The aggregates of a group row** (`ColumnConfig.aggregate`, see [Aggregates](18-aggregates.md)):
  the aggregates of a field are one `gridcell` with the `aria-colindex` of its field, named with all its
  lines (`Sum 1234.5, Avg 123.4`), so a screen reader reads them with the column's header. The name has
  a line of its own on screen; for a screen reader it is the cell of the first column and spans the
  columns up to the first aggregate - the aggregates of the first column are in its text
  (`Country: Norway (12) Count 10`).
- **The totals row** (`totalsRow`) is the last row of the grid, after the rows on screen: its first
  cell is a `rowheader`, "Total" (the text `aggregate.total`), then a `gridcell` per aggregate.
  `aria-rowcount` counts it, its `aria-rowindex` is the last.
- **The row count** in the footer is a status (`role="status"`): a screen reader reads it out when it
  changes - after a filter, an expand or a collapse.
- **The footer's buttons**: "✕ Clear" and the filter chips (a button, its tooltip "Edit filter")
  while the rows are filtered, else "No filter" - its tooltip "Open the filter editor" is its
  description. Clear and "No filter" are one `<button>` whose name changes with the filter.
- **The panel**: the x of a group chip is a button, "Remove the grouping on Country".
- **The find bar** (Ctrl+F, see [Find](19-find.md#what-a-screen-reader-gets)): a search region named
  "Find in the grid" before the grid, with an input named "Find", the count of the matches as a status
  (`3 of 17`, read out when it changes), the toggle button "Filter rows" (`aria-pressed`) and the
  buttons "Previous match", "Next match" and "Close". The cells of the matches have no state of their
  own for a screen reader, the count says where you are; with "Filter rows" on the footer's row count
  (a status) says how many rows are left.

The rows and the columns are virtual: only the rows on screen (and a few more) are in the dom, and
of the middle section only the columns on screen. That is what `aria-rowindex` and `aria-colindex`
are for, the screen reader knows where it is without having every row.

### How

A row of the grid is not one element in the dom. The grid has a section for the row numbers, the
pinned left columns, the middle columns that scroll sideways and the pinned right columns, and a row
has an element in each. The row and column elements are reused while scrolling, so their order in the
dom is not the order of the rows and columns either.

`aria-owns` gives a screen reader the right shape without moving anything: an element owns other
elements, which become its children in the accessibility tree, in the order of the list. The grid is
an element of its own: its children are the header rows, it owns the rows in the order of the rows. A
row is the row element of the row numbers: it owns the group row's cell and the column elements of
the left, middle and right sections, in the order of the columns. The other row and column elements
are `role="none"`. The grid updates the lists after every scroll. The elements aria-owns points to
have ids of the grid's own, `simple-html-grid-<n>-...`, one `<n>` per grid on the page.

## The keyboard

Every key the grid handles, by where the focus is. The cells are inputs, always ready to be typed in:
the arrow keys, Home and End move the caret in them, as in a spreadsheet's cell being edited. Alt is
the key of the grid: Alt with an arrow moves between the cells, Alt+Home / Alt+End to the first / last
cell of the row - see [The keys that jump](#the-keys-that-jump). A custom cell (`ColumnConfig.renderer`)
has no caret: there the plain arrows move between the cells too, see [Custom cells](21-custom-cells.md#the-keys-and-the-focus).
Ctrl is Cmd on a Mac, Alt is Option.

### A cell

| key | does |
| --- | --- |
| Tab / Shift+Tab | the next / previous cell, across the sections, then the next / previous row. A group row between them is a stop of its own, its button. Shift+Tab in the first row goes up to the header filters. Tab on the last cell of the last row goes on to the footer's buttons - Clear and the filter chips while the rows are filtered, else "No filter" - and leaves the grid in a footer of no height; Shift+Tab on the first cell with the filters hidden leaves it. See [Focus](#focus) |
| Alt+ArrowLeft / Alt+ArrowRight | the cell to the left / right, across the sections. Past the end of a row: the next row |
| Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row, scrolled to - in the order of Tab: the left pinned columns first, the right pinned ones last. The middle columns scroll to their start / end |
| Alt+Home / Alt+End | the first / last cell of the row |
| Home / End | the input's: the caret to the start / end of the text (Shift+Home selects to the start) |
| PageUp / PageDown | the cell a page of rows up / down, the same column: the rows scroll as far, the cell stays where it was on screen. At the first / last row it stops there |
| Alt+PageUp / Alt+PageDown | the cell a page of the middle columns left / right, the same row: the middle columns scroll as far. In a pinned column the middle columns scroll, the focus stays |
| Ctrl+ArrowUp / Ctrl+ArrowDown | the edge of the data in the column, as in a spreadsheet: the last cell with a value before a blank one, from a blank one the next cell with a value, else the first / last row |
| Ctrl+ArrowLeft / Ctrl+ArrowRight | the input's: the caret a word left / right |
| Alt+ArrowUp / Alt+ArrowDown | the cell above / below: the next field of a column of two fields, then the next row. Up from the first row: the header filter |
| Enter | in a text cell that can be edited: the cell below (Alt+ArrowDown). In a multiline cell: opens its editor, also when the cell is readonly |
| F2 | in a multiline cell: opens its editor |
| a character | in a multiline cell that can be edited: opens its editor, the character at the end of the text |
| Space | in a cell with a `focusButton`: sends `cell-focus-button-click`, as a click on the button does. In a lookup cell that can be edited: opens its list. In a checkbox: checks it |
| Alt+ArrowDown, F4, F2 | in a lookup cell (`ColumnConfig.editor`) that can be edited: opens its list - not the cell below. See [below](#the-list-of-a-lookup-column) |
| a character | in a lookup cell that can be edited: opens its list, the character as its search. The cell is not typed in |
| Enter, F2, a character | in a custom cell that can be edited: opens the grid's editor of one line over it (the renderer's own `edit()` when it has one) - Enter saves it, Esc cancels. See [Custom cells](21-custom-cells.md#editing) |
| ArrowUp / ArrowDown / ArrowLeft / ArrowRight | on a custom cell itself: as with Alt. On a control the renderer put in the cell, the control's |
| Shift+F10, the menu key | the row menu (the browser sends `contextmenu`), the focus on its first item |
| Alt+Shift+arrows | a range of cells: from this cell, the end one cell further each time - a row up or down, a field left or right (the fields of a column of two are two). The focus stays in the cell. See [Selection and clipboard](17-selection-and-clipboard.md#the-keyboard) |
| Shift+PageUp / Shift+PageDown, Ctrl+Shift+Home / Ctrl+Shift+End, Alt+Shift+Home / Alt+Shift+End, Ctrl+Shift+ArrowUp / Ctrl+Shift+ArrowDown | the end of the range where the key without Shift goes: a page, the first / last cell of the grid, of the row, the edge of the data. Not Alt+Shift+PageUp / PageDown |
| Esc | clears the ranges of cells (when there are some, and no menu is open) |
| Ctrl+C, Cmd+C | with no text selected in the cell: the range of cells as tab separated text, or the cell's value |
| Ctrl+V, Cmd+V | a block of cells (copied in a spreadsheet, or here) from this cell or the top left of the range; one value into every cell of the ranges. One value with no range is the input's own paste |
| Delete / Backspace on a row number | marks the selected rows for deletion (the number's row alone when it is not selected); a click on a row number puts the focus there. See [Deleting rows](05-editing.md#deleting-rows) |
| Shift+F10, the menu key on a row number | the row menu of the row, without a cell (the entries of a cell are greyed out), the focus on its first item. Its *Select ›* adds the row, or the rows from the anchor - see [With a finger](17-selection-and-clipboard.md#with-a-finger) |
| Delete / Backspace | with a range of more than one cell and no text selected: empties its cells. In a lookup cell that can be edited: empties it, and the fields its `set` copies. Else the input's own |
| Ctrl+F, Cmd+F | opens the find bar, see [below](#the-find-bar). Anywhere in the grid: a header filter, a column header too |
| F3 / Shift+F3 | while the find bar is open: the next / previous match. Anywhere in the grid |
| Ctrl+D (Cmd+D) | fill down: each range gets the values of its top row, a range of one row or the cell alone the row above. See [Selection and clipboard](17-selection-and-clipboard.md#fill-down) |
| Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z | in an editable grid: undo, redo - and the focus goes to the cell it changed, scrolled to. While the cell is typed in Ctrl+Z is the input's own. See [Undo and redo](05-editing.md#undo-and-redo) |

The grid scrolls to the cell the focus goes to. Moving to another cell (Tab, Alt+arrows, Enter, the keys
that jump) clears the ranges of cells, and so does typing in a cell. The focus is moved 100ms after Tab,
Enter and an Alt+arrow - the rows scroll first: until then a key that would move it again, or type in
the cell being left, waits (it is canceled; a key held down goes one cell at a time). The other keys -
Esc for a menu, Ctrl+C - are not held up, nor are the keys of another grid on the page.

### The keys that jump

The keys of a spreadsheet that go further than the next cell, in the table above:

| key | goes to | with Shift |
| --- | --- | --- |
| Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row | the end of the range there |
| Alt+Home / Alt+End | the first / last cell of the row | the end of the range there |
| PageUp / PageDown | a page of rows up / down, the same column | the end of the range a page further |
| Alt+PageUp / Alt+PageDown | a page of the middle columns left / right, the same row | - |
| Ctrl+ArrowUp / Ctrl+ArrowDown | the edge of the data in the column | the end of the range there |

- **Home and End stay the caret's.** The WAI-ARIA grid pattern and a spreadsheet move to the first /
  last cell of the row with Home / End - but only while no cell is being edited: in a cell being edited
  they move the caret, in Excel and Google Sheets too. The cells here are always being edited (an
  input, the caret in it), so Home / End are the input's, and Alt - the key that moves between the cells
  with the arrows - makes them the grid's: Alt+Home / Alt+End. Home / End only when the caret is at the
  start / end already was considered: pressed twice to be sure, a key that also moves the caret would
  jump away from the cell. Ctrl+Home / Ctrl+End do in a text input what Home / End do: the grid takes
  them (Cmd+Home / Cmd+End on a Mac too).
- **Ctrl+ArrowLeft / Ctrl+ArrowRight stay the input's**: a word left / right (Option+arrows on a Mac).
  Ctrl+ArrowUp / Ctrl+ArrowDown do nothing in an input of one line (Cmd+ArrowUp / Cmd+ArrowDown move the
  caret to its start / end on a Mac, as Cmd+ArrowLeft / Cmd+ArrowRight do): they are the grid's, to the
  edge of the data as in Excel. On a Mac Ctrl+ArrowUp / Ctrl+ArrowDown are the system's (Mission
  Control): Cmd+ArrowUp / Cmd+ArrowDown. A blank is `null`, `undefined`, `''` or an invalid date; 0 and
  false are values.
- **PageUp / PageDown** have nothing to do in an input of one line: the grid's, a page being the rows the
  view shows. The rows scroll as far as the focus goes, so the cell stays where it was on screen; down a
  page and up again is the same row. Ctrl+PageUp / Ctrl+PageDown are left to the browser (its tabs).
- **Group rows are skipped**, as the arrows skip them: a key landing on one goes on to the data row after
  it. Tab stops on their buttons, see [Focus](#focus).
- **With Shift** the key moves the end of the last range of cells instead, as Alt+Shift+arrows do - the
  key without Shift moves the focus, with Shift the range follows it; see
  [Selection and clipboard](17-selection-and-clipboard.md#the-keyboard). The focus stays in the active
  cell while it is on screen; when the range scrolled it away (Ctrl+Shift+End from the top) it goes to
  the end of the range, and the keys go on from there - copy, Delete, the next Shift key.
- **From the header**: a header filter has Ctrl+Home / Ctrl+End, Alt+Home / Alt+End (the first / last
  filter) and PageDown; a column header and the button of a group row Ctrl+Home / Ctrl+End.

### A header filter

| key | does |
| --- | --- |
| Enter | filters |
| Tab / Shift+Tab | the next / previous filter. Tab on the last one goes to the first row (the button of its group row, when the rows are grouped; the footer's buttons when there are no rows), Shift+Tab on the first one leaves the grid |
| Alt+ArrowLeft / Alt+ArrowRight | the filter to the left / right |
| Alt+ArrowUp | the filter above in a column of two fields, else the column header (label) above it |
| Alt+ArrowDown | the filter below in a column of two fields, else the first row |
| Alt+Home / Alt+End | the first / last filter |
| Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row |
| PageDown | the cell under the filter in the last row on screen |
| Home / End | the input's: the caret |
| Shift+F10, the menu key | the filter menu, the focus on its first item |

The current row stays as it is when the focus goes up into the filters (Alt+ArrowUp, Shift+Tab,
Alt+ArrowLeft from the first row): the filter row is no row of the data.

### A column header

A column header can have the focus, but is not a stop of Tab: Alt+ArrowUp from its filter gets there
(a click too).

| key | does |
| --- | --- |
| Enter / Space | sorts on the column, again for the other direction - as a click. The focus stays on it |
| Shift+Enter / Shift+Space | adds the column to the sort - as shift+click |
| Alt+ArrowUp / Alt+ArrowDown | the label above / below in a column of two fields; down from the last one, the column's filter |
| Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row |
| Shift+F10, the menu key | the header menu, the focus on its first item |

### A column number

A column number - the row of numbers under the header filters - can have the focus, but is not a stop
of Tab: a click puts it there, and selects columns (Ctrl+click, Shift+click, see
[Selecting columns](17-selection-and-clipboard.md#selecting-columns)).

| key | does |
| --- | --- |
| Shift+F10, the menu key | the column menu, the focus on its first item. When it closes the focus is back on the number |
| Ctrl+C, Cmd+C | copies the selected columns - the number's own when none is selected - as tab separated text and an html table |
| Esc | no column selected. With a menu open, Esc closes the menu first |

### The rest

| where | key | does |
| --- | --- | --- |
| the button of a group row | Enter / Space | expands or collapses the group. The focus stays on the button |
| the button of a group row | Tab / Shift+Tab | the next / previous stop: the first cell of the row after it (the button of a group row after it), the last cell of the row before it (the last header filter before the first row). Out of the grid at its ends, see [Focus](#focus) |
| the button of a group row | Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row |
| the x of a group chip in the panel | Enter / Space | removes the grouping. It is in the tab order, before the grid |
| the footer: Clear and the filter chips, or "No filter" | Tab / Shift+Tab | the stops after the last row: Clear and the chips while the rows are filtered, else "No filter". Tab from the last cell of the last row gets there, Tab from the last of them leaves the grid. Shift+Tab from the first goes back to the last row. None in a footer of no height (`footerHeight: 0`) |
| the filter chips in the footer, "No filter" | Enter / Space | opens the filter editor |
| Clear in the footer | Enter / Space | removes the filter. The focus stays on the button, now "No filter" |
| a menu | ArrowDown / ArrowUp, Home / End, a letter | the next / previous / first / last item, the next one starting with the letter. A menu opened with the mouse leaves the focus on the cell: ArrowDown / ArrowUp get into it |
| a menu | Enter, Space | uses the item: the menu closes, the focus goes back where it was. On an item with a submenu (`›`): opens it, as ArrowRight does |
| a submenu | ArrowLeft, Esc | closes it, the focus back on its item |
| a menu | Esc, Tab | closes it, the focus goes back where it was. Tab in the filter menu goes on into its value list: the search field, the checkboxes, Cancel, Apply. ArrowDown / ArrowUp move between the search field and the checkboxes, Enter applies |
| the editor of a multiline cell | Esc / Ctrl+Enter / Tab | see [below](#the-editor-of-a-multiline-cell) |
| the list of a lookup column | the arrows, Enter, Tab, Esc | see [below](#the-list-of-a-lookup-column) |
| the filter editor | Tab, Enter / Space, Esc | every control is a button or an input, in the order shown: the `✕`, each group's AND / OR, + Condition, + Group, wrap and delete, each condition's field, operator, value, switch and delete, then Undo, Redo, Cancel, Apply, Apply & close. A picker opens its menu, see [Filtering](06-filtering.md#the-filter-editor). Esc closes the menu open in it, else the editor without filtering (a modal dialog) |
| the filter editor | Ctrl+Z (Cmd+Z), Ctrl+Y / Ctrl+Shift+Z (Cmd+Y, Cmd+Shift+Z) | undoes / redoes an edit of the editor, the focus on the control it was made with (the dialog when it is gone). In a value input typed in since it got the focus, the input's own undo of the typing - Ctrl+Z until it is back where it started. Undo and Redo, the icons in the footer, are `aria-disabled` with nothing to undo / redo and keep the focus. See [Filtering](06-filtering.md#undo-and-redo-in-the-filter-editor) |
| the find bar | Enter, F3, Esc | the next match, closes it: see [below](#the-find-bar) |

### The list of a lookup column

A select or a dropdown grid under a lookup cell (`ColumnConfig.editor`), see
[Lookups](20-lookups.md#the-keys) for every key. The cell's input has `aria-haspopup`: `listbox` for
the select, `grid` for the dropdown grid. Its button, "Open the list" (the text `lookup.open`), is for
the mouse: it is no stop of Tab.

- **The select** is the WAI-ARIA [combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
  with a listbox popup: the focus is in its search field, a `combobox` named with the column's label
  (`aria-expanded`, `aria-controls` the list, `aria-autocomplete="list"`). The list is a `listbox` of
  `option`s; the active option is the search field's `aria-activedescendant` and has
  `aria-selected="true"`. ArrowDown / ArrowUp, PageDown / PageUp, Home / End move it, Enter picks,
  Tab picks and goes to the next cell, Esc closes. "No matches" is a `status`. The cell's value is
  the active option when it opens, marked with a check on screen.
- **The dropdown grid** is a grid, with the focus in its filter: ArrowDown goes to the highlighted
  row, ArrowDown / ArrowUp move between the rows (no Alt needed), Enter picks, Esc closes.

After a pick, Enter and Esc the focus is back in the cell; Ctrl+Z there undoes the pick.

### The find bar

Ctrl+F (Cmd+F) with the focus in the grid opens it over the grid's top right corner, the focus in its
input - see [Find](19-find.md). Outside the grid Ctrl+F is the browser's.

| key | does |
| --- | --- |
| typing | finds the text when the typing stops: the cells are marked, the grid scrolls to the current match |
| Enter, F3 | the next match, wrapping to the first. The focus stays in the input |
| Shift+Enter, Shift+F3 | the previous match, wrapping to the last |
| Esc | closes it: the focus goes to the cell of the current match (its row is the current row), else back to where Ctrl+F was pressed. "Filter rows" is turned off, every row is shown again. In a modal dialog of your own, the dialog stays open |
| Ctrl+F, Cmd+F | the focus back in the input, its text selected |
| Tab / Shift+Tab | the input, "Filter rows" (the funnel), previous (↑), next (↓), close (✕). Shift+Tab from the input leaves the grid |
| Space, Enter | on "Filter rows": turns it on or off - only the rows with a match, or every row |

"Filter rows" has no key of its own: Tab from the input gets to it, Space turns it on or off, Shift+Tab
goes back to the input. Alt+R was considered: on a Mac Option+R types `®` in the input, and find bars
(VS Code's) use Alt+R for regular expressions.

### The editor of a multiline cell

A textarea in a popover over the cell, see [Multiline text](05-editing.md#multiline-text). It gets the
focus when it opens: a `textbox` named with the column's label (`Notes`), multi-line, described by the
hint under it (`Ctrl+Enter to save, Esc to cancel`, `Esc to close` when it is readonly - the texts
`cell.multiline.hint` and `cell.multiline.hintReadonly`).

| key | does |
| --- | --- |
| Enter | a new line |
| Ctrl+Enter, Cmd+Enter | saves and closes it, the focus goes back to the cell |
| Esc | closes it without saving, the focus goes back to the cell. In a modal dialog of your own, the dialog stays open |
| Tab / Shift+Tab | saves and closes it, and goes on to the next / previous cell as Tab in the cell does |

The keys of an input method (IME) are its own while it composes: Enter and Esc go to it. The other
keys are the textarea's own: the arrows move the caret, Ctrl+Z is the textarea's undo while it is open.
A readonly editor (a readonly grid or cell) shows the text, nothing can be typed in it.

## Focus

What can have the focus: the cell inputs and checkboxes, the host of a custom cell (and what its renderer
makes focusable), the header filters, the column headers, the
buttons of the group rows, the x of the group chips, the buttons of the footer (Clear and the filter
chips, or "No filter"), the input and
buttons of the find bar, and the items of a menu (see [Menus](10-menus.md#the-keyboard): the WAI-ARIA
menu pattern). Each gets a
visible focus ring from the theme (`:focus-visible`, see [Theming](13-theming.md#the-keyboard-focus)).

Tab goes through the grid in the order it is shown, as through a form - every cell is a stop, not
the one stop of the WAI-ARIA grid pattern (see [Known limits](#known-limits)):

1. the x of the group chips in the panel (the browser's Tab, before the grid)
2. the header filters, left to right
3. the rows, top to bottom: the cells of a data row left to right, across the pinned sections; a group
   row is one stop, its button
4. the footer's Clear and filter chips while the rows are filtered, else its "No filter" (none in a
   footer of no height)
5. out of the grid

Shift+Tab goes the same way back. The column headers are no stops (Alt+ArrowUp from a filter gets
there), nor are the button of a lookup cell, the marker of an edited cell and the focus button.

- Sorting from the keyboard and expanding a group rebuild the header or the rows: the focus is put
  back on the new column header / group button.
- At the ends of the grid Tab is left to the browser: the focus first goes to an empty element at the
  start or the end of the grid (`tabindex="-1"`, hidden from a screen reader), and the browser's Tab
  goes on from there to what is before or after the grid.
- The wheel and a swipe take the focus from the cell being edited: its row element is about to show
  another row. The wheel uses a hidden input for it, out of the tab order; a swipe blurs the cell,
  once when it starts (focusing an input could open a phone's keyboard). Not from the find bar: no
  cell is edited, and Enter goes on finding. They save and close the
  editor of a multiline cell too, and a click outside it does: the focus is where the click put it.

## Labels and translating

The texts a screen reader reads are texts like the others, with an id - see
[Texts](12-texts.md#screen-readers):

| id | English |
| --- | --- |
| `grid.label` | `Grid` - the name of the grid |
| `grid.rowSelector` | `row selector` - the column header of the row numbers |
| `grid.filter` | `Filter {label}` - a header filter |
| `grid.groupToggle` | `{name} ({total})` - the button of a group row |
| `grid.removeGroup` | `Remove the grouping on {title}` - the x of a group chip |

The cells and the column headers use the column's label (`columns[field].label`, else the field's
label, else the field name).

Give each grid a name of its own, a page with two grids called "Grid" is hard to find your way in:

```ts
import { createGrid, type GridConfig } from '@simple-html/grid';

const config: GridConfig = {
    layout: { center: [{ fields: ['name'], width: 150 }] },
    texts: { 'grid.label': 'Customers' }
};
const gridInterface = createGrid(host, { config, datasource });
```

Translated for the whole page, with the other texts:

```ts
import { setTexts } from '@simple-html/grid';

setTexts({
    'grid.label': 'Tabell',
    'grid.rowSelector': 'radnummer',
    'grid.filter': 'Filtrer {label}',
    'grid.groupToggle': '{name}, {total} rader',
    'grid.removeGroup': 'Fjern grupperingen på {title}'
});
```

## Known limits

- **The column numbers by keyboard**: no key gets to them from a cell, a filter or a column header:
  a click does. Their menu's copies of a whole column have no other key; a range of cells copies
  the cells of a column too (Ctrl+C). `aria-multiselectable` on the grid follows the row selection
  (the selection mode `'multiple'`), while more than one column can be selected in every mode.
- **Checked in Chrome only**: its accessibility tree (through the DevTools protocol) has the
  structure above, after scrolling both ways, sorted, grouped, expanded and collapsed. Firefox,
  Safari and real screen readers (NVDA, JAWS, VoiceOver) have not been tried. The structure depends on
  `aria-owns`, which Safari supports less well than Chrome and Firefox.
- **Not the keyboard of the grid pattern**: there every cell is reached with the arrow keys and only
  one cell is a stop of Tab. Here every cell input is a stop of Tab for the browser (the grid moves
  the focus on Tab itself), and the plain arrow keys, Home and End move the caret in the input; Alt+arrows
  move between the cells, Alt+Home / Alt+End to the ends of the row, Alt+Shift+arrows select a range of
  cells - see [The keys that jump](#the-keys-that-jump). There is no key to select a whole row or column
  (Shift+Space, Ctrl+Space), and Ctrl+ArrowLeft / Ctrl+ArrowRight are the input's (a word), not the edge
  of the data sideways. Alt+Shift+PageUp / Alt+Shift+PageDown do not extend a range.
- **Shift+Tab into the grid from after it** is the browser's: the last input in the dom, the last cell of
  a row the grid rendered at the bottom of the view (row 20 at the top of 500 rows, checked in Chrome) -
  not the last row, and not the footer's buttons. Tab into the grid from before goes to the first header
  filter, as it should.
- **Ranges of cells**: only the cells in a range have `aria-selected` (`true`). WAI-ARIA asks for
  `true` or `false` on every cell that can be selected, in a grid with `aria-multiselectable`: the
  grid keeps `aria-multiselectable` for the row selection (the selection mode `'multiple'`), and gives
  the other cells no `false`: every cell of the grid would get a "not selected" state, the way the
  rows have one with a selection mode. Not tried with a screen reader yet, see above. A range
  made with Alt+Shift+arrows (Shift+PageDown ...) is not read out while it grows: the focus stays in the
  active cell, or goes to the end once the active cell scrolled away. Only the cells on screen are in
  the dom, so a screen reader reads only those of a large range.
- **Only the rows on screen are in the dom**: a screen reader reading the page (browse mode) reads
  the rows on screen, not row 400. The counts and the indexes say where they are.
- **Group rows by keyboard**: Tab stops on the button of a group row; Alt+arrows, Enter and the keys
  that jump skip the group rows (they move between cells), so a group row is reached with Tab only.
  The treegrid pattern's ArrowRight / ArrowLeft to expand / collapse a row are not there: Enter / Space
  on the button.
- **The menus**: the right click menus and `openMenu()` follow the WAI-ARIA menu pattern (roles,
  `aria-checked`, `aria-expanded`, the keys above), checked in Chrome's accessibility tree but not with
  a screen reader yet. A menu has no name of its own (`aria-label`), a submenu is labelled by its item.
  The field and operator pickers of the filter editor are menus of the grid too: buttons
  (`aria-haspopup="menu"`, named `Field: Country`) that open them, the keys above in them. The
  column chooser is for the mouse, and so is the date picker of a date cell or filter - a date can be
  typed. The date picker opens on a click in the cell, under it at the end of the page's body: no key
  opens it and Tab does not get into it (its days have no keys, so taking the focus into it would leave
  a keyboard user in a calendar that can not pick a day).
- **The list of a lookup column**: the select is checked in Chrome's accessibility tree, not with a
  screen reader yet. The cell's input is a textbox with `aria-haspopup`, not a combobox: it is not
  `aria-expanded` while its list is open - the focus is in the list then. The select shows at most 500
  options; the search finds the rest.
- **Only the first sort column** has `aria-sort`; the number of a column in a sort on several
  columns is shown, but not read out.
- **The column numbers** under the filters are hidden: selecting a column is for the mouse, and a
  selected column is not read out.
- **The two scrollbars** are elements of their own, Chrome makes them stops of Tab (an element that
  scrolls and has nothing focusable in it); they have no name.
- `setSelectionMode()` shows (`aria-multiselectable`, `aria-selected`) on the next render of the rows:
  a click or `refresh()` (a scroll only renders the rows that scroll in).
