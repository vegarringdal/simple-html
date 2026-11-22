import type { Grid } from '../grid';
import { columnNumber } from './columnSelection';
import { contextmenuColumn, copyColumnsKey } from './contextmenuColumn';
import { SELECTOR_COLTYPE } from './GROUP_COLTYPE';
import type { HTMLCellElement } from './HTMLCellElement';
import { renderCell } from './renderCell';

/**
 * The column numbers, the row of numbers under the header filters: a click selects columns (see
 * columnSelection.ts), a right click opens the column menu (contextmenuColumn.ts). A number takes the
 * focus on a click, as a row number does - not a stop of Tab - and has keys of its own there:
 *
 * - Shift+F10, the menu key: the column menu (the browser sends `contextmenu` to the element with the
 *   focus)
 * - Ctrl+C (Cmd+C): copies the selected columns, the number's own when none is selected
 * - Esc: no column selected, when no menu is open (Esc closes the menu first)
 *
 * For a screen reader the numbers are a header row of cells (ariaGrid.ts), each with `aria-selected`.
 */

/**
 * The listeners of a column number's cell, made by rebuildHeaderColumns. The cell shows the column
 * at its left (its `$coltype` / `$column`, set by renderCell): a slot of the middle section shows
 * another column after a scroll
 */
export function addColumnNumberListeners(ctx: Grid, cell: HTMLCellElement) {
    cell.addEventListener('click', (event) => {
        // the focus on the number, for its keys. The grid scrolls the header itself
        cell.focus({ preventScroll: true });
        const number = columnNumber(ctx.gridInterface.__getGridConfig(), cell.$coltype, cell.$column);
        ctx.gridInterface.__clickColumn(number, { toggle: event.ctrlKey || event.metaKey, range: event.shiftKey });
    });
    cell.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        contextmenuColumn(ctx, event, cell);
    });
    cell.addEventListener('keydown', (event) => columnNumberKeydown(ctx, cell, event));
}

/**
 * The keys of a column number with the focus, see the top of this file
 */
function columnNumberKeydown(ctx: Grid, cell: HTMLCellElement, event: KeyboardEvent) {
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c') {
        // the browser's copy would copy nothing: no text is selected
        event.preventDefault();
        copyColumnsKey(ctx, cell);
        return;
    }
    // with a menu open the document's listener closes it (addMenuListeners), after this one
    if (event.key === 'Escape' && !ctx.contextMenu && ctx.gridInterface.getSelectedColumns().length) {
        event.preventDefault();
        ctx.gridInterface.selectColumns([]);
    }
}

/**
 * Renders the column numbers of the header again, after the column selection changed: in place, so
 * the number with the focus keeps it. The column elements that show no column are hidden, they are
 * left
 */
export function renderColumnNumbers(ctx: Grid) {
    for (const columnElement of ctx.columnsHeaders.values()) {
        const cell = columnElement.querySelector<HTMLCellElement>(`:scope > [type="${SELECTOR_COLTYPE}"]`);
        if (cell && columnElement.style.display !== 'none') {
            renderCell(ctx, cell, 0, cell.$column, 0, cell.$coltype);
        }
    }
}
