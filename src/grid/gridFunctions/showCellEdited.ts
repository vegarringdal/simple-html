import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Formatter } from '../../datasource/formatter';
import type { Grid } from '../grid';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { triggerScrollEvent } from './triggerScrollEvent';

/**
 * The marker of each cell element, made the first time the cell shows an edited value. Kept here and
 * not on the element: the cell elements are a public type, and are reused while scrolling
 */
const markers = new WeakMap<HTMLCellElement, HTMLElement>();

/**
 * true when the cell's field of the row is edited: its value differs from the original value, as the
 * change tracking compares them (`__editedProps`, a `date` field on the day). Not on a new row: all
 * of it is new, the row number says so
 */
function isCellEdited(entity: Entity | null, attribute: string | null): boolean {
    const controller = entity && attribute ? entity.__controller : undefined;
    return !!controller && !controller.__isNew && controller.__editedProps[attribute as string] === true;
}

/**
 * Shows that a row cell is edited: the class `simple-html-cell-edited` on the cell element, and - with
 * `GridConfig.editedMarker` (the default) - the marker, a triangle in the top left corner. Its tooltip
 * is the cell's errors, then the original value formatted with the cell's formatter, then "Click to
 * revert" in an editable grid: a click puts the original value back (`datasource.resetField()`).
 *
 * The marker is an element of its own in the cell element, after the cell's lit template, made and
 * removed here - like the errors (showCellErrors), it is set while the user types, when the template
 * is not rendered again. Call it after the template is rendered: lit removes what is after its
 * content when the cell gets another template (a checkbox after text), this puts the marker back.
 * Hidden from a screen reader and no stop of Tab: the row number says the row is edited, the row menu
 * has "Revert cell".
 * @param entity the cell's row, null for a cell without a row or field
 * @param attribute the cell's field, null for a cell without one
 * @param formatter the cell's formatter, the one its value is shown with (`dynamicCellTypeColumn` can
 * give a cell another type than its field). Default the field's
 */
export function showCellEdited(
    ctx: Grid,
    cell: HTMLCellElement,
    entity: Entity | null,
    attribute: string | null,
    formatter?: Formatter
) {
    const edited = isCellEdited(entity, attribute);
    cell.classList.toggle('simple-html-cell-edited', edited);

    const config = ctx.gridInterface.__getGridConfig();
    let marker = markers.get(cell);
    const controller = entity?.__controller;
    if (!edited || !config.editedMarker || !entity || !attribute || !controller) {
        marker?.remove();
        return;
    }

    if (!marker) {
        marker = createMarker(ctx, cell);
        markers.set(cell, marker);
    }
    if (marker.parentNode !== cell) {
        cell.appendChild(marker);
    }

    // the errors first, as the cell's own tooltip has them: the marker has a tooltip of its own
    const datasource = ctx.gridInterface.getDatasource();
    const errors = datasource.__getRowErrors(entity)?.get(attribute) ?? [];
    const original = (formatter ?? datasource.getFormatter(attribute)).format(controller.__originalValues[attribute]);
    const lines = [
        ...errors,
        gridText(ctx, 'cell.editedMarker.tooltip', {
            value: original === '' ? gridText(ctx, 'cell.editedMarker.blank') : original
        })
    ];
    if (!config.readonly) {
        lines.push(gridText(ctx, 'cell.editedMarker.revert'));
    }
    marker.setAttribute('data-tooltip', lines.join('\n'));
    // the hand only where a click reverts
    marker.classList.toggle('simple-html-cell-edited-marker-revert', !config.readonly);
}

/**
 * the marker element of a cell element. Its click reverts the cell the element shows at the time of
 * the click: the element shows other rows after a scroll
 */
function createMarker(ctx: Grid, cell: HTMLCellElement): HTMLElement {
    const marker = document.createElement('span');
    marker.className = 'simple-html-cell-edited-marker';
    marker.setAttribute('aria-hidden', 'true');

    // the focus stays where it is: in the cell the user types in, or none
    marker.addEventListener('mousedown', (event) => event.preventDefault());
    marker.addEventListener('click', () => {
        if (ctx.gridInterface.__getGridConfig().readonly) {
            return;
        }
        const datasource = ctx.gridInterface.getDatasource();
        const row = datasource.getRow(cell.$row);
        if (row && !isGroupRow(row) && cell.$attribute) {
            // a step of the undo history, the field is validated as for an edit
            datasource.resetField(row, cell.$attribute);
            triggerScrollEvent(ctx);
        }
    });
    return marker;
}
