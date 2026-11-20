import type { ColType } from './colType';

/**
 * A cell element of the grid: the `cell` the grid events and the menu context give you. The grid
 * reuses these elements while scrolling, so the `$` fields say what the cell shows now - read them
 * in the handler, do not keep the element for later.
 *
 * @example
 * ```ts
 * gridInterface.on('cell-click', (data) => {
 *     console.log(data.cell.$attribute, data.cell.$row); // the same as data.attribute, data.row
 * });
 * ```
 */
export interface HTMLCellElement extends HTMLElement {
    /** index of the row in the displayed rows, 0 based */
    $row: number;
    /** index of the column in its section (`$coltype`), 0 based */
    $column: number;
    /** the section of the grid the cell is in */
    $coltype: ColType;
    /** index of the cell in the column (a column can stack several fields), 0 based */
    $celno: number;
    /** the field of the cell. null on group and selector cells, they have no field */
    $attribute: string | null;
    /**
     * helper to know if cell is focused
     */
    $focused: boolean;
}
