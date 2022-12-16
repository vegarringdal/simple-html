import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { FilterArgument } from '../../datasource/filterArgument';
import { Entity } from "../../datasource/Entity";
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { dropDownFilterData } from './dropDownFilterData';
import { filterCallback } from './filterCallback';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './ColType';
import { openFilterEditor } from './openFilterEditor';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { clearAllColumnFilters } from './clearAllColumnFilters';
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
    _rowData: Entity
) {
    removeContextMenu(ctx);

    const contextMenu = creatElement('div', 'simple-html-grid');
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
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

        if (!getContext().data) {
            return null;
        }

        /**
         * update grid with new result
         */
        const runFilterClick = () => {
            const intersection = Array.from(getContext().data.dataFilterSetFull).filter(
                (x) => !getContext().data.dataFilterSet.has(x)
            );

            if (intersection.length < getContext().data.dataFilterSet.size) {
                // if full we want to use NOT in
                filterCallback(
                    ctx,
                    null,
                    cellConfig,
                    intersection.length ? intersection : null,
                    getContext().searchInput ? getContext().searchInput : null,
                    intersection.length ? true : false
                );
            } else {
                filterCallback(
                    ctx,
                    null,
                    cellConfig,
                    getContext().data.dataFilterSet.size ? Array.from(getContext().data.dataFilterSet) : null,
                    getContext().searchInput ? getContext().searchInput : null,
                    false
                );
            }
        };

        /**
         * items found
         * @returns
         */
        const filterValues = () => {
            const filterValueClick = (rowData: any) => {
                getContext().selectAll = false;
                if (getContext().data.dataFilterSet.has(rowData)) {
                    getContext().data.dataFilterSet.delete(rowData);
                } else {
                    getContext().data.dataFilterSet.add(rowData);
                }
                getContext().selectAll =
                    getContext().data.dataFilterSetFull.size === getContext().data.dataFilterSet.size &&
                    !getContext().availableOnly;
                reRender();
            };
            return Array.from(getContext().data.dataFilterSetFull).map((rowData: any) => {
                return html`<div style="padding:2px">
                    <input
                        style="padding:2px"
                        type="checkbox"
                        .checked=${live(getContext().data.dataFilterSet.has(rowData))}
                        @click=${() => {
                            filterValueClick(rowData);
                        }}
                    /><label
                        style="padding:2px"
                        @click=${() => {
                            filterValueClick(rowData);
                        }}
                    >
                        ${rowData === 'NULL' ? 'Blank' : rowData}</label
                    >
                </div>`;
            });
        };

        /**
         * top checkbox - available
         * will show only column filtered
         */
        const availableCheckbox = () => {
            if (!getContext().data.enableAvailableOnlyOption) {
                return null;
            }

            const handleEvent = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                getContext().availableOnly = !getContext().availableOnly;
                getContext().selectAll =
                    getContext().data.dataFilterSetFull.size === getContext().data.dataFilterSet.size &&
                    !getContext().availableOnly;
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
                    getContext().data.dataFilterSet = new Set(getContext().data.dataFilterSetFull);
                } else {
                    getContext().data.dataFilterSet = new Set();
                }
                reRender();
            };

            return html` <div class="simple-html-grid-menu-sub simple-html-dialog-scroller">
                <div style="padding:2px">
                    <input
                        style="padding:2px"
                        type="checkbox"
                        .checked=${live(getContext().selectAll)}
                        @click=${() => clickHandler()}
                    /><label style="padding:2px" @click=${() => clickHandler()}>Select All</label>
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
                placeholder="search"
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
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

        const selected = 'simple-html-grid-menu-item simple-html-grid-menu-item-selected';
        const notSelected = 'simple-html-grid-menu-item';

        if (!cellConfig.operator) {
            cellConfig.operator = ctx.gridInterface.getDatasource().getFilterFromType(cellConfig.type);
        }

        const filterTemplate = () => {
            if (
                cellConfig.type !== 'text' &&
                cellConfig.type !== 'number' &&
                cellConfig.type !== 'date' &&
                cellConfig.type !== undefined
            ) {
                return null;
            }

            if (cellConfig.type === 'date' || cellConfig.type === 'number') {
                return html` <div class="simple-html-grid-menu-section">Set Operator:</div>
                    <hr class="hr-solid" />
                    <div
                        class=${cellConfig.operator === 'GREATER_THAN_OR_EQUAL_TO' ? selected : notSelected}
                        @click=${() => {
                            cellConfig.operator = 'GREATER_THAN_OR_EQUAL_TO';
                            removeContextMenu(ctx);
                        }}
                    >
                        Greater than or equal
                    </div>
                    <div
                        class=${cellConfig.operator === 'LESS_THAN_OR_EQUAL_TO' ? selected : notSelected}
                        @click=${() => {
                            cellConfig.operator = 'LESS_THAN_OR_EQUAL_TO';
                            removeContextMenu(ctx);
                        }}
                    >
                        Less than or equal
                    </div>`;
            }

            return html` <div class="simple-html-grid-menu-section">Set Operator:</div>
                <hr class="hr-solid" />
                <div
                    class=${cellConfig.operator === 'EQUAL' ? selected : notSelected}
                    @click=${() => {
                        cellConfig.operator = 'EQUAL';
                        removeContextMenu(ctx);
                    }}
                >
                    Equal
                </div>
                <div
                    class=${cellConfig.operator === 'NOT_EQUAL_TO' ? selected : notSelected}
                    @click=${() => {
                        cellConfig.operator = 'NOT_EQUAL_TO';
                        removeContextMenu(ctx);
                    }}
                >
                    Not Equal
                </div>
                <div
                    class=${cellConfig.operator === 'CONTAINS' ? selected : notSelected}
                    @click=${() => {
                        cellConfig.operator = 'CONTAINS';
                        removeContextMenu(ctx);
                    }}
                >
                    Contains
                </div>`;
        };

        /**
         * set blank or not blank filter
         */
        const setBlankOrNotBlank = (arg: 'IS_BLANK' | 'IS_NOT_BLANK') => {
            const datasource = ctx.gridInterface.getDatasource();
            const currentFilter = datasource.getFilter();

            const loopFilter = (filter: FilterArgument) => {
                if (filter && Array.isArray(filter.filterArguments)) {
                    filter.filterArguments = filter.filterArguments.filter((fi: FilterArgument) => {
                        if (fi.attribute === attribute) {
                            return false;
                        } else {
                            return true;
                        }
                    });
                    filter.filterArguments.forEach((fi: FilterArgument) => {
                        if (fi.type === 'GROUP') {
                            loopFilter(fi);
                        }
                    });
                }
            };
            loopFilter(currentFilter);

            const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

            cellConfig.currentFilterValue = null;

            if (currentFilter && Array.isArray(currentFilter.filterArguments)) {
                currentFilter.filterArguments.push({
                    type: 'CONDITION',
                    attribute: cellConfig.attribute,
                    operator: arg,
                    attributeType: cellConfig.type
                });
                datasource.setFilter(currentFilter);
            } else {
                datasource.setFilter({
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: [
                        {
                            type: 'CONDITION',
                            attribute: cellConfig.attribute,
                            operator: arg,
                            attributeType: cellConfig.type
                        }
                    ]
                });
            }

            datasource.filter();
        };

        /**
         * clear current column filter
         */
        const clearColumnFilter = () => {
            const datasource = ctx.gridInterface.getDatasource();
            const currentFilter = datasource.getFilter();

            const loopFilter = (filter: FilterArgument) => {
                if (filter && Array.isArray(filter.filterArguments)) {
                    filter.filterArguments = filter.filterArguments.filter((fi: FilterArgument) => {
                        if (fi.attribute === attribute) {
                            return false;
                        } else {
                            return true;
                        }
                    });
                    filter.filterArguments.forEach((fi: FilterArgument) => {
                        if (fi.type === 'GROUP') {
                            loopFilter(fi);
                        }
                    });
                }
            };
            const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
            if (cellConfig) {
                cellConfig.currentFilterValue = null;
            }

            loopFilter(currentFilter);
            datasource.setFilter(currentFilter);
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
                    }}
                >
                    Clear Filter
                </div>
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        clearAllColumnFilters(ctx);
                    }}
                >
                    Clear All Filters
                </div>
                <hr class="hr-dashed" />
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        setBlankOrNotBlank('IS_BLANK');
                    }}
                >
                    Set "Is Blank"
                </div>
                <div
                    class="simple-html-grid-menu-item"
                    @click=${() => {
                        setBlankOrNotBlank('IS_NOT_BLANK');
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
