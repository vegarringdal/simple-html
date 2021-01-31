import { customElement } from '@simple-html/core';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { log } from './log';
import { SimpleHtmlGridRow } from './simple-html-grid-row';

@customElement('simple-html-grid-body')
export class SimpleHtmlGridBody extends HTMLElement {
    connector: GridInterface;
    rowPositionCache: RowCache[];
    ref: SimpleHtmlGrid;
    firstLoad = true;
    body: HTMLElement;
    rows: SimpleHtmlGridRow[];

    connectedCallback() {
        this.classList.add('simple-html-grid-body');
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 2 + 'px';
        this.style.bottom = config.footerHeight + 'px';
        this.ref.addEventListener('reRender', this);
        this.scrollTop = 500;
        this.body = document.createElement('simple-html-grid-body-content');

        this.rows = this.rowPositionCache.map((i) => {
            const r = document.createElement('simple-html-grid-row') as SimpleHtmlGridRow;
            r.connector = this.connector;
            r.row = i;
            r.ref = this.ref;
            this.body.append(r);

            return r;
        });
        this.body.style.height = `${this.connector.getScrollVars.__SCROLL_HEIGHT || 0.1}px`;
        this.body.style.width = `${config.__rowWidth}px`;
        this.body.classList.add('simple-html-grid-content');
        this.append(this.body);
    }

    handleEvent(e: any) {
        log(this, e);

        if (e.type === 'reRender') {
            console.log('reRender');
            this.reRender();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('reRender', this);
    }

    reRender() {
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 2 + 'px';
        this.style.bottom = config.footerHeight + 'px';
        this.body.style.height = `${this.connector.getScrollVars.__SCROLL_HEIGHT || 0.1}px`;
        this.body.style.width = `${config.__rowWidth}px`;

        if (this.rowPositionCache.length !== this.rows.length) {
            if (this.rowPositionCache.length < this.rows.length) {
                const keep: any = [];
                this.rows.forEach((e, i) => {
                    if (!this.rowPositionCache[i]) {
                        this.body.removeChild(e);
                    } else {
                        keep.push(e);
                    }
                });
                this.rows = keep;
            } else {
                this.rowPositionCache.forEach((e, i) => {
                    if (!this.rows[i]) {
                        const r = document.createElement(
                            'simple-html-grid-row'
                        ) as SimpleHtmlGridRow;
                        r.connector = this.connector;
                        r.row = e;
                        r.ref = this.ref;
                        this.body.append(r);
                        this.rows.push({ r /* g */ });
                    } else {
                        const x = this.rows[i];

                        x.row = e;
                    }
                });
            }
        }

        this.rows.forEach((row, i) => {
            const r = row;
            r.connector = this.connector;
            r.row = this.rowPositionCache[i];
            r.ref = this.ref;
            r.handleEvent({ type: 'update-cols' });
        });
    }
}
