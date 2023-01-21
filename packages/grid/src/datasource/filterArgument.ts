import { FilterComparisonOperator } from './filterComparisonOperator';

/**
 * filter argument can be either group or expression
 * but it tries not to be strict
 * 
 *  
 * group = {
 *   type?: FilterGroup; // if filterArgument, it assumes "CONDITION"
 *   logicalOperator?: FilterLogicalOperator; // if nothing is set it assumes "AND"
 *   filterArguments?: FilterArgument[]; // if array then datasource assumes "GROUP"
 * };
 * 
 * expression = {
 *   type?: FilterExpressionType; // if no filterArguments, it assumes "CONDITION"
 *   attribute?: string | null;
 *   logicalOperator?: FilterLogicalOperator; // if no filterArguments, it assumes "NONE"
 *   operator?: FilterComparisonOperator | null; 
 *   value?: string | number | null | Date; 
 *   valueType?: FilterValueType | null;
 *   attributeType?: DataTypes;
 * };
 */
export type FilterArgument = {
    type?: FilterExpressionType;
    logicalOperator?: FilterLogicalOperator;
    attribute?: string | null; //only optional if type is group
    operator?: FilterComparisonOperator | null; //only optional if type is group
    value?: string | number | null | Date; //only optional if type is group
    valueType?: FilterValueType | null;
    attributeType?: DataTypes; //only optional if type is group
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
