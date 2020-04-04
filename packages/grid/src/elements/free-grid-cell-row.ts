import { customElement, property } from '@simple-html/core';
import { FreeGrid, GridInterface } from '..';
import { IgridConfigGroups, ICell } from '../interfaces';
import { html } from 'lit-html';
import { eventIF } from '../eventIF';

@customElement('free-grid-cell-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-cell-row';
    connector: GridInterface;
    cellPosition: number;
    ref: FreeGrid;
    currentHeight: number;
    @property() rowNo: number;
    group: IgridConfigGroups;
    col: ICell;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        //@ts-ignore fix later- might add options for columns in cell rows
        this.col = this.group.rows[this.cellPosition];
        this.ref.addEventListener('column-resize', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }

    render() {

        

        if (this.connector.displayedDataset[this.rowNo]) {
            const col = this.col;
            const data = this.connector.displayedDataset[this.rowNo][col.attribute];
            switch (col.type) {
                case 'boolean':
                    return html`
                        <input
                            ?readonly=${col.readonly}
                            ?disabled=${col.disabled}
                            @custom=${eventIF(true, col.editEventType || 'change', () => {})}
                            type="checkbox"
                            .checked=${data}
                            class="free-grid-row-checkbox"
                        />
                    `;
                case 'image':
                    return html`
                        <img .src=${data || ''} class="free-grid-image-round" />
                    `;

                case 'date':
                    return html`
                        <input
                            ?readonly=${col.readonly}
                            ?disabled=${col.disabled}
                            @custom=${eventIF(true, col.editEventType || 'change', () => {})}
                            type=${col.type}
                            .valueAsDate=${data || null}
                            class="free-grid-row-input"
                        />
                    `;
                case 'number':
                    return html`
                        <input
                            ?readonly=${col.readonly}
                            ?disabled=${col.disabled}
                            @custom=${eventIF(true, col.editEventType || 'change', () => {})}
                            type=${col.type}
                            .valueAsNumber=${data}
                            class="free-grid-row-input"
                        />
                    `;
                default:
            }

            return html`
                <input value=${data} class="free-grid-row-input" />
            `;
        } else {
            return '';
        }
    }
}
