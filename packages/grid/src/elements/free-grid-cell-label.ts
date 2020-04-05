import { customElement } from '@simple-html/core';
import { GridInterface, FreeGrid } from '..';
import { IgridConfigGroups } from '../interfaces';
import { html } from 'lit-html';
import { resizeColumnElement } from './resizeColumnElement';
import { sorticonElement } from './sorticonElement';
import { eventIF } from '../eventIF';
import { columnDragDrop } from '../dragEvent';

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

        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);
    }

    handleEvent(e: any) {
        if (e.type === 'column-resize') {
            this.render();
        }
        if (e.type === 'reRender') {
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const cell = this.group.rows[this.cellPosition];
        const connector = this.connector;
        
        const mouseup = (e: MouseEvent) => {
            cell.sortable.beforeSortCallbackFn &&
            cell.sortable.beforeSortCallbackFn(<any>e, cell, connector);
            if (cell.sortable.auto !== false) {
                console.log('sort');
                connector.sortCallback(<any>e, cell);
            }
        };

        const sortCallback = (e: any) => {
            
            if ((<any>e).button === 0) {
                e.target.addEventListener('mouseup', mouseup);
                setTimeout(() => {
                    e.target.removeEventListener('mouseup', mouseup);
                }, 500);
            } else {
                console.log('open menu');
            }
        };

        const mousedown = columnDragDrop('dragstart', cell, connector);
        const mouseenter = columnDragDrop('enter', cell, connector);

        this.style.width = this.group.width + 'px';

        return html`
            <span
                .cell=${cell}
                class="free-grid-label"
                @custom=${eventIF(cell.sortable, 'mousedown', sortCallback, this)}
                @custom-1=${eventIF(!cell.disableDragDrop, 'mousedown', mousedown, this)}
                @custom-2=${eventIF(!cell.disableDragDrop, 'mouseenter', mouseenter, this)}
                >${this.label}
                ${sorticonElement(this.connector, this.group.rows[this.cellPosition])}</span
            >
            ${resizeColumnElement(this.ref, this.group)}
        `;
    }
}
