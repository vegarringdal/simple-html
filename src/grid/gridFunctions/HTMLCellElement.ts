import type { ColType } from './colType';

export interface HTMLCellElement extends HTMLElement {
    $row: number;
    $column: number;
    $coltype: ColType;
    $celno: number;
    // null on group and selector cells, they have no attribute
    $attribute: string | null;
    /**
     * helper to know if cell is focused
     */
    $focused: boolean;
}
