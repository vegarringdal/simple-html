import { html, svg } from 'lit-html';
import { Entity } from '../types';
import { GridInterface } from '../gridInterface';

export function rowElementsGroupRender(
    SimpleHtmlGridRowStyle: string,
    _rowClick: () => void,
    _connector: GridInterface,
    _rowNo: number,
    rowData: Entity
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
            <svg
                class="simple-html-grid-icon"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 16 16"
            >
                ${rowData.__groupExpanded
                    ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                    : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
            </svg></i
        ><span> ${rowData.__groupName} (${rowData.__groupTotal})</span>
    `;

    return html`
        <simple-html-grid-row
            style=${SimpleHtmlGridRowStyle}
            class="simple-html-grid-row simple-html-grid-grouping-row"
        >
            ${rowData.__groupLvl
                ? html`
                      <simple-html-grid-col
                          class="simple-html-grid-col simple-html-grid-grouping-row"
                          style="width:${rowData.__groupLvl ? rowData.__groupLvl * 15 : 0}px;left:0"
                      >
                      </simple-html-grid-col>
                  `
                : ''}
            ${html`
                <simple-html-grid-col
                    class="simple-html-grid-col-group"
                    style="left:${rowData.__groupLvl ? rowData.__groupLvl * 15 : 0}px;right:0"
                >
                    ${defaultMarkup}
                </simple-html-grid-col>
            `}
        </simple-html-grid-row>
    `;
}
