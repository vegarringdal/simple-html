import { Filter } from '../../datasource/filter';
import { and, type FilterExpression, isFilterGroup } from '../../datasource/filterExpression';
import type { Grid } from '../grid';

export const DROPDOWN_FILTER_MAX_ROWS = 100;

/**
 * helper for column excel similar filter
 * @param attribute
 * @param availableOnly
 * @param searchInput
 * @returns
 */
export function dropDownFilterData(ctx: Grid, attribute: string, availableOnly: boolean, searchInput: string | null) {
    const datasource = ctx.gridInterface.getDatasource();
    const type = ctx.gridInterface.getDatasource().getField(attribute).type;
    let dataFilterSet = new Set();

    if (type !== 'text') {
        return null;
    }

    /**
     * Excel style: the list is built from the rows every *other* filter lets through, so values
     * this column filtered away itself are still listed (unchecked) and can be checked again.
     * Using the already filtered rows made a NOT_IN computed from the list bring back values the
     * column had excluded before. The column's own conditions only decide what starts checked.
     */
    const { own, others } = splitColumnFilter(datasource.getFilter(), attribute);
    const filter = new Filter();
    const allData = datasource.getAllData();
    const availableRows = others ? filter.filter(allData, others, datasource) : allData;
    const data = availableOnly ? availableRows : allData;

    // rows the column's own conditions let through, null when it has none (all checked)
    const passingOwn = own.length ? new Set(filter.filter(data, and(...own), datasource)) : null;
    const checkedValues = new Set();

    const length = data.length;
    let haveNull = false;
    const search = searchInput?.replaceAll('%', '').replaceAll('*', '');

    /**
     * how many rows each distinct value has. Counted for every row, also the ones past the
     * DROPDOWN_FILTER_MAX_ROWS cap, so the numbers are only shown when nothing was cut off.
     */
    const counts = new Map<any, number>();

    /**
     * set when a value had to be dropped because the cap was reached.
     * The list size cannot be used to detect this - the cap stops the set at exactly
     * DROPDOWN_FILTER_MAX_ROWS, so "size > max" was only ever true when a blank pushed it
     * one over.
     */
    let truncated = false;

    const addValue = (value: any, row: any) => {
        counts.set(value, (counts.get(value) || 0) + 1);
        if (dataFilterSet.size < DROPDOWN_FILTER_MAX_ROWS || dataFilterSet.has(value)) {
            dataFilterSet.add(value);
        } else {
            truncated = true;
        }
        if (!passingOwn || passingOwn.has(row)) {
            checkedValues.add(value);
        }
    };

    for (let i = 0; i < length; i++) {
        if (data[i]?.[attribute]) {
            if (typeof data[i][attribute] === 'string') {
                if (search) {
                    if (data[i][attribute].toLocaleUpperCase().indexOf(search.toLocaleUpperCase()) !== -1) {
                        addValue(data[i][attribute].toLocaleUpperCase(), data[i]);
                    }
                } else {
                    addValue(data[i][attribute].toLocaleUpperCase(), data[i]);
                }
            }
            if (typeof data[i][attribute] === 'number') {
                if (search) {
                    if (data[i][attribute].toString().indexOf(search) !== -1) {
                        addValue(data[i][attribute], data[i]);
                    }
                } else {
                    addValue(data[i][attribute], data[i]);
                }
            }
            if (typeof data[i][attribute] === 'boolean') {
                if (search) {
                    if (data[i][attribute].toString().indexOf(search) !== -1) {
                        addValue(data[i][attribute], data[i]);
                    }
                } else {
                    addValue(data[i][attribute], data[i]);
                }
            }

            if (data[i][attribute] && typeof data[i][attribute] === 'object') {
                if (search) {
                    if (data[i][attribute].toISOString().indexOf(search) !== -1) {
                        addValue(data[i][attribute], data[i]);
                    }
                } else {
                    addValue(data[i][attribute].toISOString(), data[i]);
                }
            }
        } else {
            haveNull = true;
            counts.set('NULL', (counts.get('NULL') || 0) + 1);
            if (!passingOwn || passingOwn.has(data[i])) {
                checkedValues.add('NULL');
            }
        }
    }

    if (haveNull) {
        dataFilterSet.add('NULL'); // null so we can get the blanks
    }

    const tempArray = Array.from(dataFilterSet).sort();

    if (haveNull) {
        tempArray.unshift('NULL'); // null so we can get the blanks
    }

    const dataFilterSetFull = new Set(tempArray);

    // the column's current selection: the listed values its own conditions let through
    const selectAll = !passingOwn;
    if (passingOwn) {
        dataFilterSet = new Set(tempArray.filter((value) => checkedValues.has(value)));
    }

    // "Filter Available" only changes the list when other columns hide rows
    const enableAvailableOnlyOption = availableRows.length !== allData.length;

    return {
        enableAvailableOnlyOption,
        dataFilterSet,
        dataFilterSetFull,
        selectAll,
        /** true when values were dropped because of the DROPDOWN_FILTER_MAX_ROWS cap */
        truncated,
        /** rows per distinct value, only meaningful when nothing was truncated */
        counts
    };
}

/**
 * Splits the current filter into the column's own top level conditions (what the value list,
 * header filter and "is blank" put there) and everything else.
 * Only an AND root can be split - under an OR root nothing belongs to the column alone.
 * A single condition at the root is the column's own when it is on this column.
 */
function splitColumnFilter(filter: FilterExpression | null, attribute: string) {
    if (filter && isFilterGroup(filter) && filter.group !== 'OR') {
        const isOwn = (child: FilterExpression) => !isFilterGroup(child) && child.field === attribute;
        return {
            own: filter.children.filter(isOwn),
            others: and(...filter.children.filter((child) => !isOwn(child)))
        };
    }

    if (filter && !isFilterGroup(filter) && filter.field === attribute) {
        return { own: [filter], others: null };
    }

    return { own: [], others: filter };
}
