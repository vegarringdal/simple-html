import { FilterComparisonOperator, DataTypes, GroupArgument, FilterArgument } from '@simple-html/datasource';

export type GridConfig = {
    cellHeight?: number;
    panelHeight?: number;
    footerHeight?: number;
    selectSizeHeight?: number;
    readonly?: boolean;
    selectionMode?: 'multiple' | 'single';
    attributes: Record<string, Attribute>;
    columnsPinnedLeft?: Columns[];
    columnsCenter: Columns[];
    columnsPinnedRight?: Columns[];
    /**
     * will only be used on init
     */
    sortOrder?: Sort[];
    /**
     * will only be used on init
     */
    grouping?: GroupArgument[];
    /**
     * will only be used on init
     */
    filter?: FilterArgument;

    // private

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
    placeHolderFilter?:string;
    operator?: FilterComparisonOperator;
    type?: DataTypes;
    disabled?: boolean;
    readonly?: boolean;
    sortEnabled?: boolean;
    groupEnabled?: boolean;
    currentFilterValue?: string | number | boolean | Date;
};
