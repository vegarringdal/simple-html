import { html, nothing, render } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { groupRowAggregates, showsGroupAggregates } from './aggregates';
import { ariaColCount } from './ariaGrid';
import type { ColType } from './colType';
import { GROUP_LEVEL_WIDTH } from './getGroupingWidth';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { focusGroupButton, gridCornerKey } from './jumpKeys';
import { groupRowTab } from './tabExit';

export function renderRowGroup(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string | null,
    _attribute: string | null,
    rowData: Entity | GroupRow | undefined
) {
    // only a group row is shown, the cell of a data row is hidden. What it showed is left in it: the
    // next group row renders over it (lit updates what changed), a render of a data row's template in
    // between would make it all again
    if (!isGroupRow(rowData)) {
        cell.style.display = 'none';
        return;
    }
    const group = rowData;
    cell.style.display = 'block';
    cell.style.zIndex = '10';

    const toggle = () => {
        if (group.__groupID) {
            if (group.__groupExpanded) {
                ctx.gridInterface.getDatasource().collapseGroup(group.__groupID);
            } else {
                ctx.gridInterface.getDatasource().expandGroup(group.__groupID);
            }
        }
    };

    const config = ctx.gridInterface.__getGridConfig();
    const level = group.__groupLvl || 0;
    const indent = level * GROUP_LEVEL_WIDTH;

    // the lines of the levels, like a tree: the groups this row is in have their line through it, at
    // their column left of it (the same lines run through the data rows, see grid.css
    // .simple-html-grid-grouping-row), and an expanded group's line starts under its box and runs down
    // its rows. Over the whole height of the row: under the aggregate lines too
    const lines = html`${
        level ? html`<div class="simple-html-grid-group-levels" aria-hidden="true" style="width:${indent}px"></div>` : nothing
    }${
        group.__groupExpanded
            ? html`<div
                  class="simple-html-grid-group-line"
                  aria-hidden="true"
                  style="left:${indent}px;top:${Math.floor(config.cellHeight / 2)}px"
              ></div>`
            : nothing
    }`;

    // the +/- box in the column of its level, and the name. The box is a button: it says whether
    // the group is expanded, Enter and Space toggle it like a click. Its name is the text the row
    // shows (the text itself is hidden from a screen reader), so the cell and the button read
    // "Country: Norway (12)" once - and a voice user says what is on screen
    const name = html`<i
            role="button"
            tabindex="-1"
            class="simple-html-grid-group-toggle"
            aria-expanded=${String(group.__groupExpanded)}
            aria-label=${gridText(ctx, 'grid.groupToggle', { name: group.__groupName, total: group.__groupTotal })}
            @click=${toggle}
            @keydown=${(event: KeyboardEvent) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    // Space would scroll the page
                    event.preventDefault();
                    toggle();
                    focusGroupToggle(ctx, group.__groupID);
                    return;
                }
                // a stop of Tab, between the rows: see tabExit.ts. Ctrl+Home / Ctrl+End to the cells
                if (event.key === 'Tab' && !event.altKey && !event.ctrlKey && !event.metaKey) {
                    groupRowTab(ctx, row, event);
                    return;
                }
                gridCornerKey(ctx, event);
            }}
        >
            <svg class="simple-html-grid-group-box" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 11 11">
                <rect class="simple-html-grid-group-box-frame" x="0.5" y="0.5" width="10" height="10" />
                <path class="simple-html-grid-group-box-sign" d=${group.__groupExpanded ? 'M3 5.5h5' : 'M3 5.5h5M5.5 3v5'} />
            </svg></i
        ><span class="simple-html-grid-group-text" aria-hidden="true">${group.__groupName} (${group.__groupTotal})</span>`;

    if (showsGroupAggregates(config)) {
        // the aggregates of the columns (aggregates.ts), a line each at its column, under the name: the
        // name has the first line to itself, so it covers none. For a screen reader the name cell is
        // the gridcell of the first column, with that column's aggregates in its text; it spans the
        // columns up to the next aggregate, and comes first: the cells of a row go left to right
        const datasource = ctx.gridInterface.getDatasource();
        const aggregates = groupRowAggregates(ctx, (field, fn) => datasource.aggregate(field, fn, group));
        render(
            html`<div role="none" class="simple-html-absolute-fill simple-html-label-group simple-html-grid-group-aggregates">
                ${lines}
                <div
                    role="gridcell"
                    aria-colindex="2"
                    aria-colspan=${Math.max(1, aggregates.nameColSpan)}
                    class="simple-html-grid-group-name"
                    style="padding-left:${indent}px;height:${config.cellHeight}px"
                >
                    ${name}
                    ${aggregates.nameText ? html`<span class="simple-html-visually-hidden">${aggregates.nameText}</span>` : nothing}
                </div>
                ${aggregates.sections}
            </div>`,
            cell as any
        );
        return;
    }

    // one cell for a screen reader, over every column after the row number (see ariaGrid.ts)
    const columns = ariaColCount(config);
    render(
        html`<div
            role="gridcell"
            aria-colindex="2"
            aria-colspan=${Math.max(1, columns - 1)}
            class="simple-html-absolute-fill simple-html-label-group"
            style="padding-left:${indent}px"
        >
            ${lines}${name}
        </div>`,
        cell as any
    );
}

/**
 * Focuses the button of a group row, after it was toggled from the keyboard: expanding or collapsing
 * rebuilds the rows, the button that had the focus is gone
 */
function focusGroupToggle(ctx: Grid, groupID: string) {
    const row = ctx.gridInterface
        .getDatasource()
        .getRows()
        .findIndex((rowData) => isGroupRow(rowData) && rowData.__groupID === groupID);
    if (row !== -1) {
        focusGroupButton(ctx, row);
    }
}
