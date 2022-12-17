import { html, svg, render } from 'lit-html';
import { Entity } from '../../datasource/Entity';
import { contextmenuLabel } from './contextmenuLabel';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colTypes';
import { prettyPrintString } from './prettyPrintString';

export function renderHeaderLabel(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
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
                iconAsc = html`<i class="simple-html-grid-sort-number" data-sortno=${i + 1}>
                    <svg class="simple-html-grid-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">
                        ${sort.ascending
                            ? svg`<path d="M7.4 6L3 10h1.5L8 7l3.4 3H13L8.5 6h-1z" />`
                            : svg`<path d="M7.4 10L3 6h1.5L8 9.2 11.3 6H13l-4.5 4h-1z" />`}
                    </svg></i
                >`;
            }
        });

    if (attribute) {
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
        const label = cellConfig.label || prettyPrintString(cellConfig.attribute);

        render(
            html`<div
                class="simple-html-label"
                @contextmenu=${(e: MouseEvent) => {
                    e.preventDefault();
                    contextmenuLabel(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
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
