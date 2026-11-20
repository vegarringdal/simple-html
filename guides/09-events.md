# Events

The datasource and the grid interface both send events. The datasource's are about the rows: they
changed, were sorted, filtered or grouped, the selection or the current row changed. The grid's are
about the cells: clicks, focus, copy and paste from the row menu.

## Subscribing: `on()`

`on(name, handler)` subscribes to one event. The handler gets the event's payload, typed from the
event name. `on()` returns a function that unsubscribes:

```ts
const offFiltered = datasource.on('collection-filtered', (data) => {
    console.log('filtered by', data.info, '-', datasource.getDataRows().length, 'rows left');
});

const offClick = gridInterface.on('cell-click', (data) => {
    console.log(data.attribute, 'clicked in row', data.row, data.rowData);
});

// later
offFiltered();
offClick();
```

- The handler stays subscribed until you call the function `on()` returned. What it returns is
  ignored.
- To listen once, unsubscribe in the handler:
  `const off = datasource.on('select', () => { off(); ... })`.
- The same function subscribed twice to the same event is called once.
- An error thrown by a handler is not caught: it stops the handlers after it for that event.
- `gridInterface.destroy()` unsubscribes every handler of the grid. The handlers on the datasource
  stay, the datasource lives on.

To type a handler you write on its own, use `EventHandler` with the event map:

```ts
import type { DatasourceEvents, EventHandler, GridEvents } from '@simple-html/grid';

const onSelect: EventHandler<DatasourceEvents['select']> = (data) => {
    console.log('row', data.row, 'selected by', data.info);
};
const onPaste: EventHandler<GridEvents['paste']> = (data) => {
    console.log('pasted into', data.attribute, data.entity);
};

datasource.on('select', onSelect);
gridInterface.on('paste', onPaste);
```

```sample events
```

## Datasource events

`DatasourceEvents` lists them. An event with nothing to tell sends an empty object.

| event | sent when | payload |
| --- | --- | --- |
| `collection-changed` | rows were added, replaced or removed | `{ added?, removed?, info?, data? }`, see below |
| `collection-filtered` | the displayed rows were rebuilt | `{ info }`, see below |
| `collection-sorted` | `sort()` ran | `{}` |
| `collection-grouped` | the grouping changed: `group()`, `removeGroup()` | `{ info: 'group', groupings }` or `{ info: 'removeGroup' }` |
| `collection-expand` | `expandGroup()` expanded one or every group | `{}` |
| `collection-collapse` | `collapseGroup()` collapsed one or every group | `{}` |
| `current-entity` | `currentEntity` was set: a row was clicked or selected, or `setRowAsCurrentEntity()`. Also when `setData()` set it to `null`, the current row no longer in the data (after `collection-changed`) | `{}`, read `datasource.currentEntity` |
| `selection-change` | the selected rows changed. `deselectAll()` sends it only with `{ notify: true }`, `selectAll()` only in the `'multiple'` selection mode | `{}`, read `datasource.getSelectedRows()` |
| `select` | a row was selected from code, the grid scrolls to it | `{ info, row }` |

`collection-changed`:

| method | payload |
| --- | --- |
| `setData(rows)` | `{ added: false }` |
| `setData(rows, { add: true })`, `addNewEmpty()` | `{ added: true }` |
| `removeData(rows)` | `{ removed: true, info: 'removeData', data: rows }` |
| `removeAllData()` | `{ removed: true, info: 'removeData', data: null }` |
| `clearMarkedForDeletion()` | `{ removed: true, info: 'clearMarkedForDeletion' }` |

`collection-filtered`, by `info`:

| `info` | sent by |
| --- | --- |
| `'filter'` | `filter()`, `reloadDatasource()` |
| `'resetData'` | `resetData()`, `resetDataSelectionOnly()` |
| `'markForDeletion'` | `markForDeletion()`, `markAllForDeletion()` |
| `'unmarkForDeletion'` | `unmarkForDeletion()`, `unmarkAllForDeletion()` |
| `'acceptChanges'` | `acceptChanges()`. It sends no `collection-changed`, also when it removed the rows marked for deletion |
| `'__internalUpdate, forced'` | `setData(rows, { refilter: false })` and `addNewEmpty()` while there is no filter, sort or grouping, before their `collection-changed`. A `setData()` that runs the filter (the default) sends only `collection-changed` |

`select`: `row` is the index in the displayed rows (`getRows()`), 0 based. `info` is
`'select-first'` (from `select(row, { notify: true })` and `selectFirst()`), `'select-prev'`,
`'select-next'` or `'select-last'`.

```ts
datasource.on('selection-change', () => {
    const count = datasource.getSelectedRows().length;
    document.getElementById('delete-button')!.toggleAttribute('disabled', count === 0);
});

datasource.on('collection-grouped', (data) => {
    if (data.info === 'group') {
        console.log('grouped on', data.groupings?.map((group) => group.attribute));
    }
});
```

There is no event for an edit of a cell, see [Editing](05-editing.md#how-the-user-edits).

## Grid events

`GridEvents` lists them. Most send the cell the event happened on, a `GridCellEventData`:

| field | what it is |
| --- | --- |
| `cell` | the cell element |
| `row` | the index of the row in the displayed rows (`datasource.getRows()`), 0 based. 0 for a header cell |
| `column` | the index of the column in its part of the grid, 0 based |
| `celno` | the index of the cell in a column with stacked fields, 0 based |
| `colType` | the part of the grid: `'left-pinned'`, `'middle-pinned'`, `'right-pinned'` ... |
| `cellType` | `'row-cell'` for a data cell, `'filter'` for a header filter |
| `attribute` | the field of the cell |
| `rowData` | the cell's row, always a data row |

### Cell events

| event | sent when | payload |
| --- | --- | --- |
| `cell-click` | a data cell was clicked. Sent after the click, so the row is current already | the cell, `originalEvent`: the click |
| `cell-row-focus` | a data cell got focus, by a click or the keyboard | the cell, `originalEvent`: the focus event |
| `cell-focus-button-click` | the `...` button of a cell was clicked, or Space pressed in the cell | the cell, `target`: the cell's input, `originalEvent` |
| `cell-header-focus` | a header filter got focus | the cell, `rowData`: see below |

`cell-click` and `cell-row-focus` are not sent for a checkbox (boolean) cell.

The focus button is shown in the focused cell by the column option `focusButton` (`'ALWAYS'`,
`'SHOW_IF_GRID_NOT_READONLY'` or `'SHOW_IF_GRID_AND_CELL_NOT_READONLY'`). Use it to open a picker of
your own, and focus `target` to give the focus back to the cell:

```ts
gridInterface.on('cell-focus-button-click', (data) => {
    if (data.attribute === 'company') {
        console.log('pick a company for', data.rowData);
        data.target.focus();
    }
});
```

`cell-header-focus` sends as `rowData` the first displayed row, not a row of the header: a group
row when the datasource is grouped, `undefined` when there are no rows. Check it with
`isGroupRow()`.

### Menu events

The row menu (right click a cell) sends these when the user picks an entry:

| event | entry | payload |
| --- | --- | --- |
| `copy-cell` | Copy: Cell Value | the cell |
| `copy-column` | Copy: Column (selected rows) | the cell |
| `copy-row` | Copy: Row (selected rows) | the cell |
| `copy-row-col` | Copy: Row (selected rows/col) | the cell |
| `paste` | Paste: Cell (selected rows) | the cell, without `rowData`. `entity`: the row pasted into. Sent once per row |
| `clear` | Clear: Cell (selected rows) | the cell |

`filter-operator-change` is sent when the user picks an operator in a header filter's menu, after
the filter ran with it. It sends `{ field, operator, column, rebuildHeader }`: `column` is the
column's options as the grid uses them, change them and call `rebuildHeader()` to show it:

```ts
gridInterface.on('filter-operator-change', (data) => {
    data.column.placeholderFilter = data.operator; // show the operator in the empty filter cell
    data.rebuildHeader();
});
```

### `grid-connected`

`grid-connected` is sent when a grid element connects to the interface: `connectInterface()`, or
the element is put back on the page. `createGrid()` connects before it returns, so a handler
subscribed after `createGrid()` does not hear the first one.

## The date picker

A `DateInterface` - a date picker of your own, outside a grid - sends `date-select` when the user
picks a date: the "Use" button sends the date and time, "Clear" sends `null`. Removing its element
from the page unsubscribes every handler.

```ts
import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
import '@simple-html/grid/date.css';

const config: IDateConfig = {
    datepicker: true,
    datepickerDate: new Date(),
    monthsToShow: 1,
    monthColumns: 1,
    startMonth: 0,
    startYear: 2026,
    monthHeader: [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ],
    weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    weekStart: 1,
    showWeek: true,
    isoWeek: true,
    rowHeight: 22,
    monthWidth: 230,
    monthMargin: 10,
    hideDimmedDates: false,
    showYearInMonth: false,
    headerTitle: ''
};

const dateInterface = new DateInterface(config);
const element = document.createElement('simple-html-date') as DateElement;
element.classList.add('simple-html-date');
element.connectInterface(dateInterface);
host.appendChild(element);

dateInterface.on('date-select', (date) => {
    console.log(date ? date.toISOString() : 'cleared');
});
```

The date pickers the grid opens in date cells and date header filters are its own: they write the
date into the cell or the filter, you do not subscribe to them.
