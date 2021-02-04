import { customElement } from '@simple-html/core';
import { GridInterface, SimpleHtmlGrid } from '..';
import { ColCache } from '../types';
import { SimpleHtmlGridCellRow } from './simple-html-grid-cell-row';

@customElement('simple-html-grid-group-row')
export class SimpleHtmlGridGroupRow extends HTMLElement {
    connector: GridInterface;
    rowNo: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: ColCache;
    rows: SimpleHtmlGridCellRow[];

    connectedCallback() {
        this.classList.add('simple-html-grid-group-row');
        const config = this.connector.config;
        this.updateStyling();
        this.rows = config.groups[this.group.i].rows.map((cell, i) => {
            const rowCell = document.createElement(
                'simple-html-grid-cell-row'
            ) as SimpleHtmlGridCellRow;
            rowCell.connector = this.connector;
            rowCell.rowNo = this.rowNo;
            rowCell.cell = cell;
            rowCell.group = this.group.i;
            rowCell.ref = this.ref;
            rowCell.cellPosition = i;
            this.appendChild(rowCell);
            return rowCell;
        });
    }

    updateCells() {
        const rows = this.connector.config.groups[this.group.i].rows;

        if (this.rows.length !== rows.length) {
            if (rows.length < this.rows.length) {
                const keep: any = [];
                this.rows.forEach((e, i) => {
                    if (!rows[i]) {
                        this.removeChild(e);
                    } else {
                        keep.push(e);
                    }
                });
                this.rows = keep;
                this.rows.forEach((el, i) => {
                    el.rowNo = this.rowNo;
                    el.group = i;
                });
            } else {
                rows.forEach((_e, i) => {
                    if (!this.rows[i]) {
                        const el = document.createElement(
                            'simple-html-grid-cell-row'
                        ) as SimpleHtmlGridCellRow;
                        el.connector = this.connector;
                        el.rowNo = this.rowNo;
                        el.cell = rows[i];
                        el.group = this.group.i;
                        el.ref = this.ref;
                        el.cellPosition = i;

                        this.appendChild(el);
                        this.rows.push(el);
                    } else {
                        const el = this.rows[i];
                        el.rowNo = this.rowNo;
                        el.cell = rows[i];
                        el.group = this.group.i;
                        el.cellPosition = i;
                    }
                });
            }
        }

        this.rows.forEach((r, i) => {
            r.rowNo = this.rowNo;
            r.group = this.group.i;
            r.cell = this.connector.config.groups[this.group.i].rows[i];
            r.cellPosition = i;
            r.updateInput();
        });

        this.updateStyling();
    }

    private updateStyling() {
        const config = this.connector.config;
        const grouping = config.groupingSet && config.groupingSet.length;
        const curleft = grouping ? grouping * 15 : 0;
        this.style.height = config.__rowHeight + 'px';
        this.style.width = config.groups[this.group.i].width + 'px';
        this.style.transform = `translate3d(${
            config.groups[this.group.i].__left + curleft
        }px, 0px,  0px)`;
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize' /* || e.type === 'reRender' */) {
            this.updateStyling();
            this.rows.forEach((r) => {
                r.updateWidth();
            });
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
    }
}
