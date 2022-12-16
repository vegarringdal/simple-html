import { FilterComparisonOperator } from './filterComparisonOperator';

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
export type FilterLogicalOperator = 'AND' | 'OR' | 'NONE';
export type FilterExpressionType = 'CONDITION' | 'GROUP';
export type FilterValueType = 'ATTRIBUTE' | 'VALUE';
export interface FilterAttributeSimple {
    operator: FilterComparisonOperator;
    value: any;
    attribute: string;
    type: string;
}
export type DataTypes = 'text' | 'number' | 'image' | 'boolean' | 'date';
