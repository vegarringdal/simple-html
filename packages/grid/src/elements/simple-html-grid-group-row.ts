import { customElement } from '@simple-html/core';
import { GridInterface, SimpleHtmlGrid } from '..';
import { SimpleHtmlGridCellRow } from './simple-html-grid-cell-row';

@customElement('simple-html-grid-group-row')
export class SimpleHtmlGridGroupRow extends HTMLElement {
    connector: GridInterface;
    rowNo: number;
    ref: SimpleHtmlGrid;
    currentHeight: number;
    group: number;
    rows: SimpleHtmlGridCellRow[];

    connectedCallback() {
        this.classList.add('simple-html-grid-group-row');
        const config = this.connector.config;
        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;
        const curleft = grouping ? grouping * 15 : 0;
        this.style.display = 'block';
        this.style.height = config.__rowHeight + 'px';
        this.style.width = config.groups[this.group].width + 'px';
        this.style.left = config.groups[this.group].__left + curleft + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('reRender', this);

        this.rows = config.groups[this.group].rows.map((cell, i) => {
            const x = document.createElement('simple-html-grid-cell-row') as SimpleHtmlGridCellRow;
            x.connector = this.connector;
            x.rowNo = this.rowNo;
            x.cell = cell;
            x.group = this.group;
            x.ref = this.ref;
            x.cellPosition = i;
            this.appendChild(x);
            return x;
        });
    }

    updateCells() {
        const rows = this.connector.config.groups[this.group].rows;

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
                        el.group = this.group;
                        el.ref = this.ref;
                        el.cellPosition = i;

                        this.appendChild(el);
                        this.rows.push(el);
                    } else {
                        const el = this.rows[i];
                        el.rowNo = this.rowNo;
                        el.cell = rows[i];
                        el.group = this.group;
                        el.cellPosition = i;
                    }
                });
            }
        }

        this.rows.forEach((r, i) => {
            r.rowNo = this.rowNo;
            r.cell = this.connector.config.groups[this.group].rows[i];
            r.cellPosition = i;
            r.xrender();
        });
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize' || e.type === 'reRender') {
            const config = this.connector.config;
            const grouping =
                this.connector.config.groupingSet && this.connector.config.groupingSet.length;
            const curleft = grouping ? grouping * 15 : 0;
            this.style.height = config.__rowHeight + 'px';
            this.style.width = config.groups[this.group].width + 'px';
            this.style.left = config.groups[this.group].__left + curleft + 'px';
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }
}
