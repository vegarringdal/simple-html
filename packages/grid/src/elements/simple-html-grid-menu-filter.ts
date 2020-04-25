import { customElement, value } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

@customElement('simple-html-grid-menu-filter')
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
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
        this.ref.removeEventListener('vertical-scroll', this);
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
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('=')}>
                Equal to
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('!=')}>
                Not equal to
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('*x')}>
                Starts with
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('>')}>
                Greater than
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('>=')}>
                Greater than or equal
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('<')}>
                Less than
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('<=')}>
                Less than or equal
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('x*')}>
                End with
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('*')}>
                Contains
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('!*')}>
                Does not contain
            </p>`;
    }
}
