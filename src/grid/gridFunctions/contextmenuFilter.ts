import { html, nothing, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity, GroupRow } from '../../datasource/entity';
import { and, type FilterExpression, type FilterOperator, isFilterGroup, where } from '../../datasource/filterExpression';
import type { TextId } from '../../texts';
import type { Grid } from '../grid';
import type { MenuBlock, MenuContext, MenuEntry, MenuItem } from '../gridMenus';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import type { ColType } from './colType';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData } from './dropDownFilterData';
import { filterCallback } from './filterCallback';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
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
    attribute: string,
    // the first displayed row, not the header's: a group row when grouped, undefined when there are no rows
    rowData: Entity | GroupRow | undefined
) {
    const context: MenuContext = {
        menu: 'filter',
        field: attribute,
        row: rowData,
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
 * the submenus operator and blank, clear, clear all, a line, the filter editor - then the value list,
 * the main tool, not in a submenu. The entries kept the ids they had before they were in Filter. The
 * ids are documented in MENU_IDS.filter
 */
function filterMenuEntries(ctx: Grid, attribute: string): MenuEntry[] {
    // a lookup column filters on its labels: the operators of a text (filterCallback)
    const type = ctx.gridInterface.__getLookupColumn(attribute)
        ? 'text'
        : ctx.gridInterface.getDatasource().getField(attribute).type;

    // the operator picked before (state), else the column's, else the type's default
    const current = getHeaderFilterOperator(ctx, attribute);

    /**
     * the operator picked is state, the filter runs again with the value the cell has
     */
    const setOperator = (picked: FilterOperator) => {
        ctx.gridInterface.__setHeaderFilterOperator(attribute, picked);
        filterCallback(ctx, ctx.gridInterface.__getHeaderFilter(attribute)?.value ?? null, attribute);
        ctx.gridInterface.__callSubscribers('filter-operator-change', {
            field: attribute,
            operator: picked,
            column: ctx.gridInterface.__getGridConfig().columns[attribute],
            rebuildHeader: () => rebuildHeaderColumns(ctx)
        });
    };

    // a boolean column has no operators to choose from. Number and date columns have the range ones,
    // text columns not equal and contains
    const hasOperators = () => type !== 'boolean';
    const isRange = () => type === 'date' || type === 'datetime' || type === 'number';
    const isText = () => type !== 'boolean' && !isRange();

    const text = (id: TextId) => gridText(ctx, id);

    // the id of the entry is the id of its text
    const operatorItem = (id: TextId, operator: FilterOperator, visible: () => boolean): MenuItem => ({
        id,
        label: text(id),
        visible,
        selected: () => current === operator,
        action: () => setOperator(operator)
    });

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
                    visible: hasOperators,
                    // the operator in use has a check mark
                    entries: [
                        operatorItem('filter.operator.greaterThanOrEqualTo', 'GREATER_THAN_OR_EQUAL_TO', isRange),
                        operatorItem('filter.operator.lessThanOrEqualTo', 'LESS_THAN_OR_EQUAL_TO', isRange),
                        operatorItem('filter.operator.equal', 'EQUAL', hasOperators),
                        operatorItem('filter.operator.notEqualTo', 'NOT_EQUAL_TO', isText),
                        operatorItem('filter.operator.contains', 'CONTAINS', isText)
                    ]
                },
                {
                    type: 'submenu',
                    id: 'filter.filter.blank',
                    label: text('filter.filter.blank'),
                    entries: [
                        {
                            id: 'filter.filter.isBlank',
                            label: text('filter.filter.isBlank'),
                            action: () => setBlankOrNotBlank(ctx, attribute, 'IS_BLANK')
                        },
                        {
                            id: 'filter.filter.isNotBlank',
                            label: text('filter.filter.isNotBlank'),
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
        valueListBlock(ctx, attribute)
    ];
}

/**
 * The excel style value list, the main tool of the filter menu: a search box, a checkbox per value
 * with its number of rows, "Select all" over them, then Cancel and Apply. One block (`filter.values`)
 * with an element of its own, which it renders again as the user checks values and types. Only for a
 * text field, dropDownFilterData gives null for the rest.
 *
 * Nothing is filtered until Apply: the checkboxes are a draft, Cancel (or Esc, a click outside)
 * leaves the filter as it was.
 *
 * The keyboard: Tab goes on from the menu's items into it (see itemKeydown in showMenu) - the search
 * box, the checkboxes, Cancel, Apply. ArrowDown / ArrowUp move between the search box and the
 * checkboxes, Space checks one, Enter in the search box or on a checkbox applies, as Apply does.
 */
function valueListBlock(ctx: Grid, attribute: string): MenuBlock {
    const element = document.createElement('div');
    element.setAttribute('data-menu-id', 'filter.values');
    element.className = 'simple-html-grid-value-list';

    const state = {
        searchInput: '',
        availableOnly: true,
        data: dropDownFilterData(ctx, attribute, true, '')
    };

    const block: MenuBlock = { type: 'block', id: 'filter.values', element, visible: () => state.data !== null };
    const text = (id: TextId, values?: Record<string, unknown>) => gridText(ctx, id, values);

    /**
     * filters the column on the checked values: an IN with them, or a NOT_IN with the unchecked ones
     * when there are fewer of those (none unchecked: no list). The search text is a CONTAINS too, see
     * filterCallback. Then the menu closes
     */
    const apply = () => {
        const data = state.data;
        if (!data) {
            return;
        }
        const unchecked = Array.from(data.dataFilterSetFull).filter((value) => !data.dataFilterSet.has(value));
        const search = state.searchInput || null;
        if (unchecked.length < data.dataFilterSet.size) {
            filterCallback(ctx, null, attribute, unchecked.length ? unchecked : null, search, unchecked.length > 0);
        } else {
            filterCallback(ctx, null, attribute, data.dataFilterSet.size ? Array.from(data.dataFilterSet) : null, search, false);
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

        const total = data.dataFilterSetFull.size;
        const checked = data.dataFilterSet.size;
        // "Select all" is checked when every value is, mixed (indeterminate) when some are
        const allChecked = total > 0 && checked === total;
        const someChecked = checked > 0 && checked < total;

        const toggleValue = (value: unknown) => {
            if (data.dataFilterSet.has(value)) {
                data.dataFilterSet.delete(value);
            } else {
                data.dataFilterSet.add(value);
            }
            reRender();
        };

        // all checked: none. Some or none: all, as a mixed checkbox goes
        const toggleAll = () => {
            data.dataFilterSet = allChecked ? new Set() : new Set(data.dataFilterSetFull);
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
         * A value: its checkbox, the value - cut off with an ellipsis when it is too long, the whole
         * value as its tooltip then - and its number of rows on the right. The label around them makes
         * the whole row a click on the checkbox, and is the checkbox's name. The counts are only shown
         * when the list is complete: with values dropped (the DROPDOWN_FILTER_MAX_ROWS cap) they would
         * mislead
         */
        const valueRow = (value: unknown) => {
            const count = data.truncated ? undefined : data.counts.get(value);
            const blank = value === 'NULL';
            return html`<label class="simple-html-grid-value-row">
                <input type="checkbox" .checked=${live(data.dataFilterSet.has(value))} @change=${() => toggleValue(value)} />
                <span
                    class=${blank ? 'simple-html-grid-value-text simple-html-grid-value-blank' : 'simple-html-grid-value-text'}
                    @mouseenter=${showCutOffText}
                    >${blank ? text('filter.values.blank') : value}</span
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
                    <div class="simple-html-grid-value-scroll simple-html-dialog-scroller">
                        ${Array.from(data.dataFilterSetFull, valueRow)}
                    </div>
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
