import { html, render, svg } from 'lit-html';
import type { Grid } from '../grid';
import { ariaColIndex, setAria } from './ariaGrid';
import type { ColType } from './colType';
import { contextmenuLabel } from './contextmenuLabel';
import { getColumnLabel } from './getColumnLabel';
import type { HTMLCellElement } from './HTMLCellElement';

export function renderHeaderLabel(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string | null
) {
    /**
     * first get sort logic
     */
    let iconAsc: any = '';
    ctx.gridInterface
        .getDatasource()
        .getLastSorting()
        .forEach((sort, i) => {
            if (sort.attribute === attribute) {
                // hidden from a screen reader, the column header's aria-sort says it
                iconAsc = html`<i class="simple-html-grid-sort-number" data-sortno=${i + 1} aria-hidden="true">
                    <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        ${
                            sort.ascending
                                ? svg`<path d="M7.4 6L3 10h1.5L8 7l3.4 3H13L8.5 6h-1z" />`
                                : svg`<path d="M7.4 10L3 6h1.5L8 9.2 11.3 6H13l-4.5 4h-1z" />`
                        }
                    </svg></i
                >`;
            }
        });

    // the cell element is the column header of the field, and says how the rows are sorted on it:
    // only on the first sort, a grid has one sorted column for a screen reader (WAI-ARIA 1.2,
    // aria-sort). Focusable (not in the tab order): Enter and Space sort, see rebuildHeaderColumns.
    // A column with fewer fields than the tallest one has empty label cells, they are no header
    const sorting = ctx.gridInterface.getDatasource().getLastSorting();
    const first = sorting[0];
    const config = ctx.gridInterface.__getGridConfig();
    setAria(cell, 'role', attribute ? 'columnheader' : 'none');
    setAria(cell, 'aria-colindex', attribute ? String(ariaColIndex(config, colType, column, celno)) : null);
    setAria(
        cell,
        'aria-sort',
        attribute && first?.attribute === attribute ? (first.ascending ? 'ascending' : 'descending') : null
    );
    setAria(cell, 'tabindex', attribute ? '-1' : null);

    if (attribute) {
        const label = getColumnLabel(ctx, attribute);

        render(
            html`<div
                class="simple-html-label-text"
                data-attribute-header=${attribute}
                @contextmenu=${(e: MouseEvent) => {
                    e.preventDefault();
                    contextmenuLabel(ctx, e, cell, row, column, celno, colType, cellType, attribute);
                }}
            >
                ${label} ${iconAsc}
            </div>`,
            cell as any
        );
    } else {
        render(html`<div class="simple-html-dimmed"></div>`, cell as any);
    }
}
