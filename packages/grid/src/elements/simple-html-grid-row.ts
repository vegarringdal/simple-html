import { customElement, property } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { html } from 'lit-html';
import { RowCache } from '../types';
import { log } from './log';

@customElement('simple-html-grid-row')
export default class extends HTMLElement {
    connector: GridInterface;
    @property() row: RowCache;
    ref: SimpleHtmlGrid;
    col: HTMLElement;
    cols: HTMLElement[];
    col2: HTMLElement;

    connectedCallback() {
        this.classList.add('simple-html-grid-row');
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('selection', this);
        this.ref.addEventListener('column-resize', this);

        if (this.connector.config.__rowHeight > this.connector.config.cellHeight) {
            this.classList.add('grouping-row-border');
        }
        const grouping =
            this.connector.config.groupingSet && this.connector.config.groupingSet.length;

        this.col = document.createElement('simple-html-grid-col');
        this.col.classList.add('simple-html-grid-grouping-row');
        this.col.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.col.style.left = `0`;
        this.col.style.display = grouping ? 'block' : 'none';

        this.col2 = document.createElement('simple-html-grid-col');
        this.col2.classList.add('simple-html-grid-grouping-row');
        this.col2.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.col2.style.left = `0`;
        this.col2.style.display = grouping ? 'block' : 'none';
        this.col2.connector = this.connector;
        this.col2.row = this.row;
        this.col2.ref = this.ref;

        this.appendChild(this.col);
        this.appendChild(this.col2);
        this.cols = this.connector.config.groups.map((_group, i) => {
            const x = document.createElement('simple-html-grid-group-row');
            x.onclick = (e) => {
                this.connector.highlightRow(e as any, this.row.i);
            };
            x.connector = this.connector;
            x.rowNo = this.row.i;
            x.ref = this.ref;
            x.group = i;

            this.appendChild(x);
            return x;
        });
        this.xrender();
    }

    handleEvent(e: Event) {
        log(this, e);

        if (e.type === 'vertical-scroll') {
            if (this.row.update) {
                this.cols.forEach((col) => {
                    col.rowNo = this.row.i;
                    col.updateCells();
                });
                this.row.update = false;
                this.xrender();
            }
        }

        if (e.type === 'column-resize') {
            const data = this.connector.displayedDataset[this.row.i];

            if (data && !data.__group) {
                this.cols.forEach((g, i) => {
                    g.updateCells();
                });
                this.xrender();
            }
        }

        if (e.type === 'update-cols') {
            this.col.render();

            this.col2.connector = this.connector;
            this.col2.row = this.row;
            this.col2.ref = this.ref;
            this.col2.render();
            // quick fix for now..
            this.cols = this.cols.map((e) => this.removeChild(e));
            this.cols = [];

            const data = this.connector.displayedDataset[this.row.i];

            if (data && !data.__group) {
                this.cols = this.connector.config.groups.map((_group, i) => {
                    const x = document.createElement('simple-html-grid-group-row');
                    x.onclick = (e) => {
                        this.connector.highlightRow(e as any, this.row.i);
                    };
                    x.connector = this.connector;
                    x.rowNo = this.row.i;
                    x.ref = this.ref;
                    x.group = i;

                    this.appendChild(x);
                    return x;
                });
                this.xrender();
            }
        }

        if (e.type === 'selection') {
            this.xrender();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('selection', this);
        this.ref.removeEventListener('column-resize', this);
    }

    xrender() {
        // check if height is changed
        this.style.height = this.connector.getScrollVars.__SCROLL_HEIGHTS[this.row.i] + 'px';
        this.style.transform = `translate3d(0px, ${
            this.connector.getScrollVars.__SCROLL_TOPS[this.row.i]
        }px, 0px)`;

        this.style.display = 'block';

        if (this.connector.isSelected(this.row.i)) {
            this.classList.add('simple-html-grid-selected-row');
        } else {
            this.classList.remove('simple-html-grid-selected-row');
        }
    }
}
