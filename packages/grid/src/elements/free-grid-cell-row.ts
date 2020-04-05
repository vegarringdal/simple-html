import { customElement, property } from '@simple-html/core';
import { FreeGrid, GridInterface } from '..';
import { IgridConfigGroups, ICell } from '../interfaces';
import { html } from 'lit-html';

@customElement('free-grid-cell-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-cell-row';
    connector: GridInterface;
    cellPosition: number;
    ref: FreeGrid;
    currentHeight: number;
    @property() rowNo: number;
    group: IgridConfigGroups;
    cell: ICell;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        this.cell = this.group.rows[this.cellPosition];
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    updateCallback(e: any) {
        const data = this.connector.displayedDataset[this.rowNo];
        const cell = this.cell;

        cell.beforeEditCallbackFn &&
            cell.beforeEditCallbackFn(e, cell, this.rowNo, data, this.connector);
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
        cell.afterEditCallbackFn &&
            cell.afterEditCallbackFn(e, cell, this.rowNo, data, this.connector);
    }

    render() {
        if (this.connector.displayedDataset[this.rowNo]) {
            const cell = this.cell;
            const data = this.connector.displayedDataset[this.rowNo];
            const change = this.cell.editEventType !== 'input' ? this.updateCallback : null;
            const input = this.cell.editEventType === 'input' ? this.updateCallback : null;

            if (cell.renderRowCallBackFn) {
                return cell.renderRowCallBackFn(
                    cell,
                    data,
                    this.rowNo,
                    this.connector,
                    this.updateCallback
                );
            }

            switch (cell.type) {
                case 'boolean':
                    return html`
                        <input
                            ?readonly=${cell.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type="checkbox"
                            .checked=${data[cell.attribute]}
                            class="free-grid-row-checkbox"
                        />
                    `;
                case 'image':
                    return html`
                        <img .src=${data[cell.attribute] || ''} class="free-grid-image-round" />
                    `;

                case 'date':
                    return html`
                        <input
                            ?readonly=${cell.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type=${cell.type}
                            .valueAsDate=${data[cell.attribute] || null}
                            class="free-grid-row-input"
                        />
                    `;
                case 'number':
                    return html`
                        <input
                            ?readonly=${cell.readonly}
                            ?disabled=${cell.disabled}
                            @change=${change}
                            @input=${input}
                            type=${cell.type}
                            .valueAsNumber=${data[cell.attribute]}
                            class="free-grid-row-input"
                        />
                    `;
                default:
            }

            return html`
                <input
                    ?readonly=${cell.readonly}
                    ?disabled=${cell.disabled}
                    @change=${change}
                    @input=${input}
                    type=${cell.type || 'text'}
                    .value=${data[cell.attribute] || null}
                    class="free-grid-row-input"
                />
            `;
        } else {
            return '';
        }
    }
}
