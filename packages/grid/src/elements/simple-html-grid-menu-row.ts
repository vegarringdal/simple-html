import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from './simple-html-grid';
import { CellConfig, Entity } from '../types';

let dataClip: any = null; // firefox hack
@customElement('simple-html-grid-menu-row')
export class SimpleHtmlGridMenuRow extends HTMLElement {
    connector: GridInterface;
    cell: CellConfig;
    ref: SimpleHtmlGrid;
    rowNo: number;
    rowData: Entity;

    connectedCallback() {
        this.classList.add('simple-html-grid', 'simple-html-grid-menu');
        document.addEventListener('click', this);
        setTimeout(() => {
            document.addEventListener('contextmenu', this);
        }, 50);
        this.buildHtml();
    }

    disconnectedCallback() {
        document.removeEventListener('click', this);
        document.removeEventListener('contextmenu', this);
    }

    handleEvent(e: Event) {
        if (e.target !== this) {
            this.removeSelf();
        }
    }

    capalize(text: string) {
        if (text) {
            text = text.toLowerCase();
            return text[0].toUpperCase() + text.substring(1, text.length);
        } else {
            return text;
        }
    }

    async select(_type: string) {
        if (_type === 'copy' && this.rowData) {
            try {
                dataClip = this.rowData[this.cell.attribute]; // firefox hack
                if (this.cell.type === 'date') {
                    dataClip = dataClip ? dataClip.toLocaleDateString() : '';
                }
                await navigator.clipboard.writeText(dataClip);
            } catch (err) {
                console.error(err);
            }
        }
        if ((_type === 'copy-range' || _type === 'copy-range-header') && this.rowData) {
            try {
                dataClip = '';
                if (_type === 'copy-range-header') {
                    dataClip = this.capalize(this.cell.attribute) + '\n';
                }
                this.connector.getSelectedRows().forEach((row: number) => {
                    if (!this.connector.displayedDataset[row].__group) {
                        const data = this.connector.displayedDataset[row][this.cell.attribute];
                        if (this.cell.type === 'date') {
                            dataClip = dataClip + (data ? data.toLocaleDateString() : '') + '\n';
                        } else {
                            dataClip = dataClip + (data || '') + '\n';
                        }
                    }
                });
                await navigator.clipboard.writeText(dataClip);
            } catch (err) {
                console.error(err);
            }
        }
        if (_type === 'copy-range-row-header' && this.rowData) {
            try {
                const attributes = this.connector.config.groups.flatMap((g) =>
                    g.rows.map((r) => r.attribute)
                );

                const types = this.connector.config.groups.flatMap((g) =>
                    g.rows.map((r) => r.type)
                );

                dataClip = '';
                // headers
                attributes.forEach((att) => {
                    dataClip = dataClip + this.capalize(att) + '\t';
                });
                //rows
                dataClip = dataClip + '\n';
                this.connector.getSelectedRows().forEach((row: number) => {
                    if (!this.connector.displayedDataset[row].__group) {
                        attributes.forEach((att, i) => {
                            const data = this.connector.displayedDataset[row][att];
                            if (types[i] === 'date') {
                                dataClip =
                                    dataClip + (data ? data.toLocaleDateString() : '') + '\t';
                            } else {
                                dataClip = dataClip + (data || '') + '\t';
                            }
                        });
                        dataClip = dataClip + '\n';
                    }
                });
                await navigator.clipboard.writeText(dataClip);
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
        this.connector.getSelectedRows().forEach((row: number) => {
            this.connector.displayedDataset[row][this.cell.attribute] = data;
        });
        this.connector.reRender();
    }

    removeSelf() {
        document.body.removeChild(this);
    }

    buildHtml() {
    

        const el = [1, 1, 1, 1, 1, 1].map(() => document.createElement('p'));
        el.forEach((e) => e.classList.add('simple-html-grid-menu-item'));

        el[0].onclick = () => this.select('copy');
        el[0].appendChild(document.createTextNode('Copy cell'));

        el[1].onclick = () => this.select('copy-range');
        el[1].appendChild(document.createTextNode('Copy cell column'));

        el[2].onclick = () => this.select('copy');
        el[2].appendChild(document.createTextNode('Copy cell column (w/header)'));

        el[3].onclick = () => this.select('copy-range-row-header');
        el[3].appendChild(document.createTextNode(' Copy cell rows (w/header)'));

        if (!this.connector.config.readonly && !this.cell.readonly) {
            el[4].onclick = () => this.select('paste');
            el[4].appendChild(document.createTextNode('Paste into selected rows/cells'));

            el[5].onclick = () => this.select('clear');
            el[5].appendChild(document.createTextNode('Clear selected rows/cells'));
        } else {
            el.pop();
            el.pop();
        }

        el.forEach((e) => this.appendChild(e));
    }
}
