import { EntityHandler } from './entity';

/**
 *  selecting
 */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 *  datasource
 */
export type DatasourceConfigOptions = { selectionMode: SelectionMode };

export interface Entity {
    __controller?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: Entity[];
    __groupExpanded?: boolean;
}

/**
 *  filtering interfaces
 */
export type FilterComparisonOperator =
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

export type DataTypes = 'text' | 'number' | 'image' | 'boolean' | 'date' | 'empty';
export type FilterLogicalOperator = 'AND' | 'OR' | 'NONE';
export type FilterExpressionType = 'CONDITION' | 'GROUP';
export type FilterValueType = 'ATTRIBUTE' | 'VALUE';

export type FilterArgument = {
    type: FilterExpressionType;
    groupType: FilterLogicalOperator;
    attribute: string | null;
    operator: FilterComparisonOperator | null;
    value: string | null;
    valueType: FilterValueType | null;
    attributeType: DataTypes;
    operatorObject?: FilterArgument[];
};

export interface FilterAttributeSimple {
    operator: FilterComparisonOperator;
    value: any;
    attribute: string;
    type: string;
}

/**
 *  sorting interfaces
 */

export interface SortArgument {
    attribute: string;
    ascending: boolean;
}

/**
 * grouping interfaces
 */
export interface GroupArgument {
    title: string;
    attribute: string;
}
