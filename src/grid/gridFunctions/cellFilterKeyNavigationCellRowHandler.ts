import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import { focusInAMoment, focusMoveKey, nextSection, sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { getElementByClassName } from './getElementByClassName';
import type { HTMLCellElement } from './HTMLCellElement';
import { focusHeaderLabel } from './headerLabelKeydown';
import { filterJumpKeydown, focusGroupButton } from './jumpKeys';
import { leaveGrid, tabGroupStop, tabLeavesFilters, tabPastRows } from './tabExit';

const TAB_KEY = 'Tab';
const ARROW_UP_KEY = 'ArrowUp';
const ARROW_DOWN_KEY = 'ArrowDown';
const ARROW_LEFT_KEY = 'ArrowLeft';
const ARROW_RIGHT_KEY = 'ArrowRight';
type CurrentKey = typeof TAB_KEY | typeof ARROW_UP_KEY | typeof ARROW_DOWN_KEY | typeof ARROW_LEFT_KEY | typeof ARROW_RIGHT_KEY;

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
    // a move is on its way: the keys that move or type wait for it, see focusMoveKey
    if (ctx.focusMovePending) {
        if (focusMoveKey(event)) {
            event.preventDefault();
            return false;
        }
        return true;
    }

    // Ctrl+Home / Ctrl+End, Alt+Home / Alt+End, PageDown: see jumpKeys.ts
    if (filterJumpKeydown(ctx, event, { colType, column, celno })) {
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
        const columnsCenter = ctx.gridInterface.__getGridConfig().layout.center;
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

                    if (!config.layout.left[gotoCol]) {
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

                    if (!config.layout.center[gotoCol]) {
                        if (config.layout.right.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = 0;
                        } else if (config.layout.left.length) {
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
                    if (!config.layout.right[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;
                    if (!config.layout.right[gotoCol]) {
                        leave(false);
                    }
                }
                break;
        }

        if (gotoCol >= 0) {
            switch (gotoColType) {
                case 'left-pinned':
                    if (gotoCell > config.layout.left[gotoCol].fields.length - 1) {
                        gotoCell = config.layout.left[gotoCol].fields.length - 1;
                    }
                    break;
                case 'middle-pinned':
                    if (gotoCell > config.layout.center[gotoCol].fields.length - 1) {
                        gotoCell = config.layout.center[gotoCol].fields.length - 1;
                    }
                    break;
                case 'right-pinned':
                    if (gotoCell > config.layout.right[gotoCol].fields.length - 1) {
                        gotoCell = config.layout.right[gotoCol].fields.length - 1;
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

        focusInAMoment(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, row, gotoRow);
    }

    /*
     * all logic if using arrow keys up or down
     */
    if (currentKey === ARROW_UP_KEY || currentKey === ARROW_DOWN_KEY) {
        if (!event.altKey) {
            return true;
        }
        event.preventDefault();

        // up from the first field of the column: its label above, the label of the last field
        const labelsShown = !ctx.gridInterface.__getGridConfig().hideLabels;
        if (currentKey === ARROW_UP_KEY && celno === 0 && labelsShown) {
            const fields = sectionColumns(ctx.gridInterface.__getGridConfig(), colType)[column].fields.length;
            focusHeaderLabel(ctx, colType, column, fields - 1);
            return false;
        }
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const scrollerRect = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const top = cellRect.top - scrollerRect.top;
        const bottom = scrollerRect.bottom - cellRect.bottom;
        const rowHeight = ctx.gridInterface.__getGridConfig().__rowHeight * 2;
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;
        const columnsCenter = ctx.gridInterface.__getGridConfig().layout.center;
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
                    isLastCell = gotoCell === config.layout.left[column].fields.length - 1;
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
                    isLastCell = gotoCell === config.layout.center[column].fields.length - 1;
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
                    isLastCell = gotoCell === config.layout.right[column].fields.length - 1;
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
                        gotoCell = config.layout.right[gotoCol].fields.length - 1;
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

        focusInAMoment(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, row, gotoRow);
    }

    /**
     * all logic if using tab
     */
    if (currentKey === TAB_KEY) {
        // no cell to go to: on to the footer (no rows), or the browser's Tab takes the focus out of the
        // grid, see tabExit.ts
        if (tabLeavesFilters(ctx, column, celno, colType, event.shiftKey)) {
            if (event.shiftKey) {
                leaveGrid(ctx, false);
            } else {
                tabPastRows(ctx, event);
            }
            return true;
        }
        // the first row is a group row: its button is the next stop
        const groupStop = event.shiftKey ? -1 : tabGroupStop(ctx, -1, column, celno, colType, false);
        if (groupStop !== -1) {
            event.preventDefault();
            focusGroupButton(ctx, groupStop);
            return false;
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
        const columnsCenter = ctx.gridInterface.__getGridConfig().layout.center;
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
                gotoCell = forward ? 0 : sectionColumns(config, gotoColType)[gotoCol].fields.length - 1;
            } else {
                gotoCol = column;
                gotoCell = celno;
            }
        };

        switch (colType) {
            case 'left-pinned':
                if (currentKey === TAB_KEY && !reverse) {
                    isLastCell = gotoCell === config.layout.left[column].fields.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.layout.left[gotoCol]) {
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
                        // last cell of the previous left pinned column (was read from layout.right)
                        gotoCell = config.layout.left[gotoCol].fields.length - 1;
                    }
                }

                break;

            case 'middle-pinned':
                if (currentKey === TAB_KEY && !reverse) {
                    isLastCell = gotoCell === config.layout.center[column].fields.length - 1;

                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.layout.center[gotoCol]) {
                        if (config.layout.right.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = 0;
                            gotoCell = 0;
                        } else if (config.layout.left.length) {
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

                        if (config.layout.center[gotoCol]) {
                            gotoCell = config.layout.center[gotoCol].fields.length - 1;
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
                    isLastCell = gotoCell === config.layout.right[column].fields.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoCol = gotoCol + 1;
                        gotoCell = 0;
                    }

                    if (!config.layout.right[gotoCol]) {
                        leave(true);
                    }
                } else if (currentKey === TAB_KEY && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;
                        if (config.layout.right[gotoCol]) {
                            gotoCell = config.layout.right[gotoCol].fields.length - 1;
                        }
                    }

                    if (!config.layout.right[gotoCol]) {
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

        focusInAMoment(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, row, gotoRow);
    }

    return false;
};
