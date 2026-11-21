import type { Grid } from '../grid';
import { sectionColumns } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { sortOn } from './dragEvent';
import { LEFT_PINNED_COLTYPE, RIGHT_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { getElementByClassName } from './getElementByClassName';
import type { HTMLCellElement } from './HTMLCellElement';

/**
 * The keys of a header label (a column header), which is focusable but not in the tab order -
 * Alt+ArrowUp from the header filter under it gets there:
 *
 * - Enter / Space: sorts on the field, like a click. Shift adds the field to the sort
 * - Alt+ArrowDown: the label of the next field of the column, from the last one its header filter
 * - Alt+ArrowUp: the label of the field above, in a column with several fields
 *
 * Sorting rebuilds the header, the label that had the focus is a new element after it: the focus is
 * put on that one.
 */
export function headerLabelKeydown(ctx: Grid, cell: HTMLCellElement, event: KeyboardEvent) {
    const attribute = cell.$attribute;
    if (!attribute) {
        return;
    }
    const { $coltype: colType, $column: column, $celno: celno } = cell;
    const config = ctx.gridInterface.__getGridConfig();

    if (event.key === 'Enter' || event.key === ' ') {
        // Space would scroll the page
        event.preventDefault();
        sortOn(ctx, attribute, event.shiftKey);
        focusHeaderLabel(ctx, colType, column, celno);
        return;
    }

    if (event.altKey && event.key === 'ArrowDown') {
        event.preventDefault();
        const fields = sectionColumns(config, colType)[column]?.fields.length ?? 0;
        if (celno + 1 < fields) {
            focusHeaderLabel(ctx, colType, column, celno + 1);
        } else if (!config.hideFilter) {
            // undefined when the column is not in the dom
            getElementByClassName(ctx.element, `filter-cellpos-${colType}-0-${column}-0`)?.focus();
        }
        return;
    }

    if (event.altKey && event.key === 'ArrowUp') {
        event.preventDefault();
        if (celno > 0) {
            focusHeaderLabel(ctx, colType, column, celno - 1);
        }
    }
}

/**
 * Focuses the label of a field in the header: of field `celno` of `column` in its section. Does
 * nothing when the labels are hidden, or the column is not in the dom (scrolled away)
 */
export function focusHeaderLabel(ctx: Grid, colType: ColType, column: number, celno: number) {
    let cache = ctx.containerMiddleColumnCache;
    if (colType === LEFT_PINNED_COLTYPE) {
        cache = ctx.containerLeftColumnCache;
    }
    if (colType === RIGHT_PINNED_COLTYPE) {
        cache = ctx.containerRightColumnCache;
    }
    // the column element (slot) that shows the column now
    const slot = cache.findIndex((entry) => entry.column === column);
    const columnElement = ctx.columnsHeaders.get(colType + slot.toString());
    columnElement?.querySelector<HTMLElement>(`[type="label"][cellno="${celno}"]`)?.focus();
}
