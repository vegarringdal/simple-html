import { isFilterGroup } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import { FilterEditorHistory } from './filterEditorHistory';
import { removeContextMenu } from './removeContextMenu';
import { type GroupDraft, renderFilterEditor } from './renderFilterEditor';
import { closeTextEditor } from './textEditor';

/**
 * opens filter editor with current filter. When it is open already, it starts again from the filter
 * there is, in the same dialog (where the user put it). Each time with a new undo history: the edits
 * made before are not undone into this filter
 */
export function openFilterEditor(ctx: Grid) {
    // a modal dialog: the editor of a multiline cell would be inert under it. Saved, as a click outside it
    closeTextEditor(ctx);
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
    renderFilterEditor(ctx, structuredClone(root), new FilterEditorHistory());
}
