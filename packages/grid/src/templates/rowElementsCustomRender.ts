import { FreeGrid } from '../';
import { html } from 'lit-html';
import { IDataRow } from '../interfaces';

export function rowElementsCustomRender(
    freeGridRowStyle: string,
    rowClick: Function,
    freeGrid: FreeGrid,
    rowNo: number,
    rowData: IDataRow
) {
    return html`
        <free-grid-row
            style=${freeGridRowStyle}
            class="free-grid-row ${freeGrid.selection.isSelected(rowNo)
                ? 'free-grid-selected-row'
                : ''}"
            @click=${rowClick}
        >
            ${freeGrid.config.rowRenderCallBackFn(html, null, rowNo, rowData, freeGrid)}
        </free-grid-row>
    `;
}
