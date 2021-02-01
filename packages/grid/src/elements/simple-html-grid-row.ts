import { customElement, property } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
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
        this.groupMarginEl.connector = this.connector;
        this.groupMarginEl.row = this.row;

        this.groupDataEl = document.createElement('simple-html-grid-col') as SimpleHtmlGridCol;
        this.groupDataEl.classList.add('simple-html-grid-grouping-row');
        this.groupDataEl.style.width = `${grouping ? grouping * 15 : 0}px`;
        this.groupDataEl.style.left = `0`;
        this.groupDataEl.style.display = grouping ? 'block' : 'none';
        this.groupDataEl.connector = this.connector;
        this.groupDataEl.row = this.row;

        this.appendChild(this.groupMarginEl);
        this.appendChild(this.groupDataEl);
        this.colEls = this.ref.colCache.map((group) => {
            const el = document.createElement(
                'simple-html-grid-group-row'
            ) as SimpleHtmlGridGroupRow;

            el.onclick = (e) => {
                this.connector.highlightRow(e as any, this.row.i);
            };
            el.connector = this.connector;
            el.rowNo = this.row.i;
            el.ref = this.ref;
            el.group = group;

            this.appendChild(el);
            return el;
        });
        this.xrender();
    }

    verticalScroll(/* leftMargin: number, rightMargin: number, groups: GridGroupConfig[] */) {
        this.groupMarginEl.row = this.row;
        this.groupMarginEl.render();

        this.groupDataEl.connector = this.connector;
        this.groupDataEl.row = this.row;
        this.groupDataEl.ref = this.ref;
        this.groupDataEl.render();
        if (this.row.update) {
            this.colEls.forEach((col) => {
                col.rowNo = this.row.i;
                //const g = groups[i];
                //const left = g.__left;
                //const right = g.__left + g.width;
                //  if (left >= leftMargin && left <= rightMargin) {
                col.updateCells();
                //}
            });
            this.row.update = false;
            this.xrender();
        }
    }

    fixCols() {
        if (this.ref.colCache.length < this.colEls.length) {
            const keep: any = [];
            this.colEls.forEach((e, i) => {
                if (!this.ref.colCache[i]) {
                    this.removeChild(e);
                } else {
                    keep.push(e);
                }
            });
            this.colEls = keep;
        } else {
            this.ref.colCache.forEach((group, i) => {
                if (!this.colEls[i]) {
                    const el = document.createElement(
                        'simple-html-grid-group-row'
                    ) as SimpleHtmlGridGroupRow;

                    el.onclick = (e) => {
                        this.connector.highlightRow(e as any, this.row.i);
                    };
                    el.connector = this.connector;
                    el.rowNo = this.row.i;
                    el.ref = this.ref;
                    el.group = group;
                    this.colEls.push(el);
                    this.appendChild(el);
                } else {
                    const el = this.colEls[i];
                    el.rowNo = this.row.i;
                    //el.group = i;
                }
            });
        }
        this.colEls.forEach((el, i) => {
            el.rowNo = this.row.i;
            el.group = this.ref.colCache[i];
            el.updateCells();
        });
    }

    updateCols() {
        this.groupMarginEl.row = this.row;
        this.groupMarginEl.render();

        this.groupDataEl.connector = this.connector;
        this.groupDataEl.row = this.row;
        this.groupDataEl.ref = this.ref;
        this.groupDataEl.render();
        // quick fix for now..

        /*      const groups = this.connector.config.groups; */

        if (this.colEls.length !== this.ref.colCache.length) {
            this.fixCols();
        } else {
            this.colEls.forEach((el) => {
                el.rowNo = this.row.i;
                el.updateCells();
            });
        }
        this.xrender();
    }

    updateCols2() {
        if (this.colEls.length !== this.ref.colCache.length) {
            this.fixCols();
        } else {
            this.colEls.forEach((el, i) => {
                el.group = this.ref.colCache[i];

                el.rowNo = this.row.i;
                el.updateCells();
            });
        }
        this.xrender();
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
