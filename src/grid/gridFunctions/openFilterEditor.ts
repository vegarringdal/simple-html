import { isFilterGroup } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import { removeContextMenu } from './removeContextMenu';
import { type GroupDraft, renderFilterEditor } from './renderFilterEditor';

/**
 * opens filter editor with current filter. When it is open already, it starts again from the filter
 * there is, in the same dialog (where the user put it)
 */
export function openFilterEditor(ctx: Grid) {
    removeContextMenu(ctx);

    const filter = ctx.gridInterface.getDatasource().getFilter();

    // the editor edits a group: a single condition at the root is put in an AND group
    let root: GroupDraft = { group: 'AND', children: [] };
    if (filter && isFilterGroup(filter)) {
        root = filter;
    } else if (filter) {
        root.children.push(filter);
    }

    // a copy, the editor changes it in place until the filter is applied
    renderFilterEditor(ctx, structuredClone(root));
}
