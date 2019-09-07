import { render, html } from 'lit-html';
import { IGridConfig, IDataRow } from './interfaces';
export { IGridConfig } from './interfaces';
import { gridTemplate } from './templates/gridTemplate';
import { Selection } from './selection';
import { ArrayUtils } from './arrayUtils';

export class FreeGrid extends HTMLElement {
    // private
    private _DATASET_ALL: IDataRow[] = [];
    private _DATASET_FILTERED: IDataRow[] = [];
    private _DATASET_VIEW: IDataRow[] = [];
    private _CONFIG: IGridConfig;
    // private variableRowHeight: { height: number }[] = []; for later

    // public
    public arrayUtils: ArrayUtils;
    public rowCache: { i: number }[] = [];
    public selection: Selection;

    set config(value: IGridConfig) {
        this._CONFIG = value;
        if (this.config) {
            if (this.config.sortingSet) {
                this.arrayUtils.setOrderBy(this.config.sortingSet);
            }
            if (this.config.groupingSet) {
                this.arrayUtils.setGrouping(this.config.groupingSet);
            }
            if (this.config.groupingExpanded) {
                this.arrayUtils.setExpanded(this.config.groupingExpanded);
            }

            const result = this.arrayUtils.orderBy(this.activeData, null, false);
            this.arrayUtils.arraySort.SetConfigSort(this.config.columns);
            this.viewRows = result.fixed;
        }
    }

    get config() {
        return this._CONFIG;
    }

    set data(value: IDataRow[]) {
        const oldValue = this.data;

        // set key to data - need to have option for user key
        value.forEach((x, i) => {
            if (x && !(<any>x).__fg_key) {
                (<any>x).__fg_key = this.selection.getKey();
            } else {
                if (!value[i]) {
                    value[i] = { __fg_key: this.selection.getKey() };
                }
            }
        });

        this._DATASET_ALL = Array.from(value, o => Object.assign({}, o)); // <- do I want to update user array Im allready setting a key on it ?
        this._DATASET_FILTERED = this._DATASET_ALL.slice();
        this._DATASET_VIEW = this._DATASET_ALL.slice();
        if (oldValue.length !== this._DATASET_ALL.length) {
            const node = this.getElementsByTagName('free-grid-body')[0];
            if (node) {
                node.scrollTop = 0;
            }
            this.resetRowCache();
        }
        if (this.config) {
            if (this.config.sortingSet) {
                this.arrayUtils.setOrderBy(this.config.sortingSet);
            }
            if (this.config.groupingSet) {
                this.arrayUtils.setGrouping(this.config.groupingSet);
            }

            const result = this.arrayUtils.orderBy(this.activeData, null, false);
            this.arrayUtils.arraySort.SetConfigSort(this.config.columns);
            this.viewRows = result.fixed;
        }
        this.render();
    }

    get data(): IDataRow[] {
        return this._DATASET_ALL;
    }

    /**
     * Filtered data/ active set beeing used when grouping and sorting
     */
    set activeData(value) {
        this._DATASET_FILTERED = value;
    }
    get activeData() {
        return this._DATASET_FILTERED;
    }

    /**
     * data thats displayed, this will have have rows that isnt data when grouped
     */
    set viewRows(value) {
        this._DATASET_VIEW = value;
    }
    get viewRows() {
        return this._DATASET_VIEW;
    }

    constructor() {
        super();
        this.arrayUtils = new ArrayUtils(this);
        this.selection = new Selection(this);
    }

    public connectedCallback() {
        console.log('test');
        this.render();
    }

    // internal helper called when grouping/events etc
    public reRender(cs?: IGridConfig) {
        requestAnimationFrame(() => {
            this.config = cs || this.config;
            this.render();
        });
    }

    // helper for external if they chnage config and want to force update
    public manualConfigChange() {
        if (this.config) {
            if (this.config.sortingSet) {
                this.arrayUtils.setOrderBy(this.config.sortingSet);
            }
            if (this.config.groupingSet) {
                this.arrayUtils.setGrouping(this.config.groupingSet);
            }
            if (this.config.groupingExpanded) {
                this.arrayUtils.setExpanded(this.config.groupingExpanded);
            }

            const result = this.arrayUtils.orderBy(this.activeData, null, false);
            this.arrayUtils.arraySort.SetConfigSort(this.config.columns);
            this.viewRows = result.fixed;
        }
        this.reRender();
    }

    // main render function called by lit.html
    public render() {
        // render always need to request animation frame, else click events will get skipped

        if (this.config) {
            render(
                html`
                    ${gridTemplate(this, this.rowCache)}
                `,
                this
            );
        } else {
            if (this.isConnected) {
                console.error('no config set');

                render(html``, this);
            }
        }
    }

    // resets row cache
    private resetRowCache() {
        const cacheLength = this._DATASET_VIEW.length > 40 ? 40 : this._DATASET_VIEW.length;
        this.rowCache = [];
        for (let i = 0; i < cacheLength; i++) {
            this.rowCache.push({ i: i });
        }
    }
}

if (!(<any>globalThis).hmrCache) {
    customElements.define('free-grid', FreeGrid);
} else {
    if (!customElements.get('free-grid')) {
        customElements.define('free-grid', FreeGrid);
    }
}
