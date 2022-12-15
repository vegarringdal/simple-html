import { DataTypes, FilterArgument, FilterComparisonOperator, GroupArgument } from '../datasource/types';

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
    sorting?: Sort[];
    grouping?: GroupArgument[];
    expandedGroups?: string[];
    filter?: FilterArgument;

    // private/internals
    // lets expand with internal gridConfig
    __attributes?: Record<string, Attribute>;
    __rowHeight?: number;
    __columnCells?: number;
    __leftWidth?: number;
    __rightWidth?: number;
    __scrollbarSize?: number;
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
};
