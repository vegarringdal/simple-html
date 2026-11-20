import type { Entity, GroupRow } from '../datasource/entity';
import type { FilterOperator } from '../datasource/filterExpression';
import type { ColumnConfig } from './gridConfig';
import type { ColType } from './gridFunctions/colType';
import type { HTMLCellElement } from './gridFunctions/HTMLCellElement';

/**
 * The cell a grid event happened on. Most {@link GridEvents} send this, some with more fields.
 * `cell-header-focus` sends it with a different `rowData`, see there.
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
 * @example
 * ```ts
 * const off = gridInterface.on('cell-click', (data) => {
 *     console.log('clicked', data.attribute, 'in row', data.row, data.rowData);
 * });
 * gridInterface.on('grid-connected', () => {
 *     gridInterface.autoResizeColumns();
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
     * current entity. `originalEvent` is the click.
     */
    'cell-click': GridCellEventData & { originalEvent: MouseEvent };

    /**
     * A data cell got focus, by click or keyboard. `originalEvent` is the focus event.
     */
    'cell-row-focus': GridCellEventData & { originalEvent: FocusEvent };

    /**
     * The focus button of a cell was clicked, or Space pressed in the cell. The button is shown
     * by `focusButton` on the column (`ColumnConfig.focusButton`).
     *
     * - `target`: the cell's input, focus it to give the focus back to the cell
     * - `originalEvent`: the focus event of the cell (button clicked) or the keydown (Space)
     */
    'cell-focus-button-click': GridCellEventData & {
        target: HTMLElement;
        originalEvent: FocusEvent | KeyboardEvent;
    };

    /**
     * A header filter cell got focus. `cellType` is `'filter'`, `row` is 0.
     *
     * `rowData` is not the header's own: it is the first displayed row (`datasource.getRow(0)`)
     * from when the header cell was last rendered. That is a {@link GroupRow} when the datasource
     * is grouped, and `undefined` when no rows were displayed - check with `isGroupRow()` before
     * reading it as a data row.
     */
    'cell-header-focus': Omit<GridCellEventData, 'rowData'> & { rowData: Entity | GroupRow | undefined };

    /**
     * An operator was picked in the "Set Operator" part of the filter cell menu, and the filter
     * ran with it. The operator is state, `getState().headerFilters[field].operator`.
     *
     * - `field`: the column's field
     * - `operator`: the operator picked
     * - `column`: the options of the column as the grid uses them (from `GridConfig.columns`). Change
     *   them to change what the header shows, e.g. `placeholderFilter`
     * - `rebuildHeader()`: renders the header again, call it after changing `column`
     *
     * Was `{ cellConfig, rebuildHeader }` in v5, with the operator in `cellConfig.operator`.
     *
     * @example
     * ```ts
     * gridInterface.on('filter-operator-change', (data) => {
     *     data.column.placeholderFilter = data.operator; // show the operator in the empty filter cell
     *     data.rebuildHeader();
     * });
     * ```
     */
    'filter-operator-change': {
        field: string;
        operator: FilterOperator;
        column: ColumnConfig;
        rebuildHeader: () => void;
    };

    /**
     * Pasted from the row menu (Paste: Cell). Sent once per selected row pasted into, `entity`
     * is that row. The other fields are the cell the menu was opened on.
     */
    paste: Omit<GridCellEventData, 'rowData'> & { entity: Entity };

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
}
