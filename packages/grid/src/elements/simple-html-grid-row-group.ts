import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { html, svg } from 'lit-html';
import { RowCache } from '../interfaces';

@customElement('simple-html-grid-row-group')
export default class extends HTMLElement {
    connector: GridInterface;
    row: RowCache;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-row');
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'vertical-scroll') {
            this.render();
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        // check if height is changed
        //  if (this.currentHeight !== this.row.i * config.__rowHeight) {
        this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';
        this.style.transform = `translate3d(0px, ${
            this.connector.getScrollVars.__SCROLL_TOPS[this.row.i]
        }px, 0px)`;
        // }
        const entity = this.connector.displayedDataset[this.row.i];

        if (entity && entity.__group) {
            this.style.display = 'block';

            const changeGrouping = () => {
                if (entity.__groupExpanded) {
                    this.connector.groupCollapse(entity.__groupID);
                } else {
                    this.connector.groupExpand(entity.__groupID);
                }
            };

            const defaultMarkup = html`
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

            return html`
                ${entity.__groupLvl
                    ? html`
                          <simple-html-grid-col
                              class="simple-html-grid-col simple-html-grid-grouping-row"
                              style="width:${entity.__groupLvl
                                  ? entity.__groupLvl * 15
                                  : 0}px;left:0"
                          >
                          </simple-html-grid-col>
                      `
                    : ''}
                ${html`
                    <simple-html-grid-col
                        class="simple-html-grid-col-group"
                        style="left:${entity.__groupLvl ? entity.__groupLvl * 15 : 0}px;right:0"
                    >
                        ${defaultMarkup}
                    </simple-html-grid-col>
                `}
            `;
        } else {
            this.style.display = 'none';

            return '';
        }
    }
}
