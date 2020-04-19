import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';

@customElement('simple-html-grid-footer')
export default class extends HTMLElement {
    classList: any = 'simple-html-grid-footer';
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        const config = this.connector.config;
        this.style.height = config.footerHeight + 'px';
        this.ref.addEventListener('reRender', this);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'reRender') {
            this.render();
        }
    }

    render() {
        const totalRows = this.connector.completeDataset.length;
        const filter = this.connector.filteredDataset.length;

        return html`<div style="text-align:center">${filter}/${totalRows}</div>`;
    }
}
