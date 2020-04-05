import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '../';
import { rowCache } from '../interfaces';

@customElement('free-grid-body')
export default class extends HTMLElement {
    classList: any = 'free-grid-body';
    connector: GridInterface;
    rowPositionCache: rowCache[];
    ref: FreeGrid;

    connectedCallback() {
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 'px';
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
        if (e.type === 'vertical-scroll') {
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
        const scrollheight = this.connector.displayedDataset.length * config.__rowHeight;
        return html`
            <free-grid-body-content
                style="height:${scrollheight}px;width:${config.__rowWidth}px"
                class="free-grid-content"
            >
                ${this.rowPositionCache.map((row) => {
                    const entity = this.connector.displayedDataset[row.i];
                    const data = entity && entity.__group;
                    if (data) {
                        return html`
                            <free-grid-row-group
                                .connector=${this.connector}
                                .row=${row}
                                .ref=${this.ref}
                            ></free-grid-row-group>
                        `;
                    } else {
                        return html`
                            <free-grid-row
                                .connector=${this.connector}
                                .row=${row}
                                .ref=${this.ref}
                            ></free-grid-row>
                        `;
                    }
                })}
            </free-grid-body-content>
        `;
    }
}
