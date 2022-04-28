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

/**
 * filter triggers
 */
export type InputTriggers = 'input' | 'change';

export type RowCache = { i: number; update: boolean };
export type ColCache = { i: number; update: boolean; found: boolean };

export interface IAttributes {
    attribute: string;
    type?: DataTypes; //defaults to text if not set
}

// attribute: keyof Record<keyof T, string> & string;

/**
 * Cell config
 */
export interface CellConfig<T = any> {
    /**
     * header title
     */
    header?: string;
    /**
     * attribute in data
     */
    attribute: keyof T & string;
    /**
     * read only cell, default false
     */
    readonly?: boolean;
    /**
     * disabled, false by default
     */
    disabled?: boolean;
    /**
     * width of cell
     */
    width?: number;
    /**
     * placeholder cell if empty and row selected
     */
    placeholder?: string;

    /**
     * add focus button, you also need to subscribe event on gridInterface to do anything
     */
    focusButton?: boolean;
    /**
     * show filterbutton if grid is readonly
     */
    focusButtonIfGridReadonly?: boolean;
    /**
     * show filterbutton if cell is read only
     */
    focusButtonIfCellReadonly?: boolean;
    /**
     * dont allow input, just paste/clear
     */
    stopManualEdit?: boolean;
    /**
     * filter settings
     */
    filterable?: {
        /**
         * filter over label
         */
        filterOverLabel?: boolean;
        /**Default TRUE */
        auto?: boolean;
        /**
         * filter trigger
         */
        filterTrigger?: InputTriggers;
        /**
         * @private
         * value in cell
         */
        currentValue?: string | number | boolean | Date;
        /**
         * place holder
         */
        placeholder?: string;
        /**
         * default filteroperator, default is BEGIN WITH
         */
        operator?: FilterComparisonOperator;
    };
    /**
     * sort options
     */
    sortable?: {
        /**Internal used for making sort icon on header*/
        sortAscending?: boolean;
        /**Internal used for making sort icon on header*/
        sortNo?: number;
        /**Internal used for making sort icon on header*/
        noToggle?: boolean;
        /**Default TRUE */
        /**
         * trigger sort on header click
         */
        auto?: boolean;
    };
    type?: DataTypes;
    /**Default TRUE */
    autoUpdateData?: boolean;
    editEventType?: InputTriggers;
    disableDragDrop?: boolean;
    allowGrouping?: boolean;
}

/**
 * grid row config
 */
export type GridRowConfig<T = any> = CellConfig<T>;

/**
 * @public
 * column group config
 */
export type GridGroupConfig<T = any> = {
    /**
     * width of column
     */
    width: number;
    //internal
    __left?: number;
    /**
     * rows in columns withing a row
     */
    rows: GridRowConfig<T>[];
};

/**
 * Grid config
 */
export interface GridConfig<T = any> {
    /**
     * Groups of columns, every column can have rows of cells within a row
     */
    groups: GridGroupConfig<T>[];
    /**
     * this is the optional/hidden cells
     */
    optionalCells?: CellConfig<T>[];
    /**
     * hight of a cell
     */
    cellHeight: number;
    /**
     * footer hight
     */
    footerHeight: number;
    /**
     * panel hight
     */
    panelHeight?: number;
    scrollLeft?: number;
    readonly?: boolean;
    lastScrollTop?: number;
    /**
     * selection mode
     */
    selectionMode?: 'multiple' | 'single' | 'none';

    // optional
    /**
     * show filter dialog, hidden by default
     */
    showDialogInFooter?: boolean;

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
    delayRowRenderToNextTick?: boolean;
    //default 0ms
    delayMs?: number;
}

type callF = (...args: any[]) => any;
type callO = { handleEvent: (...args: any[]) => any };
export type callable = callF | callO;
