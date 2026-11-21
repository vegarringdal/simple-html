import { html, render } from 'lit-html';
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
 * The filter menu's default entries, new objects every call: clear, the submenus blank and operator,
 * the filter editor, then the value list - the main tool, not in a submenu. The ids are documented in
 * MENU_IDS.filter
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
        { id: 'filter.filter.clear', label: text('filter.filter.clear'), action: () => clearColumnFilter(ctx, attribute) },
        { id: 'filter.filter.clearAll', label: text('filter.filter.clearAll'), action: () => clearAllColumnFilters(ctx) },
        { type: 'separator', id: 'filter.filter.blankSeparator' },
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
        { type: 'separator', id: 'filter.filter.advancedSeparator' },
        { id: 'filter.filter.advanced', label: text('filter.filter.advanced'), action: () => openFilterEditor(ctx) },
        valueListBlock(ctx, attribute)
    ];
}

/**
 * The excel style value list: "Search:", a search box, a checkbox per value and "Run Search". One
 * block (`filter.values`) with an element of its own, which it renders again as the user checks values
 * and types. Only for a text field, dropDownFilterData gives null for the rest.
 */
function valueListBlock(ctx: Grid, attribute: string): MenuBlock {
    const element = document.createElement('div');
    element.setAttribute('data-menu-id', 'filter.values');
    // its parts are laid out as they were when they were entries of the menu itself (a flex column)
    element.style.display = 'flex';
    element.style.flexDirection = 'column';

    const state = {
        searchInput: '' as string | null,
        availableOnly: true,
        selectAll: true,
        data: dropDownFilterData(ctx, attribute, true, '')
    };

    const block: MenuBlock = { type: 'block', id: 'filter.values', element, visible: () => state.data !== null };

    const reRender = () => {
        const data = state.data;
        if (!data) {
            return;
        }

        /**
         * update grid with new result
         */
        const runFilterClick = () => {
            const intersection = Array.from(data.dataFilterSetFull).filter((x) => !data.dataFilterSet.has(x));

            if (intersection.length < data.dataFilterSet.size) {
                // if full we want to use NOT in
                filterCallback(
                    ctx,
                    null,
                    attribute,
                    intersection.length ? intersection : null,
                    state.searchInput ? state.searchInput : null,
                    !!intersection.length
                );
            } else {
                filterCallback(
                    ctx,
                    null,
                    attribute,
                    data.dataFilterSet.size ? Array.from(data.dataFilterSet) : null,
                    state.searchInput ? state.searchInput : null,
                    false
                );
            }

            removeContextMenu(ctx);
        };

        /**
         * items found
         */
        const filterValues = () => {
            const filterValueClick = (value: unknown) => {
                state.selectAll = false;
                if (data.dataFilterSet.has(value)) {
                    data.dataFilterSet.delete(value);
                } else {
                    data.dataFilterSet.add(value);
                }
                state.selectAll = data.dataFilterSetFull.size === data.dataFilterSet.size && !state.availableOnly;
                reRender();
            };
            /**
             * row count per value, in parentheses.
             * Only shown when the list is complete - if values were dropped because of the
             * DROPDOWN_FILTER_MAX_ROWS cap the counts would be misleading.
             */
            const countFor = (value: unknown) => {
                if (data.truncated) {
                    return '';
                }
                const count = data.counts?.get(value);
                return count ? ` (${count})` : '';
            };

            return Array.from(data.dataFilterSetFull).map((value) => {
                return html`<div class="simple-html-grid-menu-checkbox">
                    <input
                        type="checkbox"
                        .checked=${live(data.dataFilterSet.has(value))}
                        @click=${() => {
                            filterValueClick(value);
                        }}
                    /><label
                        @click=${() => {
                            filterValueClick(value);
                        }}
                    >
                        ${value === 'NULL' ? gridText(ctx, 'filter.values.blank') : value}${countFor(value)}</label
                    >
                </div>`;
            });
        };

        /**
         * top checkbox - available
         * will show only column filtered
         */
        const availableCheckbox = () => {
            if (!data.enableAvailableOnlyOption) {
                return null;
            }

            const handleEvent = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                state.availableOnly = !state.availableOnly;
                state.selectAll = data.dataFilterSetFull.size === data.dataFilterSet.size && !state.availableOnly;
                state.data = dropDownFilterData(ctx, attribute, state.availableOnly, state.searchInput);
                reRender();
            };

            return html` <div style="padding:2px">
                <input
                    style="padding:2px"
                    type="checkbox"
                    .checked=${live(state.availableOnly)}
                    @click=${(e: MouseEvent) => handleEvent(e)}
                /><label style="padding:2px" @click=${(e: MouseEvent) => handleEvent(e)}
                    >${gridText(ctx, 'filter.values.availableOnly')}</label
                >
            </div>`;
        };

        /**
         * container, ncluding select all button
         */
        const listContainerTemplate = () => {
            const clickHandler = () => {
                state.selectAll = !state.selectAll;
                if (state.selectAll) {
                    data.dataFilterSet = new Set(data.dataFilterSetFull);
                } else {
                    data.dataFilterSet = new Set();
                }
                reRender();
            };

            // if we have more then DROPDOWN_FILTER_MAX_ROWS we display warning
            // since we only display first DROPDOWN_FILTER_MAX_ROWS row
            return html` <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${
                    data.truncated
                        ? html`<div class="max-row-info-warning">
                              ${gridText(ctx, 'filter.values.truncated', { max: DROPDOWN_FILTER_MAX_ROWS })}
                          </div>`
                        : html`<div class="max-row-info">
                              ${gridText(ctx, 'filter.values.rowsFound', { count: data.dataFilterSetFull.size })}
                          </div>`
                }
                <div class="simple-html-grid-menu-checkbox">
                    <input type="checkbox" .checked=${live(state.selectAll)} @click=${() => clickHandler()} /><label
                        @click=${() => clickHandler()}
                        >${gridText(ctx, 'filter.values.selectAll')}</label
                    >
                </div>

                ${filterValues()}
            </div>`;
        };

        /**
         * input field
         */
        const inputTemplate = () => {
            const inputHandler = (e: Event) => {
                state.searchInput = (e.target as HTMLInputElement).value || null;
                state.data = dropDownFilterData(ctx, attribute, state.availableOnly, state.searchInput);
                reRender();
            };

            return html` <input
                class="simple-html-grid-menu-item-input"
                style="border:1px solid transparent; width: 100%; margin:0"
                @focus=${(e: FocusEvent) => {
                    (e.target as HTMLInputElement).style.border = '';
                }}
                @blur=${(e: FocusEvent) => {
                    (e.target as HTMLInputElement).style.border = '1px solid transparent';
                }}
                placeholder=${gridText(ctx, 'filter.values.searchPlaceholder')}
                .value=${state.searchInput}
                @input=${(e: Event) => inputHandler(e)}
            />`;
        };

        render(
            html` <div class="simple-html-grid-menu-section">${gridText(ctx, 'filter.values.search')}</div>
                <hr class="hr-solid" />
                ${availableCheckbox()} ${inputTemplate()} ${listContainerTemplate()}
                <div
                    class="simple-html-label-button-menu-bottom"
                    role="button"
                    tabindex="0"
                    @click=${() => {
                        runFilterClick();
                    }}
                    @keydown=${(event: KeyboardEvent) => {
                        // a button for the keyboard too: Tab gets to it from the checkboxes
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            runFilterClick();
                        }
                    }}
                >
                    ${gridText(ctx, 'filter.values.run')}
                </div>`,
            element
        );
    };

    reRender();
    return block;
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
