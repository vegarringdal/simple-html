import { ColType } from './ColType';

export interface HTMLCellElement extends HTMLElement {
    $row: number;
    $column: number;
    $coltype: ColType;
    $celno: number;
    $attribute: string;
}
