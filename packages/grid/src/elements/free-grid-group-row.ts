import { customElement, property } from '@simple-html/core';
import { GridInterface, FreeGrid } from '../';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';


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
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.style.width = this.group.width + 'px';
            this.style.left = this.group.__left + 'px';
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
