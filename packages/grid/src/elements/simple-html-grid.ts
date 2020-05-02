import { render, html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { customElement } from '@simple-html/core';
import { generate } from './generate';
import { rowCache } from '../interfaces';

@customElement('simple-html-grid')
export class SimpleHtmlGrid extends HTMLElement {
    private __DATASOURCE_INTERFACE: GridInterface;
    public rowCache: rowCache[] = [];
    private currentScrollHeight: number;

    set interface(value: GridInterface) {
        this.__DATASOURCE_INTERFACE = value;
        this.__DATASOURCE_INTERFACE.connectGrid(this);
    }

    get interface() {
        return this.__DATASOURCE_INTERFACE;
    }

    public connectedCallback() {
        this.resetRowCache();
        this.render();
        if (this.interface) {
            this.currentScrollHeight = this.interface.getScrollVars.__SCROLL_HEIGHT;
        }
    }

    public disconnectedCallback() {
        this.__DATASOURCE_INTERFACE && this.__DATASOURCE_INTERFACE.disconnectGrid();
    }

    public reRender() {
        requestAnimationFrame(() => {
            for (let i = 0; i < this.rowCache.length; i++) {
                this.rowCache[i].update = true;
            }

            this.render();
            if (this.currentScrollHeight !== this.interface.getScrollVars.__SCROLL_HEIGHT) {
                // if callention length is changed we need to make sure all rows are within viewport
                this.currentScrollHeight = this.interface.getScrollVars.__SCROLL_HEIGHT;
                this.cleanup();
            }

            this.triggerEvent('reRender');
        });
    }

    public manualConfigChange() {
        console.log('not implemented');
    }

    public triggerEvent(eventName: string, data?: any) {
        const event = new CustomEvent(eventName, {
            bubbles: true,
            detail: {
                data
            }
        });
        this.dispatchEvent(event);
    }

    public cleanup() {
        const node = this.getElementsByTagName('simple-html-grid-body')[0];
        if (node && node.scrollTop !== undefined && this.interface) {
            let newTopPosition = node.scrollTop;
            if (this.interface.displayedDataset.length <= this.rowCache.length) {
                newTopPosition = 0;
            }

            const rowTopState: any = this.interface.getScrollVars.__SCROLL_TOPS;

            let currentRow = 0;

            let i = 0;

            if (newTopPosition !== 0) {
                // need to do some looping here, need to figure out where we are..
                while (i < rowTopState.length) {
                    const checkValue = Math.floor(newTopPosition - rowTopState[i]);
                    if (checkValue < 0) {
                        currentRow = i - 2;
                        break;
                    }
                    i++;
                }
            }

            let rowFound = currentRow;
            for (let i = 0; i < this.rowCache.length; i++) {
                const newRow = currentRow + i;
                if (newRow > this.interface.displayedDataset.length - 1) {
                    rowFound--;
                    this.rowCache[i].i = rowFound;
                } else {
                    this.rowCache[i].i = newRow;
                }
                this.rowCache[i].update = true;
            }

            this.triggerEvent('vertical-scroll');
        }
    }

    public resetRowCache() {
        if (this.interface) {
            const node = this.getElementsByTagName('simple-html-grid-body')[0];
            const height = node?.clientHeight || this.interface.config.cellHeight * 50;

            let rowsNeeded = Math.round(Math.floor(height / this.interface.config.cellHeight)) + 2; //(buffer);
            if (rowsNeeded > 50) {
                rowsNeeded = 50;
            }

            const cacheLength =
                this.interface.displayedDataset.length > rowsNeeded
                    ? rowsNeeded
                    : this.interface.displayedDataset.length;
            this.rowCache = [];
            for (let i = 0; i < cacheLength; i++) {
                this.rowCache.push({ i: i, update: true });
            }
        } else {
            this.rowCache = [];
        }
    }

    public render() {
        return new Promise(() => {
            if (this.interface) {
                render(html` ${generate(this.interface, this.rowCache, this)} `, this);

                if (this.interface.config.lastScrollTop) {
                    // set initial scroll top/left
                    // nice when reloading a page etc
                    const node = this.getElementsByTagName('simple-html-grid-body')[0];
                    if (node && node.scrollTop !== this.interface.config.lastScrollTop) {
                        node.scrollTop = this.interface.config.lastScrollTop;
                        node.scrollLeft = this.interface.config.scrollLeft;
                        this.interface.config.lastScrollTop = 0;
                    }
                }
            } else {
                if (this.isConnected) {
                    console.error('no config set');

                    render(html``, this);
                }
            }
        });
    }
}
