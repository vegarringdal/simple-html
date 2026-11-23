import { html, nothing, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { FieldType } from '../../datasource/field';
import { and, type FilterExpression, type FilterOperator, isFilterGroup, where } from '../../datasource/filterExpression';
import { isBlank } from '../../datasource/isBlank';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuBlock, MenuContext, MenuEntry, MenuItem } from '../gridMenus';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import type { ColType } from './colType';
import { columnOperators, headerFilterType, headerOperators, isAlwaysCaseSensitive } from './columnFilterOptions';
import { type DateRange, filterDate, openDateInMenu, openDateRangeInMenu, rangeEndTexts } from './contextmenuDate';
import { datePresetBlock } from './datePresetBlock';
import { activeDatePreset } from './datePresetFilter';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData, type ValueListEntry } from './dropDownFilterData';
import { filterCallback } from './filterCallback';
import { filterOnTypeItem } from './filterOnType';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { headerFilterFormatter, pickerRange } from './headerFilterFormatter';
import { HEADER_OPERATOR_TEXTS, headerOperatorItems, operatorPicked } from './headerOperatorMenu';
import { openFilterEditor } from './openFilterEditor';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { placeUnderCell, showMenu } from './showMenu';
import { attachTooltips, tooltipsEnabled } from './tooltip';

/**
 * Opens the filter menu, the right click menu of a header filter: the default entries (see
 * MENU_IDS.filter), changed by the `menus.filter` hook.
 */
export function contextmenuFilter(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string,
    attribute: string
) {
    const context: MenuContext = {
        menu: 'filter',
        field: attribute,
        // the first displayed row as it is now, see contextmenuLabel
        row: ctx.gridInterface.getDatasource().getRow(0),
        rowIndex: row,
        cell,
        gridInterface: ctx.gridInterface,
        datasource: ctx.gridInterface.getDatasource()
    };

    const defaults = filterMenuEntries(ctx, attribute);
    const entries = ctx.gridInterface.__getHooks().menus?.filter?.(defaults, context) ?? defaults;

    showMenu(ctx, entries, context, placeUnderCell(event, cell));
}

/**
 * The filter menu's default entries, new objects every call: the submenu Filter (`filter.filter`) -
 * the submenu operator, "Match case", "Filter as you type" (filterOnType.ts), the submenu blank, clear,
 * clear all, a line, the filter editor -
 * then the main tool, not in a submenu: the value list of a text or lookup column, the range block of a
 * number or date column (each hides itself for the other columns) - and under it the quick dates of a
 * date column (datePresetBlock.ts). The entries kept the ids they had before they were in Filter. The ids
 * are documented in MENU_IDS.filter.
 *
 * What it offers are the column's operators (columnOperators: the type's, or its `filterOperators`):
 * Operator › and the range block those the header filter's input takes, Blank › IS_BLANK /
 * IS_NOT_BLANK, the value list IN (and NOT_IN when it has it)
 */
function filterMenuEntries(ctx: Grid, attribute: string): MenuEntry[] {
    // a lookup column filters on its labels: the operators of a text (filterCallback)
    const type = headerFilterType(ctx.gridInterface, attribute);
    const column = ctx.gridInterface.__getGridConfig().columns[attribute];
    const offered = columnOperators(column, type);

    // the operator picked before (state), else the column's, else the type's default: the range block's
    const current = getHeaderFilterOperator(ctx, attribute);
    const text = (id: TextId) => gridText(ctx, id);

    // every one of them, shown when the column offers it - not on a boolean column: its header filter is
    // a checkbox. The items of the operator indicator of the header filter too (filterOperatorIndicator.ts)
    const operatorItems = headerOperatorItems(ctx, attribute);

    return [
        {
            type: 'submenu',
            id: 'filter.filter',
            label: text('filter.filter'),
            entries: [
                {
                    type: 'submenu',
                    id: 'filter.operator',
                    label: text('filter.operator'),
                    // the operator in use has a check mark. Left out with none shown: a boolean's
                    entries: operatorItems
                },
                // a toggle with a check mark, for a text column - the operator choice has it too
                matchCaseItem(ctx, attribute),
                // a toggle with a check mark, not on a boolean column (its checkbox filters on a click)
                filterOnTypeItem(ctx, attribute),
                {
                    type: 'submenu',
                    id: 'filter.filter.blank',
                    label: text('filter.filter.blank'),
                    entries: [
                        {
                            id: 'filter.filter.isBlank',
                            label: text('filter.filter.isBlank'),
                            visible: () => offered.includes('IS_BLANK'),
                            action: () => setBlankOrNotBlank(ctx, attribute, 'IS_BLANK')
                        },
                        {
                            id: 'filter.filter.isNotBlank',
                            label: text('filter.filter.isNotBlank'),
                            visible: () => offered.includes('IS_NOT_BLANK'),
                            action: () => setBlankOrNotBlank(ctx, attribute, 'IS_NOT_BLANK')
                        }
                    ]
                },
                {
                    id: 'filter.filter.clear',
                    label: text('filter.filter.clear'),
                    action: () => clearColumnFilter(ctx, attribute)
                },
                { id: 'filter.filter.clearAll', label: text('filter.filter.clearAll'), action: () => clearAllColumnFilters(ctx) },
                { type: 'separator', id: 'filter.filter.advancedSeparator' },
                { id: 'filter.filter.advanced', label: text('filter.filter.advanced'), action: () => openFilterEditor(ctx) }
            ]
        },
        valueListBlock(ctx, attribute, offered),
        rangeBlock(ctx, attribute, type, headerOperators(column, type), current),
        datePresetBlock(ctx, attribute)
    ];
}

/**
 * The excel style value list, the main tool of the filter menu: a search box, a checkbox per text the
 * column's cells show with its number of rows, "Select all" over them, then Cancel and Apply. One block
 * (`filter.values`) with an element of its own, which it renders again as the user checks values and
 * types. For a text field and a lookup column, dropDownFilterData gives null for the rest - and not
 * for a column whose `filterOperators` have no IN. When the header filter matches case the list keeps
 * texts that differ in case apart, and its IN / NOT_IN match case (filterCallback).
 *
 * Nothing is filtered until Apply: the checkboxes are a draft, Cancel (or Esc, a click outside)
 * leaves the filter as it was.
 *
 * **A text search** (the user: "if search in box like this, we need to be able to click its a text search
 * only too"): with text in the search box, *Filter on the text: contains "…"* - when the column offers
 * `CONTAINS`. Checked, Apply filters on the text instead of the values: the header filter gets the operator
 * `CONTAINS` and the text, as if picked in Operator › and typed in its cell (the cell shows it, the
 * indicator `*a*`); `*`, `%` and `_` in it are wildcards there. The list stays as a preview, greyed out:
 * the values with the text in them, ignoring case.
 *
 * The keyboard: Tab goes on from the menu's items into it (see itemKeydown in showMenu) - the search
 * box, the checkboxes, Cancel, Apply. ArrowDown / ArrowUp move between the search box and the
 * checkboxes, Space checks one, Enter in the search box or on a checkbox applies, as Apply does.
 */
function valueListBlock(ctx: Grid, attribute: string, offered: FilterOperator[]): MenuBlock {
    const element = document.createElement('div');
    element.setAttribute('data-menu-id', 'filter.values');
    element.className = 'simple-html-grid-value-list';

    const state = {
        searchInput: '',
        availableOnly: true,
        // the search box's text is the filter, not the values checked
        textSearch: false,
        data: dropDownFilterData(ctx, attribute, true, '')
    };
    // a text search is a CONTAINS of the header filter: only when the column offers it
    const canSearchText = offered.includes('CONTAINS');

    const block: MenuBlock = {
        type: 'block',
        id: 'filter.values',
        element,
        visible: () => state.data !== null && offered.includes('IN')
    };
    const text = (id: TextId, values?: Record<string, unknown>) => gridText(ctx, id, values);

    /**
     * Filters the column on the values behind the checked texts, as the header filter does
     * (filterCallback: the column's conditions are replaced): an `IN` with them, or a `NOT_IN` with the
     * values of the unchecked ones when there are fewer of those - the values not listed (the
     * DROPDOWN_FILTER_MAX_ROWS cap) stay then; not when the column's `filterOperators` have no `NOT_IN`.
     * After a search always an `IN`: the values it found and are checked. None unchecked, or none
     * checked: no condition of the list. Then the menu closes
     */
    const apply = () => {
        const data = state.data;
        if (!data) {
            return;
        }
        if (textSearchOn()) {
            applyTextSearch();
            return;
        }
        const valuesOf = (entries: ValueListEntry[]) => entries.flatMap((entry) => entry.values);
        const checked = valuesOf(data.entries.filter((entry) => data.checked.has(entry)));
        const unchecked = valuesOf(data.entries.filter((entry) => !data.checked.has(entry)));
        if (!data.searched && unchecked.length < checked.length && offered.includes('NOT_IN')) {
            filterCallback(ctx, null, attribute, unchecked.length ? unchecked : null, true);
        } else {
            filterCallback(ctx, null, attribute, checked.length ? checked : null, false);
        }
        removeContextMenu(ctx);
    };

    /** true when Apply filters on the search box's text: the option checked, and text in the box */
    const textSearchOn = () => canSearchText && state.textSearch && state.searchInput.trim() !== '';

    /**
     * The text search: as if CONTAINS was picked in Operator › and the text typed in the header filter
     * (rangeBlock's apply does the same) - the operator, when it changed, is state with a
     * `filter-operator-change` event; the cell is rendered again and shows the text. Then the menu closes
     */
    const applyTextSearch = () => {
        const changed = getHeaderFilterOperator(ctx, attribute) !== 'CONTAINS';
        if (changed) {
            ctx.gridInterface.__setHeaderFilterOperator(attribute, 'CONTAINS');
        }
        filterCallback(ctx, state.searchInput.trim(), attribute);
        rebuildHeaderColumns(ctx);
        if (changed) {
            operatorPicked(ctx, attribute, 'CONTAINS');
        }
        removeContextMenu(ctx);
    };

    /**
     * the keys of the list: Enter in the search box or on a checkbox applies, ArrowDown / ArrowUp go to
     * the next / previous input (the search box, the checkboxes). The buttons are the browser's: Enter
     * and Space click them
     */
    element.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }
        // not the Enter that ends the composing of a character (an input method editor)
        if (event.key === 'Enter' && !event.isComposing) {
            event.preventDefault();
            apply();
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            const inputs = Array.from(element.querySelectorAll<HTMLInputElement>('input:not(:disabled)'));
            const next = inputs[inputs.indexOf(target) + (event.key === 'ArrowDown' ? 1 : -1)];
            if (next) {
                event.preventDefault();
                next.focus();
            }
        }
    });

    const reRender = () => {
        const data = state.data;
        if (!data) {
            return;
        }

        const total = data.entries.length;
        const checked = data.checked.size;
        // "Select all" is checked when every value is, mixed (indeterminate) when some are
        const allChecked = total > 0 && checked === total;
        const someChecked = checked > 0 && checked < total;

        const toggleValue = (entry: ValueListEntry) => {
            if (data.checked.has(entry)) {
                data.checked.delete(entry);
            } else {
                data.checked.add(entry);
            }
            reRender();
        };

        // all checked: none. Some or none: all, as a mixed checkbox goes
        const toggleAll = () => {
            data.checked = allChecked ? new Set() : new Set(data.entries);
            reRender();
        };

        const toggleTextSearch = () => {
            state.textSearch = !state.textSearch;
            reRender();
        };

        // a text search: the values are a preview, they can not be checked
        const preview = textSearchOn();

        const toggleAvailableOnly = () => {
            state.availableOnly = !state.availableOnly;
            state.data = dropDownFilterData(ctx, attribute, state.availableOnly, state.searchInput);
            reRender();
        };

        const search = (event: Event) => {
            state.searchInput = (event.target as HTMLInputElement).value;
            state.data = dropDownFilterData(ctx, attribute, state.availableOnly, state.searchInput);
            reRender();
        };

        /**
         * A value: its checkbox, the text the cells show - cut off with an ellipsis when it is too long,
         * the whole text as its tooltip then - and its number of rows on the right. The label around them
         * makes the whole row a click on the checkbox, and is the checkbox's name. The counts are only
         * shown when the list is complete: with values left out (the DROPDOWN_FILTER_MAX_ROWS cap) they
         * would mislead
         */
        const valueRow = (entry: ValueListEntry) => {
            const count = data.truncated ? undefined : entry.count;
            return html`<label class="simple-html-grid-value-row">
                <input
                    type="checkbox"
                    .checked=${live(preview || data.checked.has(entry))}
                    ?disabled=${preview}
                    @change=${() => toggleValue(entry)}
                />
                <span
                    class=${entry.blank ? 'simple-html-grid-value-text simple-html-grid-value-blank' : 'simple-html-grid-value-text'}
                    @mouseenter=${showCutOffText}
                    >${entry.blank ? text('filter.values.blank') : entry.text}</span
                >
                ${count ? html`<span class="simple-html-grid-value-count">${count}</span>` : nothing}
            </label>`;
        };

        // how many values the list has, or that it is cut off. Read out when it changes (aria-live)
        const info = data.truncated
            ? html`<span class="simple-html-grid-value-warning">${text('filter.values.truncated', { max: DROPDOWN_FILTER_MAX_ROWS })}</span>`
            : text(total === 1 ? 'filter.values.rowsFound.one' : 'filter.values.rowsFound', { count: total });

        render(
            html`<input
                    class="simple-html-grid-value-search"
                    type="text"
                    aria-label=${text('filter.values.search')}
                    placeholder=${text('filter.values.searchPlaceholder')}
                    .value=${live(state.searchInput)}
                    @input=${search}
                />
                ${
                    canSearchText && state.searchInput.trim() !== ''
                        ? html`<label class="simple-html-grid-value-row simple-html-grid-value-option simple-html-grid-value-text-search">
                              <input type="checkbox" .checked=${live(state.textSearch)} @change=${toggleTextSearch} />
                              <span class="simple-html-grid-value-text" @mouseenter=${showCutOffText}
                                  >${text('filter.values.textSearch', { text: state.searchInput.trim() })}</span
                              >
                          </label>`
                        : nothing
                }
                ${
                    data.enableAvailableOnlyOption
                        ? html`<label class="simple-html-grid-value-row simple-html-grid-value-option">
                              <input type="checkbox" .checked=${live(state.availableOnly)} @change=${toggleAvailableOnly} />
                              <span class="simple-html-grid-value-text">${text('filter.values.availableOnly')}</span>
                          </label>`
                        : nothing
                }
                <div class="simple-html-grid-value-info" aria-live="polite">${info}</div>
                <div class=${preview ? 'simple-html-grid-value-box simple-html-grid-value-preview' : 'simple-html-grid-value-box'}>
                    <label class="simple-html-grid-value-row simple-html-grid-value-all">
                        <input
                            type="checkbox"
                            .checked=${live(preview || allChecked)}
                            .indeterminate=${!preview && someChecked}
                            ?disabled=${preview || total === 0}
                            @change=${toggleAll}
                        />
                        <span class="simple-html-grid-value-text">${text('filter.values.selectAll')}</span>
                    </label>
                    <div class="simple-html-grid-value-scroll simple-html-dialog-scroller">${data.entries.map(valueRow)}</div>
                </div>
                <div class="simple-html-grid-value-buttons">
                    <button type="button" class="simple-html-grid-button" @click=${() => removeContextMenu(ctx)}>
                        ${text('filter.values.cancel')}
                    </button>
                    <button type="button" class="simple-html-grid-button simple-html-grid-button-primary" @click=${apply}>
                        ${text('filter.values.run')}
                    </button>
                </div>`,
            element
        );
    };

    reRender();
    return block;
}

/**
 * What an operator of the range block shows (rangeBlock): its symbol. Between has none, it shows its
 * name - the text of Operator ›'s Between
 */
const OPERATOR_SYMBOLS: Partial<Record<FilterOperator, string>> = {
    EQUAL: '=',
    NOT_EQUAL_TO: '≠',
    LESS_THAN: '<',
    LESS_THAN_OR_EQUAL_TO: '≤',
    GREATER_THAN: '>',
    GREATER_THAN_OR_EQUAL_TO: '≥'
};

/**
 * The range block of the filter menu of a number, date or datetime column (`filter.range`): its main
 * tool, where a text column has the value list. A row of the operators of Operator › - =, ≠, <, ≤, >, ≥
 * and Between, the one picked filled - an input for the value, two for Between (From and To, either can
 * be left empty: an open end), then Cancel and Apply. One block with an element of its own, which it
 * renders again when another operator is picked.
 *
 * It opens with what the header filter has: its operator, its value - a BETWEEN's `[from, to]` in From
 * and To. What is picked and typed is a draft, nothing is filtered until Apply (or Enter in the block).
 * Apply does what the header filter does when the operator is picked in Operator › and the value typed
 * in the cell: the operator, when it changed, is state with a `filter-operator-change` event; the value -
 * `from..to` for Between - goes to filterCallback as typed text, parsed with the header filter's formatter
 * (parseFilter: the field's, or the display format's when the column filters as shown - `2026-W47`, see
 * headerFilterFormatter.ts); the cell is rendered again and shows it. An input left empty is no filter
 * on the column, as an empty cell. The placeholder of an input is the formatter's (a date's format, an
 * example of the display format), else "Number".
 *
 * A quick date (datePresetBlock.ts) opens as its days - Between, From and To. Apply with nothing changed
 * leaves it as it is, relative; a date changed makes it those dates.
 *
 * A date or datetime column: a click in the input opens the grid's date picker, From or To of Between the
 * range picker - beside the input, the menu stays open (see openPicker in it). What is picked fills the
 * inputs, a draft as what is typed.
 *
 * The keyboard: Tab goes on from the menu's items into it (see itemKeydown in showMenu), Shift+Tab back.
 * The operators are radio buttons, one stop of Tab: the arrows move between them, as in any radio group.
 * Picked with the mouse, the focus goes on to the input: a click, the value, Enter. Enter in an input or
 * on an operator applies, as Apply does; Cancel (or Esc, a click outside) leaves the filter as it was.
 *
 * Not for a lookup column - it filters on its labels, as text (headerFilterType) - nor a boolean one, its
 * header filter is a checkbox: the block is not shown, nothing is rendered in it.
 * @param operators the column's operators of the header filter's input (headerOperators), in the type's order
 * @param current the operator the header filter uses (getHeaderFilterOperator), picked when it opens
 */
function rangeBlock(
    ctx: Grid,
    attribute: string,
    type: FieldType,
    operators: FilterOperator[],
    current: FilterOperator
): MenuBlock {
    const element = document.createElement('div');
    element.setAttribute('data-menu-id', 'filter.range');
    element.className = 'simple-html-grid-range';

    const shown = (type === 'number' || type === 'date' || type === 'datetime') && operators.length > 0;
    const block: MenuBlock = { type: 'block', id: 'filter.range', element, visible: () => shown };
    if (!shown) {
        return block;
    }

    const text = (id: TextId) => gridText(ctx, id);
    // the field's formatter, or the display format's when the column filters as shown (`2026-W47`)
    const formatter = headerFilterFormatter(ctx, attribute, ctx.gridInterface.__getGridConfig().columns[attribute]?.format);
    // what an empty input says to type: as an empty header filter, the formatter's placeholder - a date's
    // format - else the type's
    const placeholder = formatter.placeholder || (type === 'number' ? text('filter.placeholder.number') : '');
    // the radios of the operators are one group, and the ids of From and To: one per grid, the menu of
    // another grid can be open too
    const group = `${ctx.ariaIdPrefix}-range`;
    // each operator with its name - for a screen reader and the tooltip - and its symbol
    const choices = operators.flatMap((operator) => {
        const id = HEADER_OPERATOR_TEXTS[operator];
        return id ? [{ operator, name: text(id), symbol: OPERATOR_SYMBOLS[operator] }] : [];
    });

    /**
     * The draft: the operator picked and the text of the inputs - [value, ''] for one, [from, to] for
     * Between. From the header filter's value, as its cell shows it: a BETWEEN's ends one in each
     */
    const endText = (end: unknown) => (isBlank(end) ? '' : formatter.format(end));
    const value = ctx.gridInterface.__getHeaderFilter(attribute)?.value;
    const state = {
        operator: current,
        texts: Array.isArray(value) ? [endText(value[0]), endText(value[1])] : [endText(value), '']
    };
    // what it opened with: Apply with it unchanged keeps a quick date (This month) relative
    const opened = { operator: state.operator, texts: [...state.texts] };

    /**
     * One input for an operator that is not Between: the value is the first text, From when it has one,
     * else To - as the header filter takes a BETWEEN's first end for another operator (filterCallback)
     */
    const singleValue = () => {
        if (state.operator !== 'BETWEEN' && state.texts[0].trim() === '') {
            state.texts = [state.texts[1], ''];
        }
    };
    singleValue();

    /**
     * As if the operator was picked in Operator › and the value typed in the header filter, see the
     * function. Then the menu closes
     */
    const apply = () => {
        const [first, second] = state.texts.map((typed) => typed.trim());
        const untouched = state.operator === opened.operator && state.texts.every((typed, i) => typed === opened.texts[i]);
        if (untouched && activeDatePreset(ctx, attribute)) {
            removeContextMenu(ctx);
            return;
        }
        const changed = state.operator !== current;
        if (changed) {
            ctx.gridInterface.__setHeaderFilterOperator(attribute, state.operator);
        }
        // a BETWEEN as typed: from..to, an empty end is open, `..` no filter
        filterCallback(ctx, state.operator === 'BETWEEN' ? `${first}..${second}` : first, attribute);
        // the cell shows the value as if it was typed there, and the placeholder of the operator
        rebuildHeaderColumns(ctx);
        if (changed) {
            operatorPicked(ctx, attribute, state.operator);
        }
        removeContextMenu(ctx);
    };

    /**
     * The date picker open from an input of a date or datetime column: the function that closes it, null
     * while none is open
     */
    let closePicker: (() => void) | null = null;
    const pickerClosed = () => {
        closePicker = null;
    };

    /**
     * A click in an input of a date or datetime column opens the grid's date picker beside the menu's
     * input, the menu stays open (openDateInMenu): on the date the input holds, Use puts the date picked in
     * it - Clear empties it. From and To of Between open the range picker under them, on the two dates
     * they hold: Use puts From and To in them (a datetime's To at 23:59:59, the range is whole days).
     * Picking only fills the draft: Apply applies. A click in the input while the picker is open leaves
     * it as it is
     */
    const openPicker = (event: MouseEvent, index: number) => {
        if ((type !== 'date' && type !== 'datetime') || closePicker) {
            return;
        }
        const input = event.currentTarget as HTMLInputElement;
        if (state.operator === 'BETWEEN') {
            const ends = input.closest<HTMLElement>('.simple-html-grid-range-ends') ?? input;
            // weeks shown: from Monday of the first to Sunday of the last (pickerRange)
            const range: DateRange = pickerRange(ctx, attribute, [
                filterDate(formatter, state.texts[0]),
                filterDate(formatter, state.texts[1])
            ]);
            closePicker = openDateRangeInMenu(
                ctx,
                ends,
                range,
                (picked) => {
                    state.texts = rangeEndTexts(formatter, type, picked);
                    reRender();
                },
                pickerClosed
            );
            return;
        }
        closePicker = openDateInMenu(
            ctx,
            input,
            filterDate(formatter, state.texts[index]),
            (date) => {
                state.texts[index] = formatter.format(date);
                reRender();
            },
            pickerClosed
        );
    };

    /**
     * Another operator in the draft. Picked with the mouse (the last input was no key) the focus goes on
     * to the input: the arrows of the keyboard stay in the group. A date picker open from the input
     * before closes: it was for the inputs of the operator before
     */
    const pick = (operator: FilterOperator) => {
        closePicker?.();
        state.operator = operator;
        singleValue();
        reRender();
        if (!ctx.keyboardUsed) {
            element.querySelector<HTMLInputElement>('input[type="text"]')?.focus();
        }
    };

    // Enter in an input - a value, From, To or an operator's radio - applies. Not the Enter that ends the
    // composing of a character (an input method editor). The buttons are the browser's: Enter and Space
    // click them
    element.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.isComposing && event.target instanceof HTMLInputElement) {
            event.preventDefault();
            apply();
        }
    });
    // the names of the operators, shown when the pointer rests on them
    attachTooltips(element, () => tooltipsEnabled(ctx));

    const reRender = () => {
        /**
         * An input: the text of the draft at `index`, kept in it as it is typed
         * @param name its name for a screen reader, nothing when a label names it (From, To)
         * @param id for its label
         */
        const input = (index: number, name: string | typeof nothing, id: string | typeof nothing) =>
            html`<input
                class="simple-html-grid-range-input"
                type="text"
                id=${id}
                aria-label=${name}
                placeholder=${placeholder}
                .value=${live(state.texts[index])}
                @input=${(event: Event) => {
                    state.texts[index] = (event.target as HTMLInputElement).value;
                }}
                @click=${(event: MouseEvent) => openPicker(event, index)}
            />`;

        /**
         * An operator: a radio, invisible, in a label that is the button - its symbol, the tooltip its name
         * (Between shows its name, no tooltip). The one picked is checked
         */
        const operatorButton = (choice: (typeof choices)[number]) =>
            html`<label class="simple-html-grid-range-operator" data-tooltip=${choice.symbol ? choice.name : nothing}>
                <input
                    type="radio"
                    name=${group}
                    aria-label=${choice.name}
                    .checked=${live(choice.operator === state.operator)}
                    @change=${() => pick(choice.operator)}
                />
                <span aria-hidden="true">${choice.symbol ?? choice.name}</span>
            </label>`;

        const ends = html`<div class="simple-html-grid-range-ends">
            <label for=${`${group}-from`}>${text('filter.range.from')}</label>${input(0, nothing, `${group}-from`)}
            <label for=${`${group}-to`}>${text('filter.range.to')}</label>${input(1, nothing, `${group}-to`)}
        </div>`;

        render(
            html`<div class="simple-html-grid-range-operators" role="radiogroup" aria-label=${text('filter.operator')}>
                    ${choices.map(operatorButton)}
                </div>
                ${state.operator === 'BETWEEN' ? ends : input(0, text('filter.range.value'), nothing)}
                <div class="simple-html-grid-range-buttons">
                    <button type="button" class="simple-html-grid-button" @click=${() => removeContextMenu(ctx)}>
                        ${text('filter.range.cancel')}
                    </button>
                    <button type="button" class="simple-html-grid-button simple-html-grid-button-primary" @click=${apply}>
                        ${text('filter.range.run')}
                    </button>
                </div>`,
            element
        );
    };

    reRender();
    return block;
}

/**
 * The whole text of a value as its tooltip, when it is cut off (an ellipsis): the pointer entering it
 */
function showCutOffText(event: MouseEvent) {
    const span = event.currentTarget as HTMLElement;
    span.title = span.scrollWidth > span.clientWidth ? (span.textContent ?? '') : '';
}

/**
 * set blank or not blank filter: replaces the column's conditions, everything else is kept
 */
function setBlankOrNotBlank(ctx: Grid, attribute: string, operator: 'IS_BLANK' | 'IS_NOT_BLANK') {
    const datasource = ctx.gridInterface.getDatasource();
    const rest = withoutField(datasource.getFilter(), attribute);
    const blankCondition = where(attribute, operator);

    ctx.gridInterface.__setHeaderFilterValue(attribute, null);

    if (rest && isFilterGroup(rest) && rest.group !== 'OR') {
        // an AND root (anything but OR is AND, as the filter runs it): one more condition in it
        datasource.setFilter(and(...rest.children, blankCondition));
    } else if (rest && (!isFilterGroup(rest) || rest.children.length)) {
        // an OR root, or a single condition on another column. Pushed into an OR group the
        // condition would widen the filter instead of narrowing it, so it is kept whole and ANDed
        datasource.setFilter(and(blankCondition, rest));
    } else {
        datasource.setFilter(and(blankCondition));
    }

    // the header input still showed the text filter that was just replaced
    rebuildHeaderColumns(ctx);
    datasource.filter();
}

/**
 * clear current column filter
 */
function clearColumnFilter(ctx: Grid, attribute: string) {
    const datasource = ctx.gridInterface.getDatasource();
    ctx.gridInterface.__setHeaderFilterValue(attribute, null);

    datasource.setFilter(withoutField(datasource.getFilter(), attribute));
    rebuildHeaderColumns(ctx);
    datasource.filter();
}

/**
 * A copy of the filter without any condition on `field`, in nested groups too. Groups are kept, also
 * when that leaves them empty (the filter ignores those). null when the filter is null or a single
 * condition on `field`.
 */
function withoutField(filter: FilterExpression | null, field: string): FilterExpression | null {
    if (!filter) {
        return null;
    }
    if (!isFilterGroup(filter)) {
        return filter.field === field ? null : filter;
    }
    const children: FilterExpression[] = [];
    for (const child of filter.children) {
        const kept = withoutField(child, field);
        if (kept) {
            children.push(kept);
        }
    }
    return { group: filter.group, children };
}

/**
 * "Match case" of a column's header filter, a toggle with a check mark - the filter menu's Filter › and
 * the operator choice of the header (filterOperatorIndicator.ts) have it. For a text column (a lookup
 * column too). On and greyed out when the column always matches case (`filterCaseSensitive`), with the
 * hint "always"
 */
export function matchCaseItem(ctx: Grid, attribute: string): MenuItem {
    const type = headerFilterType(ctx.gridInterface, attribute);
    const always = isAlwaysCaseSensitive(ctx.gridInterface.__getGridConfig().columns[attribute], type);
    const on = isHeaderFilterCaseSensitive(ctx, attribute);
    return {
        id: 'filter.matchCase',
        label: gridText(ctx, 'filter.matchCase'),
        hint: always ? gridText(ctx, 'filter.matchCase.hint') : undefined,
        visible: () => type === 'text',
        selected: () => on,
        disabled: () => always,
        action: () => setHeaderFilterCaseSensitive(ctx, attribute, !on)
    };
}

/**
 * "Match case" of a column's header filter on or off: state (`GridState.headerFilters[field].caseSensitive`),
 * and the filter runs again with it - as picking an operator does. The header shows it (Aa beside the
 * operator). Nothing on a column that always matches case
 */
export function setHeaderFilterCaseSensitive(ctx: Grid, attribute: string, on: boolean) {
    const type = headerFilterType(ctx.gridInterface, attribute);
    if (isAlwaysCaseSensitive(ctx.gridInterface.__getGridConfig().columns[attribute], type)) {
        return;
    }
    ctx.gridInterface.__setHeaderFilterCaseSensitive(attribute, on);
    filterCallback(ctx, ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? null, attribute);
    // the header shows it: Aa beside the operator
    rebuildHeaderColumns(ctx);
}
