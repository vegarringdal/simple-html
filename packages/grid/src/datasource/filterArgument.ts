import { FilterComparisonOperator } from './filterComparisonOperator';

/**
 * filter argument can be either group or expression
 * but it tries not to be strict
 * 
 * Group Options
 * ```ts
 * group = {
 *   type?: FilterGroup; // if filterArgument, it assumes "CONDITION"
 *   logicalOperator?: FilterLogicalOperator; // if nothing is set it assumes "AND"
 *   filterArguments?: FilterArgument[]; // if array then datasource assumes "GROUP"
 * };
 * ```
 * Expression options
 * ```ts
 * expression = {
 *   type?: FilterExpressionType; // if no filterArguments, it assumes "CONDITION"
 *   attribute?: string | null;
 *   logicalOperator?: FilterLogicalOperator; // if no filterArguments, it assumes "NONE"
 *   operator?: FilterComparisonOperator | null; 
 *   value?: string | number | null | Date; 
 *   valueType?: FilterValueType | null;
 *   attributeType?: DataTypes;
 * };
 * ```
 * 
 * Sample expression:
 * ```ts
 *  ds.filter({
 *           attribute: 'born',
 *           operator: 'EQUAL',
 *           value: new Date(1990, 0, 1),
 *           attributeType: 'date'
 *       });
 * ```
 * 
 * Sample using groups:
 * ```ts
 *  ds.filter({
 *          logicalOperator: 'OR',
 *          filterArguments: [
 *              {
 *                  logicalOperator: 'AND',
 *                  filterArguments: [
 *                      { attribute: 'group', operator: 'EQUAL', value: 'group2' },
 *                      { attribute: 'name', operator: 'EQUAL', value: 'person2' }
 *                  ]
 *              },
 *              {
 *                  logicalOperator: 'AND',
 *                  filterArguments: [
 *                      { attribute: 'group', operator: 'EQUAL', value: 'group1' },
 *                      { attribute: 'name', operator: 'EQUAL', value: 'person4' }
 *                  ]
 *              }
 *          ]
 *      });
 *  ```    
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
