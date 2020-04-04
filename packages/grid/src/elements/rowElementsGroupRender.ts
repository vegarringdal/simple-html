import { html, svg } from 'lit-html';
import { IEntity } from '../interfaces';
import { GridInterface } from '../gridInterface';

export function rowElementsGroupRender(
    freeGridRowStyle: string,
    _rowClick: Function,
    _connector: GridInterface,
    _rowNo: number,
    rowData: IEntity
) {
    const changeGrouping = () => {
        if (rowData.__groupExpanded) {
            _connector.groupCollapse(rowData.__groupID);
        } else {
            _connector.groupExpand(rowData.__groupID);
        }
    };

    const defaultMarkup = html`
        <i @click=${changeGrouping}>
            <svg class="free-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                ${rowData.__groupExpanded
                    ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                    : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
            </svg></i
        ><span> ${rowData.__groupName} (${rowData.__groupTotal})</span>
    `;

    return html`
        <free-grid-row style=${freeGridRowStyle} class="free-grid-row free-grid-grouping-row">
            ${rowData.__groupLvl
                ? html`
                      <free-grid-col
                          class="free-grid-col free-grid-grouping-row"
                          style="width:${rowData.__groupLvl ? rowData.__groupLvl * 15 : 0}px;left:0"
                      >
                      </free-grid-col>
                  `
                : ''}
            ${html`
                <free-grid-col
                    class="free-grid-col-group"
                    style="left:${rowData.__groupLvl ? rowData.__groupLvl * 15 : 0}px;right:0"
                >
                    ${defaultMarkup}
                </free-grid-col>
            `}
        </free-grid-row>
    `;
}