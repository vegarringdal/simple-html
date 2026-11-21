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
grid "Grid"  aria-rowcount=502  aria-colcount=10
  row  aria-rowindex=1
    columnheader "row selector" (1), "Company" (2), "Phone" (5), "date" (6), "Age" (7) ... "Balance" (10)
  row  aria-rowindex=2
    gridcell (2) > textbox "Filter Company", gridcell (5) > textbox "Filter Phone" ...
  row  aria-rowindex=71  selected=false
    gridcell "69" (1), gridcell (2) > textbox "Company": MASSIVE DYNAMIC,
    gridcell (5) > textbox "Phone": +47 45911795 ... gridcell (10) > textbox "Balance": 2178.34
```

- **The grid** has `role="grid"`, `role="treegrid"` while the rows are grouped. Its name is the text
  `grid.label` (see [Labels](#labels-and-translating)). `aria-rowcount` is the number of header rows
  plus the displayed rows (after the filter, the group rows that are shown included), `aria-colcount`
  the row numbers plus every field of the layout. `aria-multiselectable="true"` with the selection
  mode `'multiple'`.
- **The header rows**: the labels are `columnheader`s, the header filters are `gridcell`s with the
  filter input in them. The top left corner is the column header of the row numbers. The column
  numbers under the filters (a click selects a column) are hidden from a screen reader: they are for
  the mouse. A hidden row of labels or filters (`hideLabels`, `hideFilter`) is not counted.
- **The column header of the sorted column** has `aria-sort="ascending"` or `"descending"`. Sorted on
  more columns, only the first one has it: a grid has one sorted column for a screen reader.
- **A row** has `aria-rowindex`: where it is in the whole grid, the header rows included - the first
  data row is 3 under a header of labels and filters. With a selection mode it has `aria-selected`,
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
- **The panel**: the x of a group chip is a button, "Remove the grouping on Country".

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

Every key the grid handles, by where the focus is. The cells are inputs, the arrow keys move the
caret in them; Alt with an arrow moves between the cells.

### A cell

| key | does |
| --- | --- |
| Tab / Shift+Tab | the next / previous cell, across the sections, then the next / previous row. Group rows are skipped. Shift+Tab in the first row goes up to the header filters. Tab on the last cell of the last row, and Shift+Tab on the first cell with the filters hidden, leave the grid |
| Alt+ArrowLeft / Alt+ArrowRight | the cell to the left / right, across the sections. Past the end of a row: the next row |
| Alt+ArrowUp / Alt+ArrowDown | the cell above / below: the next field of a column of two fields, then the next row. Up from the first row: the header filter |
| Enter | in a text cell that can be edited: the cell below (Alt+ArrowDown). In a multiline cell: opens its editor, also when the cell is readonly |
| F2 | in a multiline cell: opens its editor |
| a character | in a multiline cell that can be edited: opens its editor, the character at the end of the text |
| Space | in a cell with a `focusButton`: sends `cell-focus-button-click`, as a click on the button does. In a checkbox: checks it |
| Shift+F10, the menu key | the row menu (the browser sends `contextmenu`), the focus on its first item |
| Alt+Shift+arrows | a range of cells: from this cell, the end one cell further each time - a row up or down, a field left or right (the fields of a column of two are two). The focus stays in the cell. See [Selection and clipboard](17-selection-and-clipboard.md#the-keyboard) |
| Esc | clears the ranges of cells (when there are some, and no menu is open) |
| Ctrl+C, Cmd+C | with no text selected in the cell: the range of cells as tab separated text, or the cell's value |
| Ctrl+V, Cmd+V | a block of cells (copied in a spreadsheet, or here) from this cell or the top left of the range; one value into every cell of the ranges. One value with no range is the input's own paste |
| Delete / Backspace | with a range of more than one cell and no text selected: empties its cells. Else the input's own |
| Ctrl+D (Cmd+D) | fill down: each range gets the values of its top row, a range of one row or the cell alone the row above. See [Selection and clipboard](17-selection-and-clipboard.md#fill-down) |

The grid scrolls to the cell the focus goes to. Moving to another cell (Tab, Alt+arrows, Enter) clears
the ranges of cells, and so does typing in a cell.

### A header filter

| key | does |
| --- | --- |
| Enter | filters |
| Tab / Shift+Tab | the next / previous filter. Tab on the last one goes to the first row, Shift+Tab on the first one leaves the grid |
| Alt+ArrowLeft / Alt+ArrowRight | the filter to the left / right |
| Alt+ArrowUp | the filter above in a column of two fields, else the column header (label) above it |
| Alt+ArrowDown | the filter below in a column of two fields, else the first row |
| Shift+F10, the menu key | the filter menu, the focus on its first item |

### A column header

A column header can have the focus, but is not a stop of Tab: Alt+ArrowUp from its filter gets there
(a click too).

| key | does |
| --- | --- |
| Enter / Space | sorts on the column, again for the other direction - as a click. The focus stays on it |
| Shift+Enter / Shift+Space | adds the column to the sort - as shift+click |
| Alt+ArrowUp / Alt+ArrowDown | the label above / below in a column of two fields; down from the last one, the column's filter |
| Shift+F10, the menu key | the header menu, the focus on its first item |

### The rest

| where | key | does |
| --- | --- | --- |
| the button of a group row | Enter / Space | expands or collapses the group. The focus stays on the button |
| the x of a group chip in the panel | Enter / Space | removes the grouping. It is in the tab order, before the grid |
| the filter chips in the footer | Enter / Space | opens the filter editor |
| a menu | ArrowDown / ArrowUp, Home / End, a letter | the next / previous / first / last item, the next one starting with the letter. A menu opened with the mouse leaves the focus on the cell: ArrowDown / ArrowUp get into it |
| a menu | Enter, Space | uses the item: the menu closes, the focus goes back where it was. On an item with a submenu (`›`): opens it, as ArrowRight does |
| a submenu | ArrowLeft, Esc | closes it, the focus back on its item |
| a menu | Esc, Tab | closes it, the focus goes back where it was. Tab in the filter menu goes on into its value list: the search field, the checkboxes, Run Search |
| the editor of a multiline cell | Esc / Ctrl+Enter / Tab | see [below](#the-editor-of-a-multiline-cell) |
| the filter editor | Esc | closes it without filtering (a modal dialog) |

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

What can have the focus: the cell inputs and checkboxes, the header filters, the column headers, the
buttons of the group rows, the x of the group chips and the filter chips in the footer, and the items
of a menu (see [Menus](10-menus.md#the-keyboard): the WAI-ARIA menu pattern). Each gets a
visible focus ring from the theme (`:focus-visible`, see [Theming](13-theming.md#the-keyboard-focus)).

- Sorting from the keyboard and expanding a group rebuild the header or the rows: the focus is put
  back on the new column header / group button.
- At the ends of the grid Tab is left to the browser: the focus first goes to an empty element at the
  start or the end of the grid (`tabindex="-1"`, hidden from a screen reader), and the browser's Tab
  goes on from there to what is before or after the grid.
- The wheel and a swipe take the focus from the cell being edited: its row element is about to show
  another row. The grid uses a hidden input for it, out of the tab order. They save and close the
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

- **Checked in Chrome only**: its accessibility tree (through the DevTools protocol) has the
  structure above, after scrolling both ways, sorted, grouped, expanded and collapsed. Firefox,
  Safari and real screen readers (NVDA, JAWS, VoiceOver) have not been tried. The structure depends on
  `aria-owns`, which Safari supports less well than Chrome and Firefox.
- **Not the keyboard of the grid pattern**: there every cell is reached with the arrow keys and only
  one cell is a stop of Tab. Here every cell input is a stop of Tab for the browser (the grid moves
  the focus on Tab itself), and the plain arrow keys move the caret in the input, Alt+arrows move
  between the cells, Alt+Shift+arrows select a range of cells. There is no Home / End / Page Up / Page
  Down / Ctrl+Home in the grid, and no key to select a whole row or column (Shift+Space, Ctrl+Space).
- **Ranges of cells**: only the cells in a range have `aria-selected` (`true`). WAI-ARIA asks for
  `true` or `false` on every cell that can be selected, in a grid with `aria-multiselectable`: the
  grid keeps `aria-multiselectable` for the row selection (the selection mode `'multiple'`), and gives
  the other cells no `false`: every cell of the grid would get a "not selected" state, the way the
  rows have one with a selection mode. Not tried with a screen reader yet, see above. A range
  made with Alt+Shift+arrows is not read out while it grows: the focus stays in the active cell. Only
  the cells on screen are in the dom, so a screen reader reads only those of a large range.
- **Only the rows on screen are in the dom**: a screen reader reading the page (browse mode) reads
  the rows on screen, not row 400. The counts and the indexes say where they are.
- **Group rows by keyboard**: Tab and Alt+arrows skip the group rows, so the expand/collapse button
  is no stop of Tab. A screen reader reaches it (and presses it) in its browse mode, a keyboard alone
  does not.
- **The menus**: the right click menus and `openMenu()` follow the WAI-ARIA menu pattern (roles,
  `aria-checked`, `aria-expanded`, the keys above), checked in Chrome's accessibility tree but not with
  a screen reader yet. A menu has no name of its own (`aria-label`), a submenu is labelled by its item.
  The field and operator pickers of the filter editor and the column chooser are for the mouse, and
  so is the date picker of a date cell or filter - a date can be typed.
- **The footer** (the Clear button, the filter chips) is not on the way of Tab from the cells. A
  screen reader reaches it.
- **Only the first sort column** has `aria-sort`; the number of a column in a sort on several
  columns is shown, but not read out.
- **The column numbers** under the filters are hidden: selecting a column is for the mouse, and a
  selected column is not read out.
- **The two scrollbars** are elements of their own, Chrome makes them stops of Tab (an element that
  scrolls and has nothing focusable in it); they have no name.
- `setSelectionMode()` shows (`aria-multiselectable`, `aria-selected`) on the next render of the rows:
  a click or `refresh()` (a scroll only renders the rows that scroll in).
