import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '@simple-html/grid/dist/esm';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';

@customElement('free-grid-cell-filter')
export default class extends HTMLElement {
    classList: any = 'free-grid-cell-filter';
    connector: GridInterface;
    cellPosition: number;
    ref: FreeGrid;
    currentHeight: number;
    group: IgridConfigGroups;
    label: string;

    connectedCallback() {
        const config = this.connector.config;
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        //@ts-ignore fix later- might add options for columns in cell rows
        this.attribute = this.group.rows[this.cellPosition].attribute;
    }

    render() {
        return html`
            <input class="free-grid-row-input" />
        `;
    }
}
