import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';

/**
 * Shows the validation errors of a row cell: the class `simple-html-cell-error` on the cell element,
 * and the messages as its tooltip (`data-tooltip`, one message per line) - or neither when the cell
 * has none.
 *
 * Set on the cell element itself, outside of its lit template: an edit calls this while the user
 * types, and rendering the template again would put the formatted value back into the input. The
 * grid reuses the cell elements while scrolling, so every render of a cell calls this too.
 * @param entity the cell's row, null for a cell without a row or field
 * @param attribute the cell's field, null for a cell without one
 */
export function showCellErrors(ctx: Grid, cell: HTMLElement, entity: Entity | null, attribute: string | null) {
    const messages = entity && attribute ? ctx.gridInterface.getDatasource().__getRowErrors(entity)?.get(attribute) : undefined;
    if (messages?.length) {
        cell.classList.add('simple-html-cell-error');
        cell.setAttribute('data-tooltip', messages.join('\n'));
    } else {
        cell.classList.remove('simple-html-cell-error');
        cell.removeAttribute('data-tooltip');
    }
}
