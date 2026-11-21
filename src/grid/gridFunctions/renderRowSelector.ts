import { html, nothing, render } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ColType } from './colType';
import { rowNumberKeydown } from './deleteRows';
import { SELECTOR_COLTYPE } from './GROUP_COLTYPE';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { ROW_STATE_TEXT, rowStateOf, rowStatusIcon, rowStatusIconTemplate } from './rowStatus';

/**
 * The row number of a row: the first cell of the row, a click selects the row (a group row: the rows
 * of the group). It shows the row's errors - the class `simple-html-row-error` (a red bar), the
 * messages as the tooltip - and, with `GridConfig.rowStatus` (the default), the row's state: an icon
 * in front of the number (see rowStatus.ts), the state as the tooltip's first line, the number struck
 * through for a row marked for deletion, and the state and the errors as text for a screen reader.
 *
 * The element around the number has the class `row-is-new`, `row-is-modified` or `row-is-deleted`
 * either way, users style them.
 */
export function renderRowSelector(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string | null,
    _attribute: string | null,
    rowData: Entity | GroupRow | undefined
) {
    let currentEntitySelected = '';
    if (rowData === ctx.gridInterface.getDatasource().currentEntity) {
        currentEntitySelected = row % 2 === 0 ? 'simple-html-label-even' : 'simple-html-label-odd';
    } else {
        currentEntitySelected = 'simple-html-label';
    }

    // the server's error and the validation errors of the row, a line each
    const errors = rowErrorLines(ctx, rowData);
    // its conflicts with the server (an upsert), a line each
    const conflicts = rowConflictLines(ctx, rowData);

    // the row's state: an icon, the tooltip's first line, the text for a screen reader
    const rowStatus = ctx.gridInterface.__getGridConfig().rowStatus;
    const state = rowStatus ? rowStateOf(rowData) : null;
    const icon = rowStatus ? rowStatusIcon(state, errors.length > 0, conflicts.length > 0) : null;
    const stateText = state ? gridText(ctx, ROW_STATE_TEXT[state]) : '';
    const tooltip = [stateText, ...conflicts, ...errors].filter((line) => line !== '').join('\n');
    // the tooltip is not read out: the state, the conflicts and the errors are text in the cell, hidden
    // on screen
    const screenReaderText = rowStatus
        ? [stateText, ...conflicts, errors.length ? gridText(ctx, 'rowStatus.error', { errors: errors.join(', ') }) : '']
              .filter((text) => text !== '')
              .join(', ')
        : '';

    // the first cell of the row for a screen reader, the row number: the row element is the row, see
    // ariaGrid.ts
    render(
        html`<div
            role="gridcell"
            aria-colindex="1"
            class=${`${currentEntitySelected} simple-html-absolute-fill${errors.length ? ' simple-html-row-error' : ''}`}
            data-tooltip=${tooltip || nothing}
            tabindex="-1"
            @keydown=${(e: KeyboardEvent) => rowNumberKeydown(ctx, e, row)}
            @click=${(e: MouseEvent) => {
                // the focus on the number, as a spreadsheet's row header: Delete marks the selected rows
                // for deletion (deleteRows.ts). Not a stop of Tab
                (e.currentTarget as HTMLElement).focus({ preventScroll: true });
                const ds = ctx.gridInterface.getDatasource();
                if (isGroupRow(rowData)) {
                    // selects the data rows of the group, up to the next group row
                    const rows = ds.getRows();
                    const selectRows = [];
                    for (let i = row + 1; i < rows.length; i++) {
                        const entity = rows[i];
                        if (isGroupRow(entity)) {
                            i = rows.length;
                            continue;
                        }
                        selectRows.push(i);
                    }
                    if (selectRows.length) {
                        ds.getSelection().selectRowRange(selectRows[0], selectRows[selectRows.length - 1], e.ctrlKey);
                        ctx.rebuild();
                    }
                } else {
                    ds.getSelection().highlightRow(e as any, row);
                }
            }}
        >
            <div class=${`${isModified(rowData)}${rowStatus ? ' simple-html-row-status' : ''}`}>
                ${icon ? rowStatusIconTemplate(icon) : nothing}
                <span class="simple-html-selector-text">${row + 1}</span>
                ${screenReaderText ? html`<span class="simple-html-visually-hidden">${screenReaderText}</span>` : nothing}
            </div>
        </div>`,
        cell as any
    );
}

/**
 * Renders the row selector of a displayed row again, for an edit: its validation errors can have
 * changed. Does nothing when the row is not on screen
 * @param row the index in the displayed rows
 */
export function renderRowSelectorOf(ctx: Grid, row: number) {
    const cached = ctx.containerSelectorRowCache?.find((entry) => entry.row === row);
    const element = cached ? ctx.rows.get(cached.id) : undefined;
    if (element) {
        const rowData = ctx.gridInterface.getDatasource().getRow(row);
        renderRowSelector(ctx, element as HTMLCellElement, row, 0, 0, SELECTOR_COLTYPE, null, null, rowData);
    }
}

/**
 * The errors of a row, a line each, for the row selector's tooltip: the server's (`__rowError`, from
 * setErrors()) first, then a line per field with a validation error - its column label and messages.
 * [] when the row has none. A row marked for deletion has no validation errors, but keeps the
 * server's: a delete the server refused says why
 */
function rowErrorLines(ctx: Grid, rowData: Entity | GroupRow | undefined): string[] {
    if (!rowData || isGroupRow(rowData)) {
        return [];
    }
    const lines: string[] = [];
    if (rowData.__rowError) {
        lines.push(rowData.__rowError);
    }
    for (const [field, messages] of ctx.gridInterface.getDatasource().__getRowErrors(rowData) ?? []) {
        lines.push(`${getColumnLabel(ctx, field)}: ${messages.join(', ')}`);
    }
    return lines;
}

/**
 * The conflicts of a row (`datasource.getConflicts()`), for the row selector's tooltip: a line for the
 * fields the server changed while they were edited, their column labels, and one when the server
 * removed the row and it has changes here. [] when it has none
 */
function rowConflictLines(ctx: Grid, rowData: Entity | GroupRow | undefined): string[] {
    const conflicts = rowData && !isGroupRow(rowData) ? ctx.gridInterface.getDatasource().__getRowConflicts(rowData) : undefined;
    if (!conflicts) {
        return [];
    }
    const lines: string[] = [];
    const fields = Array.from(conflicts.keys()).filter((field): field is string => field !== null);
    if (fields.length) {
        lines.push(gridText(ctx, 'rowStatus.conflict', { fields: fields.map((field) => getColumnLabel(ctx, field)).join(', ') }));
    }
    if (conflicts.has(null)) {
        lines.push(gridText(ctx, 'rowStatus.removedOnServer'));
    }
    return lines;
}

// helper to add class so we can override color when row is modified. A group row is never modified
function isModified(rowData: Entity | GroupRow | undefined) {
    if (!rowData || isGroupRow(rowData)) {
        return '';
    }

    if (rowData?.__controller?.__isDeleted) {
        return 'row-is-deleted';
    }

    if (rowData?.__controller?.__isNew) {
        return 'row-is-new';
    }

    if (rowData?.__controller?.__edited) {
        return 'row-is-modified';
    }

    return '';
}
