import { customElement } from '@simple-html/core';
import { html, render } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';
import { log } from './log';

@customElement('simple-html-grid-body')
export default class extends HTMLElement {
    connector: GridInterface;
    rowPositionCache: RowCache[];
    ref: SimpleHtmlGrid;
    firstLoad = true;

    connectedCallback() {
        this.classList.add('simple-html-grid-body');
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 2 + 'px';
        this.style.bottom = config.footerHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('vertical-scroll', this);
        this.ref.addEventListener('reRender', this);
        this.scrollTop = 500;
    }

    handleEvent(e: any) {
        log(this, e);

        if (e.type === 'column-resize') {
            this.render();
        }
        if (e.type === 'reRender') {
            render('', this); // force clear
            this.render();
        }
    }

    disconnectedCallback() {
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    updated() {
        if (this.firstLoad) {
            this.firstLoad = false;
            const node = this.ref.getElementsByTagName('simple-html-grid-body')[0];
            if (node && node.scrollTop !== this.connector.config.lastScrollTop) {
                this.scrollTop = this.connector.config.lastScrollTop;
                this.scrollLeft = this.connector.config.scrollLeft;
                this.ref.reRender();
            }
        } else {
            if (
                this.connector.config.scrollLeft &&
                this.scrollLeft !== this.connector.config.scrollLeft
            ) {
                // fixes left scroll when editing column headers
                this.scrollLeft = this.connector.config.scrollLeft;
                this.ref.reRender();
            }
        }
    }

    render() {
        const config = this.connector.config;

        if (this.firstLoad) {
            const node = this.ref.getElementsByTagName('simple-html-grid-body')[0];
            if (node && node.scrollTop !== this.connector.config.lastScrollTop) {
                return html`
                    <simple-html-grid-body-content
                        style="height:${this.connector.getScrollVars
                            .__SCROLL_HEIGHT}px;width:${config.__rowWidth}px"
                        class="simple-html-grid-content"
                    >
                    </simple-html-grid-body-content>
                `;
            }
        }
        return html`
            <simple-html-grid-body-content
                style="height:${this.connector.getScrollVars
                    .__SCROLL_HEIGHT}px;width:${config.__rowWidth}px"
                class="simple-html-grid-content"
            >
                ${this.rowPositionCache.map((row) => {
                    return html`
                        <simple-html-grid-row-group
                            .connector=${this.connector}
                            .row=${row}
                            .ref=${this.ref}
                        ></simple-html-grid-row-group>
                        <simple-html-grid-row
                            .connector=${this.connector}
                            .row=${row}
                            .ref=${this.ref}
                        ></simple-html-grid-row>
                    `;
                })}
            </simple-html-grid-body-content>
        `;
    }
}
