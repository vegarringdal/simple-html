import { asPx } from './asPx';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { ColType } from './colType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGH_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { renderCell } from './renderCell';
import { getGroupingWidth } from './getGroupingWidth';
import { removeContextMenu } from './removeContextMenu';

export function horizontalScrollHandler(ctx: Grid, scrollLeft: number, type: ColType = MIDDLE_PINNED_COLTYPE) {

    if (ctx.gridInterface.__getGridConfig().autoRemoveContextMenuOnScrollEvent) {
        removeContextMenu(ctx);
    }

    const config = ctx.gridInterface.__getGridConfig();

    let columns = config.columnsCenter;
    let columnCache = ctx.containerMiddleColumnCache;
    let rowCache = ctx.containerMiddleRowCache;
    let idPrefix: ColType = MIDDLE_PINNED_COLTYPE;

    /**
     * section like left/middle/right side
     */
    let sectionElement = 'simple-html-grid-middle-scroller';

    if (type === LEFT_PINNED_COLTYPE) {
        columns = config.columnsPinnedLeft;
        columnCache = ctx.containerLeftColumnCache;
        rowCache = ctx.containerLeftRowCache;
        idPrefix = LEFT_PINNED_COLTYPE;
        sectionElement = 'simple-html-grid-body-view-pinned-left';
    }

    if (type === RIGH_PINNED_COLTYPE) {
        columns = config.columnsPinnedRight;
        columnCache = ctx.containerRightColumnCache;
        rowCache = ctx.containerRightRowCache;
        idPrefix = RIGH_PINNED_COLTYPE;
        sectionElement = 'simple-html-grid-body-view-pinned-right';
    }

    const delayScrollRender = () => {
        ctx.largeScrollLeftTimer = setTimeout(() => {
            ctx.largeScrollLeftTimer = null;

            const el = getElementByClassName(ctx.element, sectionElement);
            ctx.lastScrollLeft = el.scrollLeft - 5;
            horizontalScrollHandler(ctx, el.scrollLeft);
        }, 100);
    };

    if (ctx.largeScrollLeftTimer) {
        clearTimeout(ctx.largeScrollLeftTimer);
        delayScrollRender();
        return;
    }

    const lastScrollLeft = ctx.lastScrollLeft;

    /**
     * build ca
     */
    const colLeft: number[] = [];
    const widths: number[] = [];
    let lastLeft = 0;

    columns.forEach((c) => {
        colLeft.push(lastLeft);
        widths.push(c.width);
        lastLeft = lastLeft + c.width;
    });

    const getLeftCol = (fromLeft = 0, toRight: number) => {
        let result = 0;

        for (let i = fromLeft; i < colLeft.length; i++) {
            if (toRight <= colLeft[i]) {
                result = i;
                break;
            }
        }
        if (fromLeft && result === 0) {
            return colLeft.length;
        }

        return result;
    };

    const sectionEl = getElementByClassName(ctx.element, sectionElement);
    const currentLeftCol = getLeftCol(0, scrollLeft);
    const currentRightCol = getLeftCol(currentLeftCol, scrollLeft + sectionEl.clientWidth) || columnCache.length;

    const scrolllength = Math.abs(lastScrollLeft - scrollLeft);

    let largeScroll = false;
    if (scrolllength > 100) {
        largeScroll = false; // lets disable ctx for now
    }
    ctx.lastScrollLeft = scrollLeft;
    if (largeScroll) {
        // large scroll will break logic on moving one and one, why bother
        clearTimeout(ctx.largeScrollLeftTimer);

        delayScrollRender();
    } else {
        const rowsWanted = new Set<number>();

        for (let i = currentLeftCol - 1; i < currentRightCol; i++) {
            rowsWanted.add(i);
        }

        columnCache.forEach((e) => {
            if (e.column < currentLeftCol) {
                e.column = -1;
            }
            if (e.column > currentRightCol) {
                e.column = -1;
            }
            if (e.column >= 0) {
                if (!rowsWanted.has(e.column)) {
                    e.column = -1;
                } else {
                    rowsWanted.delete(e.column);
                }
            }
        });

        const rowsWantedArray = Array.from(rowsWanted);

        const LeftOffset = getGroupingWidth(ctx, type);

        columnCache.forEach((e) => {
            if (e.column < 0 && rowsWantedArray.length) {
                e.column = rowsWantedArray.pop() as any;
            }
            e.left = colLeft[e.column] + LeftOffset;
        });

        // need to check data..
        const noData = ctx.gridInterface.getDatasource().length() === 0;

        rowCache.forEach((e, no) => {
            if (e.row !== -1 || (noData && no)) {
                columnCache.forEach((x, i) => {
                    const id = e.id + ':' + i.toString();
                    const colEl = ctx.columns.get(id);

                    if (x.column === -1) {
                        if (colEl) {
                            colEl.style.display = 'none';
                        }
                        const header = ctx.columnsHeaders.get(idPrefix + i.toString());
                        if (header) {
                            header.style.display = 'none';
                        }
                    } else {
                        /**
                         * rows
                         */

                        if (colEl) {
                            const rowdata = ctx.gridInterface.getDatasource().getRow(e.row);
                            if (rowdata?.__group) {
                                colEl.style.display = 'none';
                            } else {
                                colEl.style.display = 'block';
                                const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                const width = asPx(widths[x.column]);

                                if (transform !== colEl.style.transform) {
                                    colEl.style.transform = transform;
                                    for (let c = 0; c < colEl.children.length; c++) {
                                        renderCell(ctx, colEl.children[c] as HTMLElement, e.row, x.column, c, idPrefix);
                                    }
                                }
                                if (width !== colEl.style.width) {
                                    colEl.style.width = width;
                                }
                            }
                        }

                        /**
                         * header
                         */
                        const header = ctx.columnsHeaders.get(idPrefix + i.toString());
                        if (header) {
                            header.style.display = 'block';
                            const transform = `translate3d(${x.left}px, 0px, 0px)`;
                            const width = asPx(widths[x.column]);

                            if (transform !== header.style.transform) {
                                header.style.transform = transform;

                                for (let c = 0; c < header.children.length; c++) {
                                    const cellNo = parseInt(header.children[c].getAttribute('cellNo'));
                                    renderCell(ctx, header.children[c] as HTMLElement, 0, x.column, cellNo, idPrefix);
                                }
                            }
                            if (width !== header.style.width) {
                                header.style.width = width;
                            }
                        }
                    }
                });
            }
        });
    }
}
