import type { Grid } from '../grid';

/**
 * The input the user is typing in, which a render must leave as it is: the element with the focus,
 * while the datasource has a cell that is being edited (`History.editingCell()` - the user typed in it
 * since it got the focus). Rendering it would put the formatted value into what is typed (`12,` ->
 * `12`), or show another row in it. `null` while no cell is being edited.
 *
 * A focused cell the user has not typed in yet is rendered: its text is the value, nothing is lost.
 */
export function editedInput(ctx: Grid): Element | null {
    if (!ctx.gridInterface.getDatasource().getDataContainer().__history.editingCell()) {
        return null;
    }
    // the document, or the shadow root the grid is in. A grid out of the dom is its own root
    const root = ctx.element.getRootNode() as Partial<DocumentOrShadowRoot>;
    return root.activeElement ?? null;
}

/**
 * A render left out the cell being typed in (see editedInput): every row on screen is rendered once the
 * focus leaves it - the cell, and the row element it is in when the rows moved under it (an upsert
 * that added a row above it, say). See onGridFocusOut in renderChangedRows.ts
 */
export function renderWhenEditEnds(ctx: Grid) {
    ctx.renderAllOnFocusOut = true;
}
