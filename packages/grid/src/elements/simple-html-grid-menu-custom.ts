import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell, FilterOperator } from '../interfaces';

@customElement('simple-html-grid-menu-custom')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: ICell;
    ref: SimpleHtmlGrid;
    rows: any[];

    connectedCallback() {
        (this.classList as any) = 'simple-html-grid simple-html-grid-menu';
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('vertical-scroll', this);
    }

    handleEvent(e: any) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: FilterOperator) {
        if (this.cell.filterable) {
            this.cell.filterable.operator = _type;
        }
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return this.rows.map((row) => {
            return html`
                <p class="simple-html-grid-menu-item" @click=${() => row.callback(row)}>
                    row.title
                </p>
            `;
        });
    }
}
