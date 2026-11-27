import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import type { ColType } from './colType';
import { getElementByClassName } from './getElementByClassName';
import type { HTMLCellElement } from './HTMLCellElement';
import { focusGroupButton } from './jumpKeys';
import { scrollRowIntoView } from './rangeSelection';
import { leaveGrid, tabGroupStop, tabLeavesRows, tabPastRows } from './tabExit';
import { triggerScrollEvent } from './triggerScrollEvent';

const TAB_KEY = 'Tab';
const ARROW_UP_KEY = 'ArrowUp';
const ARROW_DOWN_KEY = 'ArrowDown';
const ARROW_LEFT_KEY = 'ArrowLeft';
const ARROW_RIGHT_KEY = 'ArrowRight';
type CurrentKey = typeof TAB_KEY | typeof ARROW_UP_KEY | typeof ARROW_DOWN_KEY | typeof ARROW_LEFT_KEY | typeof ARROW_RIGHT_KEY;

/**
 * Moves the focus to the element of a class at once (Tab, Enter, Alt+arrows): the row is scrolled into
 * view (scrollRowIntoView), the rows are rendered (triggerScrollEvent), then the cell is focused - as the
 * jump keys do (goToCell in jumpKeys.ts). The key has scrolled the middle columns sideways already. The
 * row the focus goes to is made the current row when it is not - also from a header filter into the first
 * row. Not a header filter: the filter row is no row of the data.
 *
 * It was 100ms later, after the scroll event had rendered the rows, and the keys that move or type were
 * canceled meanwhile (a held key repeated from the cell being left)
 * @param name the class of the cell's input: `cellpos-...`, `filter-cellpos-...` for a header filter
 * @param toRow the row it goes to
 */
export function focusCellNow(ctx: Grid, name: string, toRow: number) {
    const toFilter = name.startsWith('filter-');
    // the body scroller is the one that counts: triggerScrollEvent puts the others where it is
    if (!toFilter) {
        scrollRowIntoView(ctx, toRow);
    }
    triggerScrollEvent(ctx);
    const el = getElementByClassName(ctx.element, name);
    if (el) {
        el.focus();
        // the key's row was compared: from a header filter (row 0) into row 0 the current row stayed
        const datasource = ctx.gridInterface.getDatasource();
        if (!toFilter && datasource.currentEntity !== datasource.getRow(toRow)) {
            datasource.setRowAsCurrentEntity(toRow);
        }
    }
}

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

const SECTION_ORDER: ColType[] = ['left-pinned', 'middle-pinned', 'right-pinned'];

/**
 * columns of one section of the grid
 */
export function sectionColumns(config: ParsedGridConfig, colType: ColType) {
    switch (colType) {
        case 'left-pinned':
            return config.layout.left;
        case 'right-pinned':
            return config.layout.right;
        default:
            return config.layout.center;
    }
}

/**
 * Where focus goes when it leaves a section sideways, past its last column (forward) or its
 * first (backward). Sections are visited left -> middle -> right, past the right one it wraps to
 * the next row (the previous row going backward).
 * Sections without columns are skipped - every column can be pinned, which leaves the middle
 * section empty, and landing in it crashed on `layout.center[0].fields`.
 * @returns the section, its first (forward) or last (backward) column, and -1/0/1 rows to move
 */
export function nextSection(config: ParsedGridConfig, from: ColType, forward: boolean) {
    let index = SECTION_ORDER.indexOf(from);
    let rowStep = 0;
    for (let i = 0; i < SECTION_ORDER.length; i++) {
        index = index + (forward ? 1 : -1);
        if (index > SECTION_ORDER.length - 1) {
            index = 0;
            rowStep = 1;
        }
        if (index < 0) {
            index = SECTION_ORDER.length - 1;
            rowStep = -1;
        }
        const columns = sectionColumns(config, SECTION_ORDER[index]);
        if (columns.length) {
            return { colType: SECTION_ORDER[index], column: forward ? 0 : columns.length - 1, rowStep };
        }
    }

    // no section has columns, so there is no cell to move from either
    return { colType: from, column: 0, rowStep: 0 };
}

/**
 * moves the focus target out of its section, see nextSection.
 * Also scrolls the center section to the end focus enters it from, and moves to the next or
 * previous row (skipping group rows) when it wrapped. Going up past the first row lands in the
 * header filter row.
 */
function leaveSection(
    ctx: Grid,
    config: ParsedGridConfig,
    scrollerEl: HTMLElement,
    colType: ColType,
    forward: boolean,
    gotoRow: number
) {
    const next = nextSection(config, colType, forward);
    if (next.colType === 'middle-pinned') {
        scrollerEl.scrollLeft = forward ? 0 : scrollerEl.scrollWidth;
    }

    let row = gotoRow;
    let filterClass = '';
    if (next.rowStep) {
        // by direction, not key: shift+tab has to skip group rows upwards
        row = overrideGroupRow(ctx, forward ? ARROW_DOWN_KEY : ARROW_UP_KEY, row + next.rowStep);
        if (row < 0) {
            row = 0;
            filterClass = 'filter-';
        }
    }

    return { colType: next.colType, column: next.column, row, filterClass };
}

/**
 * this handler tab, and arrow key navigation on rows
 */
export const cellRowKeyNavigationCellRowHandler = (
    ctx: Grid,
    _cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    event: any,
    codeOverride: string // when we want to force a action
) => {
    const currentKey: CurrentKey = codeOverride ? codeOverride : event.code;

    const altKey = codeOverride ? true : event.altKey;

    if (currentKey === ARROW_LEFT_KEY || currentKey === ARROW_RIGHT_KEY) {
        if (!altKey) {
            return true;
        }
        event.preventDefault();
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const innerWidth = scrollerEl.clientWidth;
        const scrollleft = scrollerEl.scrollLeft;
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
        let filterClass = '';

        switch (colType) {
            case 'left-pinned':
                // the cell number is kept, like in the other sections, and clamped below.
                // (moving left used to jump to the last cell, read from layout.center[gotoCol] -
                // a crash when there were more left pinned than center columns)
                if (currentKey === ARROW_RIGHT_KEY) {
                    gotoCol = gotoCol + 1;

                    if (!config.layout.left[gotoCol]) {
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, true, gotoRow));
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;

                    if (!config.layout.left[gotoCol]) {
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, false, gotoRow));
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
                            gotoRow = gotoRow + 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        } else {
                            scrollerEl.scrollLeft = 0;
                            gotoCol = 0;
                            gotoCell = 0;
                            gotoRow = gotoRow + 1;
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

                    if (!config.layout.center[gotoCol]) {
                        if (config.layout.left.length) {
                            gotoColType = 'left-pinned';
                            gotoCol = config.layout.left.length - 1;
                        } else if (config.layout.right.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = config.layout.right.length - 1;

                            gotoRow = gotoRow - 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                            if (gotoRow < 0) {
                                gotoRow = 0;
                                filterClass = 'filter-';
                            }
                        } else {
                            gotoColType = 'middle-pinned';
                            gotoCol = config.layout.center.length - 1;
                            gotoRow = gotoRow - 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                            if (gotoRow < 0) {
                                gotoRow = 0;
                                filterClass = 'filter-';
                            }
                            scrollerEl.scrollLeft = scrollerEl.scrollWidth;
                        }
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
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, true, gotoRow));
                    }
                } else if (currentKey === ARROW_LEFT_KEY) {
                    gotoCol = gotoCol - 1;
                    if (!config.layout.right[gotoCol]) {
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, false, gotoRow));
                    }
                }
                break;
        }

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

        focusCellNow(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, gotoRow);
    }

    /*
     * all logic if using arrow keys up or down
     */
    if (currentKey === ARROW_UP_KEY || currentKey === ARROW_DOWN_KEY) {
        if (!altKey) {
            return true;
        }
        event.preventDefault();

        const config = ctx.gridInterface.__getGridConfig();
        const gotoColType = colType;
        let gotoCell = celno;
        let gotoRow = row;
        const gotoCol = column;
        let filterClass = '';

        let isLastCell: boolean;

        switch (colType) {
            case 'left-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.layout.left[column].fields.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoRow = gotoRow + 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoRow = gotoRow - 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        if (gotoRow < 0) {
                            gotoRow = 0;
                            filterClass = 'filter-';
                        }
                        gotoCell = config.layout.left[gotoCol].fields.length - 1;
                    }
                }

                break;

            case 'middle-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.layout.center[column].fields.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoRow = gotoRow + 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoRow = gotoRow - 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        if (gotoRow < 0) {
                            gotoRow = 0;
                            filterClass = 'filter-';
                        }
                        gotoCell = config.layout.center[gotoCol].fields.length - 1;
                    }
                }

                break;

            case 'right-pinned':
                if (currentKey === ARROW_DOWN_KEY) {
                    isLastCell = gotoCell === config.layout.right[column].fields.length - 1;
                    if (!isLastCell) {
                        gotoCell = gotoCell + 1;
                    } else {
                        gotoRow = gotoRow + 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        gotoCell = 0;
                    }
                } else if (currentKey === ARROW_UP_KEY) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoRow = gotoRow - 1;
                        gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        if (gotoRow < 0) {
                            gotoRow = 0;
                            filterClass = 'filter-';
                        }
                        gotoCell = config.layout.right[gotoCol].fields.length - 1;
                    }
                }
                break;
        }

        focusCellNow(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, gotoRow);
    }

    /**
     * all logic if using tab
     */
    if (currentKey === TAB_KEY) {
        // no row to go to: on to the footer, or the browser's Tab takes the focus out of the grid, see tabExit.ts
        if (tabLeavesRows(ctx, row, column, celno, colType, event.shiftKey)) {
            if (event.shiftKey) {
                leaveGrid(ctx, false);
            } else {
                tabPastRows(ctx, event);
            }
            return true;
        }
        // a group row next: its button is the next stop
        const groupStop = tabGroupStop(ctx, row, column, celno, colType, event.shiftKey);
        if (groupStop !== -1) {
            event.preventDefault();
            focusGroupButton(ctx, groupStop);
            return false;
        }
        event.preventDefault();
        const scrollerEl = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        const innerWidth = scrollerEl.clientWidth;
        const scrollleft = scrollerEl.scrollLeft;
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
        let filterClass = '';

        let isLastCell: boolean;

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
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, true, gotoRow));
                        gotoCell = 0;
                    }
                } else if (currentKey === TAB_KEY && reverse) {
                    if (gotoCell !== 0) {
                        gotoCell = gotoCell - 1;
                    } else {
                        gotoCol = gotoCol - 1;
                    }

                    if (!config.layout.left[gotoCol]) {
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, false, gotoRow));
                        gotoCell = sectionColumns(config, gotoColType)[gotoCol].fields.length - 1;
                    } else if (gotoCol < column) {
                        // last cell of the previous left pinned column (was read from layout.center)
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
                            gotoRow = gotoRow + 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                        } else {
                            scrollerEl.scrollLeft = 0;
                            gotoCol = 0;
                            gotoCell = 0;
                            gotoRow = gotoRow + 1;
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

                    if (!config.layout.center[gotoCol]) {
                        if (config.layout.left.length) {
                            gotoColType = 'left-pinned';
                            gotoCol = config.layout.left.length - 1;
                            gotoCell = config.layout.left[gotoCol].fields.length - 1;
                        } else if (config.layout.right.length) {
                            gotoColType = 'right-pinned';
                            gotoCol = config.layout.right.length - 1;
                            gotoCell = config.layout.right[gotoCol].fields.length - 1;
                            gotoRow = gotoRow - 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                            if (gotoRow < 0) {
                                gotoRow = 0;
                                filterClass = 'filter-';
                            }
                        } else {
                            gotoColType = 'middle-pinned';
                            gotoCol = config.layout.center.length - 1;
                            gotoCell = config.layout.center[gotoCol].fields.length - 1;
                            gotoRow = gotoRow - 1;
                            gotoRow = overrideGroupRow(ctx, currentKey, gotoRow);
                            if (gotoRow < 0) {
                                gotoRow = 0;
                                filterClass = 'filter-';
                            }
                            scrollerEl.scrollLeft = scrollerEl.scrollWidth;
                        }
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
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, true, gotoRow));
                        gotoCell = 0;
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
                        ({
                            colType: gotoColType,
                            column: gotoCol,
                            row: gotoRow,
                            filterClass
                        } = leaveSection(ctx, config, scrollerEl, colType, false, gotoRow));
                        gotoCell = sectionColumns(config, gotoColType)[gotoCol].fields.length - 1;
                    }
                }
                break;
        }

        focusCellNow(ctx, `${filterClass}cellpos-${gotoColType}-${gotoRow}-${gotoCol}-${gotoCell}`, gotoRow);
    }

    return false;
};
