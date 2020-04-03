import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '..';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';

@customElement('free-grid-cell-label')
export default class extends HTMLElement {
    classList: any = 'free-grid-cell-label';
    connector: GridInterface;
    cellPosition: number;
    ref: FreeGrid;
    currentHeight: number;
    group: IgridConfigGroups;
    label: string;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.cellHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.top = this.cellPosition * config.cellHeight + 'px';
        //@ts-ignore fix later- might add options for columns in cell rows
        this.label = this.group.rows[this.cellPosition].header;
    }

    render() {
        return html`
            <span class="free-grid-label">${this.label}</span>
        `;
    }
}
