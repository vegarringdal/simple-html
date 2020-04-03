import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '../';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';
import { property } from '@simple-html/core/dist/esm';

@customElement('free-grid-group-row')
export default class extends HTMLElement {
    classList: any = 'free-grid-group-row';
    connector: GridInterface;
    @property() rowNo: number;
    ref: FreeGrid;
    currentHeight: number;
    group: IgridConfigGroups;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.__rowHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.left = this.group.__left + 'px';
    }

    render() {
        return html`
            ${this.group.rows.map((cell, i) => {
                return html`
                    <free-grid-cell-row
                        .connector=${this.connector}
                        .rowNo=${this.rowNo}
                        .cell=${cell}
                        .group=${this.group}
                        .ref=${this.ref}
                        .cellPosition=${i}
                    ></free-grid-cell-row>
                `;
            })}
        `;
    }
}
