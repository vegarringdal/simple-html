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
    | 'NOT_IN'
    | 'IS_BLANK'
    | 'IS_NOT_BLANK';
