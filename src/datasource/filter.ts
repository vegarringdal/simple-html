import type { Datasource } from './dataSource';
import type { Entity } from './entity';
import type { FieldType } from './field';
import type { FilterArgument } from './filterArgument';
import type { FilterComparisonOperator } from './filterComparisonOperator';
import { isBlank } from './isBlank';
import { objectFilter } from './objectFilter';

export class Filter {
    private currentFilter: FilterArgument | null;

    constructor() {
        this.currentFilter = null;
    }

    public getFilter(): FilterArgument | null {
        return this.currentFilter;
    }

    public setFilter(filter: FilterArgument | null) {
        this.currentFilter = filter;
    }

    public getFilterFromType(type: string): FilterComparisonOperator {
        switch (type) {
            case 'date':
            case 'datetime':
            case 'number':
                return 'GREATER_THAN_OR_EQUAL_TO';
            default:
                return 'EQUAL';
        }
    }

    public filter(objArray: Entity[], ObjFilter: FilterArgument | null, ds: Datasource) {
        this.currentFilter = ObjFilter;

        if (!ObjFilter) {
            return objArray.slice();
        }

        // null = empty or incomplete filter, it does not restrict anything
        return objArray.filter((rowData) => this.evaluate(rowData, ObjFilter, ds) !== false);
    }

    /**
     * evaluates a group or a condition against one row
     * @returns true/false, or null for an empty group or an incomplete condition (see
     * isIncompleteCondition). Those are ignored: they never restrict rows, whatever the parent operator is.
     * Without this an empty OR group was false and filtered out every row
     */
    private evaluate(rowData: Entity, arg: FilterArgument, ds: Datasource): boolean | null {
        if (isFilterGroup(arg)) {
            // no logicalOperator means AND, as documented on FilterArgument
            const isOr = arg.logicalOperator === 'OR';
            let result: boolean | null = null;
            for (const child of arg.filterArguments || []) {
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

        const type = conditionType(arg, ds);
        if (!isCompleteCondition(arg, type)) {
            return null;
        }

        if (arg.operator === 'IN' || arg.operator === 'NOT_IN') {
            return this.inStatement(rowData, arg, type, ds);
        }

        let value = arg.value;
        if (arg.valueType === 'ATTRIBUTE') {
            if (typeof arg.value === 'string') {
                value = rowData[arg.value];
            } else {
                console.error('filtervalue needs to be string if you are comparing attributes');
            }
        }

        return objectFilter(rowData, {
            value: value,
            operator: arg.operator,
            attribute: arg.attribute,
            type
        });
    }

    /**
     * IN / NOT_IN. The list and the row value are both compared as upper case text, so a number or
     * boolean in the row matches the same value in the list. A blank row value (or 0, same as
     * IS_BLANK) only matches the list value 'NULL'.
     */
    private inStatement(rowData: Entity, filter: CompleteCondition, type: FieldType, ds: Datasource): boolean {
        if (typeof filter.value === 'string') {
            // stored back as an array, the filter dropdown only shows array values as checked
            filter.value = filter.value.toUpperCase().split('\n') as any;
        }

        let values: string[] = [];
        if (Array.isArray(filter.value)) {
            values = (filter.value as any[]).map((e) => String(e).toUpperCase());
        } else if (filter.value !== null && filter.value !== undefined) {
            values = [String(filter.value).toUpperCase()];
        }

        let data: any = rowData?.[filter.attribute];
        if (type === 'date' || type === 'datetime' || type === 'number') {
            // the formatted text, same as what is shown and typed into the list
            data = ds.getFormatter(filter.attribute, type).format(data);
        }

        const key = data === null || data === undefined || data === '' || data === 0 ? 'NULL' : String(data).toUpperCase();
        const found = values.indexOf(key) !== -1;

        return filter.operator === 'IN' ? found : !found;
    }
}

/**
 * @internal
 * The type a condition compares as: the field's type when the field is listed in the datasource's
 * `fields`, else the condition's own `attributeType`, else 'text'.
 * `attributeType` is only the fallback while conditions still carry it - the schema is the one
 * source of truth for the fields it lists.
 */
export function conditionType(arg: FilterArgument, ds: Datasource): FieldType {
    if (arg.attribute && ds.__getFieldConfig(arg.attribute)) {
        return ds.getField(arg.attribute).type;
    }
    return arg.attributeType ?? 'text';
}

/**
 * @internal
 * true if a condition can not be evaluated and is ignored: no attribute, no operator, or a date
 * condition with a blank value (null, undefined, '', invalid Date). IS_BLANK / IS_NOT_BLANK take no
 * value, and an ATTRIBUTE value is the name of the other attribute, so neither is checked for a blank value.
 * @param type the type the condition compares as, see conditionType
 */
export function isIncompleteCondition(arg: FilterArgument, type: FieldType | undefined = arg.attributeType): boolean {
    if (!arg.attribute || !arg.operator) {
        return true;
    }
    const isDate = type === 'date' || type === 'datetime' || arg.value instanceof Date;
    const takesValue = arg.operator !== 'IS_BLANK' && arg.operator !== 'IS_NOT_BLANK' && arg.valueType !== 'ATTRIBUTE';
    return isDate && takesValue && isBlank(arg.value);
}

/**
 * @internal
 * a condition that is not incomplete, see isIncompleteCondition: attribute and operator are set
 */
export type CompleteCondition = FilterArgument & { attribute: string; operator: FilterComparisonOperator };

/**
 * @internal
 * the opposite of isIncompleteCondition, as a type guard so TS knows attribute and operator are set
 * @param type the type the condition compares as, see conditionType
 */
export function isCompleteCondition(arg: FilterArgument, type?: FieldType): arg is CompleteCondition {
    return !isIncompleteCondition(arg, type ?? arg.attributeType);
}

/**
 * @internal
 * true if the filter argument is a group. `type` decides when it is set, like in the filter editor.
 * Without it, an argument with a `filterArguments` array is a group, as documented on FilterArgument.
 * `logicalOperator` alone is not enough - a condition written as { attribute, operator, value,
 * logicalOperator: 'AND' } would otherwise be read as an empty group and silently ignored.
 */
export function isFilterGroup(arg: FilterArgument): boolean {
    if (arg.type) {
        return arg.type === 'GROUP';
    }
    return Array.isArray(arg.filterArguments);
}
