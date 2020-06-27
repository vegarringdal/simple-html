/* eslint-disable @typescript-eslint/no-use-before-define */
import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { CellConfig, FilterArgument } from '../types';
import { columnDragDrop } from './dragEvent';

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
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: Event) {
        if (e.type === 'reRender') {
            this.render();
            return;
        }
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    removeSelf() {
        document.body.removeChild(this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        return html`<div class="simple-html-grid ">
            <span
                class="block simple-html-grid-menu-item"
                @click=${() => {
                    this.removeSelf();
                }}
            >
                <b> Close</b>
            </span>
            ${this.connector.config.optionalCells?.map((cell) => {
                const mousedown = columnDragDrop('dragstart', cell, this.connector, null);

                return html`<span
                    class="block simple-html-grid-menu-item"
                    @mousedown=${(e: any) => {
                        mousedown(e);
                    }}
                >
                    ${cell.header}
                </span>`;
            })}
        </div>`;
    }
}
