import { GridInterface } from '../gridInterface';
import { customElement } from '@simple-html/core';
import { generate } from './generate';
import { ColCache, RowCache } from '../types';
import { updateRowCache } from './updateRowCache';

@customElement('simple-html-grid')
export class SimpleHtmlGrid extends HTMLElement {
    private __DATASOURCE_INTERFACE: GridInterface;
    public rowCache: RowCache[] = [];
    public colCache: ColCache[] = [];

    set interface(value: GridInterface) {
        if (this.__DATASOURCE_INTERFACE !== value) {
            this.__DATASOURCE_INTERFACE = value;
            this.__DATASOURCE_INTERFACE.connectGrid(this);
        }
    }

    get interface() {
        return this.__DATASOURCE_INTERFACE;
    }

    public connectedCallback() {
        this.resetRowCache();
    }

    public disconnectedCallback() {
        this.__DATASOURCE_INTERFACE && this.__DATASOURCE_INTERFACE.disconnectGrid();
    }

    public reRender() {
        this.cleanup();
        this.triggerEvent('reRender');
    }

    public manualConfigChange() {
        //render(html``, this);
        // render(html` ${generate(this.interface, this.rowCache, this)} `, this);

        if (!this.children.length) {
            generate(this.interface, this.rowCache, this);
        }
        this.cleanup();
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

    public resetColCache() {
        const node = this.getElementsByTagName('simple-html-grid-body')[0];
        const clientWidth = node?.clientWidth || 1980;
        this.colCache = [];
        this.interface.config.groups.forEach((group, i) => {
            if (group.__left < clientWidth) {
                this.colCache.push({ i, update: true });
            }
        });
        if (this.interface.config.groups.length > this.colCache.length) {
            this.colCache.push({ i: this.colCache.length, update: true });
        }
        console.log(this.colCache.length);
    }

    public resetRowCache() {
        if (this.interface) {
            const node = this.getElementsByTagName('simple-html-grid-body')[0];
            const height = node?.clientHeight || this.interface.config.cellHeight * 50;
            this.resetColCache();

            let rowsNeeded = Math.round(Math.floor(height / this.interface.config.cellHeight)) + 2; //(buffer);
            if (rowsNeeded > 80) {
                rowsNeeded = 80;
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
                if (!this.children.length) {
                    generate(this.interface, this.rowCache, this);
                }
                // render(html` ${generate(this.interface, this.rowCache, this)} `, this);
            } else {
                if (this.isConnected) {
                    console.error('no config set');
                    //render(html``, this);
                }
            }
        });
    }
}
