import { render, html } from 'lit-html';
import { GridInterface } from '../gridInterface';
import { customElement } from '@simple-html/core';
import { generate } from './generate';
import { RowCache } from '../types';
import { updateRowCache } from './updateRowCache';

@customElement('simple-html-grid')
export class SimpleHtmlGrid extends HTMLElement {
    private __DATASOURCE_INTERFACE: GridInterface;
    public rowCache: RowCache[] = [];
    private currentScrollHeight: number;

    set interface(value: GridInterface) {
        this.__DATASOURCE_INTERFACE = value;
        this.__DATASOURCE_INTERFACE.connectGrid(this);
    }

    get interface() {
        return this.__DATASOURCE_INTERFACE;
    }

    public connectedCallback() {
        this.render();
        this.resetRowCache();
        if (this.interface) {
            this.currentScrollHeight = this.interface.getScrollVars.__SCROLL_HEIGHT;
        }
        this.cleanup();
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
            }
            this.cleanup();

            this.triggerEvent('reRender');
        });
    }

    public manualConfigChange() {
        // clear all
        render(html``, this);
        // genrate new grid
        render(html` ${generate(this.interface, this.rowCache, this)} `, this);
        // fix all
        this.reRender();
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
            updateRowCache(this.interface, this.rowCache, this, node.scrollTop);
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
            if (cacheLength !== this.rowCache.length) {
                if (this.rowCache.length > cacheLength) {
                    let l = this.rowCache.length;
                    for (let i = 0; i < l; i++) {
                        if (this.rowCache && this.rowCache[i].i > cacheLength) {
                            this.rowCache.splice(i, 1);
                            i--;
                            l--;
                            cacheLength;
                        }
                    }
                    const missingLength = cacheLength + 1 - this.rowCache.length;
                    for (let i = 0; i < missingLength; i++) {
                        this.rowCache.push({ i: i, update: true });
                    }
                } else {
                    const missingLength = cacheLength - this.rowCache.length;
                    for (let i = 0; i < missingLength; i++) {
                        this.rowCache.push({ i: i, update: true });
                    }
                }
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
                        // this.interface.config.lastScrollTop = 0;  TODO: remove
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
