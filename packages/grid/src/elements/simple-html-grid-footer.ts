import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-footer')
export default class extends HTMLElement {
    connector: GridInterface;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-footer');
        const config = this.connector.config;
        this.style.height = config.footerHeight + 'px';
        this.ref.addEventListener('reRender', this);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'reRender') {
            this.render();
        }
    }

    showEdit() {
        return html`
            <u
                @click="${(e: any) => {
                    generateMenuWithComponentName(
                        'simple-html-grid-filter-dialog',
                        e,
                        this.connector,
                        this.ref,
                        null,
                        null,
                        null
                    );
                }}}"
                >Edit filter</u
            >
        `;
    }

    render() {
        const totalRows = this.connector.completeDataset.length;
        const filter = this.connector.filteredDataset.length;

        return html`<div style="text-align:center">${filter}/${totalRows}</div>
            <div style="display: flex; justify-content: center;">
                <div style="margin-right:5px">
                    ${this.connector.getFilterString()}
                </div>

                ${this.connector.getFilterString() ? this.showEdit() : ''}
            </div> `;
    }
}
