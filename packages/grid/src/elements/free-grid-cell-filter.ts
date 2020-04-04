import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '../';
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
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
        }
        if (e.type === 'reRender') {
            this.render()
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        

        return html`
            <input class="free-grid-row-input" />
        `;
    }
}
