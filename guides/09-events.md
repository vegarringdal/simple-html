# Events

The datasource and the grid interface both send events. The datasource's are about the rows: they
changed, were sorted, filtered or grouped, the selection or the current row changed. The grid's are
about the cells: clicks, focus, the ranges of cells and the columns selected, copy and paste from the
row menu.

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
| `current-entity` | `currentEntity` was set: a row was clicked or selected, or `setRowAsCurrentEntity()`. Also when `setData()` set it to `null`, the current row no longer in the data, and when a method that removes rows removed it (`removeData()`, `acceptChanges()`, `resetData()` ...) - after their own event | `{}`, read `datasource.currentEntity` |
| `selection-change` | the selected rows changed. `deselectAll()` sends it only with `{ notify: true }`, `selectAll()` only in the `'multiple'` selection mode. Also when a method that removes rows removed a selected one, after its own event | `{}`, read `datasource.getSelectedRows()` |
| `select` | a row was selected from code, the grid scrolls to it | `{ info, row }` |
| `validate` | `validate()` ran, the grid shows the errors. An edit is validated without an event | `{ errors }`, what `validate()` returned |
| `history-changed` | the undo history changed: read `canUndo()` and `canRedo()`. Sent by every datasource on the same `DataContainer`, the history is the container's | `{ info }`, see below |
| `rows-changed` | values of rows changed - set from code, by the user, by undo/redo, a revert, `upsert()` - or a row's deletion mark, server error or conflict. Once the code that changed them is done (a microtask), one event for all of them. The grid renders the rows on screen, see [Live data](16-live-data.md#values-show-on-their-own). Sent by every datasource on the same `DataContainer` | `{ rows, fields }`: the rows, and `fields.get(row)` the fields set on each |
| `conflicts-changed` | the conflicts of `upsert()` changed: one came or went. Once per run of code, after `rows-changed`. Sent by every datasource on the same `DataContainer` | `{}`, read `datasource.getConflicts()` |

`collection-changed`:

| method | payload |
| --- | --- |
| `setData(rows)` | `{ added: false }` |
| `setData(rows, { add: true })`, `addNewEmpty()` | `{ added: true }` |
| `removeData(rows)` | `{ removed: true, info: 'removeData', data: rows }` |
| `removeAllData()` | `{ removed: true, info: 'removeData', data: null }` |
| `clearMarkedForDeletion()` | `{ removed: true, info: 'clearMarkedForDeletion' }` |
| `upsert(rows)` | `{ info: 'upsert', added }`, and `removed: true` when it removed rows. Only when it added or removed rows or the displayed rows changed (filter, sort order, groups): an upsert that only changed values sends `rows-changed` only |

`collection-filtered`, by `info`:

| `info` | sent by |
| --- | --- |
| `'filter'` | `filter()`, `reloadDatasource()` |
| `'resetData'` | `resetData()`, `resetDataSelectionOnly()` |
| `'markForDeletion'` | `markForDeletion()`, `markAllForDeletion()` |
| `'unmarkForDeletion'` | `unmarkForDeletion()`, `unmarkAllForDeletion()` |
| `'acceptChanges'` | `acceptChanges()`. It sends no `collection-changed`, also when it removed the rows marked for deletion |
| `'__internalUpdate, forced'` | `setData(rows, { refilter: false })` and `addNewEmpty()` while there is no filter, sort or grouping, before their `collection-changed`. A `setData()` that runs the filter (the default) sends only `collection-changed` |

`history-changed`, by `info` - see [Undo and redo](05-editing.md#undo-and-redo):

| `info` | sent when |
| --- | --- |
| `'edit'` | a step was recorded: an edit, what was typed in a cell, a paste, a clear, a (un)mark for deletion, a revert. Sent once the code that made it is done (in a microtask), one event per step. Also when what was typed in a cell went back to the value it started from, and its step was dropped |
| `'undo'` | `undo()`. The grid renders its cells again |
| `'redo'` | `redo()`. The grid renders its cells again |
| `'clear'` | the history was emptied: `clearHistory()`, `setData()` without `add`, `removeAllData()`, `resetData()`, `acceptChanges()`. Only when there was something in it |
| `'remove'` | rows were removed for good (`removeData()`, `clearMarkedForDeletion()`, a new row `resetDataSelectionOnly()` removed, `upsert(rows, { removeMissing: true })`) and their changes left the history. Or `upsert()` gave an edited field the server's value as its original, and a change of the history that does nothing now was dropped |

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

`rows-changed` has the rows an edit changed, and the fields: an edit of a cell, by the user or from
code, is in it - see [Live data](16-live-data.md). `history-changed` says a step was recorded, not
what it is.

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
| `cell-dblclick` | a data cell was double-clicked. Sent after it - after the `cell-click` of its two clicks - and after what the grid does with it (the editor of a multiline cell, a lookup's list) | the cell, `originalEvent`: the dblclick |
| `cell-row-focus` | a data cell got focus, by a click or the keyboard | the cell, `originalEvent`: the focus event |
| `cell-focus-button-click` | the `...` button of a cell was clicked, or Space pressed in the cell | the cell, `target`: the cell's input, `originalEvent` |
| `cell-header-focus` | a header filter got focus | the cell, `rowData`: see below |

`cell-click`, `cell-dblclick` and `cell-row-focus` are not sent for a checkbox (boolean) cell.

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
| `copy-cell` | Copy › Cell Value | the cell |
| `copy-column` | Copy › Column (selected rows) | the cell |
| `copy-row` | Copy › Row (selected rows) | the cell |
| `copy-row-col` | Copy › Row (selected rows/col) | the cell |
| `paste` | Paste: Paste cell (selected rows) | the cell, without `rowData`. `entity`: the row pasted into. Sent once per row |
| `clear` | Clear: Clear cell (selected rows) | the cell |

The entries of the ranges of cells (Range, Paste range, Clear range) and Ctrl+C / Ctrl+V / Delete on
a range send none of these: the cells changed are in `rows-changed`, see
[Selection and clipboard](17-selection-and-clipboard.md).

`filter-operator-change` is sent when the user picks an operator in a header filter's menu, after
the filter ran with it. It sends `{ field, operator, column, rebuildHeader }`: `column` is the
column's options as the grid uses them, change them and call `rebuildHeader()` to show it:

```ts
gridInterface.on('filter-operator-change', (data) => {
    data.column.placeholderFilter = data.operator; // show the operator in the empty filter cell
    data.rebuildHeader();
});
```

### `range-change`

`range-change` is sent when the ranges of cells change: the user dragged over the cells, Shift+clicked,
Ctrl/Cmd+clicked, pressed Alt+Shift+arrows or Esc, moved to another cell or typed in one, or
`setRanges()` / `clearRanges()` were called. Also when the grid cleared them because the displayed rows
or the layout changed. While the mouse drags it is sent each time the range reaches another cell; it is
not sent when nothing changed. The payload is `{ ranges }`, what `getRanges()` gives now - `[]` when
they were cleared. See [Selection and clipboard](17-selection-and-clipboard.md#the-api).

```ts
gridInterface.on('range-change', ({ ranges }) => {
    const last = ranges[ranges.length - 1];
    console.log(last ? `rows ${last.fromRow}-${last.toRow}, ${last.fromField} to ${last.toField}` : 'no cells selected');
});
```

### `column-selection-change`

`column-selection-change` is sent when the selected columns change: the user clicked a column number
(the row of numbers under the header filters, Ctrl/Cmd+click and Shift+click too) or pressed Esc on
one, or `selectColumns()` was called. Also when the grid cleared them because the fields of the
layout changed - a column moved, pinned, hidden or added. Not when nothing changed. The payload is
`{ columns, fields }`: the numbers, what `getSelectedColumns()` gives, and their fields. See
[Selection and clipboard](17-selection-and-clipboard.md#the-api-of-the-columns).

```ts
gridInterface.on('column-selection-change', ({ columns, fields }) => {
    console.log(columns.length ? `columns ${columns.join(', ')}: ${fields.join(', ')}` : 'no column selected');
});
```

### `find-change`

`find-change` is sent when what Find (Ctrl+F in the grid) has found changes: the bar opened or closed,
the typing stopped, the current match moved, *Match case* or *Filter rows* turned on or off. The payload
is what `getFind()` gives.

### `views-change`

`views-change` is sent when the list of named views changes: the user saved a view (over the one shown,
or as a new one), renamed or deleted one, or picked the default view - in the views menu of the footer,
or your code called `saveView()`, `saveViewAs()`, `renameView()`, `deleteView()` or `setDefaultView()`.
The payload is `{ views }`, what `getViews()` gives: store it, and give it back as `GridConfig.views`
next time. Not sent by `setViews()` and `updateConfig({ views })` - you gave the list - nor when the
user only switches views. See [Views](03-state.md#views).

```ts
gridInterface.on('views-change', ({ views }) => {
    // the readonly views are yours, they come from the config every time
    const own = views.filter((view) => !view.readonly);
    localStorage.setItem('orders-grid-views', JSON.stringify(own));
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

A range picker - `rangepicker: true` with `datepicker: true` - picks From and To: two months side by
side (one in a window too narrow for two), the first day clicked is From, the next one To. It sends
`range-select`: "Use" sends `[from, to]`, the days at 00:00 - an end not picked is `null`, an open end
- and "Clear" sends `null`. `datepickerRange` is the range it opens on.

```ts
import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';

declare const config: IDateConfig; // as above

const rangeInterface = new DateInterface({
    ...config,
    datepicker: true,
    rangepicker: true,
    datepickerRange: [new Date(2026, 10, 22), new Date(2026, 10, 28)]
});
const rangeElement = document.createElement('simple-html-date') as DateElement;
rangeElement.classList.add('simple-html-date');
rangeElement.connectInterface(rangeInterface);
host.appendChild(rangeElement);

rangeInterface.on('range-select', (range) => {
    if (!range) {
        console.log('cleared');
        return;
    }
    const [from, to] = range;
    console.log(from?.toDateString() ?? 'open', to?.toDateString() ?? 'open');
});
```

The names of the months and days and the buttons are texts, `datePicker.*`: the page's
(`setTexts()`), or the picker's own in `texts` of its config - see [Texts](12-texts.md#date-picker).

The date pickers the grid opens in date cells and date header filters are its own: they write the
date into the cell or the filter, you do not subscribe to them. They show the grid's texts.
