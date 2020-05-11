import { EntityHandler } from './entity';

/**
 *  selecting
 */
export type SelectionMode = 'none' | 'single' | 'multiple';

/**
 *  datasource
 */
export type DatasourceConfigOptions = { selectionMode: SelectionMode };

export interface IEntity {
    __controller?: EntityHandler;
    __KEY?: string | number;
    __group?: boolean;
    __groupID?: string;
    __groupName?: string;
    __groupLvl?: number;
    __groupTotal?: number;
    __groupChildren?: IEntity[];
    __groupExpanded?: boolean;
}

/**
 *  filtering interfaces
 */

export type FilterOperator =
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
export type GroupType = 'AND' | 'OR' | 'NONE';
export type ObjectType = 'CONDITION' | 'GROUP';
export type ValueType = 'ATTRIBUTE' | 'VALUE';
export type OperatorObject = {
    type: ObjectType;
    groupType: GroupType;
    attribute: string | null;
    operator: FilterOperator | null;
    value: string | null;
    valueType: ValueType | null;
    attributeType: DataTypes;
    operatorObject?: OperatorObject[];
};

export interface IFilterObj {
    operator: FilterOperator;
    value: any;
    attribute: string;
    type: string;
}

/**
 *  sorting
 */

export interface ISortObjectInterface {
    attribute: string;
    asc?: boolean;
    no?: number;
}

/**
 *  grouping
 */

export interface IGroupingConfig {
    title: string;
    field: string;
}
