import type { Grid } from '../grid';
import type { ColType } from './colType';
/**
 * ctx is called by scrolling/rebuild logic, its job is to pass work to correct rendrer
 * @param cell
 * @param row
 * @param column
 * @param celno
 * @param colType
 */
export declare function renderCell(ctx: Grid, cell: HTMLElement, row: number, column: number, celno: number, colType: ColType): void;
//# sourceMappingURL=renderCell.d.ts.map