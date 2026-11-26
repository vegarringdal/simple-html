import { CLOB_OPERATORS, type FieldType } from '../../datasource/field';
import { type FilterOperator, operatorsFor } from '../../datasource/filterExpression';
import type { ColumnConfig } from '../gridConfig';
import type { GridInterface } from '../gridInterface';

/**
 * The operators the grid offers for a column, from its type and its options `filterOperators`,
 * `operator` and `filterCaseSensitive` (ColumnConfig), and its field's `clobType` and `caseSensitive`
 * (FieldConfig, set by code). Plain functions of the column and the type, so the checks of a config
 * (gridInterface.ts) and the menus use the same rules.
 */

/**
 * true for a field with `clobType` (FieldConfig.clobType): a long text filtered with LIKE only, see
 * CLOB_OPERATORS
 */
export function isClobField(gridInterface: GridInterface<any>, field: string): boolean {
    return gridInterface.getDatasource().getField(field).clobType;
}

/**
 * The type a column's header filter filters as: `'text'` for a lookup column (ColumnConfig.editor) -
 * it filters on the labels it shows, also for a number field (filterCallback) - else the field's type
 */
export function headerFilterType(gridInterface: GridInterface<any>, field: string): FieldType {
    return gridInterface.__getLookupColumn(field) ? 'text' : gridInterface.getDatasource().getField(field).type;
}

/**
 * true for an operator the header filter's input can take: one that compares with the value typed
 * (`BETWEEN`: `from..to`). Not IN / NOT_IN - the value list's - nor IS_BLANK / IS_NOT_BLANK, the Blank
 * submenu's
 */
export function isHeaderOperator(operator: FilterOperator): boolean {
    return operator !== 'IN' && operator !== 'NOT_IN' && operator !== 'IS_BLANK' && operator !== 'IS_NOT_BLANK';
}

/**
 * The operators the column offers for a type: the type's (operatorsFor), only the ones in its
 * `filterOperators` when it has them - in the type's order. A field with `clobType`: only those of
 * CLOB_OPERATORS, no value list
 * @param clob true for a field with `clobType` (isClobField)
 */
export function columnOperators(column: ColumnConfig | undefined, type: FieldType, clob: boolean): FilterOperator[] {
    const own = column?.filterOperators;
    const operators = operatorsFor(type).filter((operator) => !clob || CLOB_OPERATORS.some((offered) => offered === operator));
    return Array.isArray(own) ? operators.filter((operator) => own.includes(operator)) : operators;
}

/**
 * The operators of the header filter's Operator ›: the column's that take a typed value
 * @param clob true for a field with `clobType` (isClobField)
 */
export function headerOperators(column: ColumnConfig | undefined, type: FieldType, clob: boolean): FilterOperator[] {
    return columnOperators(column, type, clob).filter(isHeaderOperator);
}

/**
 * The operator a column's header filter starts with: its `operator`, else the type's default
 * (`GREATER_THAN_OR_EQUAL_TO` for a number or date, `EQUAL` for the rest) when the column offers it,
 * else the first operator of headerOperators. The config checks make sure the column has one; one
 * the column does not offer (a `filter-operator-change` handler can change the column) is passed by
 */
export function defaultHeaderOperator(column: ColumnConfig | undefined, type: FieldType, clob: boolean): FilterOperator {
    const operators = headerOperators(column, type, clob);
    if (column?.operator && operators.includes(column.operator)) {
        return column.operator;
    }
    const typeDefault: FilterOperator =
        type === 'number' || type === 'date' || type === 'datetime' ? 'GREATER_THAN_OR_EQUAL_TO' : 'EQUAL';
    return operators.includes(typeDefault) ? typeDefault : (operators[0] ?? typeDefault);
}

/**
 * The operators the filter editor's operator picker offers for a field: those of its type - the
 * datasource's, the editor edits the values - and of its column's `filterOperators` when it has them.
 * Not a lookup column's on a field that is no text: those are its header's, text operators on its
 * labels. No field picked yet: a text's, the condition is text until one is
 */
export function editorOperators(gridInterface: GridInterface<any>, field: string | undefined): FilterOperator[] {
    if (!field) {
        return operatorsFor('text');
    }
    const { type, clobType } = gridInterface.getDatasource().getField(field);
    const column = gridInterface.__getGridConfig().columns[field];
    return gridInterface.__getLookupColumn(field) && type !== 'text'
        ? operatorsFor(type)
        : columnOperators(column, type, clobType);
}

/**
 * true when the grid's own conditions on the column always match case: `filterCaseSensitive` on a
 * text column (a lookup column filters as text), or a field whose case is locked (FieldConfig.caseSensitive)
 * - the header filter, its value list, the row menu's filter and the filter editor
 * @param locked true for a field with `caseSensitive` (`datasource.getField(field).caseSensitive`)
 */
export function isAlwaysCaseSensitive(column: ColumnConfig | undefined, type: FieldType, locked: boolean): boolean {
    return type === 'text' && (locked || column?.filterCaseSensitive === true);
}
