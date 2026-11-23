import { html, nothing, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { type Formatter, parseFilterText } from '../../datasource/formatter';
import { TextFormatter } from '../../datasource/textFormatter';
import type { Grid } from '../grid';
import { ariaColIndex, setAria } from './ariaGrid';
import { cellFilterKeyNavigationCellRowHandler } from './cellFilterKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { contextmenuDate, contextmenuDateRange, rangeFilterText } from './contextmenuDate';
import { contextmenuFilter } from './contextmenuFilter';
import { activeDatePreset, datePresetName, datePresetOfText, datePresetRangeOf } from './datePresetFilter';
import { filterCallback, headerFilterText, parseRangeText } from './filterCallback';
import { cancelFilterOnType, filterAfterPause, filterTextParses, isFilterOnType } from './filterOnType';
import { canChooseOperator, openOperatorChoice, operatorIndicator } from './filterOperatorIndicator';
import { getColumnLabel } from './getColumnLabel';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { headerFilterFormatter, pickerRange } from './headerFilterFormatter';
import { defaultFilterPlaceholder } from './headerFilterPlaceholder';
import { keepHeaderFilterFocus } from './headerOperatorMenu';

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
        // a column that filters as shown reads and writes the text in its display format (`2026-W47`)
        const formatter: Formatter = lookup ? TextFormatter : headerFilterFormatter(ctx, attribute, cellConfig.format);

        // the column's own placeholder, a BETWEEN's "from..to", the formatter's (a date's format,
        // YYYY-MM-DD, an example of the display format it filters as shown), the field's type: "Text",
        // "Number" (headerFilterPlaceholder.ts). A boolean filter is a checkbox
        const placeholderFilter = defaultFilterPlaceholder(ctx, attribute, getHeaderFilterOperator(ctx, attribute));

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
                // a BETWEEN's [from, to] as from..to - a quick date its name, `This month` (datePresetFilter.ts):
                // Enter on it filters on it again, from today, another text replaces it
                const preset = activeDatePreset(ctx, attribute);
                const currentText = preset ? datePresetName(ctx, preset) : headerFilterText(currentValue, formatter);

                let lastFilter = currentText;
                let skipFocus = false;

                /**
                 * before a menu of the cell opens: the text typed is filtered on, when it is not what the
                 * cell filtered on last - the menu's filter runs again with the cell's value
                 */
                const filterTyped = () => {
                    cancelFilterOnType(ctx);
                    const input = cell.querySelector<HTMLInputElement>('input.simple-html-grid-cell-filter-input');
                    if (input) {
                        if (lastFilter !== input.value) {
                            filterCallback(ctx, input.value, attribute);
                        }
                        lastFilter = input.value;
                    }
                };

                /**
                 * Filter as you type (filterOnType.ts), after the pause: the text in the input, when it is
                 * not what the cell filtered on last and is one to filter on (filterTextParses - not a date
                 * half typed). Not when the cell shows another column now, the grid reuses its cells. The
                 * input keeps the focus and its caret
                 */
                const filterWhileTyping = (input: HTMLInputElement) => {
                    const text = input.value;
                    const operator = getHeaderFilterOperator(ctx, attribute);
                    if (
                        cell.$attribute !== attribute ||
                        !input.isConnected ||
                        lastFilter === text ||
                        // the name of a quick date is one to filter on too
                        (!filterTextParses(formatter, type, operator, text) && !datePresetOfText(ctx, attribute, text))
                    ) {
                        return;
                    }
                    const refocus = keepHeaderFilterFocus(ctx);
                    lastFilter = text;
                    filterCallback(ctx, text, attribute);
                    refocus();
                };

                /**
                 * the filter menu: a right click, a long press, Shift+F10 - on the input and on the
                 * operator indicator
                 */
                const openFilterMenu = (e: MouseEvent) => {
                    e.preventDefault();
                    filterTyped();
                    contextmenuFilter(ctx, e, cell, row, column, celno, colType, cellType, attribute);
                };

                // the symbol of the operator beside the input, a click on it opens the operator choice
                const indicator = operatorIndicator(ctx, cell, colType, column, attribute, filterTyped, openFilterMenu);
                let inputClass = `simple-html-grid-cell-filter-input filter-cellpos-${colType}-${row}-${column}-${celno}`;
                if (indicator) {
                    inputClass += ` simple-html-grid-cell-filter-input-operator-${indicator.side}`;
                }

                render(
                    html`<input
                        aria-label=${label}
                        aria-describedby=${indicator ? indicator.id : nothing}
                        class=${inputClass}
                        style=${type === 'number' ? 'text-align: right;width:100%;height:100%;' : 'width:100%;height:100%;'}
                        .value=${live(currentText)}
                        placeholder=${placeholderFilter}
                        @contextmenu=${openFilterMenu}
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
                            }
                        }}
                        @input=${(e: Event) => {
                            // filter as you type: after a pause in typing, a key starts it again
                            if (isFilterOnType(ctx, attribute)) {
                                const input = e.target as HTMLInputElement;
                                filterAfterPause(ctx, () => filterWhileTyping(input));
                            }
                        }}
                        @click=${(e: any) => {
                            if (type === 'date' || type === 'datetime') {
                                /**
                                 * as if the text was typed: filterCallback parses it and stores the Date it
                                 * filters on as the header filter's value (it stored the text over it here,
                                 * a typed date was a Date) - a BETWEEN's [from, to]
                                 */
                                const usePicked = (filterValue: string) => {
                                    if (lastFilter !== filterValue) {
                                        lastFilter = filterValue;
                                        filterCallback(ctx, filterValue, attribute);
                                    }

                                    renderHeaderFilter(ctx, cell, row, column, celno, colType, cellType, attribute);
                                };

                                setTimeout(() => {
                                    // on the date in the input: typed since the cell was rendered too
                                    const typed = (e.target as HTMLInputElement).value;
                                    if (getHeaderFilterOperator(ctx, attribute) === 'BETWEEN') {
                                        // from..to: the range picker, on the two ends - an open end is not
                                        // picked. Use gives from..to, Clear no filter. Weeks shown: from
                                        // Monday of the first to Sunday of the last (pickerRange). The name
                                        // of a quick date: on its days
                                        const typedPreset = datePresetOfText(ctx, attribute, typed);
                                        const range = typedPreset
                                            ? datePresetRangeOf(ctx, attribute, typedPreset)
                                            : pickerRange(ctx, attribute, parseRangeText(formatter, typed) ?? [null, null]);
                                        contextmenuDateRange(ctx, cell, range, (picked) =>
                                            usePicked(rangeFilterText(formatter, type, picked))
                                        );
                                        return;
                                    }
                                    contextmenuDate(ctx, e, cell, parseFilterText(formatter, typed), (value: Date | null) =>
                                        usePicked(formatter.format(value))
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
                            // F4, as the list of a lookup cell opens: the operator choice, under the
                            // indicator - under the cell of a column too narrow for one. The focus goes
                            // into it. Not with the indicators turned off (a picker's dropdown grid)
                            const plain = !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;
                            if (e.key === 'F4' && plain && config.filterOperatorIndicator && canChooseOperator(ctx, attribute)) {
                                e.preventDefault();
                                filterTyped();
                                const anchor = cell.querySelector<HTMLElement>('.simple-html-grid-filter-operator') ?? cell;
                                openOperatorChoice(ctx, cell, attribute, anchor);
                                return;
                            }
                            const keycode = e.keyCode ? e.keyCode : e.which;
                            if (keycode === 13) {
                                e.preventDefault();
                                e.stopPropagation();
                                // the pause of filter as you type is over: the text is filtered on now, once
                                cancelFilterOnType(ctx);
                                const typed = (e.target as HTMLInputElement).value;
                                // Enter filters again on the same text - not when typing filtered on it already
                                const filteredWhileTyping = isFilterOnType(ctx, attribute) && lastFilter === typed;
                                if (!filterRunning && !filteredWhileTyping) {
                                    filterRunning = true;

                                    filterCallback(ctx, typed, attribute);

                                    lastFilter = typed;
                                    filterRunning = false;
                                }
                            }
                            return cellFilterKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                        }}
                        @blur=${(e: any) => {
                            // the pause of filter as you type is over: leaving filters on the text now, once
                            cancelFilterOnType(ctx);
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
                            cancelFilterOnType(ctx);
                            if (!filterRunning) {
                                filterRunning = true;

                                if (lastFilter !== (e.target as any).value) {
                                    filterCallback(ctx, (e.target as any).value, attribute);
                                }
                                lastFilter = (e.target as any).value;
                                filterRunning = false;
                            }
                        }}
                    />${indicator ? indicator.template : nothing}`,
                    cell as any
                );
            }
        };

        renderMenu();
    } else {
        render(html`<div class="simple-html-dimmed"></div>`, cell as any);
    }
}
