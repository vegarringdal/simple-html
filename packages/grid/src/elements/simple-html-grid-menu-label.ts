import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-menu-label')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: ICell;
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        this.ref.addEventListener('vertical-scroll', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: string, asc?: boolean, add?: boolean) {
        if (_type === 'sort') {
            if (this.cell.sortable) {
                this.cell.sortable.sortAscending = asc;
                this.cell.sortable.noToggle = true;
            } else {
                this.cell.sortable = { sortAscending: asc, noToggle: true };
            }
            this.connector.sortCallback({ shiftKey: add } as MouseEvent, this.cell);
        }
        if (_type === 'groupBy') {
            if (this.cell.allowGrouping) {
                this.connector.groupingCallback(null, this.cell);
            }
        }
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<p
                class="simple-html-grid-menu-item"
                @click=${() => this.select('sort', true, false)}
            >
                Sort asc
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', false, false)}>
                Sort desc
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', true, true)}>
                Sort asc (add)
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', false, true)}>
                Sort desc (add)
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('groupBy')}>
                Group by
            </p>`;
    }
}
