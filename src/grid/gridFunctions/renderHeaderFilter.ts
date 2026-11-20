import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity, GroupRow } from '../../datasource/entity';
import { parseFilterText } from '../../datasource/formatter';
import type { Grid } from '../grid';
import { cellFilterKeyNavigationCellRowHandler } from './cellFilterKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuFilter } from './contextmenuFilter';
import { filterCallback } from './filterCallback';
import type { HTMLCellElement } from './HTMLCellElement';

export function renderHeaderFilter(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string | null,
    // the first displayed row, not the header's: a group row when grouped, undefined when there are no rows
    rowData: Entity | GroupRow | undefined
) {
    if (attribute) {
        const cellConfig = ctx.gridInterface.__getGridConfig().columns[attribute];
        const { type, formatter } = ctx.gridInterface.getDatasource().getField(attribute);

        // the column's own placeholder, else the formatter's (YYYY-MM-DD), else the search icon
        const placeholderFilter = cellConfig.placeholderFilter || formatter.placeholder || '🔍';

        // what the cell shows, from the state's header filters. ?? and not ||: false and 0 are filters too
        let currentValue: unknown = ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? '';

        /**
         * internal function, so we can rerender
         */
        const renderMenu = () => {
            // stop duplicate events
            let filterRunning = false;

            if (type === 'boolean') {
                render(
                    html`<input
                        style="width:100%"
                        type="checkbox"
                        class=${`simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`}
                        .checked=${live(currentValue)}
                        .indeterminate=${currentValue !== true && currentValue !== false}
                        placeholder=${placeholderFilter}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                            return cellFilterKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                        }}
                        @change=${(e: any) => {
                            if (!filterRunning) {
                                filterRunning = true;

                                switch (true) {
                                    case currentValue === '' &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, (e.target as any).checked.toString(), attribute);
                                        currentValue = (e.target as any).checked;
                                        break;
                                    case currentValue === true &&
                                        (e.target as any).checked === false &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, (e.target as any).checked.toString(), attribute);
                                        currentValue = (e.target as any).checked;
                                        break;
                                    case currentValue === false &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, '', attribute);
                                        e.target.indeterminate = true;
                                        (e.target as any).checked = false;
                                        currentValue = '';
                                }

                                filterRunning = false;
                            }
                        }}
                    />`,
                    cell as any
                );
            } else {
                const currentText = formatter.format(currentValue);

                let lastFilter = currentText;
                let skipFocus = false;
                render(
                    html`<input
                        class=${`simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`}
                        style=${type === 'number' ? 'text-align: right;width:100%;height:100%;' : 'width:100%;height:100%;'}
                        .value=${live(currentText)}
                        placeholder=${placeholderFilter}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            if (lastFilter !== (e.target as any).value) {
                                filterCallback(ctx, (e.target as any).value, attribute);
                            }
                            lastFilter = (e.target as any).value;
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
                            }
                        }}
                        @click=${(e: any) => {
                            if (type === 'date' || type === 'datetime') {
                                setTimeout(() => {
                                    contextmenuDate(
                                        ctx,
                                        e,
                                        cell,
                                        parseFilterText(formatter, currentText),
                                        (value: Date | null) => {
                                            const filterValue = formatter.format(value);
                                            if (lastFilter !== filterValue) {
                                                lastFilter = filterValue;
                                                filterCallback(ctx, filterValue, attribute);
                                            }
                                            // TODO: need to check why date is inserted here and I need to reset
                                            // potential other issues I just dont see atm
                                            ctx.gridInterface.__setHeaderFilterValue(attribute, filterValue);

                                            renderHeaderFilter(
                                                ctx,
                                                cell,
                                                row,
                                                column,
                                                celno,
                                                colType,
                                                cellType,
                                                attribute,
                                                rowData
                                            );
                                        }
                                    );
                                }, 2);
                            }
                        }}
                        @focus=${() => {
                            if (skipFocus) {
                                skipFocus = false;
                                return;
                            }

                            ctx.gridInterface.__callSubscribers('cell-header-focus', {
                                cell,
                                row,
                                column,
                                celno,
                                colType,
                                cellType,
                                attribute,
                                rowData
                            });
                        }}
                        @keydown=${(e: KeyboardEvent) => {
                            const keycode = e.keyCode ? e.keyCode : e.which;
                            if (keycode === 13) {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!filterRunning) {
                                    filterRunning = true;

                                    filterCallback(ctx, (e.target as any).value, attribute);

                                    lastFilter = (e.target as any).value;
                                    filterRunning = false;
                                }
                            }
                            return cellFilterKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                        }}
                        @blur=${(e: any) => {
                            /**
                             * I would have expected change to pick this up, but its not always doing so, so added this
                             */
                            if ((e.target as any).value !== lastFilter) {
                                if (!filterRunning) {
                                    filterRunning = true;

                                    if (lastFilter !== (e.target as any).value) {
                                        filterCallback(ctx, (e.target as any).value, attribute);
                                    }
                                    lastFilter = (e.target as any).value;
                                    filterRunning = false;
                                }
                            }
                        }}
                        @change=${(e: any) => {
                            if (!filterRunning) {
                                filterRunning = true;

                                if (lastFilter !== (e.target as any).value) {
                                    filterCallback(ctx, (e.target as any).value, attribute);
                                }
                                lastFilter = (e.target as any).value;
                                filterRunning = false;
                            }
                        }}
                    />`,
                    cell as any
                );
            }
        };

        renderMenu();
    } else {
        render(html`<div class="simple-html-dimmed"></div>`, cell as any);
    }
}
