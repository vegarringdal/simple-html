import { asPx } from './asPx';
import { getElementByClassName } from './getElementByClassName';
import { Grid } from '../grid';
import { ColType, RowCache } from './colTypes';
import {
    GROUP_COLTYPE,
    LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGH_PINNED_COLTYPE,
    SELECTOR_COLTYPE
} from './GROUP_COLTYPE';
import { renderCell } from './renderCell';
import { removeContextMenu } from './removeContextMenu';

export function verticalScrollHandler(ctx: Grid, scrollTop: number) {
    removeContextMenu(ctx);

    if (ctx.largeScrollTopTimer) {
        return;
    }

    const lastScrollTop = ctx.lastScrollTop;
    const rowTops = ctx.gridInterface.__getScrollState().scrollTops;
    const heights = ctx.gridInterface.__getScrollState().scrollHeights;

    const getTopRow = (fromtop = 0, findTop: number) => {
        let result = 0;
        const tops = ctx.gridInterface.__getScrollState().scrollTops;
        for (let i = fromtop; i < tops.length; i++) {
            if (findTop <= tops[i]) {
                result = i;
                break;
            }
        }
        if (fromtop && result === 0) {
            return tops.length;
        }

        return result;
    };

    const scrollEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const currentTopRow = getTopRow(0, scrollTop || 0.1);
    const currentBottomRow = getTopRow(currentTopRow, scrollTop + scrollEl.clientHeight);

    let largeScroll = false;

    if (Math.abs(lastScrollTop - scrollTop) > 500) {
        largeScroll = true;
    }

    ctx.lastScrollTop = scrollTop;

    if (largeScroll) {
        clearTimeout(ctx.largeScrollTopTimer);

        ctx.largeScrollTopTimer = setTimeout(() => {
            ctx.largeScrollTopTimer = null;
            const el = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
            verticalScrollHandler(ctx, el.scrollTop);
        }, 100);
    } else {
        const rowsWanted = new Set<number>();

        for (let i = currentTopRow - 1; i < currentBottomRow; i++) {
            rowsWanted.add(i);
        }

        // hack 1 row
        if (currentBottomRow === 0 && currentTopRow === 0 && rowTops.length === 1) {
            rowsWanted.add(0);
        }

        ctx.containerGroupRowCache.forEach((e) => {
            if (e.row >= 0) {
                if (!rowsWanted.has(e.row)) {
                    e.row = -1;
                } else {
                    rowsWanted.delete(e.row);
                }
            } else {
                if (e.row <= currentTopRow) {
                    e.row = -1;
                }
                if (e.row >= currentBottomRow) {
                    e.row = -1;
                }
            }
        });

        const rowsWantedArray = Array.from(rowsWanted);

        ctx.containerGroupRowCache.forEach((e) => {
            if (e.row < 0 && rowsWantedArray.length) {
                e.row = rowsWantedArray.pop() as any;
            }
        });

        const widths: number[] = [];
        let lastLeft = 0;
        const config = ctx.gridInterface.__getGridConfig();
        config.columnsCenter.forEach((c) => {
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const widthsLeft: number[] = [];
        lastLeft = 0;
        config.columnsPinnedLeft.forEach((c) => {
            widthsLeft.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const widthsRight: number[] = [];
        lastLeft = 0;
        config.columnsPinnedRight.forEach((c) => {
            widthsRight.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const updateRow = (e: RowCache, colType: ColType) => {
            if (e.row !== -1) {
                const rowdata = ctx.gridInterface.getDatasource().getRow(e.row);
                e.top = rowTops[e.row];
                const rowEl = ctx.rows.get(e.id);
                if (rowEl) {
                    const selection = ctx.gridInterface.getDatasource().getSelection();

                    rowEl.classList.remove('simple-html-grid-row-even');
                    rowEl.classList.remove('simple-html-grid-row-odd');

                    rowEl.classList.remove('simple-html-grid-selected-row-odd');
                    rowEl.classList.remove('simple-html-grid-selected-row-even');
                    if (selection.isSelected(e.row)) {
                        if (e.row % 2 === 0) {
                            rowEl.classList.add('simple-html-grid-selected-row-even');
                        } else {
                            rowEl.classList.add('simple-html-grid-selected-row-odd');
                        }
                    } else {
                        if (e.row % 2 === 0) {
                            rowEl.classList.add('simple-html-grid-row-even');
                        } else {
                            rowEl.classList.add('simple-html-grid-row-odd');
                        }
                    }

                    rowEl.style.display = 'block';
                    rowEl.style.transform = `translate3d(0px, ${e.top}px, 0px)`;
                    rowEl.style.height = asPx(heights[e.row]);

                    if (colType === LEFT_PINNED_COLTYPE) {
                        ctx.containerLeftColumnCache.forEach((x, i) => {
                            const id = e.id + ':' + i.toString();
                            const elc = ctx.columns.get(id);

                            if (elc && x.column !== -1) {
                                if (rowdata?.__group) {
                                    elc.style.display = 'none';
                                } else {
                                    if (elc.style.display !== 'block') {
                                        elc.style.display = 'block';
                                    }

                                    const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                    const width = asPx(widthsLeft[x.column]);

                                    if (transform !== elc.style.transform) {
                                        elc.style.transform = transform;
                                    }
                                    if (width !== elc.style.width) {
                                        elc.style.width = width;
                                    }

                                    for (let cc = 0; cc < elc.children.length; cc++) {
                                        renderCell(ctx, elc.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                    }
                                }
                            }
                        });
                    }
                    if (colType === MIDDLE_PINNED_COLTYPE) {
                        ctx.containerMiddleColumnCache.forEach((x, i) => {
                            const id = e.id + ':' + i.toString();
                            const colEl = ctx.columns.get(id);

                            if (colEl && x.column !== -1) {
                                if (rowdata?.__group) {
                                    colEl.style.display = 'none';
                                } else {
                                    if (colEl.style.display !== 'block') {
                                        colEl.style.display = 'block';
                                    }

                                    // middle part will need to have to left/widths

                                    const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                    const width = asPx(widths[x.column]);

                                    if (transform !== colEl.style.transform) {
                                        colEl.style.transform = transform;
                                    }
                                    if (width !== colEl.style.width) {
                                        colEl.style.width = width;
                                    }

                                    for (let cc = 0; cc < colEl.children.length; cc++) {
                                        renderCell(ctx, colEl.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                    }
                                }
                            }
                        });
                    }
                    if (colType === RIGH_PINNED_COLTYPE) {
                        ctx.containerRightColumnCache.forEach((x, i) => {
                            const id = e.id + ':' + i.toString();
                            const colEl = ctx.columns.get(id);

                            if (colEl && x.column !== -1) {
                                if (rowdata?.__group) {
                                    colEl.style.display = 'none';
                                } else {
                                    if (colEl.style.display !== 'block') {
                                        colEl.style.display = 'block';
                                    }

                                    const transform = `translate3d(${x.left}px, 0px, 0px)`;
                                    const width = asPx(widthsRight[x.column]);

                                    if (transform !== colEl.style.transform) {
                                        colEl.style.transform = transform;
                                    }
                                    if (width !== colEl.style.width) {
                                        colEl.style.width = width;
                                    }

                                    for (let cc = 0; cc < colEl.children.length; cc++) {
                                        renderCell(ctx, colEl.children[cc] as HTMLElement, e.row, x.column, cc, colType);
                                    }
                                }
                            }
                        });
                    }
                    if (colType === GROUP_COLTYPE) {
                        renderCell(ctx, rowEl as HTMLElement, e.row, 0, 0, colType);
                    }
                    if (colType === SELECTOR_COLTYPE) {
                        renderCell(ctx, rowEl as HTMLElement, e.row, 0, 0, colType);
                    }
                }
            } else {
                const el = ctx.rows.get(e.id);
                if (el) {
                    el.style.display = 'none';
                }
            }
        };

        ctx.containerGroupRowCache.forEach((e) => {
            if (e.row) {
                e.top = rowTops[e.row];
            }

            updateRow(e, GROUP_COLTYPE);
        });

        ctx.containerSelectorRowCache.forEach((e, i) => {
            e.row = ctx.containerGroupRowCache[i].row;
            updateRow(e, SELECTOR_COLTYPE);
        });

        ctx.containerLeftRowCache.forEach((e, i) => {
            e.row = ctx.containerGroupRowCache[i].row;
            updateRow(e, LEFT_PINNED_COLTYPE);
        });

        ctx.containerMiddleRowCache.forEach((e, i) => {
            e.row = ctx.containerGroupRowCache[i].row;
            updateRow(e, MIDDLE_PINNED_COLTYPE);
        });

        ctx.containerRightRowCache.forEach((e, i) => {
            e.row = ctx.containerGroupRowCache[i].row;
            updateRow(e, RIGH_PINNED_COLTYPE);
        });
    }
}
