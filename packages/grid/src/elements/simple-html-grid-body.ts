import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';

@customElement('simple-html-grid-body')
export default class extends HTMLElement {
    connector: GridInterface;
    rowPositionCache: RowCache[];
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-body');
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 2 + 'px';
        this.style.bottom = config.footerHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.render();
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const config = this.connector.config;

        return html`
            <simple-html-grid-body-content
                style="height:${this.connector.getScrollVars
                    .__SCROLL_HEIGHT}px;width:${config.__rowWidth}px"
                class="simple-html-grid-content"
            >
                ${this.rowPositionCache.map((row) => {
                    return html`
                        <simple-html-grid-row-group
                            .connector=${this.connector}
                            .row=${row}
                            .ref=${this.ref}
                        ></simple-html-grid-row-group>
                        <simple-html-grid-row
                            .connector=${this.connector}
                            .row=${row}
                            .ref=${this.ref}
                        ></simple-html-grid-row>
                    `;
                })}
            </simple-html-grid-body-content>
        `;
    }
}
