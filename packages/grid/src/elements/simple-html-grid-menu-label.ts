import { customElement, value } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-menu-label')
export default class extends HTMLElement {
    @value() connector: GridInterface;
    @value() cell: ICell;
    @value() ref: SimpleHtmlGrid;

    connectedCallback() {
        (this.classList as any) = 'simple-html-grid simple-html-grid-menu';
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

    handleEvent(e: any) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: string, asc?: boolean, add?: boolean) {
        if (_type === 'sort') {
            if (this.cell.sortable) {
                this.cell.sortable.sortAscending = true;
            } else {
                this.cell.sortable = { sortAscending: asc };
            }
            this.connector.sortCallback({ shiftKey: add }, this.cell);
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
                @click=${() => this.select('sort', false, false)}
            >
                Sort asc
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', true, false)}>
                Sort desc
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', true, true)}>
                Sort asc (add)
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('sort', true, true)}>
                Sort desc (add)
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('groupBy')}>
                Group by
            </p>`;
    }
}
