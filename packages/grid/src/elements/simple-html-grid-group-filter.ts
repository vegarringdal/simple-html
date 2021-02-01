import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { GridGroupConfig } from '../types';
import { html } from 'lit-html';

@customElement('simple-html-grid-group-filter')
export class SimpleHtmlGridGroupFilter extends HTMLElement {
    connector: GridInterface;
    rowNo: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: GridGroupConfig;

    connectedCallback() {
        this.classList.add('simple-html-grid-group-label');
        const config = this.connector.config;
        this.style.display = 'block';
        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;
        const curleft = grouping ? grouping * 15 : 0;
        this.style.height = config.__rowHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.left = this.group.__left + curleft + 'px';
        this.style.top = config.__rowHeight + 'px';
        this.ref.addEventListener('column-resize', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length;
            const curleft = grouping ? grouping * 15 : 0;
            this.style.width = this.group.width + 'px';
            this.style.left = this.group.__left + curleft + 'px';

            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }

    render() {
        return html`
            ${this.group.rows.map((cell, i) => {
                if (cell.filterable) {
                    return html`
                        <simple-html-grid-cell-filter
                            .connector=${this.connector}
                            .cell=${cell}
                            .group=${this.group}
                            .ref=${this.ref}
                            .cellPosition=${i}
                        ></simple-html-grid-cell-filter>
                    `;
                } else {
                    return '';
                }
            })}
        `;
    }
}
