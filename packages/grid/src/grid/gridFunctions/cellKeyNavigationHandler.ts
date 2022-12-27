import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { getElementByClassName } from '../gridFunctions/getElementByClassName';

const TAB_KEY = 'Tab';
const ARROW_UP_KEY = 'ArrowUp';
const ARROW_DOWN_KEY = 'ArrowDown';
const ARROW_LEFT_KEY = 'ArrowLeft';
const ARROW_RIGHT_KEY = 'ArrowRight';
const allowedKeys = [TAB_KEY, ARROW_UP_KEY, ARROW_DOWN_KEY, ARROW_LEFT_KEY, ARROW_RIGHT_KEY] as const;
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

    if (allowedKeys.includes(event.code)) {
        event.preventDefault();

        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const scrollerRect = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller').getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const innerWidth = scrollerEl.clientWidth;
        const scrollleft = scrollerEl.scrollLeft;
        const colLeft: number[] = [];
        const widths: number[] = [];
        let lastLeft = 0;
        const columnsCenter = ctx.gridInterface.__getGridConfig().columnsCenter;
        columnsCenter.forEach((c) => {
            colLeft.push(lastLeft);
            widths.push(c.width);
            lastLeft = lastLeft + c.width;
        });
        const currentKey: CurrentKey = event.code;

        let shiftKey = event.shiftKey;
        if (currentKey === ARROW_LEFT_KEY) {
            shiftKey = true;
        }
        if (currentKey === ARROW_RIGHT_KEY) {
            shiftKey = false;
        }
        if (currentKey === ARROW_DOWN_KEY) {
            shiftKey = null;
        }
        if (currentKey === ARROW_UP_KEY) {
            shiftKey = null;
        }

        let gotoColType = colType;
        let gotoCell = celno;
        let gotorow = row;
        let gotCol = column;

        switch (colType) {
            case 'left-pinned':
                /*todo*/
                break;

            case 'middle-pinned':
                const columnleft = column < 2 ? column : column - 1;
                const columnRight = column > colLeft.length ? column : column + 1;
                const colLeftx = colLeft[columnleft];
                const colRightx = colLeft[columnRight] + widths[columnRight];
                const top = cellRect.top - scrollerRect.top;
                const bottom = scrollerRect.bottom - cellRect.bottom;
                const rowHeight = ctx.gridInterface.__getGridConfig().__rowHeight * 2;
                const rows = columnsCenter[column].rows || [];

                if (currentKey === ARROW_DOWN_KEY) {
                    switch (true) {
                        case celno === rows.length - 1:
                            gotoCell = 0;
                            gotorow = row + 1;
                            break;
                        case celno < rows.length - 1:
                            gotoCell = celno + 1;
                            break;
                    }
                }

                if (currentKey === ARROW_UP_KEY) {
                    switch (true) {
                        case celno === 0:
                            gotoCell = rows.length - 1;
                            gotorow = row - 1;
                            break;
                        case celno > 0:
                            gotoCell = celno - 1;

                            break;
                    }
                }

                if (bottom < rowHeight) {
                    scrollerEl.scrollTop = scrollerEl.scrollTop + rowHeight;
                }

                if (top < rowHeight) {
                    scrollerEl.scrollTop = scrollerEl.scrollTop - rowHeight;
                }

                // tab key logic
                if (shiftKey !== null) {
                    if (gotCol === 0) {
                        scrollerEl.scrollLeft = 0;
                    }

                    if (shiftKey === true && celno > 0) {
                        gotoCell = celno - 1;
                        shiftKey = null;
                    }

                    if (shiftKey === false && celno < columnsCenter[column].rows.length - 1) {
                        gotoCell = celno + 1;
                        shiftKey = null;
                    }

                    if (shiftKey !== null) {
                        gotCol = column + (shiftKey ? -1 : 1);
                    }

                    switch (true) {
                        case column === colLeft.length - 1 && shiftKey === false:
                            scrollerEl.scrollLeft = 0;
                            gotoCell = 0;
                            gotCol = 0;
                            gotorow = row + 1;
                            break;

                        case column === 0 && shiftKey === true:
                            scrollerEl.scrollLeft = scrollerEl.scrollWidth;

                            gotCol = colLeft.length - 1;
                            gotorow = row - 1;
                            gotoCell = columnsCenter[gotCol].rows.length - 1;
                            break;

                        case innerWidth + scrollleft < colRightx && shiftKey === false:
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft + widths[columnRight];
                            gotoCell = 0;
                            gotCol = column + 1;
                            break;

                        case scrollleft > colLeftx && shiftKey === true:
                            scrollerEl.scrollLeft = scrollerEl.scrollLeft - widths[columnleft];
                            gotCol = column - 1;
                            gotoCell = columnsCenter[gotCol].rows.length - 1;
                            break;
                        case shiftKey === false || shiftKey === true:
                            if (column > gotCol) {
                                gotoCell = columnsCenter[gotCol].rows.length - 1;
                            } else {
                                gotoCell = 0;
                            }
                    }
                }
                break;

            case 'right-pinned':
                /*todo*/
                break;
        }
        waitForFocusTrigger = true;
        setTimeout(() => {
            const el = getElementByClassName(ctx.element, `cellpos-${gotoColType}-${gotorow}-${gotCol}-${gotoCell}`);
            if (el) {
                el.focus();
                if (gotorow !== row) {
                    ctx.gridInterface.getDatasource().setRowAsCurrentEntity(gotorow);
                }
            }
            waitForFocusTrigger = false;
        }, 100);

        return false;
    }
    return true;
};
