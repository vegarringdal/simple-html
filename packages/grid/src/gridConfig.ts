import { FilterComparisonOperator, DataTypes } from '@simple-html/datasource';

export type GridConfig = {
    cellHeight: number;
    panelHeight: number;
    footerHeight: number;
    selectSizeHeight: number;
    readonly: true;
    selectionMode: 'multiple' | 'single';
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
    grouping?: string[];

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
    placeHolder?: string;
    operator?: FilterComparisonOperator;
    type?: DataTypes;
    disabled?: boolean;
    readonly?: boolean;
    sortEnabled?: boolean;
    groupEnabled?: boolean;
    currentFilterValue?: string | number | boolean | Date;
};