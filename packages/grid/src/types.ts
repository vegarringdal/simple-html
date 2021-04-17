export { Entity } from '@simple-html/datasource';
import {
    SortArgument,
    GroupArgument,
    FilterComparisonOperator,
    DataTypes,
    FilterArgument
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
export type ColCache = { i: number; update: boolean; found: boolean };

export interface IAttributes {
    attribute: string;
    type?: DataTypes; //defaults to text if not set
}

// attribute: keyof Record<keyof T, string> & string;

export interface CellConfig<T = any> {
    header?: string;
    attribute: keyof T & string;
    /**Default FALSE */
    readonly?: boolean;
    /**Default FALSE */
    disabled?: boolean;
    width?: number;
    /**this will overide date if any */
    placeholder?: string;
    /** you need to subscribe event*/
    focusButton?: boolean;
    focusButtonIfGridReadonly?: boolean;
    focusButtonIfCellReadonly?: boolean;
    //filter
    filterable?: {
        /**Default FALSE */
        filterOverLabel?: boolean;
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
        noToggle?: boolean;
        /**Default TRUE */
        auto?: boolean;
    };
    type?: DataTypes;
    /**Default TRUE */
    autoUpdateData?: boolean;
    editEventType?: InputTriggers;
    disableDragDrop?: boolean;
    allowGrouping?: boolean;
}

export type GridRowConfig<T = any> = CellConfig<T>;
export type GridGroupConfig<T = any> = {
    width: number;
    //internal
    __left?: number;
    rows: GridRowConfig<T>[];
};

export interface GridConfig<T = any> {
    groups: GridGroupConfig<T>[];
    optionalCells?: CellConfig<T>[];
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
    filterSet?: FilterArgument;
    sortingSet?: SortArgument[];
    groupingExpanded?: string[];

    /**
     * experimental, so grid with data dont hold inital render
     */
    delayRowRenderToNextTick?: boolean
    //default 0ms
    delayMs?: number
}

type callF = (...args: any[]) => any;
type callO = { handleEvent: (...args: any[]) => any };
export type callable = callF | callO;
