import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { html, svg } from 'lit-html';
import { RowCache } from '../types';

@customElement('simple-html-grid-col')
export class SimpleHtmlGridCol extends HTMLElement {
    connector: GridInterface;
    row: RowCache;
    ref: SimpleHtmlGrid;

    /*  disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'reRender') {
            debugger;
        }
    } */

    render() {
        if (this.ref) {
  /*           const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length; */
            this.style.width = '100%';
            this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';

            // }
            const entity = this.connector.displayedDataset[this.row.i];

            if (entity && entity.__group) {
                this.style.display = 'block';

                this.style.left = (entity.__groupLvl ? entity.__groupLvl * 15 : 0) + 'px';

                const changeGrouping = () => {
                    if (entity.__groupExpanded) {
                        this.connector.groupCollapse(entity.__groupID);
                    } else {
                        this.connector.groupExpand(entity.__groupID);
                    }
                };

                return html`
                    <simple-html-grid-col
                        .connector=${this.connector}
                        .row=${this.row}
                        class="simple-html-grid-grouping-row"
                        style="left:0"
                    ></simple-html-grid-col>
                    <i @click=${changeGrouping}>
                        <svg
                            class="simple-html-grid-icon"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 16 16"
                        >
                            ${entity.__groupExpanded
                                ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                                : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`}
                        </svg></i
                    ><span> ${entity.__groupName} (${entity.__groupTotal})</span>
                `;
            } else {
                this.style.display = 'none';

                return '' as any;
            }
        } else {
            const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length;
            const entity = this.row ? this.connector.displayedDataset[this.row.i] : null;
            if (entity && entity.__group) {
                this.style.width = entity.__groupLvl * 15 + 'px';
            } else {
                this.style.width = (grouping ? grouping * 15 : 0) + 'px';
            }
            this.style.height =
                (this.row
                    ? this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i]
                    : this.connector.config.cellHeight) + 'px';
            this.style.display = grouping ? 'block' : 'none';
        }
    }
}
