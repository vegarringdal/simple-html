import { render, html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { Entity } from '../../datasource/Entity';
import { contextmenuFilter } from './contextmenuFilter';
import { filterCallback } from './filterCallback';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colTypes';

export function renderHeaderFilter(
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
    if (attribute) {
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

        const placeHolderFilter = cellConfig.placeHolderFilter || '🔍';
        let currentValue = cellConfig.currentFilterValue || ('' as any);

        if (cellConfig?.type === 'date') {
            currentValue = ctx.gridInterface.getDatasource().getDateFormater().fromDate(currentValue);
        }

        /**
         * internal function, so we can rerender
         */
        const renderMenu = () => {
            // stop duplicate events
            let filterRunning = false;

            if (cellConfig.type === 'boolean') {
                render(
                    html`<input
                        type="checkbox"
                        .checked=${live(currentValue)}
                        .indeterminate=${currentValue !== true && currentValue !== false}
                        placeholder=${placeHolderFilter}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @change=${(e: any) => {
                            if (!filterRunning) {
                                filterRunning = true;

                                switch (true) {
                                    case currentValue === '' &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, (e.target as any).checked.toString(), cellConfig);
                                        currentValue = (e.target as any).checked.toString();
                                        break;
                                    case currentValue === 'true' &&
                                        (e.target as any).checked === false &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, (e.target as any).checked.toString(), cellConfig);
                                        currentValue = (e.target as any).checked.toString();
                                        break;
                                    case currentValue === 'false' &&
                                        (e.target as any).checked === true &&
                                        e.target.indeterminate === false:
                                        filterCallback(ctx, '', cellConfig);
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
                let lastFilter = currentValue || '';
                let skipFocus = false;
                render(
                    html`<input
                        style=${cellConfig?.type === 'number' ? 'text-align: right' : ''}
                        .value=${live(currentValue)}
                        placeholder=${placeHolderFilter}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            if (lastFilter !== (e.target as any).value) {
                                filterCallback(ctx, (e.target as any).value, cellConfig);
                            }
                            lastFilter = (e.target as any).value;
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
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

                                    if (lastFilter !== (e.target as any).value) {
                                        filterCallback(ctx, (e.target as any).value, cellConfig);
                                    }
                                    lastFilter = (e.target as any).value;
                                    filterRunning = false;
                                }
                            }
                        }}
                        @blur=${(e: any) => {
                            /**
                             * I would have expected change to pick this up, but its not always doing so, so added this
                             */
                            if ((e.target as any).value !== lastFilter) {
                                if (!filterRunning) {
                                    filterRunning = true;

                                    if (lastFilter !== (e.target as any).value) {
                                        filterCallback(ctx, (e.target as any).value, cellConfig);
                                    }
                                    lastFilter = (e.target as any).value;
                                    filterRunning = false;
                                }
                            }
                        }}
                        @change=${(e: any) => {
                            console.log('change', attribute, (e.target as any).value, lastFilter);
                            if (!filterRunning) {
                                filterRunning = true;

                                if (lastFilter !== (e.target as any).value) {
                                    filterCallback(ctx, (e.target as any).value, cellConfig);
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
