# Menus

The grid has three right click menus:

- the **row menu**, on a cell: copy, filter on the value, dimmed values, paste, clear, delete, a
  summary
- the **header menu**, on a header label: pin, hide, the column chooser, sizes, grouping
- the **filter menu**, on a header filter: clear, is blank, the filter editor, the operator, the
  value list

Each is a list of entries with ids. The `menus` hook changes them: hide entries, reorder them,
change their labels, add your own. `openMenu()` opens a menu of your own, in the same style.

## How a menu opens and closes

Every menu of the grid - the three right click menus, `openMenu()`, the column chooser, the field
and operator pickers of the filter editor and the date picker - is a popover (`popover="manual"`):
the browser shows it in the top layer, over everything on the page. A container with
`overflow: hidden` does not cut it off, and no z-index puts something over it. It is on
`document.body`, or inside the `<dialog>` (the filter editor, or one of yours) or the popover of yours
that the element it opens from is in: everything outside a modal dialog is inert, a menu there could
not be clicked. A menu has the classes `simple-html-grid simple-html-grid-popover`.

- There is one menu at a time: opening one closes the one before.
- It closes on a click outside it, on Esc, when another menu opens, on scroll (with
  `autoRemoveContextMenuOnScrollEvent: true`) and when the grid leaves the page. Clicking an item
  closes it too, then runs the item's action; a click in a block does not.
- An item does not take the focus: it stays on the cell the menu was opened from. When the focus is
  in the menu as it closes - a search field - it goes back to the element that had it when the menu
  opened.
- The column chooser is a panel more than a menu: it stays open while you drag columns from it into
  the header, and when another menu opens. It closes with its Close button, Esc in its search field,
  and when the grid leaves the page.

Why `manual` and not `auto`, which would close it on a click outside and Esc by itself: where the
browser sends `contextmenu` on the button press (macOS, Linux), the pointerup that follows is outside
the menu, and an `auto` popover would be closed by it the moment a right click opened it. So the grid
closes its menus itself, the same way everywhere.

## Changing the grid's menus

The `menus` hook has a function per menu: `row`, `header` and `filter`. It gets the grid's own
entries (`defaults`) and what the menu was opened on (`context`), and returns the entries to show.
It is called every time the menu opens. Like the other [hooks](02-grid-config.md#hooks) it is given
next to the config, not in it: the config stays plain JSON.

```ts
import { createGrid, type GridConfig, type GridHooks, isGroupRow } from '@simple-html/grid';

const config: GridConfig = {
    layout: { center: [{ fields: ['name'], width: 150 }, { fields: ['age'], width: 80 }] }
};

const hooks: GridHooks = {
    menus: {
        row: (defaults, context) => [
            // hide built-in entries by id: here the summary
            ...defaults.filter((entry) => !entry.id.startsWith('row.summary')),
            // add your own
            { type: 'section', id: 'my.section', label: 'Row:' },
            {
                id: 'my.logRow',
                label: 'Log row',
                visible: () => !isGroupRow(context.row),
                action: () => console.log(context.field, context.row)
            }
        ],
        // reorder: the value list first
        filter: (defaults) => [
            ...defaults.filter((entry) => entry.id === 'filter.values'),
            ...defaults.filter((entry) => entry.id !== 'filter.values')
        ],
        // relabel
        header: (defaults) => defaults.map((entry) => (entry.id === 'header.column.hide' ? { ...entry, label: 'Hide column' } : entry))
    }
};

const gridInterface = createGrid(host, { config, datasource, hooks });
```

- `defaults` always has every entry of the menu. The ones that do not apply here have a `visible`
  callback that hides them: paste and clear on a readonly cell, delete in a readonly grid, the
  summary of a column that is not a number, the operators of another type.
- A section header or a separator is shown as long as it is in the list: hide it together with the
  entries under it.
- The entries in `defaults` are new objects every time, change them as you like. Their labels are
  the texts of their ids, already looked up: to translate the menus use the texts (see
  [Texts](12-texts.md)), the hook is for changes in one menu.
- `updateHooks({ menus })` changes the functions while the grid is shown,
  `updateHooks({ menus: undefined })` gives back the defaults.

```sample context-menu
```

## Entries

A `MenuEntry` is one of:

| entry | shown as |
| --- | --- |
| `{ id, label, action, hint?, visible?, disabled?, selected? }` - a `MenuItem` | an entry to click. `type: 'item'` can be left out |
| `{ type: 'section', id, label, visible? }` - a `MenuSection` | a section header with a line under it, `Copy:` |
| `{ type: 'separator', id, visible? }` - a `MenuSeparator` | a dashed line |
| `{ type: 'block', id, element, visible? }` - a `MenuBlock` | your element, as it is |

- Clicking an item closes the menu, then calls `action(context)`.
- `hint` is shown after the label, in italics and in parentheses: `Paste cell (selected rows)`.
- `visible(context)`: `false` leaves the entry out. `disabled(context)`: `true` shows the item greyed
  out, a click does nothing. `selected(context)`: `true` marks it as the one picked now. They are
  called when the menu opens.
- Labels are shown as they are given. The grid's own come from the texts, by the id of the entry,
  and its section labels end with a colon.
- Every entry is rendered with its id in a `data-menu-id` attribute, for css and tests. A disabled
  item has the class `simple-html-grid-menu-item-disabled`.

Every callback gets a `MenuContext`:

| field | what it is |
| --- | --- |
| `menu` | `'row'`, `'header'`, `'filter'` or `'custom'` (opened with `openMenu()`) |
| `field` | the field of the cell the menu was opened on. `''` for `openMenu()` |
| `row` | row menu: the cell's row. Header and filter menus: the first displayed row (a group row when grouped, `undefined` without rows). `openMenu()`: `undefined` |
| `rowIndex` | the index of `row` in the displayed rows: 0 in the header and filter menus, -1 for `openMenu()` |
| `cell` | the cell the menu was opened on, `undefined` for `openMenu()` |
| `gridInterface` | the grid |
| `datasource` | the grid's datasource |

## The built-in ids

`MENU_IDS` lists the ids of every built-in entry, per menu, in the order the menus show them. A
section is `menu.section`, the entries under it `menu.section.entry`. The ids stay the same between
versions, so a menu changed by id keeps working.

The ids are the ids of the texts too: the label of `row.copy.cell` is the text `row.copy.cell`, its
hint `<id>.hint`. Change them with `setTexts()` or the grid's `texts`, see [Texts](12-texts.md#row-menu).
The "shown as" below is the English text.

### Row menu (`MENU_IDS.row`)

| id | shown as | shown when |
| --- | --- | --- |
| `row.edit` | Edit: - first in the menu | the grid is editable |
| `row.edit.undo` | Undo last change (Ctrl+Z): `datasource.undo()`, see [Undo and redo](05-editing.md#undo-and-redo). Greyed out when there is nothing to undo | the grid is editable |
| `row.edit.redo` | Redo (Ctrl+Y): `datasource.redo()`. Greyed out when there is nothing to redo | the grid is editable |
| `row.edit.revertCell` | Undo cell edit: the cell's original value, see [Reverting a cell or a row](05-editing.md#reverting-a-cell-or-a-row). Greyed out when the cell is not edited | the grid is editable |
| `row.edit.revertRow` | Undo row edits: the row right clicked back to its original values, its deletion mark taken off - no selection needed. Greyed out when the row is not edited or marked | the grid is editable |
| `row.edit.revertRows` | Undo row edits (selected rows): the selected rows back, deletion marks taken off. Greyed out when no selected row is edited or marked | the grid is editable |
| `row.copy` | Copy: | |
| `row.copy.cell` | Cell Value | |
| `row.copy.column` | Column (selected rows) | |
| `row.copy.row` | Row (selected rows) | |
| `row.copy.selectedColumns` | Row (selected rows/col): the selected columns, every column when none is selected | |
| `row.copy.range` | Range: the last range of cells, as Ctrl+C copies it - see [Selection and clipboard](17-selection-and-clipboard.md#copy) | there are ranges of cells |
| `row.filter` | Filter: | |
| `row.filter.replace` | Replace filter (all) | |
| `row.filter.add` | Add to filter (and) | |
| `row.view` | View: | |
| `row.view.dimRepeatedValues` | Use dimmed values, with a ✓ when it is on | |
| `row.view.changedOnly` | Changed rows only, with a ✓ when it is on: the new, edited and deleted rows of the filter, see [Changed rows only](05-editing.md#changed-rows-only) | |
| `row.paste` | Paste: | the grid and the cell are editable, or the grid is and there are ranges of cells |
| `row.paste.cell` | Paste cell (selected rows) | the grid and the cell are editable |
| `row.paste.range` | Paste range: the clipboard as Ctrl+V pastes it with ranges - one value into every cell of them, a block from the top left of the last one. Reads the clipboard with `navigator.clipboard.readText()`, the browser may ask the user first | the grid is editable, there are ranges of cells |
| `row.clear` | Clear: | the grid and the cell are editable, or the grid is and there are ranges of cells |
| `row.clear.cell` | Clear cell (selected rows) | the grid and the cell are editable |
| `row.clear.range` | Clear range: every cell of the ranges, as Delete | the grid is editable, there are ranges of cells |
| `row.delete` | Delete: | the grid is editable |
| `row.delete.rows` | Rows (selected rows): marks them for deletion, see [Deleting rows](05-editing.md#deleting-rows). Greyed out when no selected row is left to mark | the grid is editable |
| `row.delete.undo` | Undo (selected rows): takes the mark off | the grid is editable, and a selected row is marked for deletion |
| `row.summary` | Summary: | a number field |
| `row.summary.count` | Count: the number of selected rows. A click copies the value | a number field |
| `row.summary.sum` | Sum: of the selected rows' numbers, `datasource.aggregate(field, 'sum', rows)`. With two decimals at most, as max, min and avg | a number field |
| `row.summary.max` | Max: the largest number | a number field |
| `row.summary.min` | Min: the smallest number, 0 included | a number field |
| `row.summary.avg` | Avg: the average of the numbers, a blank is not counted | a number field |
| `row.size` | Size: | |
| `row.size.fitColumn` | Fit column to this cell: the column as wide as the cell's text, `gridInterface.fitColumns([field], { rows: [row] })`. See [Column widths and row heights](02-grid-config.md#column-widths-and-row-heights) | |
| `row.size.fitRow` | Fit row height: the row right clicked as high as its multiline cells need, `fitRows(row)` | |
| `row.size.fitRows` | Fit row height (selected rows): the selected rows and the rows of the ranges of cells | rows are selected, or there are ranges of cells |
| `row.size.fitAllRows` | Fit all rows: every row the filter lets through, `fitRows()` | |
| `row.size.resetRow` | Reset row height: the row right clicked, `resetRowHeights(row)`. Greyed out when it has the height of the layout | |
| `row.size.resetAllRows` | Reset all row heights: `resetRowHeights()`. Greyed out when no row has a height of its own | |
| `row.export` | Export: | |
| `row.export.excel` | Excel, all rows: `gridInterface.downloadExcel()`, an .xlsx file, see [Export](15-export.md) | |
| `row.export.excelSelected` | Excel, selected rows: `downloadExcel('export.xlsx', { rows: 'selected' })`. Greyed out when no row is selected | |

### Header menu (`MENU_IDS.header`)

| id | shown as | shown when |
| --- | --- | --- |
| `header.column` | Column: | |
| `header.column.pinLeft` | Pin left | not pinned left |
| `header.column.pinLeftCopy` | Pin left (copy): pinned, and kept where it is | not pinned left |
| `header.column.pinRight` | Pin right | not pinned right |
| `header.column.pinRightCopy` | Pin right (copy) | not pinned right |
| `header.column.unpin` | Unpin | pinned |
| `header.column.hide` | Hide | |
| `header.column.removeSorting` | Remove sorting: keeps the sort of the grouped fields | |
| `header.column.chooserSeparator` | a line | |
| `header.column.chooser` | Column chooser: every field, drag one into the header | |
| `header.size` | Size: | |
| `header.size.column` | Fit column width: to its content and its label, `gridInterface.fitColumns([field])` | |
| `header.size.all` | Fit all columns: `fitColumns()` | |
| `header.size.resetColumn` | Reset column width: the width of the config, `resetColumnWidths([field])` | |
| `header.size.resetAll` | Reset all column widths: `resetColumnWidths()` | |
| `header.aggregate` | Aggregate: | |
| `header.aggregate.sum` | Sum - a toggle with a ✓ when on: the column's sum in the group rows and the totals row, see [Aggregates](18-aggregates.md) | a number field |
| `header.aggregate.avg` | Average, a toggle | a number field |
| `header.aggregate.min` | Min, a toggle | a number field |
| `header.aggregate.max` | Max, a toggle | a number field |
| `header.aggregate.count` | Count, a toggle: the values that are not blank | |
| `header.aggregate.totalsRow` | Totals row, a toggle | |
| `header.grouping` | Grouping: | |
| `header.grouping.expandAll` | Expand all | |
| `header.grouping.collapseAll` | Collapse all | |
| `header.grouping.clear` | Clear all: no grouping | |

### Filter menu (`MENU_IDS.filter`)

| id | shown as | shown when |
| --- | --- | --- |
| `filter.filter` | Filter: | |
| `filter.filter.clear` | Clear Filter: the column's conditions | |
| `filter.filter.clearAll` | Clear All Filters | |
| `filter.filter.blankSeparator` | a line | |
| `filter.filter.isBlank` | Set "Is Blank" | |
| `filter.filter.isNotBlank` | Set "Is Not Blank" | |
| `filter.filter.advancedSeparator` | a line | |
| `filter.filter.advanced` | Advanced Filter: opens the filter editor | |
| `filter.operator` | Set Operator: | not a boolean field |
| `filter.operator.greaterThanOrEqualTo` | Greater than or equal | a number, date or datetime field |
| `filter.operator.lessThanOrEqualTo` | Less than or equal | a number, date or datetime field |
| `filter.operator.equal` | Equal | not a boolean field |
| `filter.operator.notEqualTo` | Not Equal | a text field |
| `filter.operator.contains` | Contains | a text field |
| `filter.values` | the value list: a search box, a checkbox per value, "Run Search". One `MenuBlock`, its texts are `filter.values.*` | a text field |

See [Filtering](06-filtering.md#the-header-filter-menu) for what the filter menu's entries do.

```ts
import { type GridHooks, MENU_IDS } from '@simple-html/grid';

// a row menu with the copy entries only
const hooks: GridHooks = {
    menus: { row: (defaults) => defaults.filter((entry) => entry.id.startsWith('row.copy')) }
};

MENU_IDS.row.includes('row.paste.cell'); // true
```

## A menu of your own: `openMenu()` and `closeMenu()`

`gridInterface.openMenu(at, entries)` opens a menu of your own, with the same entries:

```ts
gridInterface.on('cell-click', (data) => {
    if (data.attribute !== 'fruit') {
        return;
    }
    const pick = (fruit: string | null) => {
        data.rowData.fruit = fruit;
        gridInterface.refresh();
    };
    gridInterface.openMenu(data.originalEvent, [
        { type: 'section', id: 'fruit', label: 'Pick a fruit:' },
        { id: 'fruit.apple', label: 'Apple', action: () => pick('Apple') },
        { id: 'fruit.banana', label: 'Banana', action: () => pick('Banana') },
        { type: 'separator', id: 'fruit.separator' },
        { id: 'fruit.none', label: 'None', hint: 'clears the cell', action: () => pick(null) }
    ]);
});
```

`at` is where it opens:

- a mouse event: its top left corner at the mouse
- a `MenuPosition`, `{ x, y }` in px from the window's left and top edges: its top left corner there
- an element: under the element, lined up with its left edge

The menu is kept in the window, 4px from its edges - every menu of the grid, the long row menu too:
it opens below the point, above it when there is no room below, and next to it (on its right, or on
its left when there is no room on the right) when there is room neither below nor above. A menu taller
than the window gets the window's height and scrolls.

- There is one menu at a time: opening one closes the one before, the grid's own too.
- The grid closes it as its own menus: on a click outside it, on Esc, when another menu opens, on
  scroll (with `autoRemoveContextMenuOnScrollEvent: true`) and when the grid leaves the page, see
  [above](#how-a-menu-opens-and-closes). Opened from a click handler, it stays open: that click does
  not count as a click outside.
- Opened from an element in a `<dialog>` of yours, or a popover, it is put in that element, so it can
  be used there.
- `gridInterface.closeMenu()` closes the open menu from code.
- The callbacks of its entries get a context with `menu: 'custom'` and no field, row or cell: let
  them use what they were made for, as `pick` above.
- It does nothing while the grid is not on the page.

## A dropdown grid as a block

A `MenuBlock` shows an element of yours in the menu: a second grid as a dropdown, a form, a color
picker. The grid puts it on the page, places it and closes it as any menu - Esc too, also when the
focus is in the block. A click in the block does not close the menu: call `closeMenu()` when the user
has picked. The dropdown grid's own menus open over it.

```ts
import { Datasource, type GridConfig, type GridElement, GridInterface } from '@simple-html/grid';

// in the main grid's config:
// readonly: false, columns: { company: { readonly: true, focusButton: 'SHOW_IF_GRID_NOT_READONLY' } }

const companies = new Datasource();
companies.setData([{ name: 'ACME' }, { name: 'GLOBEX' }, { name: 'INITECH' }]);

const dropdownConfig: GridConfig = {
    panelHeight: 0,
    footerHeight: 10,
    layout: { center: [{ fields: ['name'], width: 250 }] }
};

gridInterface.on('cell-focus-button-click', (data) => {
    if (data.attribute !== 'company') {
        return;
    }

    const dropdown = document.createElement('simple-html-grid') as GridElement;
    dropdown.style.width = '280px';
    dropdown.style.height = '250px';
    dropdown.connectInterface(new GridInterface(dropdownConfig, companies));

    // a click on a company picks it: the cell's click made its row current
    dropdown.addEventListener('click', (event) => {
        if (event.target instanceof HTMLElement && event.target.classList.contains('simple-html-grid-cell-input')) {
            gridInterface.closeMenu();
            data.rowData.company = companies.currentEntity?.name;
            gridInterface.refresh();
            data.target.focus();
        }
    });

    gridInterface.openMenu(data.cell, [{ type: 'block', id: 'company-picker', element: dropdown }]);
});
```

Give the element its size, the menu's frame gives it a border and a shadow. The column is readonly,
so the dropdown is the only way to change the value. `allowPasteClearOnly: true` instead of
`readonly` keeps paste and clear working too.

```sample dropdown-grid
```
