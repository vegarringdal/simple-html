import { type Entity, isGroupRow } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import type { Grid } from '../grid';
import type { GridInterface } from '../gridInterface';
import { type CellPoint, rangeBlock, rangeRect } from './cellRanges';
import { followPointer, isPrimaryPress } from './followPointer';
import { getElementByClassName } from './getElementByClassName';
import { getLayoutFields } from './getLayoutFields';
import type { HTMLCellElement } from './HTMLCellElement';
import { AUTO_SCROLL_MS, cellPointAt } from './rangeSelection';

/**
 * Fill down, like a spreadsheet (plan item 34), see guides/17-selection-and-clipboard.md:
 *
 * - **Ctrl+D** (Cmd+D) in a cell, or `gridInterface.fillDown()`: in every range the values of its top
 *   row go into the rows under it; a range of one row - or the cell with the focus when there is no
 *   range - gets the values of the data row above it
 * - **The fill handle**: a small square at the bottom right corner of the last range. Dragged down, the
 *   range grows to the row under the pointer, and let go, the rows it grew by get the values of the
 *   range's rows, repeated from its top. Down only
 *
 * The values are copied as they are (a date as a new Date of the same time), not as text. Cells that
 * can not be edited are skipped, group rows have no cells, nothing happens in a readonly grid, and it is
 * one run of code: one step of the undo history.
 */

/** a value for another row: a date is copied, two rows must not share one Date */
function copyValue(value: unknown) {
    return value instanceof Date ? new Date(value.getTime()) : value;
}

/** writes a value into a cell, unless it can not be edited */
function fillCell(gridInterface: GridInterface<any>, row: Entity, field: string, value: unknown) {
    if (!gridInterface.__isCellReadonly(row, field)) {
        row[field] = copyValue(value);
    }
}

/** the data row above a displayed row, group rows skipped. undefined when there is none */
function dataRowAbove(gridInterface: GridInterface<any>, row: number): Entity | undefined {
    const datasource = gridInterface.getDatasource();
    for (let above = row - 1; above >= 0; above--) {
        const entity = datasource.getRow(above);
        if (entity && !isGroupRow(entity)) {
            return entity;
        }
    }
    return undefined;
}

/**
 * Fill down, see the top of this file
 * @param active the cell with the focus, filled when there is no range. null for none
 */
export function fillDown(gridInterface: GridInterface<any>, active: CellPoint | null) {
    if (gridInterface.__getGridConfig().readonly) {
        return;
    }
    // the cell being typed in is written too: it is rendered again, not left as it is
    gridInterface.getDatasource().getDataContainer().__history.endTyping();

    const ranges: CellRange[] = gridInterface.getRanges();
    const targets = ranges.length
        ? ranges
        : active
          ? [{ fromRow: active.row, fromField: active.field, toRow: active.row, toField: active.field }]
          : [];
    for (const range of targets) {
        const { rows, fields } = rangeBlock(gridInterface, range);
        // a range of one row takes the row above it
        const source = rows.length > 1 ? rows[0] : dataRowAbove(gridInterface, Math.min(range.fromRow, range.toRow));
        const below = rows.length > 1 ? rows.slice(1) : rows;
        if (!source) {
            continue;
        }
        for (const row of below) {
            for (const field of fields) {
                fillCell(gridInterface, row, field, source[field]);
            }
        }
    }
}

/**
 * Ctrl+D (Cmd+D) in a cell: fill down, and not the browser's bookmark. Not in a readonly grid, the key
 * is the browser's there
 * @returns true when it used the key
 */
export function fillDownKey(ctx: Grid, event: KeyboardEvent, row: number, field: string): boolean {
    const gridInterface = ctx.gridInterface;
    if (
        event.key.toLowerCase() !== 'd' ||
        !(event.ctrlKey || event.metaKey) ||
        event.shiftKey ||
        event.altKey ||
        gridInterface.__getGridConfig().readonly
    ) {
        return false;
    }
    event.preventDefault();
    fillDown(gridInterface, { row, field });
    return true;
}

/**
 * The fill handle of each grid: one element, put in the cell at the bottom right corner of the last
 * range (showFillHandle). Kept here and not on the grid: like the markers of showCellEdited
 */
const handles = new WeakMap<Grid, HTMLElement>();

/**
 * The field a cell goes with: its own, or for an empty cell under the last field of a column that field,
 * as it is in a range (rangeEdges in cellRanges.ts). undefined for none
 */
function fieldOf(cell: HTMLCellElement): string | undefined {
    for (let above: HTMLCellElement | null = cell; above; above = above.previousElementSibling as HTMLCellElement | null) {
        if (above.$attribute) {
            return above.$attribute;
        }
    }
    return undefined;
}

/**
 * true when the cell is the bottom right corner on screen of the last range: in its last row, with its
 * last field in the order of getLayoutFields() - and the bottom cell of that field: the empty cells under
 * the last field of a column go with it, the range's line goes round them too
 */
function isFillCorner(ctx: Grid, cell: HTMLCellElement): boolean {
    const state = ctx.gridInterface.__getRangeState();
    const last = state?.rects.at(-1);
    if (!state || !last || ctx.gridInterface.__getGridConfig().readonly || cell.$row !== last.bottom) {
        return false;
    }
    const field = fieldOf(cell);
    if (!field || state.layout.fields.indexOf(field) !== last.right) {
        return false;
    }
    // the cell under it shows another field, or there is none
    const under = cell.nextElementSibling as HTMLCellElement | null;
    return !under || !!under.$attribute;
}

/**
 * Puts the fill handle in the cell when it shows the corner of the last range, and takes it out when it
 * does not any more. For showCellRange: on every render of a body cell and for every cell on screen when
 * the ranges change - after the cell's template, lit removes what is after its content when the cell
 * gets another template
 */
export function showFillHandle(ctx: Grid, cell: HTMLCellElement) {
    let handle = handles.get(ctx);
    if (!isFillCorner(ctx, cell)) {
        if (handle?.parentNode === cell) {
            handle.remove();
        }
        return;
    }
    if (!handle) {
        handle = document.createElement('span');
        handle.className = 'simple-html-grid-fill-handle';
        // a screen reader user fills with Ctrl+D
        handle.setAttribute('aria-hidden', 'true');
        handle.addEventListener('pointerdown', (event) => fillHandlePointerDown(ctx, event));
        handles.set(ctx, handle);
    }
    if (handle.parentNode !== cell) {
        cell.appendChild(handle);
    }
}

/**
 * A press on the fill handle: the last range grows down with the pointer, and is filled when it is let
 * go - see the top of this file. Not a press of the cell: no new range, the focus stays where it is.
 * Dragged past the bottom of the rows the grid scrolls down, a row at a time
 */
function fillHandlePointerDown(ctx: Grid, down: PointerEvent) {
    if (!isPrimaryPress(down)) {
        return;
    }
    down.preventDefault();
    down.stopPropagation();

    const gridInterface = ctx.gridInterface;
    const ranges = gridInterface.getRanges();
    const last = ranges.at(-1);
    if (!last) {
        return;
    }
    const others = ranges.slice(0, -1);
    const rect = rangeRect(last, getLayoutFields(gridInterface));
    let bottom = rect.bottom;
    let at = { x: down.clientX, y: down.clientY };
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    const extendTo = (x: number, y: number) => {
        const over = cellPointAt(ctx, x, y);
        const next = over ? Math.max(rect.bottom, over.row) : bottom;
        if (next !== bottom) {
            bottom = next;
            // the rows top to bottom: the active cell is in the top row now
            gridInterface.__setRanges([
                ...others,
                { fromRow: rect.top, fromField: last.fromField, toRow: bottom, toField: last.toField }
            ]);
        }
    };

    const autoScroll = () => {
        scrollTimer = undefined;
        if (at.y <= ctx.body.getBoundingClientRect().bottom) {
            return;
        }
        const bodyScroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
        bodyScroller.scrollTop = bodyScroller.scrollTop + gridInterface.__getGridConfig().__rowHeight;
        scrollTimer = setTimeout(() => {
            extendTo(at.x, at.y);
            autoScroll();
        }, AUTO_SCROLL_MS);
    };

    followPointer(down.currentTarget as HTMLElement, down, {
        move: (event) => {
            at = { x: event.clientX, y: event.clientY };
            extendTo(at.x, at.y);
            if (scrollTimer === undefined) {
                autoScroll();
            }
        },
        up: () => {
            clearTimeout(scrollTimer);
            if (bottom > rect.bottom) {
                fillRows(gridInterface, last, rect.bottom + 1, bottom);
            }
        },
        cancel: () => {
            clearTimeout(scrollTimer);
            gridInterface.__setRanges(ranges);
        }
    });
}

/**
 * The rows a dragged fill handle grew the range by: the values of the range's rows, repeated from its
 * top, in its fields
 * @param range the range as it was
 * @param from the first displayed row it grew by
 * @param to the last
 */
export function fillRows(gridInterface: GridInterface<any>, range: CellRange, from: number, to: number) {
    if (gridInterface.__getGridConfig().readonly) {
        return;
    }
    gridInterface.getDatasource().getDataContainer().__history.endTyping();
    const { rows: source, fields } = rangeBlock(gridInterface, range);
    const { rows: targets } = rangeBlock(gridInterface, { ...range, fromRow: from, toRow: to });
    if (!source.length) {
        return;
    }
    targets.forEach((row, i) => {
        for (const field of fields) {
            fillCell(gridInterface, row, field, source[i % source.length][field]);
        }
    });
}
