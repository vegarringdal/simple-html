import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { getLayoutFields } from './getLayoutFields';
import { undoRedoAction, undoRedoInGrid } from './undoRedoKey';

/**
 * Marking rows for deletion from the grid: the row menu's Delete › (contextmenuRow.ts) and Delete or
 * Backspace on a row number - a click on a row number selects the row and gives the number the focus,
 * as a spreadsheet's row header. See guides/05-editing.md "Deleting rows".
 */

/**
 * true when the isReadonly hook returns true for every field in the layout: the row is locked, it is
 * not marked for deletion. Only the hook counts - the columns' readonly option does not lock a row,
 * so a grid of readonly columns can still delete rows. Without the hook no row is locked
 */
export function isLockedByHook(gridInterface: Grid['gridInterface'], row: Entity): boolean {
    const hooks = gridInterface.__getHooks();
    const columns = gridInterface.__getGridConfig().columns;
    const fields = getLayoutFields(gridInterface);
    return (
        hooks.isReadonly !== undefined &&
        fields.length > 0 &&
        fields.every((field) => hooks.isReadonly?.(row, field, columns[field]?.readonly ?? false) === true)
    );
}

/** the selected rows a delete marks: not marked yet, not locked by the isReadonly hook */
export function rowsToMark(gridInterface: Grid['gridInterface']): Entity[] {
    return gridInterface
        .getDatasource()
        .getSelectedRows()
        .filter((row) => row.__rowState !== 'D' && !isLockedByHook(gridInterface, row));
}

/** the selected rows marked for deletion, for its undo */
export function rowsToUnmark(gridInterface: Grid['gridInterface']): Entity[] {
    return gridInterface
        .getDatasource()
        .getSelectedRows()
        .filter((row) => row.__rowState === 'D');
}

/**
 * A key on a row number (renderRowSelector): Delete or Backspace marks rows for deletion - the
 * selected rows when the number's row is one of them, else the number's row alone - one step of the
 * undo history; Ctrl+Z / Ctrl+Y undo and redo it there. Only in an editable grid, a row locked by the
 * isReadonly hook is left out
 * @param row the index of the number's row in the displayed rows
 */
export function rowNumberKeydown(ctx: Grid, event: KeyboardEvent, row: number) {
    const gridInterface = ctx.gridInterface;
    if (gridInterface.__getGridConfig().readonly) {
        return;
    }
    const action = undoRedoAction(event);
    if (action) {
        if (undoRedoInGrid(ctx, action, null)) {
            event.preventDefault();
            focusRowNumber(ctx, row);
        }
        return;
    }
    if ((event.key !== 'Delete' && event.key !== 'Backspace') || event.ctrlKey || event.metaKey || event.altKey) {
        return;
    }
    const datasource = gridInterface.getDatasource();
    const entity = datasource.getRow(row);
    if (!entity || isGroupRow(entity)) {
        return;
    }
    // Backspace would go back a page in some browsers
    event.preventDefault();
    const rows = datasource.getSelection().isSelected(row)
        ? rowsToMark(gridInterface)
        : [entity].filter((one) => one.__rowState !== 'D' && !isLockedByHook(gridInterface, one));
    if (rows.length) {
        datasource.markForDeletion(rows);
        focusRowNumber(ctx, row);
    }
}

/**
 * Puts the focus back on a row's number after a mark or its undo: marking rows renders the rows again,
 * the element that had the focus can be gone - the focus would fall to the page, and the next key (Ctrl+Z)
 * with it. Nothing when the row is not on screen, or the focus went to a cell (an undo goes to the cell
 * it changed)
 * @param row the index of the row in the displayed rows
 */
function focusRowNumber(ctx: Grid, row: number) {
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    const active = root.activeElement;
    if (active && active !== document.body && ctx.element.contains(active)) {
        return;
    }
    const cached = ctx.containerSelectorRowCache?.find((entry) => entry.row === row);
    const number = cached ? ctx.rows.get(cached.id)?.firstElementChild : undefined;
    if (number instanceof HTMLElement) {
        number.focus({ preventScroll: true });
    }
}
