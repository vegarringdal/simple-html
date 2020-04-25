import { customElement, value } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-menu-row')
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
        console.log(e.target);
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    select(_type: string) {
        this.removeSelf();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('copy')}>
                Coapy cell value
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('paste')}>
                Paste into cells
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('clear')}>
                Clear cells
            </p>`;
    }
}
