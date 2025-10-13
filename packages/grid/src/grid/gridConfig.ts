import { DataTypes, FilterArgument } from '../datasource/filterArgument';
import { GroupArgument } from '../datasource/groupArgument';
import { FilterComparisonOperator } from '../datasource/filterComparisonOperator';
import { IDateConfig } from '../date/interfaces';

export type GridConfig = {
    cellHeight?: number;
    panelHeight?: number;
    /**
     * useful for when you have long header text and need to wrap in in 2-3 height
     * this will not work well with auto resize
     */
    cellHeaderLabelHeight?: number;
    footerHeight?: number;
    selectSizeHeight?: number;
    hideLabels?: boolean;
    hideFilter?: boolean;
    readonly?: boolean;
    attributes: Attribute[];
    selectionMode?: 'multiple' | 'single';
    columnsPinnedLeft?: Columns[];
    columnsCenter: Columns[];
    columnsPinnedRight?: Columns[];

    /**
     * if its a small screen you might not want this enabled
     */
    autoRemoveContextMenuOnScrollEvent?: boolean;
    

    /**
     * datepicker
     * not all is passed on to intenal picker
     */
    datePickerConfig?: IDateConfig;

    /**
     * displays only placeholder on current focused cell row/current entity row
     * default = true, so you need to set this to false to display on all rows
     */
    placeHolderRowCurrentEnityOnly?: boolean;

    /**
     * sorting added when loading config, unless grouping overrides it
     */
    sorting?: Sort[];
    /**
     * grouping added when loading config
     */
    grouping?: GroupArgument[];
    /**
     * expandedGroups added when loading config
     */
    expandedGroups?: string[];
    /**
     * filter added when loading config
     */
    filter?: FilterArgument;

    /**
     * @internal not exported in save config
     */
    __attributes?: Record<string, Attribute>;
    /**
     * @internal not exported in save config
     */
    __rowHeight?: number;
    /**
     * @internal not exported in save config
     */
    __rowHeaderHeight?: number;
    /**
     * @internal not exported in save config
     */
    __columnCells?: number;
    /**
     * @internal not exported in save config
     */
    __leftWidth?: number;
    /**
     * @internal not exported in save config
     */
    __rightWidth?: number;
    /**
     * @internal not exported in save config
     */
    __scrollbarSize?: number;
    /**
     * @internal not exported in save config
     */
    __selectSizeWidth?: number;
};

export type Sort = {
    attribute: string;
    ascending: boolean;
};

export type Grouping = keyof Attribute[];

export type Columns = {
    rows: string[];
    width: number;
};

export type Attribute = {
    attribute: string;
    label?: string;
    placeHolderRow?: string;
    placeHolderFilter?: string;
    operator?: FilterComparisonOperator;
    type?: DataTypes;
    /**
     * tries to look at value and set row cell based on it
     * this way we can have number/text etc in same column
     * PS! this can create side effects on filter/grouping/sorting
     */
    dynamicCellTypeColumn?: string;

    /**
     * sets cell to readonly, usefull if you need it to stay readonly if grid is not readonly
     */
    readonly?: boolean;

    /**
     * @internal
     * current filter value, this is really more of a internal state..
     */
    currentFilterValue?: string | number | boolean | Date;

    /**
     * like the name says, default it to display value it have recived, but you might have other needs
     */
    numberOverride?: 'ZERO_TO_BLANK' | 'BLANK_TO_ZERO';

    /**
     * like the name says, shows a focus button, you need to use the gridinterface event to do anythnig useful with it
     * like dialog, dropdown etc
     */
    focusButton?: 'SHOW_IF_GRID_NOT_READONLY' | 'SHOW_IF_GRID_AND_CELL_NOT_READONLY' | 'ALWAYS';

    /**
     * adds a blue ish color in background, highlighting cell, you can override color with css
     */
    mandatory?: boolean;

    /**
     * only show blue ish color in background if its empty
     */
    mandatoryOnlyIfEmpty?: boolean;

    /**
     * usefull for fields where you have dropdown etc, but want to allow user to update using copy/paste/clear + the dropdown
     */
    allowPasteClearOnly?: boolean;
};
