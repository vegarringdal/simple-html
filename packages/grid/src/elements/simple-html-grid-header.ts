import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';

@customElement('simple-html-grid-header')
export default class extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-header');
        const config = this.connector.config;
        this.style.top = config.panelHeight + 'px';
        this.style.height = config.__rowHeight * 2 + 2 + 'px';
        this.ref.addEventListener('horizontal-scroll', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'horizontal-scroll' || e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('horizontal-scroll', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const config = this.connector.config;

        this.style.left = -config.scrollLeft + 'px';
        this.style.width = config.__rowWidth + 'px';

        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;

        return html`
            <simple-html-grid-col
                class=" simple-html-grid-grouping-row"
                style="width:${grouping ? grouping * 15 : 0}px;left:0; display:${grouping
                    ? 'block'
                    : 'none'}"
            >
            </simple-html-grid-col>
            ${config.groups.map((group) => {
                return html`
                    <simple-html-grid-group-label
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </simple-html-grid-group-label>
                    <simple-html-grid-group-filter
                        .connector=${this.connector}
                        .ref=${this.ref}
                        .group=${group}
                    >
                    </simple-html-grid-group-filter>
                `;
            })}
        `;
    }
}
