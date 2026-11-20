import type { Grid } from '../grid';
import type { Columns } from '../gridConfig';
import { asPx } from './asPx';
import type { ColType, ColumnCache } from './colType';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getGroupingWidth } from './getGroupingWidth';

/**
 * How many column elements the middle (scrolling) section needs, so every column that can be
 * on screen at the same time has one, whatever the scroll position.
 * Used for both the rows and the header, they must have the same number.
 *
 * horizontalScrollHandler asks for every column that starts inside the viewport, plus the one
 * before it. Columns starting inside the viewport are at most "how many of the narrowest columns
 * fit in it" + 1, so that + 2 is always enough.
 *
 * Returns 0 when there are no center columns (addColumns treats 0 as "all", which is 0 then too).
 */
export function getMiddleColumnsNeeded(ctx: Grid) {
    const columns = ctx.gridInterface.__getGridConfig().columnsCenter;
    // same element/width horizontalScrollHandler uses to decide what is on screen
    const viewportWidth = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').clientWidth;

    const widths = columns.map((column) => column.width).sort((a, b) => a - b);
    let fits = 0;
    let total = 0;
    for (const width of widths) {
        total = total + width;
        if (total >= viewportWidth) {
            break;
        }
        fits++;
    }

    return Math.min(columns.length, fits + 2);
}

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
                const columnElement = createElement(DIV, 'simple-html-grid-grouping-row');
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
                const columnElement = createElement(DIV, 'simple-html-grid-col');

                const id = `${rowId}:${i.toString()}`;
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
                    const cellElement = createElement(DIV, 'simple-html-grid-col-cell');
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

    const middleColumnsNeeded = getMiddleColumnsNeeded(ctx);
    ctx.containerMiddleRowCache.forEach((e) => {
        ctx.containerMiddleColumnCache = addColumns(e.id, config.columnsCenter, middleColumnsNeeded, MIDDLE_PINNED_COLTYPE);
    });

    ctx.containerRightRowCache.forEach((e) => {
        ctx.containerRightColumnCache = addColumns(e.id, config.columnsPinnedRight, 0, RIGHT_PINNED_COLTYPE);
    });
}
