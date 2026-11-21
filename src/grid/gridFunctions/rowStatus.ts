import { html, type TemplateResult } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { TextId } from '../../texts';

/**
 * The row's state on its row number, `GridConfig.rowStatus`: an icon in front of the number, the
 * state as the first line of the tooltip, and as text for a screen reader. See renderRowSelector.
 */

/**
 * the px the row numbers get wider for the icon: a slot of 4px + the 10px icon in front of the
 * number. The number keeps the width it had
 */
export const ROW_STATUS_WIDTH = 14;

/**
 * the state of a row, from its `__rowState`: new, edited (`'M'`) or marked for deletion. `null` for
 * a row as it was set, and for a group row
 */
export type RowState = 'new' | 'edited' | 'deleted';

/**
 * the icon a row gets: its state, or the error - one icon fits. A deleted row is not saved, so its
 * state wins over an error; an error wins over new and edited, it stops the save
 */
export type RowStatusIcon = RowState | 'error';

/**
 * the text of each state: the tooltip's first line and the screen reader's text
 */
export const ROW_STATE_TEXT: Record<RowState, TextId> = {
    new: 'rowStatus.new',
    edited: 'rowStatus.edited',
    deleted: 'rowStatus.deleted'
};

/**
 * the state of a row, see RowState. `__rowState` says it: `'D'` wins over `'N'`, which wins over `'M'`
 */
export function rowStateOf(rowData: Entity | GroupRow | undefined): RowState | null {
    if (!rowData || isGroupRow(rowData)) {
        return null;
    }
    switch (rowData.__rowState) {
        case 'D':
            return 'deleted';
        case 'N':
            return 'new';
        case 'M':
            return 'edited';
        default:
            return null;
    }
}

/**
 * the icon of a row, see RowStatusIcon. `null` when the row has no state and no error
 * @param hasError the row has an error: the server's (`__rowError`) or a validation error
 */
export function rowStatusIcon(state: RowState | null, hasError: boolean): RowStatusIcon | null {
    if (state === 'deleted') {
        return 'deleted';
    }
    return hasError ? 'error' : state;
}

/**
 * The icons, 10x10px: one unit of the viewBox is a pixel, so the lines are sharp. Filled with the
 * text colour, which the css sets per icon (`--simple-html-grid-new-color` ...). Hidden from a screen
 * reader, it gets the state as text
 */
const ICONS: Record<RowStatusIcon, TemplateResult> = {
    // a plus
    new: html`<svg
        class="simple-html-row-status-icon simple-html-row-status-new"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M4 1h2v3h3v2H6v3H4V6H1V4h3z" />
    </svg>`,
    // a pencil, the point down left
    edited: html`<svg
        class="simple-html-row-status-icon simple-html-row-status-edited"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M1 9l.6-2.6L6.4 1.6 8.4 3.6 3.6 8.4z M7.1.9L8 0l2 2-.9.9z" />
    </svg>`,
    // a trash can: the handle, the lid, the can
    deleted: html`<svg
        class="simple-html-row-status-icon simple-html-row-status-deleted"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
    >
        <path d="M3.5 0h3v1h-3z M1 1.5h8V3H1z M2 3.8h6L7.4 10H2.6z" />
    </svg>`,
    // an exclamation mark cut out of a circle
    error: html`<svg
        class="simple-html-row-status-icon simple-html-row-status-error"
        viewBox="0 0 10 10"
        aria-hidden="true"
        focusable="false"
    >
        <path
            fill-rule="evenodd"
            d="M5 0a5 5 0 1 1 0 10A5 5 0 0 1 5 0z M4.2 2h1.6v3.8H4.2z M4.2 6.8h1.6v1.6H4.2z"
        />
    </svg>`
};

/**
 * the svg of an icon, see ICONS
 */
export function rowStatusIconTemplate(icon: RowStatusIcon): TemplateResult {
    return ICONS[icon];
}
