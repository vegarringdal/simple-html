import type { Datasource } from './dataSource';
import type { Entity } from './entity';
import type { FieldType } from './field';
import { type FilterCondition, type FilterExpression, type FilterOperator, isFilterGroup, isRange } from './filterExpression';
import type { Formatter } from './formatter';
import { isBlank } from './isBlank';
import { objectFilter } from './objectFilter';

export class Filter {
    private currentFilter: FilterExpression | null;

    /**
     * the keys of the IN / NOT_IN lists of the filter that runs (see inListKeys), made once per condition
     * and run - not once per row. A new run makes them again: the list may have changed
     */
    private inListKeyCache = new WeakMap<FilterCondition, Set<string>>();

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
        this.inListKeyCache = new WeakMap();

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

        if (isIgnoredCondition(expression)) {
            return null;
        }
        const type = ds.getField(expression.field).type;
        // a text field filtered on what the row shows (a column's template, __setFilterText): the text
        // in place of the value. valueField reads the row as it is
        const shown = type === 'text' ? ds.__getFilterText()?.(expression.field, rowData) : undefined;
        const data: Entity = shown === undefined ? rowData : ({ [expression.field]: shown } as Entity);

        if (expression.operator === 'IN' || expression.operator === 'NOT_IN') {
            return this.inStatement(data, expression, type, ds);
        }

        const caseSensitive = expression.caseSensitive === true;
        if (expression.operator === 'BETWEEN' && isRange(expression.value)) {
            // GREATER_THAN_OR_EQUAL_TO from AND LESS_THAN_OR_EQUAL_TO to, a blank end left out. Not
            // ignored, so one end is there
            const [from, to] = expression.value;
            const { field } = expression;
            return (
                (isBlank(from) ||
                    objectFilter(data, { field, operator: 'GREATER_THAN_OR_EQUAL_TO', value: from, type, caseSensitive })) &&
                (isBlank(to) || objectFilter(data, { field, operator: 'LESS_THAN_OR_EQUAL_TO', value: to, type, caseSensitive }))
            );
        }

        return objectFilter(data, {
            field: expression.field,
            operator: expression.operator,
            value: expression.valueField ? rowData[expression.valueField] : expression.value,
            type,
            caseSensitive,
            literal: expression.literal === true
        });
    }

    /**
     * IN / NOT_IN. The list and the row value are both compared as upper case text (see inListKey) - as
     * they are on a text field with `caseSensitive` - so a number or boolean in the row matches the same
     * value in the list. A blank row value only matches the list value 'NULL', and so does a 0 in a text
     * field - a number field compares its formatted text, '0'.
     */
    private inStatement(rowData: Entity, condition: FilterCondition, type: FieldType, ds: Datasource): boolean {
        let keys = this.inListKeyCache.get(condition);
        if (!keys) {
            keys = inListKeys(condition, type, ds);
            this.inListKeyCache.set(condition, keys);
        }
        const formatter = ds.getFormatter(condition.field, type);
        const found = keys.has(inListKey(rowData?.[condition.field], type, formatter, isCaseSensitive(condition, type)));

        return condition.operator === 'IN' ? found : !found;
    }
}

/**
 * The keys of an IN / NOT_IN condition's list: each value as upper case text (as it is with
 * caseSensitive, see isCaseSensitive). A number in the list of a number field is formatted, as the
 * row values are (inListKey): the value a row holds finds it, `[2]` the 2 a formatter shows as
 * `'2.00'`. Text is taken as it is: what is shown, typed into the list
 * @param type the field's type
 */
function inListKeys(condition: FilterCondition, type: FieldType, ds: Datasource): Set<string> {
    // a list, or text with one value per line
    let list: unknown[] = [];
    if (Array.isArray(condition.value)) {
        list = condition.value;
    } else if (typeof condition.value === 'string') {
        list = condition.value.split('\n');
    } else if (condition.value !== null && condition.value !== undefined) {
        list = [condition.value];
    }
    const formatter = ds.getFormatter(condition.field, type);
    const exact = isCaseSensitive(condition, type);
    return new Set(
        list.map((value) => {
            const text = String(type === 'number' && typeof value === 'number' ? formatter.format(value) : value);
            return exact ? text : text.toUpperCase();
        })
    );
}

/**
 * @internal
 * The text `IN` / `NOT_IN` compare a row value as: `'NULL'` for a blank (isInListBlank), else the value
 * as upper case text - as it is with `caseSensitive` - of a date or number field the text its formatter
 * shows, the same as what is shown and typed into the list. The value list of the header filter menu
 * (dropDownFilterData) keys the values with it too, so an entry of it never splits values the `IN` it
 * applies can not tell apart
 * @param type the field's type
 * @param formatter the field's formatter (`datasource.getFormatter(field)`)
 * @param caseSensitive true to keep the case, see isCaseSensitive: for a text field only
 */
export function inListKey(value: unknown, type: FieldType, formatter: Formatter, caseSensitive = false): string {
    const data = type === 'date' || type === 'datetime' || type === 'number' ? formatter.format(value) : value;
    if (isInListBlank(data)) {
        return 'NULL';
    }
    return caseSensitive ? String(data) : String(data).toUpperCase();
}

/**
 * @internal
 * true for a row value `IN` / `NOT_IN` take as blank, the list value `'NULL'`: null, undefined, `''` and
 * 0 (see "0 is blank" on FilterOperator). `false` is a value, as for `IS_BLANK`. The value list of the
 * header filter menu (dropDownFilterData) puts the same values under its "Blank" entry, so the list
 * and the `IN` it applies agree
 */
export function isInListBlank(value: unknown): boolean {
    return value === null || value === undefined || value === '' || value === 0;
}

/**
 * @internal
 * true when a condition compares text with upper and lower case as they are: it has
 * `caseSensitive: true` and compares text - a text field and a value that is no number and no Date
 * (those compare as one, see objectFilter), any list for IN / NOT_IN. Not IS_BLANK / IS_NOT_BLANK, they
 * compare nothing. A `valueField` condition compares text when the other field's value does
 * @param type the field's type (`datasource.getField(field).type`)
 */
export function isCaseSensitive(condition: Partial<FilterCondition>, type: FieldType): boolean {
    const { operator, value } = condition;
    if (condition.caseSensitive !== true || type !== 'text' || operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK') {
        return false;
    }
    if (operator === 'IN' || operator === 'NOT_IN' || condition.valueField) {
        return true;
    }
    // a BETWEEN compares each end
    const values = operator === 'BETWEEN' && isRange(value) ? value : [value];
    return values.some((end) => !isBlank(end) && !(end instanceof Date) && Number(end) !== end);
}

/**
 * @internal
 * true if a condition can not be evaluated and is ignored:
 * - no field, no operator
 * - `BETWEEN` without a `[from, to]` with an end that is not blank - its `valueField` is not used
 * - another operator that takes a value (not IS_BLANK / IS_NOT_BLANK, IN / NOT_IN) without a
 *   `valueField`, whose value is blank: null, undefined, '' or an invalid Date (isBlank)
 *
 * IN / NOT_IN take a missing list as an empty one: IN matches no row, NOT_IN every row. A valueField
 * condition takes its value from the row.
 * The rule is the same for every type. Takes a partial condition: plain js and the filter editor's
 * drafts can leave anything out.
 */
export function isIgnoredCondition(condition: Partial<FilterCondition>): boolean {
    const { operator, value } = condition;
    if (!condition.field || !operator) {
        return true;
    }
    if (operator === 'BETWEEN') {
        return !isRange(value) || (isBlank(value[0]) && isBlank(value[1]));
    }
    if (operator === 'IS_BLANK' || operator === 'IS_NOT_BLANK' || operator === 'IN' || operator === 'NOT_IN') {
        return false;
    }
    return !condition.valueField && isBlank(value);
}
