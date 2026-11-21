import { isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';

/**
 * The classes the `rowClass` hook gave each row element, to take them off when the element shows
 * another row or the row's values change. Kept here and not on the element, like the markers of
 * showCellEdited: the row elements are reused while scrolling
 */
const applied = new WeakMap<HTMLElement, string[]>();

/**
 * Puts the classes of the `rowClass` hook (GridHooks.rowClass) on a row element of a section - the row
 * selector and the pinned sections, the row elements of one row in each - and takes off the ones it
 * had. For renderRow (a row scrolled in, refresh()) and renderChangedRows (the values of the row
 * changed): the classes follow the row's values. A group row gets none, the hook is not called for it.
 * @param row the displayed row the element shows, its index
 */
export function showRowClass(ctx: Grid, rowElement: HTMLElement, row: number) {
    const entity = ctx.gridInterface.getDatasource().getRow(row);
    const wanted = entity && !isGroupRow(entity) ? ctx.gridInterface.__getRowClass(entity, row) : [];
    const before = applied.get(rowElement) ?? [];
    if (before.length === wanted.length && before.every((name, i) => name === wanted[i])) {
        return;
    }
    rowElement.classList.remove(...before);
    rowElement.classList.add(...wanted);
    if (wanted.length) {
        applied.set(rowElement, wanted);
    } else {
        applied.delete(rowElement);
    }
}
