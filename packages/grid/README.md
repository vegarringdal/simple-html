# @simple-html/grid

Simple data grid made with lit-html Makes displaying a local array very easy. Support:

-   Grouping
-   filtering
-   multi sorting
-   mulitiselect rows
-   get/set setting - inluding sorting/grouping with expaned

### Install

-   `npm install @simple-html/grid`

### Sample

https://codesandbox.io/s/github/simple-html/codesandbox/tree/master/sample-grid

### Bundle size:

https://bundlephobia.com/result?p=@simple-html/grid

### Docs

JS

```ts
// import grid and its css
import '@simple-html/grid';
import '@simple-html/grid/dist/esm/grid.css';
```

HTML

```html
// lit html
<free-grid
    style="margin:20px;width:800px;height:400px"
    class="free-grid"
    .data="${this.mydata}"
    .config="${this.gridConfig}"
>
</free-grid>
```

> If you are not using lit-html then u need to set data and config on the html element

#### Config

```ts
export interface IColumns {
    header?: string;
    attribute: string;
    /**Default FALSE */
    readonly?: boolean;
    /**Default FALSE */
    disabled?: boolean;
    /**Default FALSE */
    hide?: boolean;
    /**Default 100 */
    width?: number;
    filterable?: {
        /**Default FALSE */
        filterOverLabel?: boolean;
        beforeFilterCallbackFn?: ColumnCallBackFn;
        /**Default TRUE */
        auto?: boolean;
        /**Default CHANGE */
        filterTrigger?: Triggers;
        /**Default STRING/TEXT */
        currentValue?: string | number | boolean | Date;
        placeholder?: string;
        /**Default BEGIN WITH */
        operator?: FilterOperator;
    };
    sortable?: {
        sortAscending?: boolean;
        sortNo?: number;
        beforeSortCallbackFn?: ColumnCallBackFn;
        /**Default TRUE */
        auto?: boolean;
    };
    type?: DataTypes;
    beforeEditCallbackFn?: CellCallbackFn;
    /**Default TRUE */
    autoUpdateData?: boolean;
    afterEditCallbackFn?: CellCallbackFn;
    editEventType?: Triggers;
    rowRenderCallBackFn?: renderCallBackFn;
    headerRenderCallBackFn?: renderCallBackFn;
    headerRenderLabelCallBackFn?: renderCallBackFn;
    headerRenderInputCallBackFn?: renderCallBackFn;
    disableDragDrop?: boolean;
    allowGrouping?: boolean;
}

export interface IGridConfig {
    columns: IColumns[];
    rowHeight: number;
    panelHeight?: number;
    headerHeight: number;
    footerHeight: number;
    scrollLeft?: number;
    lastScrollTop?: number;
    selectionMode?: SelectionMode;
    beforeSelectionChangeCallBackFn?: RowCallBackFn;
    afterSelectionChangeCallBackFn?: RowCallBackFn;
    rowRenderCallBackFn?: renderCallBackFn;
    footerRenderCallBackFn?: renderCallBackFn;
    headerRenderCallBackFn?: renderCallBackFn;
    groupingSet?: IGroupingObj[];
}

export type CallbackEvent = { target: HTMLInputElement };
export type ColumnCallBackFn = (e: CallbackEvent, col: IColumns, freeGrid: FreeGrid) => void;
export type CellCallbackFn = (
    e: CallbackEvent,
    col: IColumns,
    row: number,
    data: Entity,
    freeGrid: FreeGrid
) => void;
export type RowCallBackFn = (e: CallbackEvent, row: number, freeGrid: FreeGrid) => void;
export type renderCallBackFn = (
    html: any,
    col: IColumns,
    row: number,
    data: Entity,
    freeGrid: FreeGrid
) => void;

export type FilterOperator =
    | 'EQUAL'
    | 'LESS_THAN_OR_EQUAL_TO'
    | 'GREATER_THAN_OR_EQUAL_TO'
    | 'LESS_THAN'
    | 'GREATER_THAN'
    | 'CONTAINS'
    | 'NOT_EQUAL_TO'
    | 'DOES_NOT_CONTAIN'
    | 'BEGIN_WITH'
    | 'END_WITH';
export type DataTypes = 'text' | 'number' | 'image' | 'boolean' | 'date';
export type Triggers = 'input' | 'change';
export type SelectionMode = 'none' | 'single' | 'multiple';
export type rowCache = { i: number };
```
