import { removeContextMenu } from './removeContextMenu';
import { renderFilterEditor } from './renderFilterEditor';
/**
 * opens filter editor with current filter
 */
export function openFilterEditor(ctx) {
    removeContextMenu(ctx);
    const defaultStartFilter = {
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
//# sourceMappingURL=openFilterEditor.js.map