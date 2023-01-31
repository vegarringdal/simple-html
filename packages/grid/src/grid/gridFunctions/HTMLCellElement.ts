import { ColType } from './colType';

export interface HTMLCellElement extends HTMLElement {
    $row: number;
    $column: number;
    $coltype: ColType;
    $celno: number;
    $attribute: string;
    /**
     * helper to know if cell is focused
     */
    $focused: boolean;
}
