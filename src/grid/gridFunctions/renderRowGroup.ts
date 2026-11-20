import { html, render, svg } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import type { ColType } from './colType';
import type { HTMLCellElement } from './HTMLCellElement';

export function renderRowGroup(
    ctx: Grid,
    cell: HTMLCellElement,
    _row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string | null,
    _attribute: string | null,
    rowData: Entity | GroupRow | undefined
) {
    // only a group row is shown, the cell of a data row is hidden
    const group = isGroupRow(rowData) ? rowData : null;
    if (group) {
        cell.style.display = 'block';
        cell.style.zIndex = '10';
    } else {
        cell.style.display = 'none';
    }

    // TODO: I do not like how hardcoded grouping indent is
    // add it as a option

    render(
        html`<div
            class="simple-html-absolute-fill simple-html-label-group"
            style="padding-left:${(rowData?.__groupLvl ?? 0) * 15 || 0}px"
        >
            <div
                class="${group?.__groupID ? 'simple-html-grid-grouping-row-group' : 'simple-html-grid-grouping-row'}"
                style="width:${(rowData?.__groupLvl ?? 0) * 15 || 0}px;display:${rowData?.__groupLvl || 0 ? 'block' : 'none'}"
            ></div>
            <i
                @click=${() => {
                    if (group?.__groupID) {
                        if (group.__groupExpanded) {
                            ctx.gridInterface.getDatasource().collapseGroup(group.__groupID);
                        } else {
                            ctx.gridInterface.getDatasource().expandGroup(group.__groupID);
                        }
                    }
                }}
            >
                <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    ${
                        group?.__groupExpanded
                            ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                            : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`
                    }
                </svg></i
            >
            <span class=""> ${group?.__groupName} (${group?.__groupTotal})</span>
        </div>`,
        cell as any
    );
}
