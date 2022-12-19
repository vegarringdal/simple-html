import { FilterArgument } from '../../datasource/filterArgument';
import { renderFilterEditor } from './renderFilterEditor';
import { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';

/**
 * opens filter editor with current filter
 */
export function openFilterEditor(ctx: Grid) {
    removeContextMenu(ctx);

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

    renderFilterEditor(ctx, structuredClone(filterArg));
}
