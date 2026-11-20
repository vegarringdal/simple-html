import type { Datasource } from './dataSource';
import type { Entity } from './entity';
import type { FieldType } from './field';
import { type FilterCondition, type FilterExpression, type FilterOperator, isFilterGroup } from './filterExpression';
import { isBlank } from './isBlank';
import { objectFilter } from './objectFilter';

export class Filter {
    private currentFilter: FilterExpression | null;

    constructor() {
        this.currentFilter = null;
    }

    public getFilter(): FilterExpression | null {
        return this.currentFilter;
    }

    public setFilter(filter: FilterExpression | null) {
        this.currentFilter = filter;
    }

    public getFilterFromType(type: string): FilterOperator {
        switch (type) {
            case 'date':
            case 'datetime':
            case 'number':
                return 'GREATER_THAN_OR_EQUAL_TO';
            default:
                return 'EQUAL';
        }
    }

    public filter(objArray: Entity[], expression: FilterExpression | null, ds: Datasource) {
        this.currentFilter = expression;

        if (!expression) {
            return objArray.slice();
        }

        // null = empty or incomplete filter, it does not restrict anything
        return objArray.filter((rowData) => this.evaluate(rowData, expression, ds) !== false);
    }

    /**
     * evaluates a group or a condition against one row
     * @returns true/false, or null for an empty group or an incomplete condition (see
     * isIgnoredCondition). Those are ignored: they never restrict rows, whatever the parent group is.
     * Without this an empty OR group was false and filtered out every row
     */
    private evaluate(rowData: Entity, expression: FilterExpression, ds: Datasource): boolean | null {
        if (isFilterGroup(expression)) {
            // anything but OR is AND, plain js can leave `group` out
            const isOr = expression.group === 'OR';
            let result: boolean | null = null;
            for (const child of expression.children) {
                const childResult = this.evaluate(rowData, child, ds);
                if (childResult === null) {
                    continue;
                }
                if (isOr && childResult) {
                    return true;
                }
                if (!isOr && !childResult) {
                    return false;
                }
                result = childResult;
            }
            return result;
        }

        const type = ds.getField(expression.field).type;
        if (isIgnoredCondition(expression, type)) {
            return null;
        }

        if (expression.operator === 'IN' || expression.operator === 'NOT_IN') {
            return this.inStatement(rowData, expression, type, ds);
        }

        return objectFilter(rowData, {
            field: expression.field,
            operator: expression.operator,
            value: expression.valueField ? rowData[expression.valueField] : expression.value,
            type
        });
    }

    /**
     * IN / NOT_IN. The list and the row value are both compared as upper case text, so a number or
     * boolean in the row matches the same value in the list. A blank row value only matches the list
     * value 'NULL', and so does a 0 in a text field - a number field compares its formatted text, '0'.
     */
    private inStatement(rowData: Entity, condition: FilterCondition, type: FieldType, ds: Datasource): boolean {
        // a list, or text with one value per line
        let list: unknown[] = [];
        if (Array.isArray(condition.value)) {
            list = condition.value;
        } else if (typeof condition.value === 'string') {
            list = condition.value.split('\n');
        } else if (condition.value !== null && condition.value !== undefined) {
            list = [condition.value];
        }
        const values = list.map((value) => String(value).toUpperCase());

        let data: unknown = rowData?.[condition.field];
        if (type === 'date' || type === 'datetime' || type === 'number') {
            // the formatted text, same as what is shown and typed into the list
            data = ds.getFormatter(condition.field, type).format(data);
        }

        const key = data === null || data === undefined || data === '' || data === 0 ? 'NULL' : String(data).toUpperCase();
        const found = values.indexOf(key) !== -1;

        return condition.operator === 'IN' ? found : !found;
    }
}

/**
 * @internal
 * true if a condition can not be evaluated and is ignored: no field, no operator, or a date
 * condition with a blank value (null, undefined, '', invalid Date). IS_BLANK / IS_NOT_BLANK take no
 * value, and a valueField condition takes its value from the row, so neither is checked for a blank
 * value.
 * Takes a partial condition: plain js and the filter editor's drafts can leave anything out.
 * @param type the type the condition compares as, the field's type (`datasource.getField(field).type`)
 */
export function isIgnoredCondition(condition: Partial<FilterCondition>, type: FieldType): boolean {
    if (!condition.field || !condition.operator) {
        return true;
    }
    const isDate = type === 'date' || type === 'datetime' || condition.value instanceof Date;
    const takesValue = condition.operator !== 'IS_BLANK' && condition.operator !== 'IS_NOT_BLANK' && !condition.valueField;
    return isDate && takesValue && isBlank(condition.value);
}
