import type { FilterAttributeSimple } from './filterArgument';
import type { FilterComparisonOperator } from './filterComparisonOperator';
import { isBlank } from './isBlank';

/**
 * tests one row against one condition
 * @param dateOnly compare dates on the day only, time ignored on both sides. For date formats
 * without time, see `ValueFormater.dateIncludesTime`
 */
export function objectFilter(rowData: any, filter: FilterAttributeSimple, dateOnly = false) {
    let result = true;

    // vars
    let rowValue: any;
    let filterValue: any;
    type filterExtended = ('REGEX' | 'REGEX-NOT') | FilterComparisonOperator;
    let filterOperator: filterExtended = filter.operator;
    let newFilterOperator: filterExtended;
    let type: string = filter.type || 'text';

    if (filter.value instanceof Date) {
        // little chance someone sends in date if they do not want to query for it
        type = 'date';
    }

    if (Number(filter.value) === filter.value) {
        type = 'number';
    }

    rowValue = rowData[filter.attribute];

    // if is blank or is not blank then just check right away
    if ('IS_BLANK' === filterOperator) {
        if (type === 'date') {
            if (rowValue && typeof rowValue === 'object' && rowValue.toString && rowValue.toString() === 'Invalid Date') {
                return true;
            }
        }

        if (rowValue === '' || rowValue === 0 || rowValue === null || rowValue === undefined) {
            return true;
        } else {
            return false;
        }
    }

    if ('IS_NOT_BLANK' === filterOperator) {
        if (type === 'date') {
            if (rowValue && typeof rowValue === 'object' && rowValue.toString && rowValue.toString() === 'Invalid Date') {
                return false;
            }
        }
        if (rowValue === '' || rowValue === 0 || rowValue === null || rowValue === undefined) {
            return false;
        } else {
            return true;
        }
    }

    // lets set some defaults/corrections if its all wrong
    switch (type) {
        case 'date':
            rowValue = toFilterTime(rowValue, dateOnly);
            filterValue = toFilterTime(filter.value, dateOnly);

            if (filterOperator === 'END_WITH') {
                filterOperator = 'LESS_THAN_OR_EQUAL_TO';
            }

            if (filterOperator === 'DOES_NOT_CONTAIN') {
                filterOperator = 'LESS_THAN';
            }

            if (
                filterOperator !== 'EQUAL' &&
                filterOperator !== 'NOT_EQUAL_TO' &&
                filterOperator !== 'GREATER_THAN' &&
                filterOperator !== 'GREATER_THAN_OR_EQUAL_TO' &&
                filterOperator !== 'LESS_THAN' &&
                filterOperator !== 'LESS_THAN_OR_EQUAL_TO'
            ) {
                filterOperator = 'GREATER_THAN_OR_EQUAL_TO';
            }

            // a blank row date is not on, before or after any date, it only matches NOT_EQUAL_TO.
            // Checked after the remapping above, so END_WITH, DOES_NOT_CONTAIN etc. follow the same rule
            if (Number.isNaN(rowValue)) {
                return filterOperator === 'NOT_EQUAL_TO';
            }

            break;
        case 'number':
            filterValue = Number(filter.value);
            if (!filterValue) {
                // needs to be 0
                filterValue = 0;
            }
            try {
                rowValue = Number.isNaN(Number(rowValue)) ? 0 : Number(rowValue);
            } catch {
                // conversion failed, keep rowValue as it was
            }

            if (filterOperator === 'END_WITH') {
                filterOperator = 'LESS_THAN_OR_EQUAL_TO';
            }

            if (filterOperator === 'DOES_NOT_CONTAIN') {
                filterOperator = 'LESS_THAN';
            }

            if (
                filterOperator !== 'EQUAL' &&
                filterOperator !== 'NOT_EQUAL_TO' &&
                filterOperator !== 'GREATER_THAN' &&
                filterOperator !== 'GREATER_THAN_OR_EQUAL_TO' &&
                filterOperator !== 'LESS_THAN' &&
                filterOperator !== 'LESS_THAN_OR_EQUAL_TO'
            ) {
                filterOperator = 'GREATER_THAN_OR_EQUAL_TO';
            }
            break;
        case 'text': {
            if (rowValue === null || rowValue === undefined) {
                rowValue = '';
            } else {
                rowValue = `${rowValue}`; // incase we got something else
                rowValue = rowValue.toLowerCase();
            }

            filterValue = `${filter.value}`; // incase we got something else
            filterValue = filterValue.toLowerCase();
            filterOperator = filterOperator || 'BEGIN_WITH';
            newFilterOperator = filterOperator;

            function updateRegex(input: string) {
                return input
                    .replace(/[.^$+?()[\]{}\\|]/g, '\\$&')
                    .replace(/\*/g, '.*')
                    .replace(/%/g, '.*');
            }

            // I need to check for wildcards, old method did not support wildcard in the middle
            switch (filterOperator) {
                case 'BEGIN_WITH':
                    newFilterOperator = 'REGEX';
                    filterValue = new RegExp(`^${updateRegex(filterValue as string)}.*`, 'gim');
                    break;
                case 'CONTAINS':
                    newFilterOperator = 'REGEX';
                    filterValue = new RegExp(`.*${updateRegex(filterValue as string)}.*`, 'gim');
                    break;
                case 'END_WITH':
                    newFilterOperator = 'REGEX';
                    filterValue = new RegExp(`.*${updateRegex(filterValue as string)}$`, 'gim');
                    break;
                case 'DOES_NOT_CONTAIN':
                    newFilterOperator = 'REGEX-NOT';
                    filterValue = new RegExp(`.*${updateRegex(filterValue as string)}`, 'gim');
                    break;
                case 'NOT_EQUAL_TO': {
                    newFilterOperator = 'REGEX-NOT';
                    let start = '';
                    if (filterValue[0] !== '*' || filterValue[0] !== '%') {
                        start = '^';
                    }
                    let end = '';
                    if (filterValue[filterValue.length] !== '*' || filterValue[filterValue.length] !== '%') {
                        end = '$';
                    }
                    filterValue = new RegExp(`${start}${updateRegex(filterValue as string)}${end}`, 'gim');
                    break;
                }
                default:
                    if (filterValue.split('*').length > 1 || filterValue.split('%').length > 1) {
                        newFilterOperator = 'REGEX';
                        let start = '';
                        if (filterValue[0] !== '*' || filterValue[0] !== '%') {
                            start = '^';
                        }
                        let end = '';
                        if (filterValue[filterValue.length] !== '*' || filterValue[filterValue.length] !== '%') {
                            end = '$';
                        }
                        filterValue = new RegExp(`${start}${updateRegex(filterValue as string)}${end}`, 'gim');
                    }
            }

            // set the filteroperator from new if changed
            if (filterOperator !== newFilterOperator) {
                filterOperator = newFilterOperator as any;
            }
            break;
        }
        case 'boolean':
            filterValue = filter.value;
            filterOperator = 'EQUAL';
            break;

        default:
            // todo: take the stuff under equal to and put in a function
            // and also call i from here.. or just make it fail?
            try {
                rowValue = rowValue.toLowerCase();
            } catch {
                // conversion failed, keep rowValue as it was
            }
            try {
                filterValue = filter.value.toLowerCase();
            } catch {
                filterValue = filter.value;
            }
            filterOperator = filterOperator || 'EQUAL';
            break;
    }

    // filter from what operator used
    switch (filterOperator) {
        case 'REGEX':
            // contains any type of wildcard
            if (!filterValue.test(rowValue)) {
                result = false;
            }
            break;
        case 'REGEX-NOT':
            // not contains with any type of wildcard
            if (filterValue.test(rowValue)) {
                result = false;
            }
            break;
        case 'EQUAL':
            if (rowValue !== filterValue) {
                result = false;
            }
            break;
        case 'LESS_THAN_OR_EQUAL_TO':
            if (!(rowValue <= filterValue)) {
                result = false;
            }
            break;
        case 'GREATER_THAN_OR_EQUAL_TO':
            if (!(rowValue >= filterValue)) {
                result = false;
            }
            break;
        case 'LESS_THAN':
            if (!(rowValue < filterValue)) {
                result = false;
            }
            break;
        case 'GREATER_THAN':
            if (!(rowValue > filterValue)) {
                result = false;
            }
            break;
        case 'CONTAINS':
            if (rowValue.indexOf(filterValue) === -1) {
                result = false;
            }
            break;
        case 'NOT_EQUAL_TO':
            if (rowValue === filterValue) {
                result = false;
            }
            break;
        case 'DOES_NOT_CONTAIN':
            if (rowValue.indexOf(filterValue) !== -1) {
                result = false;
            }
            break;
        case 'BEGIN_WITH':
            if (rowValue.substring(0, filterValue.length) !== filterValue) {
                result = false;
            }
            break;
        case 'END_WITH':
            if (rowValue.substring(rowValue.length - filterValue.length, rowValue.length) !== filterValue) {
                result = false;
            }
            break;
        default:
            if (rowValue !== filterValue) {
                result = false;
            }
    }

    return result;
}

/**
 * the timestamp a date condition compares, milliseconds always dropped and the time too if dateOnly.
 * NaN for a blank (null, undefined, '', invalid Date) or anything else that is not a date.
 */
function toFilterTime(value: any, dateOnly: boolean): number {
    // checked first, new Date(null) would be the epoch
    if (isBlank(value)) {
        return Number.NaN;
    }
    const date = new Date(value);
    // an unreadable value gives an invalid date, and every part of it below is NaN
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        dateOnly ? 0 : date.getHours(),
        dateOnly ? 0 : date.getMinutes(),
        dateOnly ? 0 : date.getSeconds(),
        0
    ).getTime();
}
