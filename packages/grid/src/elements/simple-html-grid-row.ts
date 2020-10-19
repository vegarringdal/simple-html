import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { html } from 'lit-html';
import { RowCache } from '../types';
import { log } from './log';

@customElement('simple-html-grid-row')
export default class extends HTMLElement {
    connector: GridInterface;
    row: RowCache;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-row');
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('selection', this);

        if (this.connector.config.__rowHeight > this.connector.config.cellHeight) {
            this.classList.add('grouping-row-border');
        }
    }

    handleEvent(e: Event) {
        log(this, e);

        if (e.type === 'vertical-scroll') {
            if (this.row.update) {
                this.row.update = false;
                this.render();
            }
        }
        if (e.type === 'selection') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('selection', this);
    }

    render() {
        const config = this.connector.config;

        // check if height is changed
        this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';
        this.style.transform = `translate3d(0px, ${
            this.connector.getScrollVars.__SCROLL_TOPS[this.row.i]
        }px, 0px)`;

        const entity = this.connector.displayedDataset[this.row.i];

        if (entity && !entity.__group) {
            this.style.display = 'block';

            const rowClick = (e: any) => {
                this.connector.highlightRow(e as any, this.row.i);
            };

            if (this.connector.isSelected(this.row.i)) {
                this.classList.add('simple-html-grid-selected-row');
            } else {
                this.classList.remove('simple-html-grid-selected-row');
            }

            const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length;

            return html`
                <simple-html-grid-col
                    class="simple-html-grid-grouping-row"
                    style="width:${grouping ? grouping * 15 : 0}px;left:0; display:${grouping
                        ? 'block'
                        : 'none'}"
                >
                </simple-html-grid-col>
                ${config.groups.map((group) => {
                    return html`
                        <simple-html-grid-group-row
                            @click=${rowClick}
                            .connector=${this.connector}
                            .rowNo=${this.row.i}
                            .ref=${this.ref}
                            .group=${group}
                        >
                        </simple-html-grid-group-row>
                    `;
                })}
            `;
        } else {
            this.style.display = 'none';

            return '';
        }
    }
}
