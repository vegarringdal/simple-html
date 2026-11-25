# Keyboard

You can do almost everything in the grid from the keyboard. This page lists the keys by where you are:
in a cell, a header filter, a menu, the find bar or a dialog.

**One thing to know first**: a cell is like a small text box that is always ready to type in. The arrow
keys, **Home** and **End** move the text cursor inside the cell, as in a spreadsheet cell you are
editing. To move from cell to cell, hold **Alt** with the arrow keys.

**On a Mac**, use **⌘** (Cmd) where this page says **Ctrl**, **⌥** (Option) where it says **Alt**, and
**⇧** for **Shift**: **Ctrl+C** is **⌘C**, **Alt+↓** is **⌥↓**.

Some keys only work if your app lets you edit the grid. They are marked *editing* below.

```tryit keyboard
```

## See every key in the grid

Press **Ctrl+/** anywhere in the grid, also while you type in a cell. Or press **?** where it types
nothing, such as on a read only cell or a column header. Or right click a column header and choose
**Keyboard shortcuts…**.

The **Keyboard shortcuts** dialog lists the keys in groups, the way your computer names them (⌘ and ⌥
on a Mac). Type in its **Search** box to find a key: `undo`, `ctrl`, `f3`. **Esc** closes it.

Your app may have turned this help off.

## Move around

| key | goes to |
| --- | --- |
| **Tab** / **Shift+Tab** | the next / previous cell, then on to the next / previous row |
| **Alt+←** / **Alt+→** | the cell to the left / right |
| **Alt+↑** / **Alt+↓** | the cell above / below. Up from the first row: the header filter |
| **Enter** | the cell below, from a cell you can edit |
| **Alt+Home** / **Alt+End** | the first / last cell of the row |
| **Ctrl+Home** / **Ctrl+End** | the first cell of the first row / the last cell of the last row |
| **Page Up** / **Page Down** | a page of rows up / down, in the same column |
| **Alt+Page Up** / **Alt+Page Down** | a page of columns left / right, in the same row |
| **Ctrl+↑** / **Ctrl+↓** | the edge of the data in the column, as in a spreadsheet: the last filled cell before an empty one |
| **Home** / **End** | the start / end of the text in the cell |
| **Ctrl+←** / **Ctrl+→** | a word left / right in the text of the cell (**⌥←** / **⌥→** on a Mac) |

The keys pass over group rows. **Tab** stops on them, see [Groups](#groups-and-column-headers).

## Edit cells

*Editing* - only if your app lets you edit the grid.

| key | does |
| --- | --- |
| type | changes the value of the cell. There is no need to press a key first |
| **Enter** | goes to the cell below. The value is kept as you typed it |
| **Delete** / **Backspace** | deletes text in the cell. With a block of cells selected: empties them all |
| **Space** | checks or unchecks a checkbox |
| **Enter** or **F2** | in a cell of several lines: opens its editor (also to read a read only one) |
| **Alt+↓** or **F4** | in a cell with a list: opens the list. Typing a letter opens it too |
| **Alt+Enter** | in a link cell: opens the link |
| **Ctrl+D** | fill down: the value of the row above, or of the top row of the selected cells |
| **Ctrl+Z** | undo, and go to the cell that changed |
| **Ctrl+Y** or **Ctrl+Shift+Z** | redo |

See [Editing](08-editing.md).

### The editor of a cell of several lines

| key | does |
| --- | --- |
| **Enter** | a new line |
| **Ctrl+Enter** | saves and closes the editor |
| **Esc** | closes the editor without saving |
| **Tab** / **Shift+Tab** | saves, closes and goes to the next / previous cell |

### The list of a cell

| key | does |
| --- | --- |
| type | searches the list |
| **↑** / **↓**, **Page Up** / **Page Down**, **Home** / **End** | moves in the list |
| **Enter** | picks the value |
| **Tab** | picks the value and goes to the next cell |
| **Esc** | closes the list, nothing picked |

### Dates

Type a date straight into a date cell or a date filter. The date picker that opens on a click is for
the mouse: no key opens it, and the keyboard does not go into it. In the range of a filter menu, type
the date and press **Enter** to filter; **Esc** closes the picker.

## Select cells

| key | does |
| --- | --- |
| **Alt+Shift+arrow** | a block of cells, one cell further each time |
| **Shift+Page Up** / **Shift+Page Down** | the block a page up / down |
| **Alt+Shift+Home** / **Alt+Shift+End** | the block to the first / last cell of the row |
| **Ctrl+Shift+Home** / **Ctrl+Shift+End** | the block to the first / last cell of the grid |
| **Ctrl+Shift+↑** / **Ctrl+Shift+↓** | the block to the edge of the data |
| **Esc** | no block of cells any more |

There is no key to select whole rows or columns. Click the row numbers or column numbers, or use
**Select ›** in the row menu. See [Selecting and copying](09-selecting-and-copying.md).

## Copy, paste, undo and redo

| key | does |
| --- | --- |
| **Ctrl+C** | copies the selected block of cells, or the value of the cell |
| **Ctrl+C** on a column number | copies the selected columns |
| **Ctrl+V** | pastes cells copied in the grid or in a spreadsheet (*editing*) |
| **Ctrl+Z** | undo (*editing*) |
| **Ctrl+Y** or **Ctrl+Shift+Z** | redo (*editing*) |
| **Delete** / **Backspace** on a row number | marks the row, or the selected rows, for deletion (*editing*) |

## Header filters

| key | does |
| --- | --- |
| **Enter** | filters |
| **Tab** / **Shift+Tab** | the next / previous filter. **Tab** on the last one goes to the rows |
| **Alt+←** / **Alt+→** | the filter to the left / right |
| **Alt+↑** | up to the column header |
| **Alt+↓** | down to the first row |
| **Alt+Home** / **Alt+End** | the first / last filter |
| **F4** | choose the operator (=, ≥, contains ...) |
| **Shift+F10** or the **Menu** key | opens the filter menu |

See [Filtering](02-filtering.md).

## Groups and column headers

| where | key | does |
| --- | --- | --- |
| a column header | **Enter** / **Space** | sorts on the column; again for the other direction |
| a column header | **Shift+Enter** / **Shift+Space** | adds the column to the sort |
| a column header | **Shift+F10** or the **Menu** key | opens the header menu |
| a group row | **Enter** / **Space** | expands or collapses the group |

To get to a column header, press **Alt+↑** in its header filter.

## Menus

| key | does |
| --- | --- |
| **Shift+F10** or the **Menu** key | opens the menu of the cell, header, filter or column number you are on |
| **↓** / **↑** | the next / previous item |
| **Home** / **End** | the first / last item |
| a letter | the next item that starts with it |
| **Enter** / **Space** | uses the item, or opens its submenu |
| **→** / **←** | opens / closes a submenu |
| **Esc** | closes the submenu, or the menu |
| **Tab** | closes the menu |

In the filter menu, **Tab** goes on into its list of values (or the From and To of a number or date
column), then **Cancel** and **Apply**. See [Filtering](02-filtering.md).

## Find

| key | does |
| --- | --- |
| **Ctrl+F** | opens the find bar. Again: back to its box |
| **Enter** or **F3** | the next match |
| **Shift+Enter** or **Shift+F3** | the previous match |
| **Alt+C** | **Match case** on or off (not on a Mac) |
| **Tab** | the buttons of the bar: **Match case**, **Filter rows**, previous, next, close |
| **Esc** | closes the find bar and goes to the cell of the match, if there is one |

**Ctrl+F** finds in the grid only while you are in the grid. Outside it, it is the browser's own find.
See [Find](10-find.md).

## The footer and the detail form

After the last cell of the last row, **Tab** goes on to the footer: the views button, the filter
buttons, then the gear ⚙. **Enter** or **Space** uses the button: the views button opens the views
menu, the gear opens **Grid config**.

Then **Tab** goes into the detail form, if it is shown: first the button of its title (**Enter** or
**Space** collapses and expands it), then its left edge (**←** wider, **→** narrower), then its fields.
See [The detail form](15-detail-form.md).

## Dialogs

| key | does |
| --- | --- |
| **Esc** | closes an open menu in the dialog, else the dialog, without applying |
| **Tab** / **Shift+Tab** | the next / previous control |
| **←** / **→**, **Home** / **End** | on the tabs of **Grid config**: the tab before / after, the first / last |
| **↑** / **↓**, a letter | in the list of columns of **Grid config**: another column |
| **Space** | in the fields of the detail form (**Grid config**, **Detail form** tab): the field in the form or out |
| **Alt+↑** / **Alt+↓** | in the fields of the detail form: moves the field up / down |
| **Ctrl+Z** / **Ctrl+Y** | in the filter editor: undo / redo |
| **Ctrl+/** | the keyboard shortcuts |

See [Grid config](14-grid-config.md).
