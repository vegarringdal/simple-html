import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { cellFilterKeyNavigationCellRowHandler } from './cellFilterKeyNavigationCellRowHandler';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuFilter } from './contextmenuFilter';
import { filterCallback } from './filterCallback';
export function renderHeaderFilter(ctx, cell, row, column, celno, colType, cellType, attribute, rowData) {
    if (attribute) {
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
        let placeHolderFilter = cellConfig.placeHolderFilter || '🔍';
        const valueFormater = ctx.gridInterface.getDatasource().getValueFormater();
        // if user have not set placeholder, then use placeholde in formater if any
        if (!cellConfig.placeHolderFilter) {
            const placeholderFormat = valueFormater.placeholder(cellConfig.type, attribute, true);
            if (placeholderFormat) {
                placeHolderFilter = placeholderFormat;
            }
        }
        let currentValue = cellConfig.currentFilterValue || '';
        /**
         * internal function, so we can rerender
         */
        const renderMenu = () => {
            // stop duplicate events
            let filterRunning = false;
            if (cellConfig.type === 'boolean') {
                render(html `<input
                        style="width:100%"
                        type="checkbox"
                        class=${`simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`}
                        .checked=${live(currentValue)}
                        .indeterminate=${currentValue !== true && currentValue !== false}
                        placeholder=${placeHolderFilter}
                        @contextmenu=${(e) => {
                    e.preventDefault();
                    contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                }}
                        @keydown=${(e) => {
                    return cellFilterKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                }}
                        @change=${(e) => {
                    if (!filterRunning) {
                        filterRunning = true;
                        switch (true) {
                            case currentValue === '' &&
                                e.target.checked === true &&
                                e.target.indeterminate === false:
                                filterCallback(ctx, e.target.checked.toString(), cellConfig);
                                currentValue = e.target.checked;
                                break;
                            case currentValue === true &&
                                e.target.checked === false &&
                                e.target.indeterminate === false:
                                filterCallback(ctx, e.target.checked.toString(), cellConfig);
                                currentValue = e.target.checked;
                                break;
                            case currentValue === false &&
                                e.target.checked === true &&
                                e.target.indeterminate === false:
                                filterCallback(ctx, '', cellConfig);
                                e.target.indeterminate = true;
                                e.target.checked = false;
                                currentValue = '';
                        }
                        filterRunning = false;
                    }
                }}
                    />`, cell);
            }
            else {
                currentValue = valueFormater.fromSource(currentValue, cellConfig?.type, cellConfig?.attribute, true);
                let lastFilter = currentValue || '';
                let skipFocus = false;
                render(html `<input
                        class=${`simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`}
                        style=${cellConfig?.type === 'number'
                    ? 'text-align: right;width:100%;height:100%;'
                    : 'width:100%;height:100%;'}
                        .value=${live(currentValue)}
                        placeholder=${placeHolderFilter}
                        @contextmenu=${(e) => {
                    e.preventDefault();
                    if (lastFilter !== e.target.value) {
                        filterCallback(ctx, e.target.value, cellConfig);
                    }
                    lastFilter = e.target.value;
                    contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                }}
                        @mousedown=${(e) => {
                    if (e.button === 2) {
                        skipFocus = true;
                    }
                }}
                        @click=${(e) => {
                    if (cellConfig?.type === 'date') {
                        setTimeout(() => {
                            contextmenuDate(ctx, e, cell, valueFormater.toFilter(currentValue, 'date', attribute, true), (value) => {
                                const filterValue = valueFormater.fromSource(value, 'date', attribute, true);
                                if (lastFilter !== filterValue) {
                                    lastFilter = filterValue;
                                    filterCallback(ctx, filterValue, cellConfig);
                                }
                                // TODO: need to check why date is inserted here and I need to reset
                                // potential other issues I just dont see atm
                                cellConfig.currentFilterValue = filterValue;
                                renderHeaderFilter(ctx, cell, row, column, celno, colType, cellType, attribute, rowData);
                            });
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
                        @keydown=${(e) => {
                    const keycode = e.keyCode ? e.keyCode : e.which;
                    if (keycode === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!filterRunning) {
                            filterRunning = true;
                            filterCallback(ctx, e.target.value, cellConfig);
                            lastFilter = e.target.value;
                            filterRunning = false;
                        }
                    }
                    return cellFilterKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                }}
                        @blur=${(e) => {
                    /**
                     * I would have expected change to pick this up, but its not always doing so, so added this
                     */
                    if (e.target.value !== lastFilter) {
                        if (!filterRunning) {
                            filterRunning = true;
                            if (lastFilter !== e.target.value) {
                                filterCallback(ctx, e.target.value, cellConfig);
                            }
                            lastFilter = e.target.value;
                            filterRunning = false;
                        }
                    }
                }}
                        @change=${(e) => {
                    if (!filterRunning) {
                        filterRunning = true;
                        if (lastFilter !== e.target.value) {
                            filterCallback(ctx, e.target.value, cellConfig);
                        }
                        lastFilter = e.target.value;
                        filterRunning = false;
                    }
                }}
                    />`, cell);
            }
        };
        renderMenu();
    }
    else {
        render(html `<div class="simple-html-dimmed"></div>`, cell);
    }
}
//# sourceMappingURL=renderHeaderFilter.js.map