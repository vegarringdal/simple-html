export { Entity } from '@simple-html/datasource';
import {
    SortArgument,
    GroupArgument,
    FilterComparisonOperator,
    DataTypes
} from '@simple-html/datasource';
export {
    FilterComparisonOperator,
    FilterAttributeSimple,
    SortArgument,
    GroupArgument,
    FilterLogicalOperator,
    FilterExpressionType,
    FilterValueType,
    FilterArgument,
    SelectionMode,
    DataTypes
} from '@simple-html/datasource';

export type InputTriggers = 'input' | 'change';
export type RowCache = { i: number; update: boolean };

export interface IAttributes {
    attribute: string;
    type?: DataTypes; //defaults to text if not set
}

export interface CellConfig {
    header?: string;
    attribute: string;
    /**Default FALSE */
    readonly?: boolean;
    /**Default FALSE */
    disabled?: boolean;
    /**NOT IN USE */
    width?: number;
    //filter
    filterable?: {
        /**Default FALSE */
        filterOverLabel?: boolean;
        beforeFilterCallbackFn?: any;
        /**Default TRUE */
        auto?: boolean;
        /**Default CHANGE */
        filterTrigger?: InputTriggers;
        /**Default STRING/TEXT */
        currentValue?: string | number | boolean | Date;
        placeholder?: string;
        /**Default BEGIN WITH */
        operator?: FilterComparisonOperator;
    };
    sortable?: {
        /**Internal used for making sort icon on header*/
        sortAscending?: boolean;
        /**Internal used for making sort icon on header*/
        sortNo?: number;
        /**Internal used for making sort icon on header*/
        beforeSortCallbackFn?: any;
        /**Internal used for making sort icon on header*/
        noToggle?: boolean;
        /**Default TRUE */
        auto?: boolean;
    };
    type?: DataTypes;
    beforeEditCallbackFn?: any;
    /**Default TRUE */
    autoUpdateData?: boolean;
    afterEditCallbackFn?: any;
    editEventType?: InputTriggers;
    disableDragDrop?: boolean;
    allowGrouping?: boolean;

    // needs more work
    renderRowCallBackFn?: any; //cell, data, connector, updatecallback
    renderLabelCallBackFn?: any;
    renderFilterCallBackFn?: any;
}

export type GridRowConfig = CellConfig;
export type GridGroupConfig = {
    width: number;
    //internal
    __left?: number;
    rows: GridRowConfig[];
};

export interface GridConfig {
    groups: GridGroupConfig[];
    cellHeight: number;
    footerHeight: number;
    panelHeight?: number;
    scrollLeft?: number;
    readonly?: boolean;
    lastScrollTop?: number;
    selectionMode?: 'multiple' | 'single' | 'none';

    // internals
    __cellRows?: number;
    __rowHeight?: number;
    __rowWidth?: number;

    /**
     * you need to set new or config for this to work
     * You can use this to save current sorting/grouping for later
     * these will override what is set in a datasource // todo: add a option to skip this?
     */
    groupingSet?: GroupArgument[];
    sortingSet?: SortArgument[];
    groupingExpanded?: string[];
}
