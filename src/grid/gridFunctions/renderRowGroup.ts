import { html, nothing, render, svg } from 'lit-html';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { ariaColCount } from './ariaGrid';
import type { ColType } from './colType';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';

export function renderRowGroup(
    ctx: Grid,
    cell: HTMLCellElement,
    _row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string | null,
    _attribute: string | null,
    rowData: Entity | GroupRow | undefined
) {
    // only a group row is shown, the cell of a data row is hidden
    const group = isGroupRow(rowData) ? rowData : null;
    if (group) {
        cell.style.display = 'block';
        cell.style.zIndex = '10';
    } else {
        cell.style.display = 'none';
    }

    // TODO: I do not like how hardcoded grouping indent is
    // add it as a option

    const toggle = () => {
        if (group?.__groupID) {
            if (group.__groupExpanded) {
                ctx.gridInterface.getDatasource().collapseGroup(group.__groupID);
            } else {
                ctx.gridInterface.getDatasource().expandGroup(group.__groupID);
            }
        }
    };

    // one cell for a screen reader, over every column after the row number (see ariaGrid.ts). The
    // icon is a button: it says whether the group is expanded, Enter and Space toggle it like a click.
    // Its name is the text the row shows (the text itself is hidden from a screen reader), so the cell
    // and the button read "Country: Norway (12)" once - and a voice user says what is on screen
    const columns = ariaColCount(ctx.gridInterface.__getGridConfig());
    render(
        html`<div
            role="gridcell"
            aria-colindex="2"
            aria-colspan=${Math.max(1, columns - 1)}
            class="simple-html-absolute-fill simple-html-label-group"
            style="padding-left:${(rowData?.__groupLvl ?? 0) * 15 || 0}px"
        >
            <div
                class="${group?.__groupID ? 'simple-html-grid-grouping-row-group' : 'simple-html-grid-grouping-row'}"
                style="width:${(rowData?.__groupLvl ?? 0) * 15 || 0}px;display:${rowData?.__groupLvl || 0 ? 'block' : 'none'}"
            ></div>
            <i
                role="button"
                tabindex="-1"
                aria-expanded=${group ? String(group.__groupExpanded) : nothing}
                aria-label=${
                    group ? gridText(ctx, 'grid.groupToggle', { name: group.__groupName, total: group.__groupTotal }) : nothing
                }
                @click=${toggle}
                @keydown=${(event: KeyboardEvent) => {
                    if (group && (event.key === 'Enter' || event.key === ' ')) {
                        // Space would scroll the page
                        event.preventDefault();
                        toggle();
                        focusGroupToggle(ctx, group.__groupID);
                    }
                }}
            >
                <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                    ${
                        group?.__groupExpanded
                            ? svg`<path d="M4.8 7.5h6.5v1H4.8z" />`
                            : svg`<path d="M7.4 4.8v2.7H4.7v1h2.7v3h1v-3h2.8v-1H8.5V4.8h-1z" />`
                    }
                </svg></i
            >
            <span class="" aria-hidden="true"> ${group?.__groupName} (${group?.__groupTotal})</span>
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
    const cached = ctx.containerGroupRowCache.find((entry) => entry.row === row);
    const element = cached ? ctx.rows.get(cached.id) : undefined;
    element?.querySelector<HTMLElement>('[role="button"]')?.focus();
}
