import type { Entity } from '../../datasource/entity';
import type { Grid } from '../grid';
import { tooltipText } from './multilineText';

/**
 * Shows the validation errors of a row cell: the class `simple-html-cell-error` on the cell element,
 * and the messages as its tooltip (`data-tooltip`, one message per line) - or neither when the cell
 * has none.
 *
 * Set on the cell element itself, outside of its lit template: an edit calls this while the user
 * types, and rendering the template again would put the formatted value into the input. The
 * grid reuses the cell elements while scrolling, so every render of a cell calls this too.
 * @param entity the cell's row, null for a cell without a row or field
 * @param attribute the cell's field, null for a cell without one
 * @param text the whole text of a multiline cell that shows its first line (multilineText.ts): the
 * tooltip has it after the messages, an empty line between them. Cut when it is long
 */
export function showCellErrors(ctx: Grid, cell: HTMLElement, entity: Entity | null, attribute: string | null, text?: string) {
    const messages = entity && attribute ? ctx.gridInterface.getDatasource().__getRowErrors(entity)?.get(attribute) : undefined;
    cell.classList.toggle('simple-html-cell-error', !!messages?.length);

    const tooltip = [messages?.join('\n'), text === undefined ? undefined : tooltipText(text)].filter(Boolean).join('\n\n');
    if (tooltip) {
        cell.setAttribute('data-tooltip', tooltip);
    } else {
        cell.removeAttribute('data-tooltip');
    }
}
