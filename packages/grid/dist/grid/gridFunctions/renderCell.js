import { GROUP_COLTYPE, LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGH_PINNED_COLTYPE, SELECTOR_COLTYPE } from './GROUP_COLTYPE';
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
export function renderCell(ctx, cell, row, column, celno, colType) {
    const type = cell.getAttribute('type');
    const rowdata = ctx.gridInterface.getDatasource().getRow(row);
    let attribute;
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
    cell.$row = row;
    cell.$column = column;
    cell.$coltype = colType;
    cell.$celno = celno;
    cell.$attribute = attribute;
    if (colType === GROUP_COLTYPE) {
        renderRowGroup(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
    if (type === 'label') {
        renderHeaderLabel(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
    if (type === 'filter') {
        renderHeaderFilter(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
    if (type === SELECTOR_COLTYPE) {
        renderHeaderSelector(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
    if (type === null && colType === SELECTOR_COLTYPE) {
        renderRowSelector(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
    if (type === 'row-cell') {
        renderRowCell(ctx, cell, row, column, celno, colType, type, attribute, rowdata);
    }
}
//# sourceMappingURL=renderCell.js.map