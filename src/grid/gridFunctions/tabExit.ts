import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import { nextSection, sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';

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
 * true when a data row comes after `row` (step 1) or before it (step -1). Tab skips the group rows
 * @param row a displayed row, -1 to look from the top
 */
function hasDataRow(ctx: Grid, row: number, step: 1 | -1) {
    const datasource = ctx.gridInterface.getDatasource();
    for (let i = row + step; i >= 0 && i < datasource.length(); i = i + step) {
        if (!isGroupRow(datasource.getRow(i))) {
            return true;
        }
    }
    return false;
}

/**
 * true when Tab (or Shift+Tab, `reverse`) on a cell has no cell to go to: forward from the last
 * cell of the last data row, backward from the first cell of the first data row when the header
 * filters are hidden (shown, Shift+Tab goes up to them)
 */
export function tabLeavesRows(ctx: Grid, row: number, column: number, celno: number, colType: ColType, reverse: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    if (reverse) {
        return isFirstInRow(config, colType, column, celno) && !hasDataRow(ctx, row, -1) && !!config.hideFilter;
    }
    return isLastInRow(config, colType, column, celno) && !hasDataRow(ctx, row, 1);
}

/**
 * true when Tab (or Shift+Tab, `reverse`) on a header filter has no cell to go to: backward from the
 * first filter, forward from the last one when there is no data row to wrap to
 */
export function tabLeavesFilters(ctx: Grid, column: number, celno: number, colType: ColType, reverse: boolean) {
    const config = ctx.gridInterface.__getGridConfig();
    if (reverse) {
        return isFirstInRow(config, colType, column, celno);
    }
    return isLastInRow(config, colType, column, celno) && !hasDataRow(ctx, -1, 1);
}
