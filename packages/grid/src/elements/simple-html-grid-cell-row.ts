import { customElement, property } from '@simple-html/core';
import { SimpleHtmlGrid, GridInterface } from '..';
import { GridGroupConfig, CellConfig } from '../types';
import { html } from 'lit-html';
import { generateMenuWithComponentName } from './generateMenuWithComponentName';
import { log } from './log';

@customElement('simple-html-grid-cell-row')
export default class extends HTMLElement {
    connector: GridInterface;
    cellPosition: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    @property() rowNo: number;
    group: GridGroupConfig;
    cell: CellConfig;

    connectedCallback() {
        this.classList.add('simple-html-grid-cell-row');
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.cell = this.group.rows[this.cellPosition];
        this.ref.addEventListener('column-resize', this);
    }

    handleEvent(e: Event) {
        log(this, e);

        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }

    updateCallback(e: any) {
        const data = this.connector.displayedDataset[this.rowNo];
        const cell = this.cell;

        this.connector.gridCallbacks.beforeEditCallbackFn &&
            this.connector.gridCallbacks.beforeEditCallbackFn(
                e,
                cell,
                this.rowNo,
                data,
                this.connector
            );
        // filter out based on type so we know what type to use
        if (cell.autoUpdateData !== false) {
            switch (this.cell.type) {
                case 'boolean':
                    data[cell.attribute] = e.target.checked;
                    break;
                case 'image':
                    // rowData[col.attribute] = e.target.checked;
                    // we need this ever ?
                    break;
                case 'date':
                    data[cell.attribute] = e.target.valueAsDate;
                    break;
                case 'number':
                    data[cell.attribute] = e.target.valueAsNumber;
                    break;
                default:
                    data[cell.attribute] = e.target.value;
            }
            this.connector.publishEvent('attribute-change');
        }
        this.connector.gridCallbacks.afterEditCallbackFn &&
            this.connector.gridCallbacks.afterEditCallbackFn(
                e,
                cell,
                this.rowNo,
                data,
                this.connector
            );

        /*  
         TODO: do we want to check and highlight it ? 
       if (data.__controller?.__editedProps?.[cell.attribute]) {
            e.target.style = 'border-bottom: 1px solid red';
        } else {
            e.target.style = '';
        } */
    }

    render() {
        if (this.connector.displayedDataset[this.rowNo]) {
            const cell = this.cell;
            const data = this.connector.displayedDataset[this.rowNo];
            /* 
            TODO: do we want to check and highlight it ?
            let edited = false;
            if (data.__edited) {
                if (data.__controller?.__editedProps?.[cell.attribute]) {
                    edited = true;
                }
            } */

            const connector = this.connector;
            const rowNo = this.rowNo;
            const ref = this.ref;
            const change = this.cell.editEventType !== 'input' ? this.updateCallback : null;
            const input = this.cell.editEventType === 'input' ? this.updateCallback : null;

            const contentMenu = function (e: any) {
                if ((e as any).button !== 0) {
                    generateMenuWithComponentName(
                        'simple-html-grid-menu-row',
                        e,
                        connector,
                        ref,
                        cell,
                        rowNo,
                        data
                    );
                }
            };

            if (this.connector.gridCallbacks.renderRowCallBackFn) {
                return this.connector.gridCallbacks.renderRowCallBackFn(
                    cell,
                    data,
                    rowNo,
                    connector,
                    this.updateCallback
                );
            }

            switch (cell.type) {
                case 'boolean':
                    return html`
                        <input
                            ?readonly=${cell.readonly || connector.config.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type="checkbox"
                            @contextmenu=${(e: any) => {
                                e.preventDefault();
                                contentMenu(e);
                                return false;
                            }}
                            .checked=${data[cell.attribute]}
                            class="simple-html-grid-row-checkbox"
                        />
                    `;
                case 'image':
                    return html`
                        <img
                            .src=${data[cell.attribute] || ''}
                            class="simple-html-grid-image-round"
                        />
                    `;
                case 'empty':
                    return html`<div class="simple-html-grid-row-input "></div>`;

                case 'date':
                    return html`
                        <input
                            ?readonly=${cell.readonly || connector.config.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type=${cell.type}
                            @contextmenu=${(e: any) => {
                                e.preventDefault();
                                contentMenu(e);
                                return false;
                            }}
                            .valueAsDate=${data[cell.attribute] || null}
                            class="simple-html-grid-row-input"
                        />
                    `;
                case 'number':
                    return html`
                        <input
                            ?readonly=${cell.readonly || connector.config.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type=${cell.type}
                            @contextmenu=${(e: any) => {
                                e.preventDefault();
                                contentMenu(e);
                                return false;
                            }}
                            .valueAsNumber=${data[cell.attribute]}
                            class="simple-html-grid-row-input"
                        />
                    `;
                default:
            }

            // style="${edited ? 'border-bottom: 1px solid red' : ''}" <- do we want to highlight it?
            return html`
                <input
                    ?readonly=${cell.readonly || connector.config.readonly}
                    ?disabled=${cell.disabled}
                    @change=${change}
                    @input=${input}
                    @contextmenu=${(e: any) => {
                        e.preventDefault();
                        contentMenu(e);
                        return false;
                    }}
                    type=${cell.type || 'text'}
                    .value=${data[cell.attribute] || null}
                    class="simple-html-grid-row-input"
                />
            `;
        } else {
            return '';
        }
    }
}
