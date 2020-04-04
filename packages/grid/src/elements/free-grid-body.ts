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
        this.style.top = (config.panelHeight + config.__rowHeight * 2) +'px'
        this.style.bottom = config.footerHeight + 'px';
    }

    render() {
        const config = this.connector.config;
        const scrollheight = this.connector.displayedDataset.length * config.__rowHeight;

        console.log("wow")

        return html`
            <free-grid-body-content style="height:${scrollheight}px;width:${config.__rowWidth}px" class="free-grid-content">
                ${this.rowPositionCache.map(row => html`<free-grid-row .connector=${this.connector} .row=${row} .ref=${this.ref}></free-grid-row>`)}
            </free-grid-body-content>
        `;
    }
}
