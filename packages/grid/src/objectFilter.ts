import { IFilterObj } from './interfaces';

export function objectFilter(rowData: any, filter: IFilterObj) {
    let result = true;

    // vars
    let rowValue: any;
    let filterValue: any;
    let filterOperator = filter.operator;
    let newFilterOperator: number;
    let type: string = filter.type;

    if (filter.value === 'null') {
        type = 'null';
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
            filterOperator = 1;

            break;
        case 'number':
            filterValue = Number(filter.value);
            if (!filterValue) {
                // needs to be 0
                filterValue = 0;
            }
            filterOperator = filterOperator || 1;
            if (filterOperator === 6) {
                filterOperator = 1;
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
            filterOperator = filterOperator || 9;
            newFilterOperator = filterOperator;

            // if filter operator is BEGIN WITH
            if (filter.value.charAt(0) === '*' && filterOperator === 9) {
                newFilterOperator = 6;
                filterValue = filterValue.substr(1, filterValue.length);
            }

            // if filter operator is EQUAL TO
            // wildcard first = end with
            if (filter.value.charAt(0) === '*' && filterOperator === 1) {
                newFilterOperator = 10;
                filterValue = filterValue.substr(1, filterValue.length);
            }

            // wildcard end and first = contains
            if (
                filter.value.charAt(filter.value.length - 1) === '*' &&
                filterOperator === 1 &&
                newFilterOperator === 10
            ) {
                newFilterOperator = 6;
                filterValue = filterValue.substr(0, filterValue.length - 1);
            }

            // begin with since wildcard is in the end
            if (
                filter.value.charAt(filter.value.length - 1) === '*' &&
                filterOperator === 1 &&
                newFilterOperator !== 10 &&
                newFilterOperator !== 6
            ) {
                newFilterOperator = 9;
                filterValue = filterValue.substr(0, filterValue.length - 1);
            }

            // set the filteroperator from new if changed
            if (filterOperator !== newFilterOperator) {
                filterOperator = newFilterOperator;
            }
            break;
        case 'boolean':
            filterValue = typeBool[filter.value];
            filterOperator = 1;
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
            filterOperator = filterOperator || 1;
            break;
    }

    // filter from what operator used
    switch (filterOperator) {
        case 1: // equal
            if (rowValue !== filterValue) {
                result = false;
            }
            break;
        case 2: // less or equal
            if (!(rowValue <= filterValue)) {
                result = false;
            }
            break;
        case 3: // greater or equal
            if (!(rowValue >= filterValue)) {
                result = false;
            }
            break;
        case 4: // greate
            if (!(rowValue < filterValue)) {
                result = false;
            }
            break;
        case 5: // greater
            if (!(rowValue > filterValue)) {
                result = false;
            }
            break;
        case 6: // contains
            if (rowValue.indexOf(filterValue) === -1) {
                result = false;
            }
            break;
        case 7: // not equal to
            if (rowValue === filterValue) {
                result = false;
            }
            break;
        case 8: // does not contain
            if (rowValue.indexOf(filterValue) !== -1) {
                result = false;
            }
            break;
        case 9: // begin with
            if (rowValue.substring(0, filterValue.length) !== filterValue) {
                result = false;
            }
            break;
        case 10: // end with
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
        if (filter.value.charAt(0) === '*' && filter.value.length === 1) {
            result = true;
        }
    }

    return result;
}
