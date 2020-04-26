import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-menu-panel')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: ICell;
    ref: SimpleHtmlGrid;

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

    select(_type: string) {
        if (_type === 'clear') {
            this.connector.config.groupingExpanded = [];
            this.connector.config.sortingSet = [];
            this.connector.config.groupingSet = [];
            this.connector.manualConfigChange();
        }
        if (_type === 'collapse') {
            this.connector.groupCollapse(null);
        }
        if (_type === 'expand') {
            this.connector.groupExpand(null);
        }
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('clear')}>
                Clear grouping
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('collapse')}>
                Collapse all
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('expand')}>
                Expand all
            </p>`;
    }
}
