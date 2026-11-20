import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import { nextSection, sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { getElementByClassName } from './getElementByClassName';
import type { HTMLCellElement } from './HTMLCellElement';

const TAB_KEY = 'Tab';
const ARROW_UP_KEY = 'ArrowUp';
const ARROW_DOWN_KEY = 'ArrowDown';
const ARROW_LEFT_KEY = 'ArrowLeft';
const ARROW_RIGHT_KEY = 'ArrowRight';
type CurrentKey = typeof TAB_KEY | typeof ARROW_UP_KEY | typeof ARROW_DOWN_KEY | typeof ARROW_LEFT_KEY | typeof ARROW_RIGHT_KEY;

let waitForFocusTrigger = false;

/**
 * helper to skip grouped rows
 * @param ctx
 * @param currentKey
 * @param gotoRow
 * @returns
 */
function overrideGroupRow(ctx: Grid, currentKey: string, gotoRow: number) {
    let x = 0;

    while (x < 100) {
        const data = ctx.gridInterface.getDatasource().getRow(gotoRow + x);
        if (!isGroupRow(data)) {
            gotoRow = gotoRow + x;
            x = 200;
        } else {
            switch (currentKey) {
                case ARROW_RIGHT_KEY:
                    x++;
                    break;
                case ARROW_DOWN_KEY:
                    x++;
                    break;
                case ARROW_UP_KEY:
                    x--;
                    break;
                case ARROW_LEFT_KEY:
                    x--;
                    break;
                default:
                    x++;
            }
        }
    }

    return gotoRow;
}

/**
 * Moves the focus target out of its section in the filter row, see nextSection - it skips
 * sections without columns, every column can be pinned.
 * Wrapping forward goes down to the first data row. There is no row above the filter row, so
 * wrapping backward returns null and focus stays where it is.
 */
function leaveFilterSection(
    ctx: Grid,
    config: ParsedGridConfig,
    scrollerEl: HTMLElement,
    colType: ColType,
    forward: boolean,
    gotoRow: number
) {
    const next = nextSection(config, colType, forward);
    if (next.rowStep < 0) {
        return null;
    }

    if (next.colType === 'middle-pinned') {
        scrollerEl.scrollLeft = forward ? 0 : scrollerEl.scrollWidth;
    }

    if (next.rowStep > 0) {
        return {
            colType: next.colType,
            column: next.column,
            row: overrideGroupRow(ctx, ARROW_DOWN_KEY, gotoRow),
            filterClass: ''
        };
    }

    return { colType: next.colType, column: next.column, row: gotoRow, filterClass: 'filter-' };
}

/**
 * this handler tab, and arrow key navigation on rows
 */
export const cellFilterKeyNavigationCellRowHandler = (
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    event: KeyboardEvent
) => {
    if (waitForFocusTrigger) {
        event.preventDefault();
        return false;
    }

    const currentKey: CurrentKey = event.code as any;

    if (currentKey === ARROW_LEFT_KEY || currentKey === ARROW_RIGHT_KEY) {
        if (!event.altKey) {
            return true;
        }

        event.preventDefault();
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const scrollerRect = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const innerWidth = scrollerEl.clientWidth;
        const scrollleft = scrollerEl.scrollLeft;
        const top = cellRect.top - scrollerRect.top;
        const bottom = scrollerRect.bottom - cellRect.bottom;
        const rowHeight = ctx.gridInterface.__getGridConfig().__rowHeight * 2;
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;
        const columnsCenter = ctx.gridInterface.__getGridConfig().columnsCenter;
        columnsCenter.forEach((c) => {
            colLeft.push(lastLeft);
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const config = ctx.gridInterface.__getGridConfig();
        let gotoColType = colType;
        let gotoCell = celno;
        let gotoRow = row;
        let gotoCol = column;
        let filterClass = 'filter-';

        /**
         * leaves the section, or stays on the current cell when there is nowhere to go
         */
        const leave = (forward: boolean) => {
            const target = leaveFilterSection(ctx, config, scrollerEl, colType, forward, gotoRow);
            if (target) {
                ({ colType: gotoColType, column: gotoCol, row: gotoRow, filterClass } = target);
            } else {
                gotoCol = column;
                gotoCell = celno;
            }
        };

        switch (colType) {
            case 'left-pinned':
                if (currentKey === ARROW_RIGHT_KEY) {
                    gotoCol = gotoCol + 1;

                    if (!config.columnsPinnedLeft[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;
                    if (gotoCol < 0) {
                        leave(false);
                    }
                }

                break;

            case 'middle-pinned':
                if (currentKey === ARROW_RIGHT_KEY) {
                    gotoCol = gotoCol + 1;

                    if (!config.columnsCenter[gotoCol]) {
                        if (config.columnsPinnedRight.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = 0;
                        } else if (config.columnsPinnedLeft.length) {
                            gotoColType = 'left-pinned';
                            gotoCol = 0;

                            filterClass = '';
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        } else {
                            scrollerEl.scrollLeft = 0;
                            gotoCol = 0;
                            gotoCell = 0;
                            filterClass = '';
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        }
                    } else {
                        const columnRight = column > colLeft.length ? column : column + 1;
                        const colRightx = colLeft[columnRight] + widths[columnRight];
                        if (innerWidth + scrollleft < colRightx) {
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft + widths[columnRight];
                        }
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;
                    if (gotoCol < 0) {
                        // past the first center column, into the left pinned filters
                        // (a clamp to 0 here made that branch unreachable)
                        leave(false);
                    } else {
                        const columnleft = column < 2 ? column : column - 1;
                        const colLeftx = colLeft[columnleft] - widths[columnleft];
                        if (scrollleft > colLeftx) {
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft - widths[columnleft];
                        }
                    }
                }

                break;

            case 'right-pinned':
                if (currentKey === ARROW_RIGHT_KEY) {
                    gotoCol = gotoCol + 1;
                    if (!config.columnsPinnedRight[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;
                    if (!config.columnsPinnedRight[gotoCol]) {
                        leave(false);
                    }
                }
                break;
        }

        if (gotoCol >= 0) {
            switch (gotoColType) {
                case 'left-pinned':
                    if (gotoCell > config.columnsPinnedLeft[gotoCol].rows.length - 1) {
                        gotoCell = config.columnsPinnedLeft[gotoCol].rows.length - 1;
                    }
                    break;
                case 'middle-pinned':
                    if (gotoCell > config.columnsCenter[gotoCol].rows.length - 1) {
                        gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
                    }
                    break;
                case 'right-pinned':
                    if (gotoCell > config.columnsPinnedRight[gotoCol].rows.length - 1) {
                        gotoCell = config.columnsPinnedRight[gotoCol].rows.length - 1;
                    }
                    break;
            }
        }

        if (bottom < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop + rowHeight;
        }

        if (top < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop - rowHeight;
        }

        waitForFocusTrigger = true;
        setTimeout(() => {
            const el = getElementByClassName(
                ctx.element,
                `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`
            );
            if (el) {
                el.focus();
                if (gotoRow !== row) {
                    ctx.gridInterface.getDatasource().setRowAsCurrentEntity(gotoRow);
                }
            }
            waitForFocusTrigger = false;
        }, 100);
    }

    /*
     * all logic if using arrow keys up or down
     */
    if (currentKey === ARROW_UP_KEY || currentKey === ARROW_DOWN_KEY) {
        if (!event.altKey) {
            return true;
        }
        event.preventDefault();
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const scrollerRect = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const top = cellRect.top - scrollerRect.top;
        const bottom = scrollerRect.bottom - cellRect.bottom;
        const rowHeight = ctx.gridInterface.__getGridConfig().__rowHeight * 2;
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;
        const columnsCenter = ctx.gridInterface.__getGridConfig().columnsCenter;
        columnsCenter.forEach((c) => {
            colLeft.push(lastLeft);
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const config = ctx.gridInterface.__getGridConfig();
        const gotoColType = colType;
        let gotoCell = celno;
        let gotoRow = row;
        const gotoCol = column;
        let filterClass = 'filter-';

        let isLastCell: boolean;

        switch (colType) {
            case 'left-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.columnsPinnedLeft[column].rows.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        filterClass = '';
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    }
                }

                break;

            case 'middle-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.columnsCenter[column].rows.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        filterClass = '';
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    }
                }

                break;

            case 'right-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.columnsPinnedRight[column].rows.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        filterClass = '';
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCell = config.columnsPinnedRight[gotoCol].rows.length - 1;
                    }
                }
                break;
        }

        if (bottom < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop + rowHeight;
        }

        if (top < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop - rowHeight;
        }

        waitForFocusTrigger = true;
        setTimeout(() => {
            const el = getElementByClassName(
                ctx.element,
                `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`
            );
            if (el) {
                el.focus();
                if (gotoRow !== row) {
                    ctx.gridInterface.getDatasource().setRowAsCurrentEntity(gotoRow);
                }
            }
            waitForFocusTrigger = false;
        }, 100);
    }

    /**
     * all logic if using tab
     */
    if (currentKey === TAB_KEY) {
        event.preventDefault();
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const scrollerRect = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const innerWidth = scrollerEl.clientWidth;
        const scrollleft = scrollerEl.scrollLeft;
        const top = cellRect.top - scrollerRect.top;
        const bottom = scrollerRect.bottom - cellRect.bottom;
        const rowHeight = ctx.gridInterface.__getGridConfig().__rowHeight * 2;
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;
        const columnsCenter = ctx.gridInterface.__getGridConfig().columnsCenter;
        columnsCenter.forEach((c) => {
            colLeft.push(lastLeft);
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });

        const reverse = event.shiftKey;
        const config = ctx.gridInterface.__getGridConfig();
        let gotoColType = colType;
        let gotoCell = celno;
        let gotoRow = row;
        let gotoCol = column;
        let filterClass = 'filter-';

        let isLastCell: boolean;

        /**
         * leaves the section, landing on the first cell going forward and the last going
         * backward. Stays on the current cell when there is nowhere to go.
         */
        const leave = (forward: boolean) => {
            const target = leaveFilterSection(ctx, config, scrollerEl, colType, forward, gotoRow);
            if (target) {
                ({ colType: gotoColType, column: gotoCol, row: gotoRow, filterClass } = target);
                gotoCell = forward ? 0 : sectionColumns(config, gotoColType)[gotoCol].rows.length - 1;
            } else {
                gotoCol = column;
                gotoCell = celno;
            }
        };

        switch (colType) {
            case 'left-pinned':
                if (currentKey === TAB_KEY && !reverse) {
                    isLastCell = gotoCell === config.columnsPinnedLeft[column].rows.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.columnsPinnedLeft[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === TAB_KEY && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;
                    }
                    if (gotoCol < 0) {
                        leave(false);
                    } else if (gotoCol < column) {
                        // last cell of the previous left pinned column (was read from columnsPinnedRight)
                        gotoCell = config.columnsPinnedLeft[gotoCol].rows.length - 1;
                    }
                }

                break;

            case 'middle-pinned':
                if (currentKey === TAB_KEY && !reverse) {
                    isLastCell = gotoCell === config.columnsCenter[column].rows.length - 1;

                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.columnsCenter[gotoCol]) {
                        if (config.columnsPinnedRight.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = 0;
                            gotoCell = 0;
                        } else if (config.columnsPinnedLeft.length) {
                            gotoColType = 'left-pinned';
                            gotoCol = 0;
                            gotoCell = 0;
                            filterClass = '';
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        } else {
                            scrollerEl.scrollLeft = 0;
                            gotoCol = 0;
                            gotoCell = 0;
                            filterClass = '';
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        }
                    } else {
                        const columnRight = column > colLeft.length ? column : column + 1;
                        const colRightx = colLeft[columnRight] + widths[columnRight];
                        if (innerWidth + scrollleft < colRightx) {
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft + widths[columnRight];
                        }
                    }
                } else if (currentKey === 'Tab' && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;

                        if (config.columnsCenter[gotoCol]) {
                            gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
                        }
                    }
                    if (gotoCol < 0) {
                        // past the first center column, into the left pinned filters
                        // (a clamp to 0 here made that branch unreachable)
                        leave(false);
                    } else {
                        const columnleft = column < 2 ? column : column - 1;
                        const colLeftx = colLeft[columnleft] - widths[columnleft];
                        if (scrollleft > colLeftx) {
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft - widths[columnleft];
                        }
                    }
                }

                break;

            case 'right-pinned':
                if (currentKey === TAB_KEY && !reverse) {
                    isLastCell = gotoCell === config.columnsPinnedRight[column].rows.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.columnsPinnedRight[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === TAB_KEY && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;
                        if (config.columnsPinnedRight[gotoCol]) {
                            gotoCell = config.columnsPinnedRight[gotoCol].rows.length - 1;
                        }
                    }

                    if (!config.columnsPinnedRight[gotoCol]) {
                        leave(false);
                    }
                }
                break;
        }

        if (bottom < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop + rowHeight;
        }

        if (top < rowHeight) {
            scrollerEl.scrollTop = scrollerEl.scrollTop - rowHeight;
        }

        waitForFocusTrigger = true;
        setTimeout(() => {
            const el = getElementByClassName(
                ctx.element,
                `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`
            );
            if (el) {
                el.focus();
                if (gotoRow !== row) {
                    ctx.gridInterface.getDatasource().setRowAsCurrentEntity(gotoRow);
                }
            }
            waitForFocusTrigger = false;
        }, 100);
    }

    return false;
};
