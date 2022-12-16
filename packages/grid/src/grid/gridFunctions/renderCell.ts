import {
    Grid} from '../grid';
import { HTMLCellElement } from "./HTMLCellElement";
import { ColType } from "./ColType";
import {
    GROUP_COLTYPE, LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGH_PINNED_COLTYPE,
    SELECTOR_COLTYPE
} from "./GROUP_COLTYPE";
import { renderHeaderFilter } from './renderHeaderFilter';
import { renderHeaderLabel } from './renderHeaderLabel';
import { renderHeaderSelector } from './renderHeaderSelector';
import { renderRowCell } from './renderRowCell';
import { renderRowGroup } from './renderRowGroup';
import { renderRowSelector } from './renderRowSelector';

/**
 * ctx is called by scrolling/rebuild logic, its job is to pass work to correct rendrer
 * @param cell
 * @param row
 * @param column
 * @param celno
 * @param colType
 */
export function renderCell(ctx: Grid, cell: HTMLElement, row: number, column: number, celno: number, colType: ColType) {
    const type = cell.getAttribute('type');
    const rowdata = ctx.gridInterface.getDatasource().getRow(row);

    let attribute: string;
    switch (colType) {
        case GROUP_COLTYPE:
            attribute = null;
            break;
        case SELECTOR_COLTYPE:
            attribute = null;
            break;
        case LEFT_PINNED_COLTYPE:
            attribute = ctx.gridInterface.__getGridConfig().columnsPinnedLeft[column]?.rows[celno];
            break;
        case MIDDLE_PINNED_COLTYPE:
            attribute = ctx.gridInterface.__getGridConfig().columnsCenter[column]?.rows[celno];
            break;
        case RIGH_PINNED_COLTYPE:
            attribute = ctx.gridInterface.__getGridConfig().columnsPinnedRight[column]?.rows[celno];
            break;
    }

    // todo: make type, so its easier to reuse
    (cell as HTMLCellElement).$row = row;
    (cell as HTMLCellElement).$column = column;
    (cell as HTMLCellElement).$coltype = colType;
    (cell as HTMLCellElement).$celno = celno;
    (cell as HTMLCellElement).$attribute = attribute;

    if (colType === GROUP_COLTYPE) {
        renderRowGroup(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }

    if (type === 'label') {
        renderHeaderLabel(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }

    if (type === 'filter') {
        renderHeaderFilter(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }

    if (type === SELECTOR_COLTYPE) {
        renderHeaderSelector(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }

    if (type === null && colType === SELECTOR_COLTYPE) {
        renderRowSelector(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }

    if (type === 'row-cell') {
        renderRowCell(ctx, cell as HTMLCellElement, row, column, celno, colType, type, attribute, rowdata);
    }
}
