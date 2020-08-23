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
    | 'END_WITH'
    | 'IN'
    | 'NOT_IN';

export type DataTypes = 'text' | 'number' | 'image' | 'boolean' | 'date' | 'empty';
export type FilterLogicalOperator = 'AND' | 'OR' | 'NONE';
export type FilterExpressionType = 'CONDITION' | 'GROUP';
export type FilterValueType = 'ATTRIBUTE' | 'VALUE';

export type FilterArgument = {
    type?: FilterExpressionType;
    logicalOperator?: FilterLogicalOperator;
    attribute?: string | null; //only optional if type is group
    operator?: FilterComparisonOperator | null; //only optional if type is group
    value?: string | number | null | Date; //only optional if type is group
    valueType?: FilterValueType | null;
    attributeType?: DataTypes;
    filterArguments?: FilterArgument[];
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

/**
 * nices string values
 */
export const OPERATORS = {
    EQUAL: 'equal to',
    LESS_THAN_OR_EQUAL_TO: 'less or equal',
    GREATER_THAN_OR_EQUAL_TO: 'greater than or equal',
    LESS_THAN: 'less than',
    GREATER_THAN: 'greater than',
    CONTAINS: 'contains',
    NOT_EQUAL_TO: 'not equal to',
    DOES_NOT_CONTAIN: 'does not contain',
    BEGIN_WITH: 'start with',
    END_WITH: 'end with',
    IN: 'IN',
    NOT_IN: 'NOT IN'
};
