import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { renderTotalsRow, showsGroupAggregates } from './aggregates';
import type { ColType, RowCache } from './colType';
import { renderDetailForm } from './detailForm';
import {
    GROUP_COLTYPE,
    LEFT_PINNED_COLTYPE,
    MIDDLE_PINNED_COLTYPE,
    RIGHT_PINNED_COLTYPE,
    SELECTOR_COLTYPE
} from './GROUP_COLTYPE';
import { renderRowColumns } from './pinnedSection';
import { renderFooter } from './rebuildFooter';
import { renderCell } from './renderCell';
import { showRowClass } from './rowClass';
import { triggerScrollEvent } from './triggerScrollEvent';

/**
 * Reactive cells: the datasource sends `rows-changed` with the rows whose values changed (from code,
 * undo, an upsert ...), once per run of code, and the grid renders the ones on screen here - in the
 * next animation frame, once however many changes came before it. So a value set from code shows
 * without `gridInterface.refresh()`, and the scroll handlers only render the rows that scroll in.
 *
 * The rows wait in `ctx.changedRows` until the frame. A row off screen is skipped: its row element is
 * rendered when it scrolls in.
 *
 * @param rows the rows of the event
 */
export function requestRowsRender(ctx: Grid, rows: readonly Entity[]) {
    for (const row of rows) {
        ctx.changedRows.add(row);
    }
    requestFrame(ctx);
}

/**
 * For the grid element's focusout: the focus left a cell (or moved inside the grid). When a cell was
 * left out of a render while it was typed in, everything on screen is rendered in the next frame - the
 * input's blur ends the typing first, see History.endTyping
 */
export function onGridFocusOut(ctx: Grid) {
    if (ctx.renderAllOnFocusOut) {
        ctx.renderAllOnFocusOut = false;
        ctx.renderAllInFrame = true;
        requestFrame(ctx);
    }
}

/**
 * one animation frame for what waits, whatever asks for it in the meantime
 */
function requestFrame(ctx: Grid) {
    if (ctx.rowsFrame !== null || (!ctx.changedRows.size && !ctx.renderAllInFrame)) {
        return;
    }
    ctx.rowsFrame = requestAnimationFrame(() => {
        ctx.rowsFrame = null;
        renderInFrame(ctx);
    });
}

/**
 * Cancels the frame, for a grid that leaves the dom: it is rendered again when it is put back
 */
export function cancelRowsRender(ctx: Grid) {
    if (ctx.rowsFrame !== null) {
        cancelAnimationFrame(ctx.rowsFrame);
    }
    ctx.rowsFrame = null;
    ctx.changedRows.clear();
    ctx.renderAllInFrame = false;
    ctx.renderAllOnFocusOut = false;
}

/**
 * the frame: every row on screen (triggerScrollEvent), or the changed ones
 */
function renderInFrame(ctx: Grid) {
    if (ctx.renderAllInFrame) {
        ctx.renderAllInFrame = false;
        // the group rows on screen are rendered with the rest, the totals row is not part of the rows
        const valuesChanged = ctx.changedRows.size > 0;
        ctx.changedRows.clear();
        triggerScrollEvent(ctx);
        if (valuesChanged) {
            renderTotalsRow(ctx);
            renderSummary(ctx);
        }
        return;
    }
    renderChangedRows(ctx);
}

/**
 * Renders the row elements on screen whose row is in `ctx.changedRows`: the row selector (the row's
 * state, its errors) and the cells of the pinned sections - every cell but the one being typed in
 * (renderRowColumns leaves it) - and the detail form when it shows one of them. With `dimRepeatedValues` also the row after a changed row: whether its
 * value is dimmed depends on the row above it.
 *
 * An edit does not group the rows again, a group row stays as it is - but the aggregates it shows
 * (`ColumnConfig.aggregate`) can change with any row: every group row on screen is rendered, and the
 * totals row. Cheap, the datasource computes the aggregates of a group again only when a row changed.
 * What moves rows - filter, sort, group, rows added or removed - renders every row on screen: a
 * rebuild, or after an upsert GridInterface.updateAfterMerge.
 */
export function renderChangedRows(ctx: Grid) {
    const changed = ctx.changedRows;
    ctx.changedRows = new Set();
    // connected but not in the dom yet: it renders everything when it is put there
    if (!ctx.domCreated || !changed.size) {
        return;
    }

    const datasource = ctx.gridInterface.getDatasource();
    const dimRepeated = ctx.gridInterface.__getGridConfig().dimRepeatedValues;
    const isChanged = (row: number) => {
        const entity = datasource.getRow(row);
        if (!entity || isGroupRow(entity)) {
            return false;
        }
        return changed.has(entity) || (dimRepeated === true && row > 0 && changed.has(datasource.getRow(row - 1) as Entity));
    };

    const sections: [RowCache[], ColType][] = [
        [ctx.containerSelectorRowCache, SELECTOR_COLTYPE],
        [ctx.containerLeftRowCache, LEFT_PINNED_COLTYPE],
        [ctx.containerMiddleRowCache, MIDDLE_PINNED_COLTYPE],
        [ctx.containerRightRowCache, RIGHT_PINNED_COLTYPE]
    ];
    for (const [rowCache, colType] of sections) {
        for (const entry of rowCache) {
            const rowElement = ctx.rows.get(entry.id);
            // a hidden row element (no row, or hidden for a large scroll jump) renders when it is shown
            if (entry.row === -1 || !rowElement || rowElement.style.display !== 'block' || !isChanged(entry.row)) {
                continue;
            }
            // the rowClass hook's classes follow the row's values
            showRowClass(ctx, rowElement, entry.row);
            if (colType === SELECTOR_COLTYPE) {
                renderCell(ctx, rowElement, entry.row, 0, 0, colType);
            } else {
                renderRowColumns(ctx, entry, colType, true);
            }
        }
    }

    // the aggregates, of whatever rows changed: the group rows on screen (the shown row elements of
    // the group section are the group rows) and the totals row
    const config = ctx.gridInterface.__getGridConfig();
    if (showsGroupAggregates(config)) {
        for (const entry of ctx.containerGroupRowCache) {
            const rowElement = ctx.rows.get(entry.id);
            if (entry.row !== -1 && rowElement?.style.display === 'block') {
                renderCell(ctx, rowElement, entry.row, 0, 0, GROUP_COLTYPE);
            }
        }
    }
    if (config.__totalsRowHeight) {
        renderTotalsRow(ctx);
    }
    renderSummary(ctx);
    // the detail form, when its row is one of them: the field the user types in keeps its text
    const shown = ctx.gridInterface.getDatasource().currentEntity;
    if (shown && changed.has(shown as Entity)) {
        renderDetailForm(ctx);
    }
}

/**
 * the summary of the selected cells in the footer, after values changed: it has their numbers. Only
 * with ranges - without, the footer has none
 */
function renderSummary(ctx: Grid) {
    if (ctx.gridInterface.__getRangeState()) {
        renderFooter(ctx);
    }
}
