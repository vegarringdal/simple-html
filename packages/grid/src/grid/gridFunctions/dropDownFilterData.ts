import { FilterArgument } from '../../datasource/types';
import { Grid } from '../grid';

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
    const search = searchInput && searchInput.replaceAll('%', '').replaceAll('*', '');

    for (let i = 0; i < length; i++) {
        // maybe I should let ctx be aoption ? the 200 size..
        if (data[i] && data[i][attribute] && dataFilterSet.size < 50) {
            if (typeof data[i][attribute] === 'string') {
                if (search) {
                    if (data[i][attribute].toLocaleUpperCase().indexOf(search.toLocaleUpperCase()) !== -1) {
                        dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                    }
                } else {
                    dataFilterSet.add(data[i][attribute].toLocaleUpperCase());
                }
            }
            if (typeof data[i][attribute] === 'number') {
                if (search) {
                    if (data[i][attribute].toString().indexOf(search) !== -1) {
                        dataFilterSet.add(data[i][attribute]);
                    }
                } else {
                    dataFilterSet.add(data[i][attribute]);
                }
            }
        } else {
            haveNull = true;
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
        selectAll
    };
}
