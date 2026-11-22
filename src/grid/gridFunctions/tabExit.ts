import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import { nextSection, sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { focusFilter, focusGroupButton, goToCell, rowPlaces } from './jumpKeys';

/**
 * Tab and Shift+Tab out of the grid.
 *
 * In the cells and the header filters the grid moves the focus on Tab itself (to the next cell,
 * wrapping to the next row) and cancels the browser's Tab. At the ends there is no cell to go to:
 * before the last cell of the last row (Tab) and the first header filter (Shift+Tab) the focus used to
 * stay where it was, a keyboard trap (WCAG 2.1.2).
 *
 * There the Tab is left to the browser. It moves the focus in the order of the dom, and the dom order
 * of the cells is the order of the reused row and column elements, not the order of the rows: from a
 * cell it could land on another cell. So the focus is first put on an element at the end (Tab) or the
 * start (Shift+Tab) of the grid, and the browser's Tab goes on from there, out of the grid. The
 * elements are `tabindex="-1"`: never a stop of the tab order themselves.
 */

/**
 * Makes the two elements the focus leaves the grid from, for createDom: the start one goes before
 * the header, the end one after everything else
 */
export function createTabExits(ctx: Grid) {
    const make = () => {
        const element = document.createElement('div');
        element.tabIndex = -1;
        element.setAttribute('aria-hidden', 'true');
        return element;
    };
    ctx.tabExitStart = make();
    ctx.tabExitEnd = make();
}

/**
 * Lets this Tab leave the grid: focuses the element at its end (forward) or start, and the browser's
 * Tab - not canceled - goes on from it
 */
export function leaveGrid(ctx: Grid, forward: boolean) {
    (forward ? ctx.tabExitEnd : ctx.tabExitStart).focus({ preventScroll: true });
}

/**
 * true for the last cell of a row in the order of Tab: the last field of the last column of the last
 * section with columns
 */
function isLastInRow(config: ParsedGridConfig, colType: ColType, column: number, celno: number) {
    const columns = sectionColumns(config, colType);
    return (
        nextSection(config, colType, true).rowStep === 1 &&
        column === columns.length - 1 &&
        celno === columns[column].fields.length - 1
    );
}

/**
 * true for the first cell of a row in the order of Tab: the first field of the first column of the
 * first section with columns
 */
function isFirstInRow(config: ParsedGridConfig, colType: ColType, column: number, celno: number) {
    return nextSection(config, colType, false).rowStep === -1 && column === 0 && celno === 0;
}

/**
 * true when a row - a data row or a group row - comes after `row` (step 1) or before it (step -1)
 * @param row a displayed row, -1 to look from the top
 */
function hasRow(ctx: Grid, row: number, step: 1 | -1) {
    const next = row + step;
    return next >= 0 && next < ctx.gridInterface.getDatasource().length();
}

/**
 * true when Tab (or Shift+Tab, `reverse`) on a cell has no row to go to: forward from the last
 * cell of the last row, backward from the first cell of the first row when the header filters are
 * hidden (shown, Shift+Tab goes up to them). Forward, tabPastRows goes on to the footer
 */
export function tabLeavesRows(ctx: Grid, row: number, column: number, celno: number, colType: ColType, reverse: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    if (reverse) {
        return isFirstInRow(config, colType, column, celno) && !hasRow(ctx, row, -1) && !!config.hideFilter;
    }
    return isLastInRow(config, colType, column, celno) && !hasRow(ctx, row, 1);
}

/**
 * true when Tab (or Shift+Tab, `reverse`) on a header filter has no cell to go to: backward from the
 * first filter, forward from the last one when there are no rows
 */
export function tabLeavesFilters(ctx: Grid, column: number, celno: number, colType: ColType, reverse: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    if (reverse) {
        return isFirstInRow(config, colType, column, celno);
    }
    return isLastInRow(config, colType, column, celno) && ctx.gridInterface.getDatasource().length() === 0;
}

/*
 * The group rows and the footer on the way of Tab.
 *
 * Tab goes through the grid in the order it is shown: the header filters, then the rows. A group row
 * has one stop, the button that expands and collapses it (renderRowGroup.ts): Tab from the last cell of
 * the row before it, Shift+Tab from the first cell of the row after it - Alt+arrows, Enter and the jump
 * keys (jumpKeys.ts) skip it, they move between cells. After the last row the footer's buttons (Clear and
 * the filter chips, or "No filter" without a filter) are stops, then Tab leaves the grid; Shift+Tab from
 * the first of them goes back to the last row.
 */

/**
 * The group row whose button is the next stop of Tab from a cell: the row after `row` (Tab from the
 * last cell of the row) or before it (Shift+Tab from the first cell) when it is a group row
 * @param row the row of the cell, -1 for the header filters
 * @returns the group row, -1 when the next stop is a cell (or out of the rows)
 */
export function tabGroupStop(ctx: Grid, row: number, column: number, celno: number, colType: ColType, reverse: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    const edge = reverse ? isFirstInRow(config, colType, column, celno) : isLastInRow(config, colType, column, celno);
    const next = reverse ? row - 1 : row + 1;
    const datasource = ctx.gridInterface.getDatasource();
    return edge && next >= 0 && next < datasource.length() && isGroupRow(datasource.getRow(next)) ? next : -1;
}

/**
 * Tab on the button of a group row: the next stop - the button of the next group row, the first cell
 * of the next data row, the footer (tabPastRows); Shift+Tab the button of the group row before, the last
 * cell of the data row before, the last header filter. Out of the grid at its ends
 */
export function groupRowTab(ctx: Grid, row: number, event: KeyboardEvent) {
    const datasource = ctx.gridInterface.getDatasource();
    const config = ctx.gridInterface.__getGridConfig();
    const places = rowPlaces(config);
    const reverse = event.shiftKey;
    const next = reverse ? row - 1 : row + 1;

    if (next >= datasource.length()) {
        tabPastRows(ctx, event);
        return;
    }
    if (next < 0) {
        if (!config.hideFilter && places.length && focusFilter(ctx, places[places.length - 1])) {
            event.preventDefault();
        } else {
            leaveGrid(ctx, false);
        }
        return;
    }
    event.preventDefault();
    if (isGroupRow(datasource.getRow(next))) {
        focusGroupButton(ctx, next);
    } else {
        goToCell(ctx, next, reverse ? places[places.length - 1] : places[0]);
    }
}

/**
 * Tab past the last cell of the last row (or the last header filter, with no rows): into the footer,
 * on its first button - else out of the grid, the browser's Tab goes on from the end of the grid
 */
export function tabPastRows(ctx: Grid, event: KeyboardEvent) {
    const first = footerStops(ctx)[0];
    if (first) {
        event.preventDefault();
        first.focus({ preventScroll: true });
    } else {
        leaveGrid(ctx, true);
    }
}

/**
 * The stops of Tab in the footer, in their order: the Clear button and the filter chips (a button of
 * their own) while the rows are filtered, else the button "No filter" (rebuildFooter.ts). None in a
 * footer of no height (`footerHeight: 0`)
 */
function footerStops(ctx: Grid): HTMLElement[] {
    const footer = ctx.element.querySelector('.simple-html-grid-footer');
    if (!footer || ctx.gridInterface.__getGridConfig().footerHeight <= 0) {
        return [];
    }
    return Array.from(footer.querySelectorAll<HTMLElement>('button, [tabindex="0"]'));
}

/**
 * The keys of the footer, on the footer element for createDom (its content is rendered again and again):
 * Tab on its last stop leaves the grid - the scrollbars and the cells come after it in the dom -
 * and Shift+Tab on its first goes back to the last row: the button of a group row, or the last cell of
 * a data row (the last header filter when there are no rows). Between its stops Tab is the browser's
 */
export function addFooterKeys(ctx: Grid, footer: HTMLElement) {
    footer.addEventListener(
        'keydown',
        (event) => {
            if (event.key !== 'Tab' || event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }
            const stops = footerStops(ctx);
            if (!event.shiftKey && event.target === stops[stops.length - 1]) {
                leaveGrid(ctx, true);
            } else if (event.shiftKey && event.target === stops[0]) {
                if (focusLastRowStop(ctx)) {
                    event.preventDefault();
                } else {
                    leaveGrid(ctx, false);
                }
            }
        },
        { signal: ctx.scrollListenersAbort?.signal }
    );
}

/**
 * Focuses the last stop of Tab before the footer: the button of the last row when it is a group row,
 * else the last cell of the last row; the last header filter when there are no rows
 * @returns false when there is none
 */
function focusLastRowStop(ctx: Grid): boolean {
    const config = ctx.gridInterface.__getGridConfig();
    const datasource = ctx.gridInterface.getDatasource();
    const places = rowPlaces(config);
    const last = datasource.length() - 1;
    if (!places.length) {
        return false;
    }
    if (last === -1) {
        return !config.hideFilter && focusFilter(ctx, places[places.length - 1]);
    }
    if (isGroupRow(datasource.getRow(last))) {
        return focusGroupButton(ctx, last);
    }
    return goToCell(ctx, last, places[places.length - 1]);
}
