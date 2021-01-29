import { FilterAttributeSimple, FilterComparisonOperator } from './types';

export function objectFilter(rowData: any, filter: FilterAttributeSimple) {
    let result = true;

    // vars
    let rowValue: any;
    let filterValue: any;
    let filterOperator = filter.operator;
    let newFilterOperator: FilterComparisonOperator;
    let type: string = filter.type || 'text';

    if (filter.value === 'null') {
        type = 'null';
    }

    if (filter.value === null || filter.value === undefined) {
        type = 'null';
    }

    if (filter.value instanceof Date) {
        // little chance someone sends in date if they do not want to query for it
        type = 'date';
    }

    if (Number(filter.value) === filter.value) {
        type = 'number';
    }

    rowValue = rowData[filter.attribute];

    // helper for boolean
    const typeBool: { true: boolean; false: boolean } = {
        true: true,
        false: false
    };

    // lets set some defaults/corrections if its all wrong
    switch (type) {
        case 'null':
            filterValue = null;
            filterOperator = filterOperator === 'NOT_EQUAL_TO' ? 'NOT_EQUAL_TO' : 'EQUAL'; // we only want blanks or not blanks..
            if (rowValue === undefined || rowValue === 0 || rowValue === '') {
                rowValue = null;
            }

            break;

        case 'date':
            try {
                // we need to reset date so they use same time/timezone
                rowValue = new Date(
                    new Date(rowValue).getFullYear(),
                    new Date(rowValue).getMonth(),
                    new Date(rowValue).getDate(),
                    0,
                    0,
                    0,
                    0
                );
                rowValue = rowValue.getTime();
            } catch (err) {
                rowValue = rowValue;
            }

            try {
                // we need to reset date so they use same time/timezone
                filterValue = new Date(
                    new Date(filter.value).getFullYear(),
                    new Date(filter.value).getMonth(),
                    new Date(filter.value).getDate(),
                    0,
                    0,
                    0,
                    0
                );
                filterValue = filterValue.getTime();
            } catch (err) {
                filterValue = filter.value;
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
        case 'number':
            filterValue = Number(filter.value);
            if (!filterValue) {
                // needs to be 0
                filterValue = 0;
            }
            try {
                rowValue = isNaN(Number(rowValue)) ? 0 : Number(rowValue);
            } catch (err) {
                rowValue = rowValue;
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
        case 'text':
            if (rowValue === null || rowValue === undefined) {
                rowValue = '';
            } else {
                rowValue = rowValue + ''; // incase we got something else
                rowValue = rowValue.toLowerCase();
            }
            filterValue = filter.value.toLowerCase();
            filterOperator = filterOperator || 'BEGIN_WITH';
            newFilterOperator = filterOperator;

            // if filter operator is BEGIN WITH
            if (
                (filter.value.charAt(0) === '*' || filter.value.charAt(0) === '%') &&
                filterOperator === 'BEGIN_WITH'
            ) {
                newFilterOperator = 'CONTAINS';
                filterValue = filterValue.substr(1, filterValue.length);
            }

            // if filter operator is EQUAL TO
            // wildcard first = end with
            if (
                (filter.value.charAt(0) === '*' || filter.value.charAt(0) === '%') &&
                filterOperator === 'EQUAL'
            ) {
                newFilterOperator = 'END_WITH';
                filterValue = filterValue.substr(1, filterValue.length);
            }

            // wildcard end and first = contains
            if (
                (filter.value.charAt(filter.value.length - 1) === '*' ||
                    filter.value.charAt(filter.value.length - 1) === '%') &&
                filterOperator === 'EQUAL' &&
                newFilterOperator === 'END_WITH'
            ) {
                newFilterOperator = 'CONTAINS';
                filterValue = filterValue.substr(0, filterValue.length - 1);
            }

            if (
                (filter.value.charAt(filter.value.length - 1) === '*' ||
                    filter.value.charAt(filter.value.length - 1) === '%') &&
                (filterOperator === 'END_WITH' || newFilterOperator === 'END_WITH')
            ) {
                newFilterOperator = 'CONTAINS';
                filterValue = filterValue.substr(0, filterValue.length - 1);
            }

            // begin with since wildcard is in the end
            if (
                (filter.value.charAt(filter.value.length - 1) === '*' ||
                    filter.value.charAt(filter.value.length - 1) === '%') &&
                filterOperator === 'EQUAL' &&
                newFilterOperator !== 'END_WITH' &&
                newFilterOperator !== 'CONTAINS'
            ) {
                newFilterOperator = 'BEGIN_WITH';
                filterValue = filterValue.substr(0, filterValue.length - 1);
            }

            // set the filteroperator from new if changed
            if (filterOperator !== newFilterOperator) {
                filterOperator = newFilterOperator;
            }
            break;
        case 'boolean':
            filterValue = typeBool[filter.value];
            filterOperator = 'EQUAL';
            break;

        default:
            // todo: take the stuff under equal to and put in a function
            // and also call i from here.. or just make it fail?
            try {
                rowValue = rowValue.toLowerCase();
            } catch (err) {
                rowValue = rowValue;
            }
            try {
                filterValue = filter.value.toLowerCase();
            } catch (err) {
                filterValue = filter.value;
            }
            filterOperator = filterOperator || 'EQUAL';
            break;
    }

    // filter from what operator used
    switch (filterOperator) {
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
            if (
                rowValue.substring(rowValue.length - filterValue.length, rowValue.length) !==
                filterValue
            ) {
                result = false;
            }
            break;
        default:
            if (rowValue !== filterValue) {
                result = false;
            }
    }
    if (type === 'text') {
        if (
            (filter.value.charAt(0) === '*' || filter.value.charAt(0) === '%') &&
            filter.value.length === 'EQUAL'
        ) {
            result = true;
        }
    }

    return result;
}
