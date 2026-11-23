import type { Entity, GroupRow } from '../datasource/entity';
import type { FilterExpression, FilterOperator } from '../datasource/filterExpression';
import type { CellRange } from './cellRange';
import type { FindResult } from './findResult';
import type { ColumnConfig } from './gridConfig';
import type { ColType } from './gridFunctions/colType';
import type { HTMLCellElement } from './gridFunctions/HTMLCellElement';
import type { GridView } from './gridView';

/**
 * The cell a grid event happened on. Most {@link GridEvents} send this, some with more fields.
 * `cell-header-focus` sends it with a different `rowData`, see there.
 *
 * @example
 * ```ts
 * import type { EventHandler, GridCellEventData } from '@simple-html/grid';
 *
 * const logCell: EventHandler<GridCellEventData> = (data) => console.log(data.attribute, data.row, data.rowData);
 * gridInterface.on('copy-cell', logCell);
 * gridInterface.on('clear', logCell);
 * ```
 */
export interface GridCellEventData {
    /** the cell element */
    cell: HTMLCellElement;
    /** index of the row in the displayed rows (`datasource.getRows()`), 0 based. 0 for header cells */
    row: number;
    /** index of the column in its section (`colType`), 0 based */
    column: number;
    /** index of the cell in the column, a column can have more than one row of cells. 0 based */
    celno: number;
    /** the section of the grid the cell is in */
    colType: ColType;
    /** `'row-cell'` for a data cell, `'filter'` for a header filter cell */
    cellType: string;
    /** the attribute (field) of the cell */
    attribute: string;
    /** the data row of the cell. Never a group row, a group row has no cells */
    rowData: Entity;
}

/**
 * The events of a {@link GridInterface}: event name -> the payload its handler gets.
 * The datasource has its own events, see {@link DatasourceEvents}.
 *
 * Subscribe with `gridInterface.on(name, handler)`, the payload is typed from this map.
 * `on()` returns a function that unsubscribes.
 *
 * @sample events
 * @example
 * ```ts
 * const off = gridInterface.on('cell-click', (data) => {
 *     console.log('clicked', data.attribute, 'in row', data.row, data.rowData);
 * });
 * gridInterface.on('grid-connected', () => {
 *     gridInterface.fitColumns();
 * });
 * off(); // unsubscribe
 * ```
 */
export interface GridEvents {
    /**
     * A grid element connected to this interface: `element.connectInterface(gridInterface)`,
     * or the element was put back in the dom. Empty payload. Was `gridConnected` in v5.
     *
     * `createGrid()` connects before it returns: a handler subscribed after it hears this only when
     * the element is put back in the dom.
     */
    'grid-connected': Record<string, never>;

    /**
     * A data cell was clicked. Sent in a `setTimeout` after the click, so the row is already the
     * current entity. `originalEvent` is the click. Not sent for a boolean (checkbox) cell.
     */
    'cell-click': GridCellEventData & {
        /** the click */
        originalEvent: MouseEvent;
    };

    /**
     * A data cell got focus, by click or keyboard. `originalEvent` is the focus event. Not sent for a
     * boolean (checkbox) cell.
     */
    'cell-row-focus': GridCellEventData & {
        /** the focus event of the cell's input */
        originalEvent: FocusEvent;
    };

    /**
     * The focus button of a cell was clicked, or Space pressed in the cell. The button is shown
     * by `focusButton` on the column (`ColumnConfig.focusButton`).
     *
     * - `target`: the cell's input, focus it to give the focus back to the cell
     * - `originalEvent`: the focus event of the cell (button clicked) or the keydown (Space)
     */
    'cell-focus-button-click': GridCellEventData & {
        /** the cell's input, focus it to give the focus back to the cell */
        target: HTMLElement;
        /** the focus event of the cell (button clicked) or the keydown (Space) */
        originalEvent: FocusEvent | KeyboardEvent;
    };

    /**
     * A header filter cell got focus. `cellType` is `'filter'`, `row` is 0.
     *
     * `rowData` is not the header's own: it is the first displayed row (`datasource.getRow(0)`)
     * when the header filter got the focus. That is a {@link GroupRow} when the datasource is
     * grouped, and `undefined` when no rows are displayed - check with `isGroupRow()` before
     * reading it as a data row.
     */
    'cell-header-focus': Omit<GridCellEventData, 'rowData'> & {
        /** the first displayed row, not the header's own: a group row when grouped, `undefined` without rows */
        rowData: Entity | GroupRow | undefined;
    };

    /**
     * An operator was picked for a header filter - in the filter menu's Filter › Operator ›, another one
     * applied with the range block of a number or date column, or picked in the choice the header
     * filter's operator indicator opens (`GridConfig.filterOperatorIndicator`) - and the filter ran with
     * it. The operator is state, `getState().headerFilters[field].operator`.
     *
     * - `field`: the column's field
     * - `operator`: the operator picked
     * - `column`: the options of the column as the grid uses them (from `GridConfig.columns`). Change
     *   them to change what the header shows, e.g. `placeholderFilter`
     * - `rebuildHeader()`: renders the header again, call it after changing `column`
     *
     * Was `{ cellConfig, rebuildHeader }` in v5, with the operator in `cellConfig.operator`.
     *
     * @sample filter-operator-header
     * @example
     * ```ts
     * gridInterface.on('filter-operator-change', (data) => {
     *     data.column.placeholderFilter = data.operator; // show the operator in the empty filter cell
     *     data.rebuildHeader();
     * });
     * ```
     */
    'filter-operator-change': {
        /** the column's field */
        field: string;
        /** the operator picked */
        operator: FilterOperator;
        /** the column's options as the grid uses them, change them to change what the header shows */
        column: ColumnConfig;
        /** renders the header again, call it after changing `column` */
        rebuildHeader: () => void;
    };

    /**
     * Pasted from the row menu (Paste: Cell). Sent once per selected row pasted into, `entity`
     * is that row. The other fields are the cell the menu was opened on.
     */
    paste: Omit<GridCellEventData, 'rowData'> & {
        /** the row pasted into */
        entity: Entity;
    };

    /**
     * Cleared from the row menu (Clear: Cell): the column, in the selected rows.
     */
    clear: GridCellEventData;

    /**
     * Copied from the row menu (Copy: Cell Value): the value of the cell.
     */
    'copy-cell': GridCellEventData;

    /**
     * Copied from the row menu (Copy: Column): the column, in the selected rows.
     */
    'copy-column': GridCellEventData;

    /**
     * Copied from the row menu (Copy: Row): all columns, in the selected rows.
     */
    'copy-row': GridCellEventData;

    /**
     * Copied from the row menu (Copy: Row, selected rows/col): the selected columns (all when none
     * are selected), in the selected rows.
     */
    'copy-row-col': GridCellEventData;

    /**
     * The ranges of cells changed: the user dragged over the cells, Shift+clicked, Ctrl/Cmd+clicked,
     * pressed Alt+Shift+arrows or Esc, moved to another cell, or `setRanges()` / `clearRanges()` were
     * called. Also when the grid cleared them: the displayed rows or the layout changed, see
     * `gridInterface.getRanges()`. While the mouse drags it is sent each time the range reaches another
     * cell. Not sent when nothing changed.
     *
     * `ranges` is what `getRanges()` gives now, `[]` when they were cleared.
     *
     * @sample ranges
     * @example
     * ```ts
     * gridInterface.on('range-change', ({ ranges }) => {
     *     console.log(ranges.length ? `${ranges.length} ranges, the last ends at row ${ranges[ranges.length - 1].toRow}` : 'no cells selected');
     * });
     * ```
     */
    'range-change': {
        /** the ranges now, copies: see {@link CellRange} */
        ranges: CellRange[];
    };

    /**
     * The selected columns changed: the user clicked a column number (the row of numbers under the
     * header filters), pressed Esc on one, or `selectColumns()` was called. Also when the grid cleared
     * them because the fields of the layout changed - a column moved, pinned, hidden or added. Not sent
     * when nothing changed.
     *
     * `columns` is what `gridInterface.getSelectedColumns()` gives now - the numbers, 1 based, `[]` when
     * none is selected - and `fields` their fields, `getLayoutFields({ selectedOnly: true })`.
     *
     * @sample ranges
     * @example
     * ```ts
     * gridInterface.on('column-selection-change', ({ columns, fields }) => {
     *     console.log(columns.length ? `columns ${columns.join(', ')}: ${fields.join(', ')}` : 'no column selected');
     * });
     * ```
     */
    'column-selection-change': {
        /** the selected column numbers, ascending */
        columns: number[];
        /** the fields of the selected columns, in the layout's order */
        fields: string[];
    };

    /**
     * What Find (Ctrl+F in the grid) has found changed: the find bar opened or closed, the text was
     * typed (sent when the typing stops), the current match moved (Enter, F3, `findNext()` ...), or the
     * matches were found again after the data changed. Not sent when nothing changed.
     *
     * The payload is what `gridInterface.getFind()` gives now, see {@link FindResult}.
     *
     * @sample find
     * @example
     * ```ts
     * gridInterface.on('find-change', ({ open, text, count, current }) => {
     *     console.log(open ? `"${text}": ${count} cells, the current at ${JSON.stringify(current)}` : 'find closed');
     * });
     * ```
     */
    'find-change': FindResult;

    /**
     * The rows Find's "Filter rows" shows changed what they are: it was turned on or off, its text
     * changed (sent when the typing stops), "Match case" was turned on or off, the columns of the layout
     * changed while it filters. Not when the data changes, nor when the current match moves - so a
     * backend that loads the rows can load them again on it without a loop.
     *
     * `filter` is what `gridInterface.getFindFilter()` gives now: the rows with a match as a filter, for
     * `toSqlWhere()` - null while "Filter rows" shows every row. See the find guide.
     *
     * @sample sql
     * @example
     * ```ts
     * import { and, type FilterExpression } from '@simple-html/grid';
     *
     * gridInterface.on('find-filter-change', async ({ filter }) => {
     *     // the datasource's filter AND the find's: an empty AND is no filter
     *     const parts = [datasource.getFilter(), filter].filter((part): part is FilterExpression => part !== null);
     *     const response = await fetch('/api/customers', {
     *         method: 'POST',
     *         headers: { 'Content-Type': 'application/json' },
     *         body: JSON.stringify({ filter: and(...parts) })
     *     });
     *     datasource.setData(await response.json());
     * });
     * ```
     */
    'find-filter-change': {
        /** the filter of the rows "Filter rows" shows, as `getFindFilter()` gives it - null for every row */
        filter: FilterExpression | null;
    };

    /**
     * The list of named views changed: a view was saved (over the one shown, or as a new one), renamed,
     * deleted or made the default - in the views menu of the footer, or by `saveView()`, `saveViewAs()`,
     * `renameView()`, `deleteView()`, `setDefaultView()`. Store `views` - in a backend, say - and give it
     * back as `GridConfig.views` next time. Not sent by `setViews()` and `updateConfig({ views })`: you
     * gave the list, you have it. Nor when the user only switches to another view.
     *
     * `views` is what `gridInterface.getViews()` gives now: copies, plain JSON - the readonly views of
     * yours are in it too, leave them out when you store the user's. See {@link GridView}.
     *
     * @sample views
     * @example
     * ```ts
     * gridInterface.on('views-change', async ({ views }) => {
     *     const own = views.filter((view) => !view.readonly);
     *     await fetch('/api/settings/orders-grid-views', {
     *         method: 'PUT',
     *         headers: { 'Content-Type': 'application/json' },
     *         body: JSON.stringify(own)
     *     });
     * });
     * ```
     */
    'views-change': {
        /** every view, in their order: copies */
        views: GridView[];
    };
}
