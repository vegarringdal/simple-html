import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import type { Entity, GroupRow } from '../../datasource/entity';
import { and, type FilterExpression, type FilterOperator, isFilterGroup, where } from '../../datasource/filterExpression';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { clearAllColumnFilters } from './clearAllColumnFilters';
import type { ColType } from './colType';
import { createElement } from './createElement';
import { DROPDOWN_FILTER_MAX_ROWS, dropDownFilterData } from './dropDownFilterData';
import { filterCallback } from './filterCallback';
import { getHeaderFilterOperator } from './getHeaderFilterOperator';
import type { HTMLCellElement } from './HTMLCellElement';
import { openFilterEditor } from './openFilterEditor';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';

export function contextmenuFilter(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    _row: number,
    _column: number,
    _celno: number,
    _colType: ColType,
    _cellType: string,
    attribute: string,
    // the first displayed row, not the header's: a group row when grouped, undefined when there are no rows
    _rowData: Entity | GroupRow | undefined
) {
    removeContextMenu(ctx);

    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(event.clientX - 65);
    contextMenu.style.minWidth = asPx(130);

    if (event.clientX + 70 > window.innerWidth) {
        contextMenu.style.left = asPx(window.innerWidth - 150);
    }
    if (event.clientX - 65 < 0) {
        contextMenu.style.left = asPx(5);
    }

    const context = {
        searchInput: '',
        availableOnly: true,
        selectAll: true,
        data: dropDownFilterData(ctx, attribute, true, '')
    };

    /**
     * helper to get context, if we do not do it like ctx we risk getting another state
     * @returns
     */
    function getContext() {
        return context;
    }

    /**
     * template for bottom excel like filter
     * @param reRender
     * @returns
     */
    const searchTemplate = (reRender: () => void) => {
        if (!getContext().data) {
            return null;
        }

        /**
         * data is only null when the column is not a text column (see dropDownFilterData), so it
         * stays set for everything below
         */
        const getData = () => getContext().data!;

        /**
         * update grid with new result
         */
        const runFilterClick = () => {
            const intersection = Array.from(getData().dataFilterSetFull).filter((x) => !getData().dataFilterSet.has(x));

            if (intersection.length < getData().dataFilterSet.size) {
                // if full we want to use NOT in
                filterCallback(
                    ctx,
                    null,
                    attribute,
                    intersection.length ? intersection : null,
                    getContext().searchInput ? getContext().searchInput : null,
                    !!intersection.length
                );
            } else {
                filterCallback(
                    ctx,
                    null,
                    attribute,
                    getData().dataFilterSet.size ? Array.from(getData().dataFilterSet) : null,
                    getContext().searchInput ? getContext().searchInput : null,
                    false
                );
            }

            removeContextMenu(ctx);
        };

        /**
         * items found
         * @returns
         */
        const filterValues = () => {
            const filterValueClick = (rowData: any) => {
                getContext().selectAll = false;
                if (getData().dataFilterSet.has(rowData)) {
                    getData().dataFilterSet.delete(rowData);
                } else {
                    getData().dataFilterSet.add(rowData);
                }
                getContext().selectAll =
                    getData().dataFilterSetFull.size === getData().dataFilterSet.size && !getContext().availableOnly;
                reRender();
            };
            /**
             * row count per value, in parentheses.
             * Only shown when the list is complete - if values were dropped because of the
             * DROPDOWN_FILTER_MAX_ROWS cap the counts would be misleading.
             */
            const countFor = (rowData: any) => {
                if (getData().truncated) {
                    return '';
                }
                const count = getData().counts?.get(rowData);
                return count ? ` (${count})` : '';
            };

            return Array.from(getData().dataFilterSetFull).map((rowData: any) => {
                return html`<div class="simple-html-grid-menu-checkbox">
                    <input
                        type="checkbox"
                        .checked=${live(getData().dataFilterSet.has(rowData))}
                        @click=${() => {
                            filterValueClick(rowData);
                        }}
                    /><label
                        @click=${() => {
                            filterValueClick(rowData);
                        }}
                    >
                        ${rowData === 'NULL' ? 'Blank' : rowData}${countFor(rowData)}</label
                    >
                </div>`;
            });
        };

        /**
         * top checkbox - available
         * will show only column filtered
         */
        const availableCheckbox = () => {
            if (!getData().enableAvailableOnlyOption) {
                return null;
            }

            const handleEvent = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                getContext().availableOnly = !getContext().availableOnly;
                getContext().selectAll =
                    getData().dataFilterSetFull.size === getData().dataFilterSet.size && !getContext().availableOnly;
                getContext().data = dropDownFilterData(ctx, attribute, getContext().availableOnly, getContext().searchInput);
                reRender();
            };

            return html` <div style="padding:2px">
                <input
                    style="padding:2px"
                    type="checkbox"
                    .checked=${live(getContext().availableOnly)}
                    @click=${(e: MouseEvent) => handleEvent(e)}
                /><label style="padding:2px" @click=${(e: MouseEvent) => handleEvent(e)}>Filter Available</label>
            </div>`;
        };

        /**
         * container, ncluding select all button
         */
        const listContainerTemplate = () => {
            const clickHandler = () => {
                getContext().selectAll = !getContext().selectAll;
                if (getContext().selectAll) {
                    getData().dataFilterSet = new Set(getData().dataFilterSetFull);
                } else {
                    getData().dataFilterSet = new Set();
                }
                reRender();
            };

            // if we have more then DROPDOWN_FILTER_MAX_ROWS we display warning
            // since we only display first DROPDOWN_FILTER_MAX_ROWS row
            return html` <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                ${
                    getData().truncated
                        ? html`<div class="max-row-info-warning">Showing only first ${DROPDOWN_FILTER_MAX_ROWS}  !</div>`
                        : html`<div class="max-row-info">${getData().dataFilterSetFull.size} rows found</div>`
                }
                <div class="simple-html-grid-menu-checkbox">
                    <input type="checkbox" .checked=${live(getContext().selectAll)} @click=${() => clickHandler()} /><label
                        @click=${() => clickHandler()}
                        >Select All</label
                    >
                </div>

                ${filterValues()}
            </div>`;
        };

        /**
         * input field
         */
        const inputTemplate = () => {
            const clickHandler = (e: any) => {
                getContext().searchInput = e.target.value || null;
                getContext().data = dropDownFilterData(ctx, attribute, getContext().availableOnly, getContext().searchInput);
                reRender();
            };

            return html` <input
                class="simple-html-grid-menu-item-input"
                style="border:1px solid transparent; width: 100%; margin:0"
                @focus=${(e: any) => {
                    e.target.style.border = '';
                }}
                @blur=${(e: any) => {
                    e.target.style.border = '1px solid transparent';
                }}
                placeholder="type to search"
                .value=${getContext().searchInput}
                @input=${(e: EventTarget) => clickHandler(e)}
            />`;
        };

        return html` <div class="simple-html-grid-menu-section">Search:</div>
            <hr class="hr-solid" />
            ${availableCheckbox()} ${inputTemplate()} ${listContainerTemplate()}
            <div
                class="simple-html-label-button-menu-bottom"
                @click=${() => {
                    runFilterClick();
                }}
            >
                Run Search
            </div>`;
    };

    /**
     * inner render so its easier to rerender when excel filter changes
     */
    const innerRender = () => {
        const type = ctx.gridInterface.getDatasource().getField(attribute).type;

        const selected = 'simple-html-grid-menu-item simple-html-grid-menu-item-selected';
        const notSelected = 'simple-html-grid-menu-item';

        // the operator picked before (state), else the column's, else the type's default
        const operator = getHeaderFilterOperator(ctx, attribute);

        const filterTemplate = () => {
            // a boolean column has no operators to choose from
            if (type === 'boolean') {
                return null;
            }

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

            if (type === 'date' || type === 'datetime' || type === 'number') {
                return html` <div class="simple-html-grid-menu-section">Set Operator:</div>
                    <hr class="hr-solid" />
                    <div
                        class=${operator === 'GREATER_THAN_OR_EQUAL_TO' ? selected : notSelected}
                        @click=${() => {
                            setOperator('GREATER_THAN_OR_EQUAL_TO');
                            removeContextMenu(ctx);
                        }}
                    >
                        Greater than or equal
                    </div>
                    <div
                        class=${operator === 'LESS_THAN_OR_EQUAL_TO' ? selected : notSelected}
                        @click=${() => {
                            setOperator('LESS_THAN_OR_EQUAL_TO');
                            removeContextMenu(ctx);
                        }}
                    >
                        Less than or equal
                    </div>
                    <div
                        class=${operator === 'EQUAL' ? selected : notSelected}
                        @click=${() => {
                            setOperator('EQUAL');
                            removeContextMenu(ctx);
                        }}
                    >
                        Equal
                    </div>`;
            }

            return html`
                <div class="simple-html-grid-menu-section">Set Operator:</div>
                <hr class="hr-solid" />
                <div
                    class=${operator === 'EQUAL' ? selected : notSelected}
                    @click=${() => {
                        setOperator('EQUAL');
                        removeContextMenu(ctx);
                    }}
                >
                    Equal
                </div>
                <div
                    class=${operator === 'NOT_EQUAL_TO' ? selected : notSelected}
                    @click=${() => {
                        setOperator('NOT_EQUAL_TO');
                        removeContextMenu(ctx);
                    }}
                >
                    Not Equal
                </div>
                <div
                    class=${operator === 'CONTAINS' ? selected : notSelected}
                    @click=${() => {
                        setOperator('CONTAINS');
                        removeContextMenu(ctx);
                    }}
                >
                    Contains
                </div>
            `;
        };

        /**
         * set blank or not blank filter: replaces the column's conditions, everything else is kept
         */
        const setBlankOrNotBlank = (operator: 'IS_BLANK' | 'IS_NOT_BLANK') => {
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
        };

        /**
         * clear current column filter
         */
        const clearColumnFilter = () => {
            const datasource = ctx.gridInterface.getDatasource();
            ctx.gridInterface.__setHeaderFilterValue(attribute, null);

            datasource.setFilter(withoutField(datasource.getFilter(), attribute));
            rebuildHeaderColumns(ctx);
            datasource.filter();
        };

        render(
            html`<div class="simple-html-grid-menu">
                <div class="simple-html-grid-menu-section">Filter:</div>
                <hr class="hr-solid" />
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        clearColumnFilter();
                        removeContextMenu(ctx);
                    }}
                >
                    Clear Filter
                </div>
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        clearAllColumnFilters(ctx);
                        removeContextMenu(ctx);
                    }}
                >
                    Clear All Filters
                </div>
                <hr class="hr-dashed" />
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        setBlankOrNotBlank('IS_BLANK');
                        removeContextMenu(ctx);
                    }}
                >
                    Set "Is Blank"
                </div>
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        setBlankOrNotBlank('IS_NOT_BLANK');
                        removeContextMenu(ctx);
                    }}
                >
                    Set "Is Not Blank"
                </div>
                <hr class="hr-dashed" />

                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        openFilterEditor(ctx);
                    }}
                >
                    Advanced Filter
                </div>
                ${filterTemplate()}
                ${searchTemplate(() => {
                    innerRender();
                })}
            </div>`,
            contextMenu
        );
    };
    innerRender();

    document.body.appendChild(contextMenu);
    ctx.contextMenu = contextMenu;
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
