import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { getElementByClassName } from '../gridFunctions/getElementByClassName';

const TAB_KEY = 'Tab';
const ARROW_UP_KEY = 'ArrowUp';
const ARROW_DOWN_KEY = 'ArrowDown';
const ARROW_LEFT_KEY = 'ArrowLeft';
const ARROW_RIGHT_KEY = 'ArrowRight';
const arrowKeys = [ARROW_UP_KEY, ARROW_DOWN_KEY, ARROW_LEFT_KEY, ARROW_RIGHT_KEY] as const;
type CurrentKey = typeof TAB_KEY | typeof ARROW_UP_KEY | typeof ARROW_DOWN_KEY | typeof ARROW_LEFT_KEY | typeof ARROW_RIGHT_KEY;

let waitForFocusTrigger = false;

/**
 * there is a lot of weird logic here atm
 */
export const cellKeyNavigationHandler = (
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    event: any
) => {
    if (waitForFocusTrigger) {
        event.preventDefault();
        return false;
    }

    const currentKey: CurrentKey = event.code;

    if (arrowKeys.includes(event.code)) {
        console.log('TODO- not implented');
    }

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

        let isLastCell: boolean;

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
                        gotoColType = 'middle-pinned';
                        scrollerEl.scrollLeft = 0;
                        gotoCell = 0;
                        gotoCol = 0;
                    }
                } else if (currentKey === TAB_KEY && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;
                        gotoCell = 100;
                    }

                    if (!config.columnsPinnedLeft[gotoCol]) {
                        gotoColType = config.columnsPinnedRight.length ? 'right-pinned' : 'middle-pinned';
                        if (gotoColType === 'right-pinned') {
                            gotoCol = config.columnsPinnedRight.length - 1;
                            gotoCell = config.columnsPinnedRight[gotoCol].rows.length - 1;
                            gotoRow = gotoRow - 1;
                        }
                        if (gotoColType === 'middle-pinned') {
                            gotoCol = config.columnsCenter.length - 1;
                            gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
                            scrollerEl.scrollLeft = scrollerEl.scrollWidth;
                            gotoRow = gotoRow - 1;
                        }
                    } else {
                        if (gotoCol < column) {
                            gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
                        }
                        if (gotoCol > column) {
                            gotoCell = 0;
                        }
                    }
                }

                break;

            case 'middle-pinned':
                console.log('middle');

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
                            gotoRow = gotoRow + 1;
                        } else {
                            scrollerEl.scrollLeft = 0;
                            gotoCol = 0;
                            gotoCell = 0;
                            gotoRow = gotoRow + 1;
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

                    if (!config.columnsCenter[gotoCol]) {
                        if (config.columnsPinnedLeft.length) {
                            gotoColType = 'left-pinned';
                            gotoCol = config.columnsPinnedLeft.length - 1;
                            gotoCell = config.columnsPinnedLeft[gotoCol].rows.length - 1;
                        } else if (config.columnsPinnedRight.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = config.columnsPinnedRight.length - 1;
                            gotoCell = config.columnsPinnedRight[gotoCol].rows.length - 1;
                            gotoRow = gotoRow - 1;
                        } else {
                            gotoColType = 'middle-pinned';
                            gotoCol = config.columnsCenter.length - 1;
                            gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
                            gotoRow = gotoRow - 1;
                            scrollerEl.scrollLeft = scrollerEl.scrollWidth;
                        }
                    } else {
                        const columnleft = column < 2 ? column : column - 1;
                        const colLeftx = colLeft[columnleft];
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
                        gotoColType = config.columnsPinnedLeft.length ? 'left-pinned' : 'middle-pinned';
                        gotoCol = 0;
                        gotoCell = 0;
                        gotoRow = gotoRow + 1;
                        if (gotoColType === 'middle-pinned') {
                            scrollerEl.scrollLeft = 0;
                        }
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
                        gotoColType = 'middle-pinned';
                        scrollerEl.scrollLeft = scrollerEl.scrollWidth;
                        gotoCol = config.columnsCenter.length - 1;
                        gotoCell = config.columnsCenter[gotoCol].rows.length - 1;
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
            const el = getElementByClassName(ctx.element, `cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`);
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
