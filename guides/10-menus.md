# Menus

The grid has three right click menus:

- the **row menu**, on a cell: copy, filter on the value, dimmed values, paste, clear, delete, a
  summary
- the **header menu**, on a header label: pin, hide, the column chooser, sizes, grouping
- the **filter menu**, on a header filter: clear, is blank, the filter editor, the operator, the
  value list

Each is a list of entries with ids. The `menus` hook changes them: hide entries, reorder them,
change their labels, add your own. `openMenu()` opens a menu of your own, in the same style.

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
- The entries in `defaults` are new objects every time, change them as you like.
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
- `hint` is shown after the label, in italics and in parentheses: `Cell (selected rows)`.
- `visible(context)`: `false` leaves the entry out. `disabled(context)`: `true` shows the item greyed
  out, a click does nothing. `selected(context)`: `true` marks it as the one picked now. They are
  called when the menu opens.
- Labels are shown as they are given. The grid's own section labels end with a colon.
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

### Row menu (`MENU_IDS.row`)

| id | shown as | shown when |
| --- | --- | --- |
| `row.copy` | Copy: | |
| `row.copy.cell` | Cell Value | |
| `row.copy.column` | Column (selected rows) | |
| `row.copy.row` | Row (selected rows) | |
| `row.copy.selectedColumns` | Row (selected rows/col): the selected columns, every column when none is selected | |
| `row.filter` | Filter: | |
| `row.filter.replace` | Replace filter (all) | |
| `row.filter.add` | Add to filter (and) | |
| `row.view` | View: | |
| `row.view.dimRepeatedValues` | Use dimmed values, with a ✓ when it is on | |
| `row.paste` | Paste: | the grid and the cell are editable |
| `row.paste.cell` | Cell (selected rows) | the grid and the cell are editable |
| `row.clear` | Clear: | the grid and the cell are editable |
| `row.clear.cell` | Cell (selected rows) | the grid and the cell are editable |
| `row.delete` | Delete: | the grid is editable |
| `row.delete.rows` | Rows (selected rows): marks them for deletion, see [Deleting rows](05-editing.md#deleting-rows). Greyed out when no selected row is left to mark | the grid is editable |
| `row.delete.undo` | Undo (selected rows): takes the mark off | the grid is editable, and a selected row is marked for deletion |
| `row.summary` | Summary: | a number field |
| `row.summary.count` | Count: the number of selected rows. A click copies the value | a number field |
| `row.summary.sum` | Sum: of the selected rows | a number field |
| `row.summary.max` | Max: | a number field |
| `row.summary.min` | Min: | a number field |
| `row.summary.avg` | Avg: | a number field |

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
| `header.size.column` | Resize Column: to its content | |
| `header.size.all` | Resize all columns | |
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
| `filter.values` | the value list: a search box, a checkbox per value, "Run Search". One `MenuBlock` | a text field |

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

The menu is kept in the window: it opens above when there is no room below, and moves left when it
sticks out on the right.

- There is one menu at a time: opening one closes the one before, the grid's own too.
- The grid closes it as its own menus: on a click outside it, when another menu opens, on scroll
  (with `autoRemoveContextMenuOnScrollEvent: true`) and when the grid leaves the page. Opened from a
  click handler, it stays open: that click does not count as a click outside.
- `gridInterface.closeMenu()` closes the open menu from code.
- The callbacks of its entries get a context with `menu: 'custom'` and no field, row or cell: let
  them use what they were made for, as `pick` above.
- It does nothing while the grid is not on the page.

## A dropdown grid as a block

A `MenuBlock` shows an element of yours in the menu: a second grid as a dropdown, a form, a color
picker. The grid puts it on the page, places it and closes it as any menu. A click in the block does
not close the menu: call `closeMenu()` when the user has picked.

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
