import { customElement, value } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { html } from 'lit-html';
import { ICell } from '../interfaces';

let dataClip: any = null; // firefox hack
@customElement('simple-html-grid-menu-row')
export default class extends HTMLElement {
    @value() connector: GridInterface;
    @value() cell: ICell;
    @value() ref: SimpleHtmlGrid;
    @value() rowNo: number;
    @value() rowData: any;

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

    async select(_type: string) {
        if (_type === 'copy' && this.rowData) {
            try {
                dataClip = this.rowData[this.cell.attribute]; // firefox hack
                await navigator.clipboard.writeText(this.rowData[this.cell.attribute]);
            } catch (err) {
                console.error(err);
            }
        }
        if (_type === 'paste') {
            try {
                let data;
                if (navigator.clipboard.readText) {
                    data = await navigator.clipboard.readText();
                } else {
                    data = dataClip; // firefox hack
                }

                if (data === 'undefined' || data === 'null') {
                    data = null;
                }
                this.pasteIntoCells(data);
            } catch (err) {
                console.error(err);
            }
        }
        if (_type === 'clear') {
            this.pasteIntoCells(null);
        }
    }

    pasteIntoCells(data: any) {
        this.connector.selection.getSelectedRows().forEach((row: number) => {
            this.connector.filteredDataset[row][this.cell.attribute] = data;
        });
        this.connector.reRender();
        console.log(data);
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    render() {
        return html`<p class="simple-html-grid-menu-item" @click=${() => this.select('copy')}>
                Copy cell value
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('paste')}>
                Paste into selected rows
            </p>
            <p class="simple-html-grid-menu-item" @click=${() => this.select('clear')}>
                Clear selected rows
            </p>`;
    }
}
