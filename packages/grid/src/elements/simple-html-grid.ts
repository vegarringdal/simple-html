import { GridInterface } from '../gridInterface';
import { generate } from './generate';
import { ColCache, RowCache } from '../types';
import { updateRowCache } from './updateRowCache';
import { defineElement } from './defineElement';
declare const ResizeObserver: any; // dunno whytypescript dont know about this one, TODO: check lib in tsconfig
export class SimpleHtmlGrid extends HTMLElement {
    private __DATASOURCE_INTERFACE: GridInterface;
    public rowCache: RowCache[] = [];
    public colCache: ColCache[] = [];
    private oldHeight: number;
    private oldWidth: number;
    private resizeTimer: any;
    private resizeInit: boolean;

    set interface(value: GridInterface) {
        if (this.__DATASOURCE_INTERFACE !== value) {
            this.__DATASOURCE_INTERFACE = value;
            this.__DATASOURCE_INTERFACE.connectGrid(this);
        }
        //just incase reziser is not set
        if (!this.resizeInit) {
            this.initResizerEvent();
        }
    }

    get interface() {
        return this.__DATASOURCE_INTERFACE;
    }

    public connectedCallback() {
        this.resizeInit = false;
        if (this.interface && this.isConnected) {
            this.oldHeight = this.clientHeight;
            this.oldWidth = this.clientWidth;
            this.resizeTimer;

            this.resetRowCache();

            // lets do a extra connect, just incase hmr have disconnected it and user cache har messed up
            this.interface.connectGrid(this);

            if (!this.children.length) {
                generate(this.interface, this.rowCache, this);
            }

            this.initResizerEvent();
        }
    }

    private initResizerEvent() {
        new ResizeObserver(() => {
            if (this.isConnected) {
                if (
                    this.oldHeight !== this.clientHeight ||
                    (this.oldWidth !== this.clientWidth && this.resizeInit)
                ) {
                    if (this.resizeTimer) clearTimeout(this.resizeTimer);
                    this.resizeTimer = setTimeout(() => {
                        this.resetRowCache();
                        this.reRender();
                    }, 100);
                }
                this.resizeInit = true;
            }
        }).observe(this);
    }

    public disconnectedCallback() {
        this.__DATASOURCE_INTERFACE && this.__DATASOURCE_INTERFACE.disconnectGrid(this);
    }

    public reRender() {
        const node = this.getElementsByTagName('simple-html-grid-body')[0];
        if (node && node.scrollTop !== undefined && this.interface) {
            updateRowCache(this.interface, this.rowCache, this, node.scrollTop, true);
        }
        this.triggerEvent('reRender');
    }

    public manualConfigChange() {
        if (!this.children.length) {
            generate(this.interface, this.rowCache, this);
        }
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

    public resetColCache() {
        const node = this.getElementsByTagName('simple-html-grid-body')[0];
        const clientWidth = node?.clientWidth || 1980;
        const scrollLeft = node?.scrollLeft || 0;
        let minGroups = Math.floor(clientWidth / 50) || 22;
        if (minGroups > this.interface.config.groups.length) {
            minGroups = this.interface.config.groups.length;
        }

        this.colCache = [];
        this.interface.config.groups.forEach((group, i) => {
            const cellRight = group.__left + group.width;
            const cellLeft = group.__left;
            const rightMargin = clientWidth + scrollLeft;
            const leftMargin = scrollLeft;
            if (
                (leftMargin <= cellLeft && cellLeft <= rightMargin) ||
                (leftMargin <= cellRight && cellRight <= rightMargin)
            ) {
                this.colCache.push({ i, update: true, found: false });
                return;
            }
        });
        if (this.colCache.length < minGroups) {
            // make sure we dont add "i" we have from before..

            // columns we have
            const x = this.colCache.map((x) => x.i);
            // columns we should have
            const y = Array.from(new Array(minGroups)).map((_x, i) => {
                return i;
            });
            // missing ones
            const z = y.filter((y) => !x.includes(y));

            while (this.colCache.length < minGroups) {
                this.colCache.push({ i: z.pop(), update: true, found: false });
            }
        }
    }

    public resetRowCache() {
        if (this.interface) {
            const node = this.getElementsByTagName('simple-html-grid-body')[0];
            const height = node?.clientHeight || this.interface.config.cellHeight * 50;
            this.resetColCache();
            // I need to use cell height here due to grouping/variable row height

            let rowsNeeded = Math.round(Math.floor(height / this.interface.config.cellHeight)) + 2;
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
                        if (
                            (this.rowCache && this.rowCache[i].i > cacheLength - 1) ||
                            this.rowCache[i].i < 0
                        ) {
                            this.rowCache.splice(i, 1);
                            i--;
                            l--;
                            cacheLength;
                        }
                    }
                    const missingLength = cacheLength - this.rowCache.length;
                    for (let i = 0; i < missingLength; i++) {
                        this.rowCache.push({ i: i, update: true });
                    }
                } else {
                    const missingLength = cacheLength - this.rowCache.length;
                    for (let i = 0; i < missingLength; i++) {
                        this.rowCache.push({ i: this.rowCache.length, update: true });
                    }
                }
            }
        } else {
            this.rowCache = [];
        }
    }
}
defineElement(SimpleHtmlGrid, 'simple-html-grid');
