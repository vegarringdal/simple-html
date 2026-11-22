import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { FieldType } from '../../datasource/field';
import { type Formatter, parseFilterText } from '../../datasource/formatter';
import { TextFormatter } from '../../datasource/textFormatter';
import type { Grid } from '../grid';
import { ariaColIndex, setAria } from './ariaGrid';
import { cellFilterKeyNavigationCellRowHandler } from './cellFilterKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuFilter } from './contextmenuFilter';
import { filterCallback, headerFilterText } from './filterCallback';
import { getColumnLabel } from './getColumnLabel';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';

export function renderHeaderFilter(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string | null
) {
    // the cell element is a gridcell of the filter row, the input in it the widget (see ariaGrid.ts). A
    // column with fewer fields than the tallest one has empty cells, they are no cells
    const config = ctx.gridInterface.__getGridConfig();
    setAria(cell, 'role', attribute ? 'gridcell' : 'none');
    setAria(cell, 'aria-colindex', attribute ? String(ariaColIndex(config, colType, column, celno)) : null);

    if (attribute) {
        const cellConfig = config.columns[attribute];
        // the name of the input for a screen reader; the placeholder says what to type, see below
        const label = gridText(ctx, 'grid.filter', { label: getColumnLabel(ctx, attribute) });
        // a lookup column (ColumnConfig.editor) filters on the labels it shows: a text filter, also for a
        // number field
        const field = ctx.gridInterface.getDatasource().getField(attribute);
        const lookup = !!ctx.gridInterface.__getLookupColumn(attribute);
        const type = lookup ? 'text' : field.type;
        const formatter: Formatter = lookup ? TextFormatter : field.formatter;

        // the column's own placeholder, else the formatter's (a date's format, YYYY-MM-DD), else the
        // field's type: "Text", "Number" (texts filter.placeholder.*). A BETWEEN's: "from..to". A boolean
        // filter is a checkbox
        const between = getHeaderFilterOperator(ctx, attribute) === 'BETWEEN';
        const placeholderFilter =
            cellConfig.placeholderFilter ||
            (between ? gridText(ctx, 'filter.placeholder.between') : formatter.placeholder || typePlaceholder(ctx, type));

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
                        aria-label=${label}
                        type="checkbox"
                        class=${`simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`}
                        .checked=${live(currentValue)}
                        .indeterminate=${currentValue !== true && currentValue !== false}
                        placeholder=${placeholderFilter}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute);
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
                // a BETWEEN's [from, to] as from..to
                const currentText = headerFilterText(currentValue, formatter);

                let lastFilter = currentText;
                let skipFocus = false;
                render(
                    html`<input
                        aria-label=${label}
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
                            contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute);
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
                                        // on the date in the input: typed since the cell was rendered too
                                        parseFilterText(formatter, (e.target as HTMLInputElement).value),
                                        (value: Date | null) => {
                                            // as if the date was typed: filterCallback parses the text and
                                            // stores the Date it filters on as the header filter's value
                                            // (it stored the text over it here, a typed date was a Date)
                                            const filterValue = formatter.format(value);
                                            if (lastFilter !== filterValue) {
                                                lastFilter = filterValue;
                                                filterCallback(ctx, filterValue, attribute);
                                            }

                                            renderHeaderFilter(ctx, cell, row, column, celno, colType, cellType, attribute);
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
                                // the first displayed row as it is now: it was the one when the cell was
                                // rendered, a filter since left it stale
                                rowData: ctx.gridInterface.getDatasource().getRow(0)
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

/**
 * the placeholder of an empty header filter of a field without one of its own: its type, "Text" or
 * "Number" - nothing for the other types, a date's formatter has its format as the placeholder
 */
function typePlaceholder(ctx: Grid, type: FieldType): string {
    if (type === 'text') {
        return gridText(ctx, 'filter.placeholder.text');
    }
    if (type === 'number') {
        return gridText(ctx, 'filter.placeholder.number');
    }
    return '';
}
