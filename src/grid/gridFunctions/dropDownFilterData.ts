import type { FilterArgument } from '../../datasource/filterArgument';
import type { Grid } from '../grid';

export const DROPDOWN_FILTER_MAX_ROWS = 100;

/**
 * helper for column excel similar filter
 * @param attribute
 * @param availableOnly
 * @param searchInput
 * @returns
 */
export function dropDownFilterData(ctx: Grid, attribute: string, availableOnly: boolean, searchInput: string) {
    const datasource = ctx.gridInterface.getDatasource();
    const type = ctx.gridInterface.__getGridConfig().__attributes[attribute].type || 'text';
    let dataFilterSet = new Set();

    if (type !== 'text') {
        return null;
    }

    const data = availableOnly ? datasource.getRows(true) : datasource.getAllData();

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

    const addValue = (value: any) => {
        counts.set(value, (counts.get(value) || 0) + 1);
        if (dataFilterSet.size < DROPDOWN_FILTER_MAX_ROWS || dataFilterSet.has(value)) {
            dataFilterSet.add(value);
        } else {
            truncated = true;
        }
    };

    for (let i = 0; i < length; i++) {
        if (data[i]?.[attribute]) {
            if (typeof data[i][attribute] === 'string') {
                if (search) {
                    if (data[i][attribute].toLocaleUpperCase().indexOf(search.toLocaleUpperCase()) !== -1) {
                        addValue(data[i][attribute].toLocaleUpperCase());
                    }
                } else {
                    addValue(data[i][attribute].toLocaleUpperCase());
                }
            }
            if (typeof data[i][attribute] === 'number') {
                if (search) {
                    if (data[i][attribute].toString().indexOf(search) !== -1) {
                        addValue(data[i][attribute]);
                    }
                } else {
                    addValue(data[i][attribute]);
                }
            }
            if (typeof data[i][attribute] === 'boolean') {
                if (search) {
                    if (data[i][attribute].toString().indexOf(search) !== -1) {
                        addValue(data[i][attribute]);
                    }
                } else {
                    addValue(data[i][attribute]);
                }
            }

            if (data[i][attribute] && typeof data[i][attribute] === 'object') {
                if (search) {
                    if (data[i][attribute].toISOString().indexOf(search) !== -1) {
                        addValue(data[i][attribute]);
                    }
                } else {
                    addValue(data[i][attribute].toISOString());
                }
            }
        } else {
            haveNull = true;
            counts.set('NULL', (counts.get('NULL') || 0) + 1);
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
    let selectAll = true;

    // check if top level filter have attribute, if so.. use it
    const oldFilter = datasource.getFilter();
    if (oldFilter?.filterArguments?.length) {
        oldFilter?.filterArguments.forEach((f: FilterArgument) => {
            if (f.attribute === attribute) {
                if (Array.isArray(f.value as any)) {
                    if (f.operator === 'IN') {
                        dataFilterSet = new Set(f.value as any);
                        selectAll = false;
                    }
                    if (f.operator === 'NOT_IN') {
                        const tempSet = new Set(f.value as any);
                        dataFilterSet = new Set(Array.from(dataFilterSetFull).filter((x) => !tempSet.has(x)));
                        selectAll = false;
                    }
                }
            }
        });
    }

    const dataSize = datasource.getRows(true).length;
    const totalSize = datasource.getAllData().length;
    const filterSetsSameSize = dataFilterSet.size === dataFilterSetFull.size;
    const enableAvailableOnlyOption = dataSize !== totalSize && filterSetsSameSize;

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
