import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { HTMLCellElement } from './HTMLCellElement';

/**
 * How long after a merge a cell rendered shows the flash, in ms: the css fades it out over as long
 * (`simple-html-grid-merged` in grid.css)
 */
export const MERGE_HIGHLIGHT_MS = 1000;

/**
 * The merge each cell element flashes for: its row and the time of the merge. Kept here and not on the
 * element, like the markers of showCellEdited: the cell elements are reused while scrolling
 */
const shown = new WeakMap<HTMLCellElement, { row: Entity; at: number }>();

/**
 * The flash of a cell a merge changed, `GridConfig.mergeHighlight`: the class `simple-html-cell-merged`
 * on the cell element while it is rendered in the {@link MERGE_HIGHLIGHT_MS} after an `upsert()` changed
 * its field (`datasource.getMergedAt()`). The css animation runs once, when the class is added. A new
 * merge of a cell that still has it - or another row in the reused element - flips
 * `data-merged-again`, which the css gives an animation of another name: that starts it again.
 * @param entity the cell's row, null for a cell without a row or field
 * @param attribute the cell's field, null for a cell without one
 */
export function showCellMerged(ctx: Grid, cell: HTMLCellElement, entity: Entity | null, attribute: string | null) {
    const at =
        entity && attribute && ctx.gridInterface.__getGridConfig().mergeHighlight
            ? ctx.gridInterface.getDatasource().getMergedAt(entity, attribute)
            : undefined;
    if (!entity || at === undefined || Date.now() - at >= MERGE_HIGHLIGHT_MS) {
        cell.classList.remove('simple-html-cell-merged');
        shown.delete(cell);
        return;
    }

    const last = shown.get(cell);
    if (last && (last.row !== entity || last.at !== at)) {
        cell.toggleAttribute('data-merged-again');
    }
    shown.set(cell, { row: entity, at });
    cell.classList.add('simple-html-cell-merged');
}
