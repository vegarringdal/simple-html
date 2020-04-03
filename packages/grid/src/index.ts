import { render, html } from 'lit-html';
export { IGridConfig } from './interfaces';
import { GridInterface } from './gridInterface';
import { customElement } from '@simple-html/core';
import { generate } from './elements/generate';
export { GridInterface } from './gridInterface';

@customElement('free-grid')
export class FreeGrid extends HTMLElement {
    private __DATASOURCE_INTERFACE: GridInterface;
    public rowCache: { i: number }[] = [];

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
    }

    public disconnectedCallback() {
        this.__DATASOURCE_INTERFACE && this.__DATASOURCE_INTERFACE.disconnectGrid();
    }

    public reRender() {
        requestAnimationFrame(() => {
            this.render();
        });
    }

    public manualConfigChange() {
        console.log('not implemented');
    }

    public triggerEvent(eventName: string, data?: any){
        console.log(eventName)
        const event = new CustomEvent(eventName, {
            bubbles:true,
            detail: {
                data
            }
          });
          this.dispatchEvent(event);
    }

    public resetRowCache() {
        if (this.interface) {
            const cacheLength =
                this.interface.displayedDataset.length > 40
                    ? 40
                    : this.interface.displayedDataset.length;
            this.rowCache = [];
            for (let i = 0; i < cacheLength; i++) {
                this.rowCache.push({ i: i });
            }
        } else {
            this.rowCache = [];
        }
    }

    public render() {
        return new Promise(() => {
            // console.time('render');
            if (this.interface) {
                render(
                    html`
                        ${generate(this.interface, this.rowCache, this)}
                    `,
                    this
                );

                if (this.interface.config.lastScrollTop) {
                    // set initial scroll top/left
                    // nice when reloading a page etc
                    const node = this.getElementsByTagName('free-grid-body')[0];
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
            //console.timeEnd('render');
        });
    }
}

