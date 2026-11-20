import { html, render } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ColType } from './colType';
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

    render(
        html`<div
            class=${`${currentEntitySelected} simple-html-absolute-fill`}
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
                <span role="cell" aria-label=${'row selector'} class="simple-html-selector-text"
                    >${row + 1}</span
                >
            </div>
        </div>`,
        cell as any
    );
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
