import { html, nothing, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { and, type FilterExpression, type FilterOperator, isFilterGroup, where } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuBlock, MenuContext, MenuEntry, MenuItem } from '../gridMenus';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import type { ColType } from './colType';
import { columnOperators, headerFilterType, isAlwaysCaseSensitive, isHeaderOperator } from './columnFilterOptions';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData, type ValueListEntry } from './dropDownFilterData';
import { filterCallback } from './filterCallback';
import { getHeaderFilterOperator, isHeaderFilterCaseSensitive } from './getHeaderFilterOperator';
import { gridText } from './gridText';
import type { HTMLCellElement } from './HTMLCellElement';
import { openFilterEditor } from './openFilterEditor';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { placeUnderCell, showMenu } from './showMenu';

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
 * The text of each operator of the header filter's Operator ›, its id in MENU_IDS.filter too, in the
 * order of the menu. The operators the header filter's input takes (isHeaderOperator)
 */
const OPERATOR_TEXTS: Partial<Record<FilterOperator, TextId>> = {
    EQUAL: 'filter.operator.equal',
    NOT_EQUAL_TO: 'filter.operator.notEqualTo',
    LESS_THAN: 'filter.operator.lessThan',
    LESS_THAN_OR_EQUAL_TO: 'filter.operator.lessThanOrEqualTo',
    GREATER_THAN: 'filter.operator.greaterThan',
    GREATER_THAN_OR_EQUAL_TO: 'filter.operator.greaterThanOrEqualTo',
    BETWEEN: 'filter.operator.between',
    CONTAINS: 'filter.operator.contains',
    DOES_NOT_CONTAIN: 'filter.operator.doesNotContain',
    BEGIN_WITH: 'filter.operator.beginWith',
    END_WITH: 'filter.operator.endWith'
};

/**
 * The filter menu's default entries, new objects every call: the submenu Filter (`filter.filter`) -
 * the submenu operator, "Match case", the submenu blank, clear, clear all, a line, the filter editor -
 * then the value list, the main tool, not in a submenu. The entries kept the ids they had before they
 * were in Filter. The ids are documented in MENU_IDS.filter.
 *
 * What it offers are the column's operators (columnOperators: the type's, or its `filterOperators`):
 * Operator › those the header filter's input takes, Blank › IS_BLANK / IS_NOT_BLANK, the value list IN
 * (and NOT_IN when it has it)
 */
function filterMenuEntries(ctx: Grid, attribute: string): MenuEntry[] {
    // a lookup column filters on its labels: the operators of a text (filterCallback)
    const type = headerFilterType(ctx.gridInterface, attribute);
    const column = ctx.gridInterface.__getGridConfig().columns[attribute];
    const offered = columnOperators(column, type);

    // the operator picked before (state), else the column's, else the type's default
    const current = getHeaderFilterOperator(ctx, attribute);
    // "Match case": always for a filterCaseSensitive column, the toggle can not turn it off
    const caseSensitive = isHeaderFilterCaseSensitive(ctx, attribute);
    const alwaysCaseSensitive = isAlwaysCaseSensitive(column, type);

    /**
     * the operator picked is state, the filter runs again with the value the cell has
     */
    const setOperator = (picked: FilterOperator) => {
        ctx.gridInterface.__setHeaderFilterOperator(attribute, picked);
        filterCallback(ctx, ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? null, attribute);
        // the cell shows its value for the operator (a BETWEEN's from..to) and its placeholder
        rebuildHeaderColumns(ctx);
        ctx.gridInterface.__callSubscribers('filter-operator-change', {
            field: attribute,
            operator: picked,
            column: ctx.gridInterface.__getGridConfig().columns[attribute],
            rebuildHeader: () => rebuildHeaderColumns(ctx)
        });
    };

    /**
     * "Match case" is state too, the filter runs again with it: as picking an operator does
     */
    const setCaseSensitive = () => {
        ctx.gridInterface.__setHeaderFilterCaseSensitive(attribute, !caseSensitive);
        filterCallback(ctx, ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? null, attribute);
    };

    const text = (id: TextId) => gridText(ctx, id);

    // every one of them, shown when the column offers it - not on a boolean column: its header filter is
    // a checkbox. The id of the entry is the id of its text
    const operatorItems = Object.entries(OPERATOR_TEXTS).map(
        ([operator, id]): MenuItem => ({
            id,
            label: text(id),
            visible: () => type !== 'boolean' && offered.some((op) => op === operator && isHeaderOperator(op)),
            selected: () => current === operator,
            action: () => setOperator(operator as FilterOperator)
        })
    );

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
                {
                    // a toggle with a check mark, for a text column. On and greyed out when the column
                    // always matches case (filterCaseSensitive), with the hint "always"
                    id: 'filter.matchCase',
                    label: text('filter.matchCase'),
                    hint: alwaysCaseSensitive ? text('filter.matchCase.hint') : undefined,
                    visible: () => type === 'text',
                    selected: () => caseSensitive,
                    disabled: () => alwaysCaseSensitive,
                    action: setCaseSensitive
                },
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
        valueListBlock(ctx, attribute, offered)
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
        data: dropDownFilterData(ctx, attribute, true, '')
    };

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
                <input type="checkbox" .checked=${live(data.checked.has(entry))} @change=${() => toggleValue(entry)} />
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
                    data.enableAvailableOnlyOption
                        ? html`<label class="simple-html-grid-value-row simple-html-grid-value-option">
                              <input type="checkbox" .checked=${live(state.availableOnly)} @change=${toggleAvailableOnly} />
                              <span class="simple-html-grid-value-text">${text('filter.values.availableOnly')}</span>
                          </label>`
                        : nothing
                }
                <div class="simple-html-grid-value-info" aria-live="polite">${info}</div>
                <div class="simple-html-grid-value-box">
                    <label class="simple-html-grid-value-row simple-html-grid-value-all">
                        <input
                            type="checkbox"
                            .checked=${live(allChecked)}
                            .indeterminate=${someChecked}
                            ?disabled=${total === 0}
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
