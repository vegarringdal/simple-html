import { Grid } from '../grid';
import { render, html } from 'lit-html';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './ColType';
import { LEFT_PINNED_COLTYPE, MIDDLE_PINNED_COLTYPE, RIGH_PINNED_COLTYPE } from './GROUP_COLTYPE';
import { Entity } from '../../datasource/Entity';

export function renderHeaderSelector(
    ctx: Grid,
    cell: HTMLCellElement,
    _row: number,
    column: number,
    _celno: number,
    colType: ColType,
    _cellType: string,
    _attribute: string,
    _rowData: Entity
) {
    let colNo = 0;
    if (colType === LEFT_PINNED_COLTYPE) {
        colNo = column + 1;
    }
    if (colType === MIDDLE_PINNED_COLTYPE) {
        colNo = ctx.gridInterface.__getGridConfig().columnsPinnedLeft.length || 0;
        colNo = colNo + column + 1;
    }
    if (colType === RIGH_PINNED_COLTYPE) {
        colNo = ctx.gridInterface.__getGridConfig().columnsPinnedLeft.length || 0;
        colNo = colNo + ctx.gridInterface.__getGridConfig().columnsCenter.length || 0;
        colNo = colNo + column + 1;
    }

    let className = 'simple-html-absolute-fill simple-html-label';
    if (ctx.gridInterface.__isColumnSelected(colNo)) {
        className = 'simple-html-absolute-fill simple-html-label simple-html-label-odd';
    }

    render(
        html`<div
            class=${className}
            @click=${(e: MouseEvent) => {
                ctx.gridInterface.__setSelectedColumn(colNo, e.ctrlKey);
            }}
        >
            <span class="simple-html-selector-text">${colNo}</span>
        </div>`,
        cell as any
    );
}
