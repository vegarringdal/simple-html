import { DataTypes, FilterArgument } from '../datasource/filterArgument';
import { GroupArgument } from '../datasource/groupArgument';
import { FilterComparisonOperator } from '../datasource/filterComparisonOperator';

export type GridConfig = {
    cellHeight?: number;
    panelHeight?: number;
    footerHeight?: number;
    selectSizeHeight?: number;
    readonly?: boolean;
    attributes: Attribute[];
    selectionMode?: 'multiple' | 'single';
    columnsPinnedLeft?: Columns[];
    columnsCenter: Columns[];
    columnsPinnedRight?: Columns[];

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
    disabled?: boolean;
    readonly?: boolean;
    sortEnabled?: boolean;
    groupEnabled?: boolean;
    currentFilterValue?: string | number | boolean | Date;
    numberOverride?: 'ZERO_TO_BLANK' | 'BLANK_TO_ZERO';
    focusButton?: 'SHOW_IF_GRID_NOT_READONLY' | 'SHOW_IF_GRID_AND_CELL_NOT_READONLY' | 'ALWAYS';
    mandatory?: boolean;
    allowPasteClearOnReadonly?: boolean;
};
