import { render, html, svg } from 'lit-html';
import { Entity } from '../../datasource/Entity';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';

export function renderRowGroup(
    ctx: Grid,
    cell: HTMLCellElement,
    _row: number,
    column: number,
    _celno: number,
    colType: ColType,
    _cellType: string,
    _attribute: string,
    rowData: Entity
) {
    if (rowData.__group) {
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
            style="padding-left:${rowData.__groupLvl * 15}px"
            @click=${() => {
                console.log('group selected, do I want something here ?:', column, colType);
            }}
        >
            <div
                class="simple-html-grid-grouping-row"
                style="width:${rowData.__groupLvl * 15}px;display:${rowData.__groupLvl ? 'block' : 'none'}"
            ></div>
            <i
                @click=${() => {
                    if (rowData.__groupExpanded) {
                        ctx.gridInterface.getDatasource().collapseGroup(rowData.__groupID);
                    } else {
                        ctx.gridInterface.getDatasource().expandGroup(rowData.__groupID);
                    }
                }}
            >
                <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    ${rowData.__groupExpanded
                        ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                        : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
                </svg></i
            >
            <span class=""> ${rowData.__groupName} (${rowData.__groupTotal})</span>
        </div>`,
        cell as any
    );
}
