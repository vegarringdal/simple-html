/* eslint-disable @typescript-eslint/no-use-before-define */
import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { CellConfig, FilterArgument } from '../types';

@customElement('simple-html-grid-column-chooser')
export default class extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;
    width: number;
    filterAttributes: CellConfig[];
    filter: FilterArgument;

    connectedCallback() {
        this.classList.add('simple-html-grid-menu');
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<div class="simple-html-grid ">
            <button
                class="dialog-item-x"
                @click=${() => {
                    this.removeSelf();
                }}
            >
                <b> Close</b>
            </button>
            <br />
            "NOT IMPLEMENTED YET"
        </div>`;
    }
}
