/**
 * The text `datasource.getFilterString()` shows for each {@link FilterOperator}, before it upper cases
 * the whole string: `EQUAL` is shown as `<<EQUAL_TO>>`, `BEGIN_WITH` as `<<START_WITH>>`.
 *
 * @example
 * ```ts
 * import { OPERATORS } from '@simple-html/grid';
 *
 * OPERATORS.EQUAL; // 'equal_to'
 * OPERATORS.GREATER_THAN_OR_EQUAL_TO; // 'greater_than_or_equal'
 * ```
 */
export const OPERATORS = {
    /** EQUAL, shown as `<<EQUAL_TO>>` */
    EQUAL: 'equal_to',
    /** LESS_THAN_OR_EQUAL_TO, shown as `<<LESS_OR_EQUAL>>` */
    LESS_THAN_OR_EQUAL_TO: 'less_or_equal',
    /** GREATER_THAN_OR_EQUAL_TO, shown as `<<GREATER_THAN_OR_EQUAL>>` */
    GREATER_THAN_OR_EQUAL_TO: 'greater_than_or_equal',
    /** LESS_THAN, shown as `<<LESS_THAN>>` */
    LESS_THAN: 'less_than',
    /** GREATER_THAN, shown as `<<GREATER_THAN>>` */
    GREATER_THAN: 'greater_than',
    /** CONTAINS, shown as `<<CONTAINS>>` */
    CONTAINS: 'contains',
    /** NOT_EQUAL_TO, shown as `<<NOT_EQUAL_TO>>` */
    NOT_EQUAL_TO: 'not_equal_to',
    /** DOES_NOT_CONTAIN, shown as `<<DOES_NOT_CONTAIN>>` */
    DOES_NOT_CONTAIN: 'does_not_contain',
    /** BEGIN_WITH, shown as `<<START_WITH>>` */
    BEGIN_WITH: 'start_with',
    /** END_WITH, shown as `<<END_WITH>>` */
    END_WITH: 'end_with',
    /** IN, shown as `<<IN>>` */
    IN: 'IN',
    /** NOT_IN, shown as `<<NOT_IN>>` */
    NOT_IN: 'NOT_IN',
    /** IS_BLANK, shown as `<<IS_BLANK>>` */
    IS_BLANK: 'IS_BLANK',
    /** IS_NOT_BLANK, shown as `<<IS_NOT_BLANK>>` */
    IS_NOT_BLANK: 'IS_NOT_BLANK'
};
