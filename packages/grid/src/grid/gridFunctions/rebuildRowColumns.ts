import { asPx } from './asPx';
import { creatElement } from './createElement';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { DIV } from './DIV';
import { ColType, ColumnCache } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGH_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { Columns } from '../gridConfig';
import { getGroupingWidth } from './getGroupingWidth';

export function rebuildRowColumns(ctx: Grid) {
    const config = ctx.gridInterface.__getGridConfig();

    /**
     * helper to generate cols and rows elements
     */
    const addColumns = (rowId: string, columns: Columns[], maxColumns: number, coltype: ColType) => {
        const parent = ctx.rows.get(rowId);

        const columnCache: ColumnCache[] = [];
        let columnsNeeded = maxColumns === 0 ? columns.length : maxColumns;
        if (columns.length < columnsNeeded) {
            columnsNeeded = columns.length;
        }

        if (!parent) {
            console.log('err');
        } else {
            let left = getGroupingWidth(ctx, coltype);
            while (parent.firstChild) {
                parent.removeChild(parent.firstChild);
            }

            if (coltype === 'left-pinned') {
                const columnElement = creatElement(DIV, 'simple-html-grid-grouping-row');
                columnElement.style.width = asPx(left);
                if (left === 0) {
                    columnElement.style.display = 'none';
                }
                parent.appendChild(columnElement);
            }

            for (let i = 0; i < columnsNeeded; i++) {
                /**
                 * generate column
                 */
                const columnElement = creatElement(DIV, 'simple-html-grid-col');

                const id = rowId + ':' + i.toString();
                ctx.columns.set(id, columnElement);
                columnElement.style.transform = `translate3d(${left}px, 0px, 0px)`;
                columnElement.style.width = asPx(columns[i].width);
                columnElement.setAttribute('refID', i.toString());
                parent.appendChild(columnElement);

                columnCache.push({ column: i, left, refID: i });
                left = left + columns[i].width;

                /**
                 * generate cells
                 */

                for (let y = 0; y < config.__columnCells; y++) {
                    const cellElement = creatElement(DIV, 'simple-html-grid-col-cell');
                    cellElement.style.top = asPx(config.cellHeight * y);
                    cellElement.style.height = asPx(config.cellHeight);
                    cellElement.setAttribute('type', 'row-cell');
                    columnElement.appendChild(cellElement);
                }
            }
        }

        return columnCache;
    };

    // clear old config
    ctx.columns.clear();

    ctx.containerLeftRowCache.forEach((e) => {
        ctx.containerLeftColumnCache = addColumns(e.id, config.columnsPinnedLeft, 0, LEFT_PINNED_COLTYPE);
    });

    // get params we will use to apply max columns
    const bodyWidth = getElementByClassName(ctx.element, 'simple-html-grid-body').clientWidth;
    const middleWidth = bodyWidth - (config.__leftWidth + config.__scrollbarSize + config.__rightWidth + config.selectSizeHeight);

    ctx.containerMiddleRowCache.forEach((e) => {
        ctx.containerMiddleColumnCache = addColumns(e.id, config.columnsCenter, middleWidth / 50, MIDDLE_PINNED_COLTYPE);
    });

    ctx.containerRightRowCache.forEach((e) => {
        ctx.containerRightColumnCache = addColumns(e.id, config.columnsPinnedRight, 0, RIGH_PINNED_COLTYPE);
    });
}
