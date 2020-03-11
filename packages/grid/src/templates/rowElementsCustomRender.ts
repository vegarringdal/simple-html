import { html } from 'lit-html';
import { IEntity } from '../interfaces';
import { GridInterface } from '../gridInterface';

export function rowElementsCustomRender(
    freeGridRowStyle: string,
    rowClick: Function,
    connector: GridInterface,
    rowNo: number,
    rowData: IEntity
) {
    return html`
        <free-grid-row
            style=${freeGridRowStyle}
            class="free-grid-row ${connector.selection.isSelected(rowNo)
                ? 'free-grid-selected-row'
                : ''}"
            @click=${rowClick}
        >
            ${connector.config.rowRenderCallBackFn(html, null, rowNo, rowData, connector)}
        </free-grid-row>
    `;
}
