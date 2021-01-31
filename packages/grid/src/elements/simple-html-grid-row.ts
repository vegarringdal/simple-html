import { customElement, property } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { GridGroupConfig, RowCache } from '../types';
import { SimpleHtmlGridGroupRow } from './simple-html-grid-group-row';
import { SimpleHtmlGridCol } from './simple-html-grid-col';

@customElement('simple-html-grid-row')
export class SimpleHtmlGridRow extends HTMLElement {
    connector: GridInterface;
    @property() row: RowCache;
    ref: SimpleHtmlGrid;
    groupMarginEl: SimpleHtmlGridCol;
    colEls: SimpleHtmlGridGroupRow[];
    groupDataEl: SimpleHtmlGridCol;

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

        this.groupMarginEl = document.createElement('simple-html-grid-col') as SimpleHtmlGridCol;
        this.groupMarginEl.classList.add('simple-html-grid-grouping-row');
        this.groupMarginEl.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.groupMarginEl.style.left = `0`;
        this.groupMarginEl.style.display = grouping ? 'block' : 'none';

        this.groupDataEl = document.createElement('simple-html-grid-col') as SimpleHtmlGridCol;
        this.groupDataEl.classList.add('simple-html-grid-grouping-row');
        this.groupDataEl.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.groupDataEl.style.left = `0`;
        this.groupDataEl.style.display = grouping ? 'block' : 'none';
        this.groupDataEl.connector = this.connector;
        this.groupDataEl.row = this.row;
        this.groupDataEl.ref = this.ref;

        this.appendChild(this.groupMarginEl);
        this.appendChild(this.groupDataEl);
        this.colEls = this.connector.config.groups.map((_group, i) => {
            const el = document.createElement(
                'simple-html-grid-group-row'
            ) as SimpleHtmlGridGroupRow;

            el.onclick = (e) => {
                this.connector.highlightRow(e as any, this.row.i);
            };
            el.connector = this.connector;
            el.rowNo = this.row.i;
            el.ref = this.ref;
            el.group = i;

            this.appendChild(el);
            return el;
        });
        this.xrender();
    }

    verticalScroll(leftMargin: number, rightMargin: number, groups: GridGroupConfig[]) {
        if (this.row.update) {
            this.colEls.forEach((col, i) => {
                col.rowNo = this.row.i;
                const g = groups[i];
                const left = g.__left;
                //const right = g.__left + g.width;
                if (left >= leftMargin && left <= rightMargin) {
                    col.updateCells();
                }
            });
            this.row.update = false;
            this.xrender();
        }
    }

    updateCols() {
        this.groupMarginEl.render();

        this.groupDataEl.connector = this.connector;
        this.groupDataEl.row = this.row;
        this.groupDataEl.ref = this.ref;
        this.groupDataEl.render();
        // quick fix for now..
        this.colEls = this.colEls.map((e) => this.removeChild(e));
        this.colEls = [];

        const data = this.connector.displayedDataset[this.row.i];

        if (data && !data.__group) {
            this.colEls = this.connector.config.groups.map((_group, i) => {
                const el = document.createElement(
                    'simple-html-grid-group-row'
                ) as SimpleHtmlGridGroupRow;

                el.onclick = (e) => {
                    this.connector.highlightRow(e as any, this.row.i);
                };
                el.connector = this.connector;
                el.rowNo = this.row.i;
                el.ref = this.ref;
                el.group = i;

                this.appendChild(el);
                return el;
            });
            this.xrender();
        }
    }

    handleEvent(e: Event) {
        if (e.type === 'column-resize') {
            const data = this.connector.displayedDataset[this.row.i];

            if (data && !data.__group) {
                this.colEls.forEach((g) => {
                    g.updateCells();
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
