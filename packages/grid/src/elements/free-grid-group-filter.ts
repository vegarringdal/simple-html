import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { FreeGrid } from '..';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';

@customElement('free-grid-group-filter')
export default class extends HTMLElement {
    classList: any = 'free-grid-group-filter';
    connector: GridInterface;
    rowNo: number;
    ref: FreeGrid;
    currentHeight: number;
    group: IgridConfigGroups;

    connectedCallback() {
        const config = this.connector.config;
        this.style.display = 'block';
        this.style.height = config.__rowHeight + 'px';
        this.style.width = this.group.width + 'px';
        this.style.left = this.group.__left + 'px';
        this.style.top = config.__rowHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize' || e.type === 'reRender') {
            const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length;
            let curleft = grouping ? grouping * 15 : 0;
            this.style.width = this.group.width + 'px';
            this.style.left = this.group.__left + curleft + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        return html`
            ${this.group.rows.map((cell, i) => {
                if (cell.filterable) {
                    return html`
                        <free-grid-cell-filter
                            .connector=${this.connector}
                            .cell=${cell}
                            .group=${this.group}
                            .ref=${this.ref}
                            .cellPosition=${i}
                        ></free-grid-cell-filter>
                    `;
                } else{
                    return ''
                }
            })}
        `;
    }
}
