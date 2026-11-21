import { isGroupRow } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import type { Grid } from '../grid';
import { setAria } from './ariaGrid';
import { type CellPoint, rangeEdges } from './cellRanges';
import type { ColType } from './colType';
import { followPointer, isPrimaryPress } from './followPointer';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import { getLayoutFields } from './getLayoutFields';
import type { HTMLCellElement } from './HTMLCellElement';
import { pinnedSection } from './pinnedSection';

/**
 * The cell ranges in the grid (see CellRange, cellRanges.ts for the model): making them with the
 * mouse and the keyboard, and showing them on the cells. Copy, paste and clear are rangeClipboard.ts.
 *
 * The mouse (and a pen), from a press on a body cell with a field - not on its focus button or edited
 * marker, they are buttons:
 * - a press and a drag over the cells: a range from the cell pressed to the cell under the pointer.
 *   Inside the cell pressed it is the input's own text selection; once the pointer is on another
 *   cell it is a range, and the text selection the press started is collapsed again
 * - Shift: the last range (or the active cell, the one with the focus) to the cell pressed - the
 *   focus stays in the active cell
 * - Ctrl or Cmd: another range, from the cell pressed. With no range yet the active cell stays
 *   selected, as a range of its own
 * - a plain press clears the ranges. So does the focus moving to another cell (Tab, Alt+arrows, a
 *   click) and typing in a cell
 * - dragged past the top or the bottom of the rows the grid scrolls, past the left or right edge of the
 *   grid the middle columns scroll
 * - a finger does none of this: it scrolls the grid, see addScrollEventListeners.ts
 *
 * The keyboard, in a cell (the cell's keydown calls rangeKeydown): Alt+Shift+arrows move the end of
 * the last range (from the focused cell when there is none), Esc clears the ranges. Delete and
 * Backspace clear the cells of the ranges, see rangeDeleteKey in rangeClipboard.ts.
 *
 * The cells in a range have the class `simple-html-cell-in-range` and `aria-selected="true"`, the
 * cells at its edges `simple-html-cell-range-top` / `-bottom` / `-left` / `-right`: see showCellRange.
 */

/** the class of a cell in a range */
const IN_RANGE_CLASS = 'simple-html-cell-in-range';

/** the classes of the sides of a cell that are an edge of the ranges */
const RANGE_EDGE_CLASSES = {
    top: 'simple-html-cell-range-top',
    bottom: 'simple-html-cell-range-bottom',
    left: 'simple-html-cell-range-left',
    right: 'simple-html-cell-range-right'
} as const;

/** how often (ms) a drag past the edge of the rows scrolls on, see rangePointerDown */
export const AUTO_SCROLL_MS = 50;

/** how far (px) the middle columns scroll each time, dragged past the left or right edge of the grid */
const AUTO_SCROLL_X = 40;

/**
 * Shows whether a body cell is in a range: its classes and `aria-selected`. For renderRowCell, on every
 * render of a body cell - the cells are reused while scrolling, the classes follow the row and field
 * the cell shows - and for renderRangeClasses. Reads what the cell shows from its `$` fields
 * (renderCell sets them). A cell of a group row is in no range; an empty cell under the last field of
 * a column goes with that field (see rangeEdges), it is no gridcell and gets no `aria-selected`.
 */
export function showCellRange(ctx: Grid, cell: HTMLCellElement) {
    const state = ctx.gridInterface.__getRangeState();
    const edges = state ? rangeEdges(ctx.gridInterface, state, cell.$row, cell.$coltype, cell.$column, cell.$celno) : null;

    if (!edges) {
        if (cell.classList.contains(IN_RANGE_CLASS)) {
            cell.classList.remove(IN_RANGE_CLASS, ...Object.values(RANGE_EDGE_CLASSES));
            setAria(cell, 'aria-selected', null);
        }
        return;
    }

    cell.classList.add(IN_RANGE_CLASS);
    for (const side of ['top', 'bottom', 'left', 'right'] as const) {
        cell.classList.toggle(RANGE_EDGE_CLASSES[side], edges[side]);
    }
    // a gridcell can be selected (WAI-ARIA 1.2, gridcell): the cells in a range are. The others have
    // no aria-selected, see guides/17-selection-and-clipboard.md
    setAria(cell, 'aria-selected', cell.$attribute ? 'true' : null);
}

/**
 * Shows the ranges on the cells on screen, after they changed (GridInterface.__setRanges): only the
 * classes, the cells are not rendered - the input the user types in keeps its text. The cells that
 * scroll in later get them from renderRowCell.
 */
export function renderRangeClasses(ctx: Grid) {
    // the ranges can be set before the dom is made, the first render shows them
    if (!ctx.domCreated) {
        return;
    }
    const sections: ColType[] = [LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE];
    for (const colType of sections) {
        const { rowCache, columnCache } = pinnedSection(ctx, colType);
        for (const entry of rowCache) {
            if (entry.row === -1) {
                continue;
            }
            columnCache.forEach((cached, i) => {
                const columnElement = ctx.columns.get(`${entry.id}:${i}`);
                if (cached.column === -1 || !columnElement) {
                    return;
                }
                for (const cell of columnElement.children) {
                    showCellRange(ctx, cell as HTMLCellElement);
                }
            });
        }
    }
}

/**
 * The listeners of the ranges on the grid element, for createDom: a pointerdown on a cell. On the
 * body, not on each cell: the cells are reused while scrolling, the `$` fields of the cell say what it
 * shows. Removed with the scroll listeners (Grid.destroy())
 */
export function addRangeListeners(ctx: Grid) {
    ctx.body.addEventListener('pointerdown', (event) => rangePointerDown(ctx, event), {
        signal: ctx.scrollListenersAbort?.signal
    });
}

/**
 * The body cell of the grid with a field an element is in: null for anything else - a header cell, a
 * group row, the row selector, an empty cell under the last field of a column - and for the focus
 * button and the edited marker of a cell, they are buttons
 */
export function bodyCellOf(ctx: Grid, target: EventTarget | null): HTMLCellElement | null {
    if (
        !(target instanceof Element) ||
        !ctx.body?.contains(target) ||
        target.closest('.simple-html-grid-focus-button, .simple-html-cell-edited-marker')
    ) {
        return null;
    }
    const cell = target.closest('.simple-html-grid-col-cell') as HTMLCellElement | null;
    return cell && cell.getAttribute('type') === 'row-cell' && cell.$attribute ? cell : null;
}

/**
 * The input of a body cell that has the focus, and its cell: null when the focus is elsewhere. The
 * document's focus, or the shadow root's the grid is in
 */
export function focusedCell(ctx: Grid): { cell: HTMLCellElement; input: HTMLInputElement } | null {
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const input = root.activeElement;
    const cell = bodyCellOf(ctx, input ?? null);
    return cell && input instanceof HTMLInputElement ? { cell, input } : null;
}

/**
 * the cell a cell element shows, from its `$` fields
 */
export function pointOf(cell: HTMLCellElement): CellPoint {
    return { row: cell.$row, field: cell.$attribute as string };
}

function samePoint(a: CellPoint, b: CellPoint) {
    return a.row === b.row && a.field === b.field;
}

/**
 * a range of one cell
 */
function oneCell(point: CellPoint): CellRange {
    return { fromRow: point.row, fromField: point.field, toRow: point.row, toField: point.field };
}

/**
 * The text selected in an input: what its own copy, cut and Delete work on. A checkbox has none
 * (`selectionStart` is null for it)
 */
export function hasSelectedText(input: EventTarget | null): boolean {
    return input instanceof HTMLInputElement && input.selectionStart !== null && input.selectionStart !== input.selectionEnd;
}

/**
 * Collapses the text selected in an input to where it started: making a range ends a text selection.
 * A checkbox has none - setSelectionRange() would throw for it
 */
function collapseTextSelection(input: HTMLInputElement) {
    const { selectionStart, selectionEnd, selectionDirection } = input;
    if (selectionStart === null || selectionEnd === null || selectionStart === selectionEnd) {
        return;
    }
    // a selection made backwards started at its end
    const anchor = selectionDirection === 'backward' ? selectionEnd : selectionStart;
    input.setSelectionRange(anchor, anchor);
}

/**
 * The cell under a point of the window: what the browser's hit test finds there. A point above or
 * below the rows, or left or right of them, is moved just inside them first - the pointer dragged past
 * an edge selects up to the cell at that edge. An empty cell under the last field of a column is that
 * field, as it is in a range (rangeEdges). null when there is no body cell there
 */
function cellPointAt(ctx: Grid, x: number, y: number): CellPoint | null {
    // inside the border of the element of the rows: the views of the rows are in its padding box
    const rect = ctx.body.getBoundingClientRect();
    const left = rect.left + ctx.body.clientLeft;
    const top = rect.top + ctx.body.clientTop;
    const inX = Math.min(Math.max(x, left + 1), left + ctx.body.clientWidth - 1);
    const inY = Math.min(Math.max(y, top + 1), top + ctx.body.clientHeight - 1);
    // the document, or the shadow root the grid is in: its hit test finds the elements inside it. A grid
    // out of the dom is its own root, it has none
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const element = root.elementFromPoint ? root.elementFromPoint(inX, inY) : null;
    let cell = element?.closest('.simple-html-grid-col-cell') as HTMLCellElement | null | undefined;
    // the cells of a column element are its fields top to bottom, the empty ones last
    while (cell && cell.getAttribute('type') === 'row-cell' && !cell.$attribute && cell.previousElementSibling) {
        cell = cell.previousElementSibling as HTMLCellElement;
    }
    if (!cell || !ctx.body.contains(cell) || cell.getAttribute('type') !== 'row-cell' || !cell.$attribute) {
        return null;
    }
    const entity = ctx.gridInterface.getDatasource().getRow(cell.$row);
    return entity && !isGroupRow(entity) ? pointOf(cell) : null;
}

/**
 * A press on a cell: makes, adds to or clears the ranges, and follows the pointer - see the top of this
 * file. Only the primary pointer with its main button (`isPrimaryPress`), not a finger
 */
function rangePointerDown(ctx: Grid, down: PointerEvent) {
    if (!isPrimaryPress(down) || down.pointerType === 'touch') {
        return;
    }
    const pressed = bodyCellOf(ctx, down.target);
    if (!pressed) {
        return;
    }

    const gridInterface = ctx.gridInterface;
    const point = pointOf(pressed);
    const active = focusedCell(ctx);
    const activePoint = active ? pointOf(active.cell) : null;
    const ranges = gridInterface.getRanges();
    const last = ranges.at(-1);

    // the ranges before the one the pointer makes, and that one: its end follows the pointer
    let others: CellRange[] = [];
    let current: CellRange | null = null;

    if (down.shiftKey && (last || (activePoint && !samePoint(activePoint, point)))) {
        // from where the last range starts, or the active cell, to the cell pressed
        others = last ? ranges.slice(0, -1) : [];
        const from = last ? { row: last.fromRow, field: last.fromField } : (activePoint as CellPoint);
        current = { fromRow: from.row, fromField: from.field, toRow: point.row, toField: point.field };
        gridInterface.__setRanges([...others, current]);
        // the focus stays in the active cell, with its caret. A canceled pointerdown has no mousedown
        // after it (Pointer Events, compatibility mouse events), and the focus moves on the mousedown.
        // With no cell focused (the wheel takes the focus away) the cell pressed gets it: the keys work
        if (active && active.cell !== pressed) {
            down.preventDefault();
        }
    } else if (down.ctrlKey || down.metaKey) {
        // another range: the active cell stays selected as Excel keeps it, a range of its own
        others = ranges.length ? ranges : activePoint && !samePoint(activePoint, point) ? [oneCell(activePoint)] : [];
        current = oneCell(point);
        gridInterface.__setRanges([...others, current]);
    } else {
        gridInterface.clearRanges();
    }

    // while the pointer is down a focus moving to a cell is part of the gesture, see rangeCellFocused
    ctx.rangeGesture = true;
    // the pointer left the cell pressed: a range, not a text selection
    let moved = false;
    let at = { x: down.clientX, y: down.clientY };
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;

    const extendTo = (x: number, y: number) => {
        const over = cellPointAt(ctx, x, y);
        if (!over || (!moved && samePoint(over, point))) {
            return;
        }
        moved = true;
        current = current
            ? { ...current, toRow: over.row, toField: over.field }
            : { fromRow: point.row, fromField: point.field, toRow: over.row, toField: over.field };
        gridInterface.__setRanges([...others, current]);

        // the browser extends the text selection the press started in the input after this event, up
        // to the input's edge: collapsed in the frame of this move, before it is painted
        const focused = focusedCell(ctx);
        if (focused) {
            requestAnimationFrame(() => collapseTextSelection(focused.input));
        }
    };

    // past the top or bottom of the rows, or the left or right of the grid: scroll that way, a row (or
    // AUTO_SCROLL_X px) at a time while the pointer stays out there. The rows and columns are rendered on
    // the scroll events, the cell at the edge is read after
    const autoScroll = () => {
        scrollTimer = undefined;
        const body = ctx.body.getBoundingClientRect();
        const grid = ctx.element.getBoundingClientRect();
        const dy = at.y < body.top ? -1 : at.y > body.bottom ? 1 : 0;
        const dx = at.x < grid.left ? -1 : at.x > grid.right ? 1 : 0;
        if (!dx && !dy) {
            return;
        }
        const bodyScroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
        const middleScroller = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
        bodyScroller.scrollTop = bodyScroller.scrollTop + dy * gridInterface.__getGridConfig().__rowHeight;
        middleScroller.scrollLeft = middleScroller.scrollLeft + dx * AUTO_SCROLL_X;
        scrollTimer = setTimeout(() => {
            extendTo(at.x, at.y);
            autoScroll();
        }, AUTO_SCROLL_MS);
    };

    const end = () => {
        clearTimeout(scrollTimer);
        if (moved) {
            const focused = focusedCell(ctx);
            if (focused) {
                collapseTextSelection(focused.input);
            } else if (current) {
                // the wheel took the focus while dragging: back to a cell of the range, the keys (copy,
                // Delete, Alt+Shift+arrows) work from there
                focusCellInput(ctx, { row: current.fromRow, field: current.fromField }) ||
                    focusCellInput(ctx, { row: current.toRow, field: current.toField });
            }
            // the cell pressed is the active cell now, its row the current row - as a click on it makes
            // it (there is no click after a drag over cells: it goes to an element both are in)
            const datasource = gridInterface.getDatasource();
            if (!down.shiftKey && datasource.currentEntity !== datasource.getRow(point.row)) {
                datasource.setRowAsCurrentEntity(point.row);
            }
        }
        ctx.rangeGesture = false;
    };

    followPointer(pressed, down, {
        move: (event) => {
            at = { x: event.clientX, y: event.clientY };
            extendTo(at.x, at.y);
            if (scrollTimer === undefined) {
                autoScroll();
            }
        },
        up: end,
        cancel: end
    });
}

/**
 * Focuses the input of a cell on screen, without scrolling: the views scroll with the grid's own
 * scrollbars, the browser must not scroll them
 * @returns false when the cell is not on screen
 */
function focusCellInput(ctx: Grid, point: CellPoint): boolean {
    for (const columnElement of ctx.columns.values()) {
        // a hidden row or column element still has what it showed last on its cells
        const shown = columnElement.style.display !== 'none' && columnElement.parentElement?.style.display !== 'none';
        for (const cell of columnElement.children) {
            const shows = cell as HTMLCellElement;
            if (shown && shows.$row === point.row && shows.$attribute === point.field) {
                const input = cell.querySelector('input');
                if (input) {
                    input.focus({ preventScroll: true });
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * For a cell's focus: the focus moved to another cell than the active one (the start of the last
 * range) - Tab, Alt+arrows, a click, code - so the ranges are cleared, as moving the active cell does
 * in a spreadsheet. Not while the pointer makes a range: the focus moving is part of it
 */
export function rangeCellFocused(ctx: Grid, row: number, field: string) {
    const last = ctx.gridInterface.getRanges().at(-1);
    if (!ctx.rangeGesture && last && !(last.fromRow === row && last.fromField === field)) {
        ctx.gridInterface.clearRanges();
    }
}

/** the arrow keys, by `key` */
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * The keys of the ranges in a body cell, called first by the cell's keydown:
 * - Alt+Shift+arrows: the end of the last range one cell further, see extendRangeByKey
 * - Esc: clears the ranges. Not when a menu is open: Esc closes that first
 *
 * @param row the row of the cell (displayed)
 * @param field the field of the cell
 * @returns true when it used the key: the cell's own handling of it is skipped
 */
export function rangeKeydown(ctx: Grid, event: KeyboardEvent, row: number, field: string): boolean {
    const gridInterface = ctx.gridInterface;
    const otherModifier = event.ctrlKey || event.metaKey;

    if (event.altKey && event.shiftKey && !otherModifier && ARROWS.includes(event.key)) {
        event.preventDefault();
        extendRangeByKey(ctx, { row, field }, event.key);
        return true;
    }

    if (event.key === 'Escape' && gridInterface.getRanges().length && !event.defaultPrevented && !ctx.contextMenu?.isConnected) {
        // one Esc does one thing: a modal dialog the grid is in stays open
        event.preventDefault();
        gridInterface.clearRanges();
        return true;
    }
    return false;
}

/**
 * Alt+Shift+arrow: moves the end (`to`) of the last range one cell - a row up or down (group rows are
 * skipped), a field left or right in the order of getLayoutFields(). With no range it starts one at
 * `here`, the cell with the focus. The focus stays where it is; the grid scrolls the end into view.
 * At the edge of the grid nothing moves
 */
function extendRangeByKey(ctx: Grid, here: CellPoint, key: string) {
    const gridInterface = ctx.gridInterface;
    const fields = getLayoutFields(gridInterface);
    const ranges = gridInterface.getRanges();
    const last = ranges.at(-1) ?? oneCell(here);

    let row = last.toRow;
    let index = fields.indexOf(last.toField);
    if (key === 'ArrowUp' || key === 'ArrowDown') {
        row = nextDataRow(ctx, row, key === 'ArrowUp' ? -1 : 1);
    } else {
        index = Math.min(Math.max(index + (key === 'ArrowLeft' ? -1 : 1), 0), fields.length - 1);
    }

    gridInterface.__setRanges([...ranges.slice(0, -1), { ...last, toRow: row, toField: fields[index] }]);
    const focused = focusedCell(ctx);
    if (focused) {
        collapseTextSelection(focused.input);
    }
    scrollCellIntoView(ctx, row, fields[index]);
}

/**
 * The next data row up (`step` -1) or down (1) from a row, group rows skipped. The row itself when
 * there is none
 */
function nextDataRow(ctx: Grid, row: number, step: number) {
    const datasource = ctx.gridInterface.getDatasource();
    let next = row + step;
    while (next >= 0 && next < datasource.length() && isGroupRow(datasource.getRow(next))) {
        next = next + step;
    }
    return next >= 0 && next < datasource.length() ? next : row;
}

/**
 * Scrolls a cell into view: the rows when it is above or below them, the middle columns when it is in
 * one of them and left or right of what is shown. The scroll events render what scrolls in
 */
function scrollCellIntoView(ctx: Grid, row: number, field: string) {
    const gridInterface = ctx.gridInterface;
    const { scrollTops, scrollHeights } = gridInterface.__getScrollState();
    const bodyScroller = getElementByClassName(ctx.element, 'simple-html-grid-body-scroller');
    const top = scrollTops[row];
    const bottom = top + scrollHeights[row];
    if (top < bodyScroller.scrollTop) {
        bodyScroller.scrollTop = top;
    } else if (bottom > bodyScroller.scrollTop + bodyScroller.clientHeight) {
        bodyScroller.scrollTop = bottom - bodyScroller.clientHeight;
    }

    const center = gridInterface.__getGridConfig().layout.center;
    const column = center.findIndex((col) => col.fields.includes(field));
    if (column === -1) {
        return;
    }
    const middleScroller = getElementByClassName(ctx.element, 'simple-html-grid-middle-scroller');
    const left = center.slice(0, column).reduce((sum, col) => sum + col.width, 0);
    const right = left + center[column].width;
    if (left < middleScroller.scrollLeft) {
        middleScroller.scrollLeft = left;
    } else if (right > middleScroller.scrollLeft + middleScroller.clientWidth) {
        middleScroller.scrollLeft = right - middleScroller.clientWidth;
    }
}
