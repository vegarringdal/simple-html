import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';

@customElement('simple-html-grid-footer')
export class SimpleHtmlGridFooter extends HTMLElement {
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
            <div
                style="
                    margin:2px;position:absolute;
                    top:0px; border: 1px solid; 
                    border-color: var(--simple-html-grid-sec-bg-border);
                    background-color: var(--simple-html-grid-main-bg-color)"
            >
                <button
                    style="padding:2px"
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
                >
                    Edit filter
                </button>
            </div>
        `;
    }

    render() {
        const totalRows = this.connector.completeDataset.length;
        const filter = this.connector.filteredDataset.length;

        return html`${this.showEdit()}
            <div style="text-align:center">${filter}/${totalRows}</div>

            <div style="display: flex; justify-content: center;">
                <span
                    style="margin-right:5px; 
                        overflow:hidden; 
                        max-width:90%; 
                        white-space: nowrap;
                        text-overflow: ellipsis;"
                >
                    ${this.connector.getFilterString().replace(/\,/g, ', ')}
                </span>
            </div> `;
    }
}
