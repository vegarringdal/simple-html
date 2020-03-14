import { GridInterface } from './gridInterface';
import { EntityHandler } from './entity';


export interface IEntity  {
    __controller ?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: IEntity[];
    __groupExpanded?: boolean;
}


export type CallbackEvent = { target: HTMLInputElement };
export type ColumnCallBackFn = (e: CallbackEvent, col: IColumns, connector: GridInterface) => void;
export type CellCallbackFn = (
    e: CallbackEvent,
    col: IColumns,
    row: number,
    data: IEntity,
    connector: GridInterface
) => void;
export type RowCallBackFn = (e: CallbackEvent, row: number, connector: GridInterface) => void;
export type renderCallBackFn = (
    html: any,
    col: IColumns,
    row: number,
    data: IEntity,
    connector: GridInterface
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


export interface IAttributes{
    attribute: string;
    type?: DataTypes; //defaults to text if not set
}


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
        /**Internal used for making sort icon on header*/
        sortAscending?: boolean;
        /**Internal used for making sort icon on header*/
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
    /**
     * you need to set new or config for this to work
     * You can use this to save current sorting/grouping for later
     */
    groupingSet?: IGroupingObj[];
    sortingSet?: ISortObjectInterface[];
    groupingExpanded?: string[];
}

export interface ISortObjectInterface {
    attribute: string;
    asc?: boolean;
    no?: number;
}


export interface IGroupingObj {
    title: string;
    field: string;
}

export interface IFilterObj {
    operator: number;
    value: any;
    attribute: string;
    type: string;
}
