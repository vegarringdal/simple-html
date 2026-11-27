import type { Grid } from '../grid';
import type { ParsedGridConfig } from '../gridConfig';
import { sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { firstIndexAtOrAfter } from './firstIndexAtOrAfter';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import type { HTMLCellElement } from './HTMLCellElement';
import { extendRange, scrollCenterColumnIntoView, scrollRowIntoView } from './rangeSelection';
import { dataRowNear, edgeRow, firstDataRow, lastDataRow, pageIndex, pageRow } from './rowSteps';
import { triggerScrollEvent } from './triggerScrollEvent';

/**
 * The keys that jump: the keys of a spreadsheet that go further than the next cell. The cells are text
 * inputs that are always edited, so the keys a text input uses for its caret stay its own - Home, End,
 * Ctrl+ArrowLeft / Ctrl+ArrowRight (a word) - and Alt is the key of the grid, as for Alt+arrows:
 *
 * | key | goes to |
 * | --- | --- |
 * | Ctrl+Home / Ctrl+End | the first cell of the first row / the last cell of the last row |
 * | Alt+Home / Alt+End | the first / last cell of the row |
 * | PageUp / PageDown | the cell a page of rows up / down, the same column: the rows scroll a page with it |
 * | Alt+PageUp / Alt+PageDown | the cell a page of middle columns left / right, the same row |
 * | Ctrl+ArrowUp / Ctrl+ArrowDown | the edge of the data in the column (rowSteps.ts edgeRow) |
 *
 * Cmd is Ctrl on a Mac. Group rows are skipped, as the arrows skip them. The first and last cell are in
 * the order of Tab: the sections left to right, the fields of a column top to bottom.
 *
 * With Shift they extend the last range of cells instead (as Alt+Shift+arrows do, rangeSelection.ts):
 * Ctrl+Shift+Home / End, Alt+Shift+Home / End, Shift+PageUp / PageDown, Ctrl+Shift+ArrowUp / ArrowDown.
 * Not Alt+Shift+PageUp / PageDown. The focus stays in the active cell.
 *
 * From a header filter: Ctrl+Home / Ctrl+End, Alt+Home / Alt+End (the first / last filter) and PageDown
 * (the cell under it in the last row on screen). From a column header and the button of a group row:
 * Ctrl+Home / Ctrl+End.
 */

/**
 * a cell of a row by where it is in the layout - the `$` fields of a cell element: the section, the
 * column in it, the field in the column
 */
export interface CellPlace {
    colType: ColType;
    column: number;
    celno: number;
}

/** a cell of a row and its field */
type FieldPlace = CellPlace & { field: string };

/** what a key does, see the table at the top */
type Jump =
    | 'gridStart'
    | 'gridEnd'
    | 'rowStart'
    | 'rowEnd'
    | 'pageUp'
    | 'pageDown'
    | 'columnsLeft'
    | 'columnsRight'
    | 'edgeUp'
    | 'edgeDown';

/** the sections in the order of Tab */
const SECTIONS: ColType[] = [LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE];

/**
 * The cells of a row in the order of Tab: the sections left to right, their columns, the fields of a
 * column top to bottom - the order of getLayoutFields()
 */
export function rowPlaces(config: ParsedGridConfig): FieldPlace[] {
    const places: FieldPlace[] = [];
    for (const colType of SECTIONS) {
        sectionColumns(config, colType).forEach((column, index) => {
            column.fields.forEach((field, celno) => {
                places.push({ colType, column: index, celno, field });
            });
        });
    }
    return places;
}

/**
 * What a key does, null for a key that is not one of these. Ctrl or Cmd, not with Alt (Ctrl+Alt is
 * AltGr on Windows). Ctrl+PageUp / PageDown are left to the browser (its tabs)
 */
function jumpOf(event: KeyboardEvent): Jump | null {
    if (event.isComposing) {
        return null;
    }
    const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey;
    const alt = event.altKey && !event.ctrlKey && !event.metaKey;
    const plain = !event.altKey && !event.ctrlKey && !event.metaKey;
    switch (event.key) {
        case 'Home':
            return ctrl ? 'gridStart' : alt ? 'rowStart' : null;
        case 'End':
            return ctrl ? 'gridEnd' : alt ? 'rowEnd' : null;
        case 'PageUp':
            return plain ? 'pageUp' : alt && !event.shiftKey ? 'columnsLeft' : null;
        case 'PageDown':
            return plain ? 'pageDown' : alt && !event.shiftKey ? 'columnsRight' : null;
        case 'ArrowUp':
            return ctrl ? 'edgeUp' : null;
        case 'ArrowDown':
            return ctrl ? 'edgeDown' : null;
        default:
            return null;
    }
}

/**
 * The keys of the table at the top in a body cell, for its keydown - after the ranges' keys, before the
 * key navigation of Tab and Alt+arrows. The key is prevented: in a text input Ctrl+Home and Ctrl+End do
 * what Home and End do, PageUp and PageDown nothing of use, Alt+Home is a browser's home page
 * @param row the row of the cell (displayed)
 * @param here where the cell is in the row
 * @returns true when it used the key
 */
export function jumpKeydown(ctx: Grid, event: KeyboardEvent, row: number, here: CellPlace): boolean {
    const jump = jumpOf(event);
    if (!jump) {
        return false;
    }
    event.preventDefault();
    const config = ctx.gridInterface.__getGridConfig();
    const field = sectionColumns(config, here.colType)[here.column]?.fields[here.celno];
    if (field === undefined) {
        return true;
    }
    if (event.shiftKey) {
        extendByJump(ctx, jump, { row, field });
        return true;
    }

    const places = rowPlaces(config);
    switch (jump) {
        case 'gridStart':
            goToCell(ctx, firstDataRow(ctx), places[0], { scroll: () => scrollMiddleTo(ctx, 'start') });
            break;
        case 'gridEnd':
            goToCell(ctx, lastDataRow(ctx), places[places.length - 1], { scroll: () => scrollMiddleTo(ctx, 'end') });
            break;
        case 'rowStart':
            goToCell(ctx, row, places[0], { scroll: () => scrollMiddleTo(ctx, 'start') });
            break;
        case 'rowEnd':
            goToCell(ctx, row, places[places.length - 1], { scroll: () => scrollMiddleTo(ctx, 'end') });
            break;
        case 'pageUp':
        case 'pageDown':
            goPage(ctx, row, here, jump === 'pageUp' ? -1 : 1);
            break;
        case 'columnsLeft':
        case 'columnsRight':
            goColumnsPage(ctx, row, here, jump === 'columnsLeft' ? -1 : 1);
            break;
        case 'edgeUp':
        case 'edgeDown':
            goToCell(ctx, edgeRow(ctx, row, field, jump === 'edgeUp' ? -1 : 1), here);
            break;
    }
    return true;
}

/**
 * Shift with a key of the table: the end of the last range goes where the key goes, see extendRange.
 * Alt+Shift+PageUp / PageDown do nothing
 */
function extendByJump(ctx: Grid, jump: Jump, here: { row: number; field: string }) {
    // -1 when there is no data row: the end stays
    const rowOr = (row: number, end: number) => (row === -1 ? end : row);
    extendRange(ctx, here, (end, fields) => {
        switch (jump) {
            case 'gridStart':
                return { row: rowOr(firstDataRow(ctx), end.row), field: fields[0] };
            case 'gridEnd':
                return { row: rowOr(lastDataRow(ctx), end.row), field: fields[fields.length - 1] };
            case 'rowStart':
                return { row: end.row, field: fields[0] };
            case 'rowEnd':
                return { row: end.row, field: fields[fields.length - 1] };
            case 'pageUp':
            case 'pageDown':
                return { row: pageRow(ctx, end.row, jump === 'pageUp' ? -1 : 1), field: end.field };
            case 'edgeUp':
            case 'edgeDown':
                return { row: edgeRow(ctx, end.row, end.field, jump === 'edgeUp' ? -1 : 1), field: end.field };
            default:
                return end;
        }
    });
}

/**
 * Ctrl+Home / Ctrl+End where there is no cell: in a column header and on the button of a group row -
 * the first cell of the first row, the last cell of the last row. Prevents the key
 * @returns true when it was one of them
 */
export function gridCornerKey(ctx: Grid, event: KeyboardEvent): boolean {
    const jump = jumpOf(event);
    if ((jump !== 'gridStart' && jump !== 'gridEnd') || event.shiftKey) {
        return false;
    }
    event.preventDefault();
    focusGridCorner(ctx, jump === 'gridEnd');
    return true;
}

/**
 * Focuses the first cell of the first data row, or the last cell of the last one (`end`), and scrolls
 * the middle columns to that end - Ctrl+Home / Ctrl+End
 * @returns false when there is no data row
 */
export function focusGridCorner(ctx: Grid, end: boolean): boolean {
    const places = rowPlaces(ctx.gridInterface.__getGridConfig());
    const row = end ? lastDataRow(ctx) : firstDataRow(ctx);
    const place = end ? places[places.length - 1] : places[0];
    return goToCell(ctx, row, place, { scroll: () => scrollMiddleTo(ctx, end ? 'end' : 'start') });
}

/**
 * The keys of the table at the top in a header filter, for its keydown: Ctrl+Home / Ctrl+End (the cells),
 * Alt+Home / Alt+End (the first / last filter) and PageDown - the cell under the filter in the last row
 * that is on screen as a whole. The other keys are the filter's
 * @param here where the filter is in the filter row
 * @returns true when it used the key
 */
export function filterJumpKeydown(ctx: Grid, event: KeyboardEvent, here: CellPlace): boolean {
    const jump = jumpOf(event);
    if (!jump || event.shiftKey) {
        return false;
    }
    const places = rowPlaces(ctx.gridInterface.__getGridConfig());
    switch (jump) {
        case 'gridStart':
        case 'gridEnd':
            event.preventDefault();
            focusGridCorner(ctx, jump === 'gridEnd');
            return true;
        case 'rowStart':
        case 'rowEnd': {
            event.preventDefault();
            const end = jump === 'rowEnd';
            focusFilter(ctx, end ? places[places.length - 1] : places[0], () => scrollMiddleTo(ctx, end ? 'end' : 'start'));
            return true;
        }
        case 'pageDown': {
            event.preventDefault();
            const row = lastRowOnScreen(ctx);
            if (row !== -1) {
                goToCell(ctx, row, here);
            }
            return true;
        }
        default:
            return false;
    }
}

/**
 * The last row on screen as a whole - the last one partly on screen when it is the first one there - or
 * the data row above it when it is a group row (else the one below). -1 when there are no data rows.
 * For PageDown from a header filter
 */
function lastRowOnScreen(ctx: Grid): number {
    const { scrollTops, scrollHeights } = ctx.gridInterface.__getScrollState();
    const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const bottom = scroller.scrollTop + scroller.clientHeight;
    // the last row that starts above the bottom of the view
    let row = firstIndexAtOrAfter(scrollTops, bottom) - 1;
    if (row > 0 && scrollTops[row] + scrollHeights[row] > bottom && scrollTops[row] > scroller.scrollTop) {
        row = row - 1;
    }
    return dataRowNear(ctx, row, -1);
}

/**
 * PageUp / PageDown: the cell a page of rows up or down (pageRow), and the rows scroll as far as the
 * focus goes - it stays where it was on screen, as in a spreadsheet. In the first or last page: to the
 * first or last data row
 */
function goPage(ctx: Grid, row: number, here: CellPlace, step: 1 | -1) {
    const target = pageRow(ctx, row, step);
    const { scrollTops } = ctx.gridInterface.__getScrollState();
    goToCell(ctx, target, here, {
        scroll: () => {
            const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
            scrollRowsTo(ctx, scroller.scrollTop + scrollTops[target] - scrollTops[row]);
        }
    });
}

/**
 * Alt+PageUp / Alt+PageDown: the middle columns scroll a page (their width on screen) and the focus
 * goes as far: to the column that comes to where the cell was, the same field of it when it has as many
 * (else its last). From a pinned column the middle columns scroll and the focus stays
 */
function goColumnsPage(ctx: Grid, row: number, here: CellPlace, step: 1 | -1) {
    const center = ctx.gridInterface.__getGridConfig().layout.center;
    const middle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const page = Math.max(middle.clientWidth, 1);
    if (here.colType !== MIDDLE_PINNED_COLTYPE || !center.length) {
        goToCell(ctx, row, here, { scroll: () => scrollMiddleTo(ctx, middle.scrollLeft + step * page) });
        return;
    }
    const lefts: number[] = [];
    let left = 0;
    for (const column of center) {
        lefts.push(left);
        left = left + column.width;
    }
    const column = pageIndex(lefts, here.column, step, page);
    const celno = Math.min(here.celno, center[column].fields.length - 1);
    goToCell(
        ctx,
        row,
        { colType: MIDDLE_PINNED_COLTYPE, column, celno },
        { scroll: () => scrollMiddleTo(ctx, middle.scrollLeft + lefts[column] - lefts[here.column]) }
    );
}

/**
 * Scrolls the rows to a position, kept between the first and the last: a browser keeps it there itself,
 * the tests' dom does not
 */
function scrollRowsTo(ctx: Grid, top: number) {
    const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const max = Math.max(0, ctx.gridInterface.__getScrollState().scrollHeight - scroller.clientHeight);
    scroller.scrollTop = Math.min(Math.max(top, 0), max);
}

/**
 * Scrolls the middle columns to their start, their end, or a position - kept between the two
 */
function scrollMiddleTo(ctx: Grid, to: 'start' | 'end' | number) {
    const middle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const width = ctx.gridInterface.__getGridConfig().layout.center.reduce((sum, column) => sum + column.width, 0);
    const max = Math.max(0, width - middle.clientWidth);
    const left = to === 'start' ? 0 : to === 'end' ? max : to;
    middle.scrollLeft = Math.min(Math.max(left, 0), max);
}

/**
 * Focuses a body cell and makes its row the current row, as moving to it with the keys does: scrolls
 * it into view first, and renders the rows and columns there now - a jump far away would else wait for
 * the scrolling to stop (see verticalScrollHandler). The focus is put without scrolling: the views
 * scroll with the grid's own scrollbars.
 * @param row a data row (displayed), nothing happens for -1
 * @param place where the cell is in the row
 * @param options.scroll scrolls first (a page, to an end), then the cell is scrolled into view
 * @param options.middle a cell out of view is put in the middle of the view, else at the edge it was past
 * @returns false when there was no cell to focus
 */
export function goToCell(
    ctx: Grid,
    row: number,
    place: CellPlace,
    options: { scroll?: () => void; middle?: boolean } = {}
): boolean {
    if (row < 0 || !ctx.domCreated) {
        return false;
    }
    const scroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const middle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const before = { top: scroller.scrollTop, left: middle.scrollLeft };
    options.scroll?.();
    scrollRowIntoView(ctx, row, options.middle);
    if (place.colType === MIDDLE_PINNED_COLTYPE) {
        scrollCenterColumnIntoView(ctx, place.column, options.middle);
    }
    if (scroller.scrollTop !== before.top || middle.scrollLeft !== before.left) {
        triggerScrollEvent(ctx);
    }

    const target = cellFocusable(ctx, row, place);
    if (!target) {
        return false;
    }
    target.focus({ preventScroll: true });
    const datasource = ctx.gridInterface.getDatasource();
    if (datasource.currentEntity !== datasource.getRow(row)) {
        datasource.setRowAsCurrentEntity(row);
    }
    return true;
}

/**
 * The element of a body cell on screen that gets the focus: its input (a checkbox too), or the host of
 * a custom cell (customCell.ts). Found by the `$` fields of the cells in the row and column elements
 * that are shown: a hidden one still has what it showed last. null when the cell is not on screen
 */
function cellFocusable(ctx: Grid, row: number, place: CellPlace): HTMLElement | null {
    for (const columnElement of ctx.columns.values()) {
        const shown = columnElement.style.display !== 'none' && columnElement.parentElement?.style.display !== 'none';
        if (!shown) {
            continue;
        }
        for (const child of columnElement.children) {
            const cell = child as HTMLCellElement;
            if (
                cell.$row === row &&
                cell.$coltype === place.colType &&
                cell.$column === place.column &&
                cell.$celno === place.celno &&
                cell.$attribute
            ) {
                // the host comes before what its renderer put in it: an input of its own
                return cell.querySelector<HTMLElement>('input, .simple-html-grid-cell-custom');
            }
        }
    }
    return null;
}

/**
 * Focuses the button of a group row (renderRowGroup.ts), after scrolling the row into view - a stop of
 * Tab, see tabExit.ts. The current row stays: a group row is never the current row
 * @param row a group row (displayed)
 * @returns false when there was no button to focus
 */
export function focusGroupButton(ctx: Grid, row: number): boolean {
    if (!ctx.domCreated) {
        return false;
    }
    if (scrollRowIntoView(ctx, row)) {
        triggerScrollEvent(ctx);
    }
    const cached = ctx.containerGroupRowCache.find((entry) => entry.row === row);
    const button = cached ? ctx.rows.get(cached.id)?.querySelector<HTMLElement>('[role="button"]') : null;
    button?.focus({ preventScroll: true });
    return !!button;
}

/**
 * Focuses a header filter, after scrolling its column into view (a middle column) - `scroll` first.
 * Nothing when the filters are hidden
 * @returns false when there was no filter to focus
 */
export function focusFilter(ctx: Grid, place: CellPlace, scroll?: () => void): boolean {
    const middle = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const before = middle.scrollLeft;
    scroll?.();
    if (place.colType === MIDDLE_PINNED_COLTYPE) {
        scrollCenterColumnIntoView(ctx, place.column);
    }
    if (middle.scrollLeft !== before) {
        triggerScrollEvent(ctx);
    }
    for (const columnElement of ctx.columnsHeaders.values()) {
        if (columnElement.style.display === 'none') {
            continue;
        }
        for (const child of columnElement.children) {
            const cell = child as HTMLCellElement;
            if (
                cell.getAttribute('type') === 'filter' &&
                cell.$coltype === place.colType &&
                cell.$column === place.column &&
                cell.$celno === place.celno
            ) {
                const input = cell.querySelector('input');
                input?.focus({ preventScroll: true });
                return !!input;
            }
        }
    }
    return false;
}
