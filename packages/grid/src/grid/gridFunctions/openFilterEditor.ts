import { FilterArgument } from '../../datasource/types';
import { generateFilterEditor } from './generateFilterEditor';
import { Grid } from '../grid';

/**
 * opens filter editor with current filter
 */
export function openFilterEditor(ctx: Grid) {
    ctx.removeContextMenu();

    const defaultStartFilter: FilterArgument = {
        type: 'GROUP',
        logicalOperator: 'AND',
        filterArguments: []
    };

    const dsFilter = ctx.gridInterface.getDatasource().getFilter();

    const filterArg = dsFilter?.type === 'GROUP' ? dsFilter : defaultStartFilter;

    if (dsFilter && dsFilter?.type !== 'GROUP' && !Array.isArray(dsFilter)) {
        filterArg.filterArguments = [dsFilter];
    }
    if (Array.isArray(dsFilter) && dsFilter.length) {
        filterArg.filterArguments = dsFilter;
    }

    generateFilterEditor(ctx, structuredClone(filterArg));
}
