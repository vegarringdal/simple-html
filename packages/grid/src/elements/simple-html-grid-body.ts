import { customElement } from '@simple-html/core';
import { html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { SimpleHtmlGrid } from '..';
import { RowCache } from '../types';

@customElement('simple-html-grid-body')
export default class extends HTMLElement {
    connector: GridInterface;
    rowPositionCache: RowCache[];
    ref: SimpleHtmlGrid;

    connectedCallback() {
        this.classList.add('simple-html-grid-body');
        const config = this.connector.config;
        this.style.top = config.panelHeight + config.__rowHeight * 2 + 2 + 'px';
        this.style.bottom = config.footerHeight + 'px';
        this.ref.addEventListener('column-resize', this);
        this.ref.addEventListener('vertical-scroll', this);
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
        this.ref.removeEventListener('vertical-scroll', this);
        this.ref.removeEventListener('column-resize', this);
        this.ref.removeEventListener('reRender', this);
    }

    render() {
        const config = this.connector.config;
        const lastcsroll = this.connector.config.lastScrollTop;

        if (lastcsroll > 0) {
            // if we start withh scrolltop we want to set rows correctly right away to stop
            // unwanted blinking
            let newTopPosition = lastcsroll;
            if (this.connector.displayedDataset.length <= this.rowPositionCache.length) {
                newTopPosition = 0;
            }

            const rowTopState: any = this.connector.getScrollVars.__SCROLL_TOPS;

            let currentRow = 0;

            let i = 0;

            if (newTopPosition !== 0) {
                // need to do some looping here, need to figure out where we are..
                while (i < rowTopState.length) {
                    const checkValue = Math.floor(newTopPosition - rowTopState[i]);

                    if (checkValue < 0) {
                        currentRow = i - 1;
                        break;
                    }

                    i++;
                }
            }

            let rowFound = currentRow;
            for (let i = 0; i < this.rowPositionCache.length; i++) {
                const newRow = currentRow + i;
                if (newRow > this.connector.displayedDataset.length - 1) {
                    rowFound--;
                    this.rowPositionCache[i].i = rowFound;
                } else {
                    this.rowPositionCache[i].i = newRow;
                }
                this.rowPositionCache[i].update = true;
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
