import { EntityHandler } from './entity';

export interface IEntity {
    __controller?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: IEntity[];
    __groupExpanded?: boolean;
}

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

export interface IAttributes {
    attribute: string;
    type?: DataTypes; //defaults to text if not set
}

export interface ICell {
    header?: string;
    attribute: string;
    /**Default FALSE */
    readonly?: boolean;
    /**Default FALSE */
    disabled?: boolean;
    /**Default 100 */
    width?: number;
    //filter
    filterable?: {
        /**Default FALSE */
        filterOverLabel?: boolean;
        beforeFilterCallbackFn?: any;
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
        beforeSortCallbackFn?: any;
        /**Default TRUE */
        auto?: boolean;
    };
    type?: DataTypes;
    beforeEditCallbackFn?: any;
    /**Default TRUE */
    autoUpdateData?: boolean;
    afterEditCallbackFn?: any;
    editEventType?: Triggers;
    disableDragDrop?: boolean;
    allowGrouping?: boolean;

     // needs more work
     renderRowCallBackFn?: any; //cell, data, connector, updatecallback

     renderLabelCallBackFn?: any;
     renderFilterCallBackFn?: any;
}

export type IgridConfigRows = ICell;
export type IgridConfigGroups = {
    width: number;
    //internal
    __left?: number;
    rows: IgridConfigRows[];
};

export interface IGridConfig {
    groups: IgridConfigGroups[];
    cellHeight: number;
    footerHeight: number;
    panelHeight?: number;
    scrollLeft?: number;
    lastScrollTop?: number;
    selectionMode?: 'multiple' | 'single' | 'none';

    // internals
    __cellRows?: number;
    __rowHeight?: number;
    __rowWidth?: number;

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
