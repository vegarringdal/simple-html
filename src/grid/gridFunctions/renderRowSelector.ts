import { html, nothing, render } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ColType } from './colType';
import { SELECTOR_COLTYPE } from './GROUP_COLTYPE';
import { getColumnLabel } from './getColumnLabel';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';

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

    // the server's error and the validation errors of the row, one per line: shown as the tooltip
    const errors = rowErrorText(ctx, rowData);

    render(
        html`<div
            class=${`${currentEntitySelected} simple-html-absolute-fill${errors ? ' simple-html-row-error' : ''}`}
            data-tooltip=${errors || nothing}
            @click=${(e: MouseEvent) => {
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
            <div class="${isModified(rowData)}">
                <span role="cell" aria-label=${gridText(ctx, 'grid.rowSelector')} class="simple-html-selector-text"
                    >${row + 1}</span
                >
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
 * The errors of a row as the row selector's tooltip, one per line: the server's (`__rowError`, from
 * setErrors()) first, then a line per field with a validation error - its column label and messages.
 * '' when the row has none. A row marked for deletion has no validation errors, but keeps the
 * server's: a delete the server refused says why
 */
function rowErrorText(ctx: Grid, rowData: Entity | GroupRow | undefined): string {
    if (!rowData || isGroupRow(rowData)) {
        return '';
    }
    const lines: string[] = [];
    if (rowData.__rowError) {
        lines.push(rowData.__rowError);
    }
    for (const [field, messages] of ctx.gridInterface.getDatasource().__getRowErrors(rowData) ?? []) {
        lines.push(`${getColumnLabel(ctx, field, true)}: ${messages.join(', ')}`);
    }
    return lines.join('\n');
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
