import { isGroupRow } from '../../datasource/entity';
import { isBlank } from '../../datasource/isBlank';
import type { Grid } from '../grid';
import { firstIndexAtOrAfter } from './firstIndexAtOrAfter';
import { getElementByClassName } from './getElementByClassName';

/**
 * Where the keys that move between the rows go, in the displayed rows: the next data row, the first and
 * the last, a page further, the edge of the data. Group rows are skipped, as the arrows skip them: they
 * have no cells. For the keys of the cells (jumpKeys.ts) and the ranges of cells (rangeSelection.ts).
 * The rows are indexes in the displayed rows (`datasource.getRows()`).
 */

/**
 * true for a displayed row that is a data row: there is one at the index, and it is no group row
 */
function isDataRow(ctx: Grid, row: number): boolean {
    const datasource = ctx.gridInterface.getDatasource();
    return row >= 0 && row < datasource.length() && !isGroupRow(datasource.getRow(row));
}

/**
 * The next data row up (`step` -1) or down (1) from a row, group rows skipped. The row itself when
 * there is none
 */
export function nextDataRow(ctx: Grid, row: number, step: 1 | -1): number {
    const length = ctx.gridInterface.getDatasource().length();
    for (let next = row + step; next >= 0 && next < length; next = next + step) {
        if (isDataRow(ctx, next)) {
            return next;
        }
    }
    return row;
}

/**
 * The data row at a row, or the first one after it in the direction of `step` - else the first one
 * before it. -1 when there is no data row
 */
export function dataRowNear(ctx: Grid, row: number, step: 1 | -1): number {
    if (isDataRow(ctx, row)) {
        return row;
    }
    const directions: (1 | -1)[] = [step, step === 1 ? -1 : 1];
    for (const direction of directions) {
        const next = nextDataRow(ctx, row, direction);
        if (next !== row) {
            return next;
        }
    }
    return -1;
}

/**
 * the first data row, -1 when there is none
 */
export function firstDataRow(ctx: Grid): number {
    return dataRowNear(ctx, 0, 1);
}

/**
 * the last data row, -1 when there is none
 */
export function lastDataRow(ctx: Grid): number {
    return dataRowNear(ctx, ctx.gridInterface.getDatasource().length() - 1, -1);
}

/**
 * The height of a page: the rows the view of the rows shows, in px. The view is the body scroller's,
 * as scrollCellIntoView uses it. At least a row, also while the grid is not on screen (0 high)
 */
export function pageHeight(ctx: Grid): number {
    const view = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller').clientHeight;
    return Math.max(view, ctx.gridInterface.__getGridConfig().__rowHeight);
}

/**
 * The data row a page up (`step` -1) or down (1) from a row: the furthest row whose top is at most a
 * page height (pageHeight) from the row's top - what comes to where the row is on screen when the rows
 * scroll that far. Down and up again is the same row. A group row there: the data row after it, in that
 * direction. Past the first or the last row: the first or the last data row. The row itself when there
 * is no other
 */
export function pageRow(ctx: Grid, row: number, step: 1 | -1): number {
    const { scrollTops } = ctx.gridInterface.__getScrollState();
    if (!scrollTops.length) {
        return row;
    }
    const target = dataRowNear(ctx, pageIndex(scrollTops, row, step, pageHeight(ctx)), step);
    return target === -1 ? row : target;
}

/**
 * A page further in a list of starts - the tops of the rows, the lefts of the columns, sorted: from
 * index `from`, the furthest one that starts at most `page` px further. Forward (`step` 1) the last that
 * starts at its start + page or before; back (-1) the first that starts at its start - page or after:
 * forward and back again is the same index. At least one further, a row taller than a page (fitRows) is
 * no wall, and within the list
 */
export function pageIndex(starts: readonly number[], from: number, step: 1 | -1, page: number): number {
    const y = (starts[from] ?? 0) + step * page;
    let at = firstIndexAtOrAfter(starts, y);
    if (step === -1) {
        at = Math.min(at, from - 1);
    } else if (starts[at] !== y) {
        at = Math.max(at - 1, from + 1);
    }
    return Math.min(Math.max(at, 0), starts.length - 1);
}

/**
 * The edge of the data in a field from a row, up (`step` -1) or down (1) - Ctrl+ArrowUp / Ctrl+ArrowDown,
 * as in a spreadsheet: from a cell with a value whose next cell has one too, the last cell with a value
 * before a blank one (isBlank: null, undefined, '', an invalid date - 0 and false are values); else the
 * next cell with a value. Without one: the first or the last data row. Group rows are skipped, they are
 * no blank. The row itself at the edge of the rows
 */
export function edgeRow(ctx: Grid, row: number, field: string, step: 1 | -1): number {
    const datasource = ctx.gridInterface.getDatasource();
    const blank = (index: number) => isBlank(datasource.getRow(index)?.[field]);

    let current = nextDataRow(ctx, row, step);
    if (current === row) {
        return row;
    }
    // in a block of values: to its end
    const inBlock = !blank(row) && !blank(current);
    for (let next = nextDataRow(ctx, current, step); next !== current; next = nextDataRow(ctx, current, step)) {
        if (inBlock ? blank(next) : !blank(current)) {
            break;
        }
        current = next;
    }
    return current;
}
