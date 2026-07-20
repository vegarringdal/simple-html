import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { asPx } from './asPx';
import { cellRowKeyNavigationCellRowHandler } from './cellRowKeyNavigationCellRowHandler';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuRow } from './contextmenuRow';
import { creatElement } from './createElement';
import { DIV } from './DIV';
import { isRepeatedValue } from './isRepeatedValue';
import { triggerScrollEvent } from './triggerScrollEvent';
export function renderRowCell(ctx, cell, row, column, celno, colType, cellType, attribute, rowData) {
    const entity = ctx.gridInterface.getDatasource().getRow(row);
    let value = entity?.[attribute];
    if (value === null && value === undefined) {
        value = '';
    }
    if (entity?.__group) {
        return;
    }
    if (attribute) {
        const config = ctx.gridInterface.__getGridConfig();
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
        const valueFormater = ctx.gridInterface.getDatasource().getValueFormater();
        let cellConfigType = cellConfig.type || 'text';
        const dynCellType = cellConfig.dynamicCellTypeColumn;
        if (dynCellType && cellConfig.type === 'text') {
            const dynCellTypeValue = entity?.[dynCellType] || '';
            if (dynCellTypeValue === 'text' ||
                dynCellTypeValue === 'number' ||
                dynCellTypeValue === 'date' ||
                dynCellTypeValue === 'boolean') {
                cellConfigType = dynCellTypeValue;
            }
        }
        let showPlaceHolder = true;
        if (config.placeHolderRowCurrentEnityOnly) {
            if (rowData !== ctx.gridInterface.getDatasource().currentEntity) {
                showPlaceHolder = false;
            }
        }
        let dimmed = '';
        let cellReadOnly = ctx.gridInterface.__callReadonlySetter(attribute, rowData, cellConfig.readonly || false);
        if (cellReadOnly !== false && cellReadOnly !== true) {
            cellReadOnly = cellConfig.readonly || false;
        }
        if (!config.readonly && cellReadOnly) {
            dimmed = 'simple-html-readonly';
        }
        if (!config.readonly && !cellReadOnly && cellConfig.mandatory) {
            dimmed = 'simple-html-mandatory';
        }
        if (cell.$focused && !cellReadOnly && !config.readonly) {
            value = valueFormater.fromSource(value, cellConfigType, cellConfig.attribute, false);
        }
        else {
            value = valueFormater.fromSourceDisplay(value, cellConfigType, cellConfig.attribute, false);
        }
        if (value) {
            if (dimmed === 'simple-html-mandatory') {
                dimmed = '';
            }
        }
        if (cellConfig?.type === 'number') {
            if ((cellConfig.numberOverride === 'BLANK_TO_ZERO' && value === '') || value === undefined || value === null) {
                value = '0';
            }
            if (cellConfig.numberOverride === 'ZERO_TO_BLANK' && value === '0') {
                value = '';
            }
        }
        const { inputClass, dimmedClass } = ctx.gridInterface.__callCellAppendClass(attribute, rowData, cellReadOnly);
        // dims cells that repeat the row above, resets at the start of every group
        const repeated = isRepeatedValue(ctx, row, attribute);
        const repeatedClass = repeated ? ' simple-html-grid-repeated-value' : '';
        if (cellConfigType === 'boolean') {
            render(html ` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${dimmed + dimmedClass}></div>
                    <input
                        style="width:100%;"
                        role="cell"
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        aria-label=${attribute}
                        .checked=${live(value)}
                        type="checkbox"
                        class=${`cellpos-${colType}-${row}-${column}-${celno} ${inputClass}${repeatedClass}`}
                        @contextmenu=${(e) => {
                e.preventDefault();
                contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
            }}
                        @keydown=${(e) => {
                return cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, '');
            }}
                        @click=${() => {
                ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                triggerScrollEvent(ctx);
            }}
                        @change=${(e) => {
                if (!cellReadOnly && !config.readonly) {
                    if (cellConfig.allowPasteClearOnly) {
                        // nothing
                    }
                    else {
                        entity[attribute] = valueFormater.toSource(!e.target.checked, cellConfigType, attribute, false);
                        e.target.checked = valueFormater.fromSource(entity[attribute], cellConfigType, attribute, false);
                    }
                }
            }}
                    />
                </div>`, cell);
        }
        else {
            let skipFocus = false;
            render(html ` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${dimmed + dimmedClass}></div>
                    <input
                        role="cell"
                        aria-label=${attribute}
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        style=${cellConfigType === 'number' ? 'text-align: right;width:100%;height:100%;' : 'width:100%;height:100%;'}
                        .value=${live(value?.toString())}
                        class=${`simple-html-grid-cell-input cellpos-${colType}-${row}-${column}-${celno}  ${inputClass}${repeatedClass}`}
                        .readOnly=${config.readonly ? config.readonly : cellReadOnly}
                        placeholder=${showPlaceHolder ? cellConfig.placeHolderRow : ''}
                        @contextmenu=${(e) => {
                e.preventDefault();
                contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
            }}
                        @click=${(e) => {
                ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                triggerScrollEvent(ctx);
                if (!cellReadOnly && !config.readonly) {
                    setTimeout(() => {
                        if (cellConfigType === 'date') {
                            contextmenuDate(ctx, e, cell, valueFormater.toSource(entity[attribute], cellConfigType, attribute, false), (value) => {
                                rowData[attribute] = value;
                                ctx.gridInterface.triggerScrollEvent();
                            });
                        }
                    });
                }
                setTimeout(() => {
                    ctx.gridInterface.__callSubscribers('cell-click', {
                        cell,
                        row,
                        column,
                        celno,
                        colType,
                        cellType,
                        attribute,
                        rowData,
                        originalEvent: e //incase user want to reuse
                    });
                });
            }}
                        @mousedown=${(e) => {
                if (e.button === 2) {
                    skipFocus = true;
                }
            }}
                        @focus=${(e) => {
                if (skipFocus) {
                    skipFocus = false;
                    return;
                }
                cell.$focused = true;
                ctx.gridInterface.__callSubscribers('cell-row-focus', {
                    cell,
                    row,
                    column,
                    celno,
                    colType,
                    cellType,
                    attribute,
                    rowData,
                    originalEvent: e //incase user want to reuse
                });
                const addFocusButton = () => {
                    const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0];
                    if (input) {
                        input.style.right = asPx(30);
                    }
                    const el = creatElement(DIV, 'simple-html-grid-focus-button');
                    el.style.position = 'absolute';
                    el.style.top = asPx(0);
                    el.style.bottom = asPx(0);
                    el.style.right = asPx(0);
                    el.style.width = asPx(30);
                    el.onclick = () => {
                        ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                            cell,
                            row,
                            column,
                            celno,
                            colType,
                            cellType,
                            attribute,
                            rowData,
                            target: e.target, // so user can set focus back to cell
                            originalEvent: e //incase user want to reuse
                        });
                    };
                    el.innerText = '...';
                    cell.appendChild(el);
                };
                switch (cellConfig.focusButton) {
                    case 'SHOW_IF_GRID_NOT_READONLY':
                        if (!config.readonly) {
                            addFocusButton();
                        }
                        break;
                    case 'SHOW_IF_GRID_AND_CELL_NOT_READONLY':
                        if (!config.readonly && !cellReadOnly) {
                            addFocusButton();
                        }
                        break;
                    case 'ALWAYS':
                        addFocusButton();
                }
                renderRowCell(ctx, cell, row, column, celno, colType, cellType, attribute, rowData);
            }}
                        @blur=${() => {
                // I need to delay this incase someone clicks on focus button
                setTimeout(() => {
                    const focus = cell.getElementsByClassName('simple-html-grid-focus-button')[0];
                    if (focus) {
                        if (focus.parentElement) {
                            focus.parentElement.removeChild(focus);
                        }
                    }
                    const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0];
                    if (input) {
                        input.style.right = null;
                    }
                }, 100);
                cell.$focused = false;
            }}
                        @keydown=${(e) => {
                // if hidding spcae we want the option to trigger focus button if it exist
                if (e.code === 'Space') {
                    switch (cellConfig.focusButton) {
                        case 'SHOW_IF_GRID_NOT_READONLY':
                            if (!config.readonly) {
                                ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                                    cell,
                                    row,
                                    column,
                                    celno,
                                    colType,
                                    cellType,
                                    attribute,
                                    rowData,
                                    target: e.target,
                                    originalEvent: e //incase user want to reuse
                                });
                            }
                            break;
                        case 'SHOW_IF_GRID_AND_CELL_NOT_READONLY':
                            if (!config.readonly && !cellReadOnly) {
                                ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                                    cell,
                                    row,
                                    column,
                                    celno,
                                    colType,
                                    cellType,
                                    attribute,
                                    rowData,
                                    target: e.target,
                                    originalEvent: e //incase user want to reuse
                                });
                            }
                            break;
                        case 'ALWAYS':
                            ctx.gridInterface.__callSubscribers('cell-focus-button-click', {
                                cell,
                                row,
                                column,
                                celno,
                                colType,
                                cellType,
                                attribute,
                                rowData,
                                target: e.target,
                                originalEvent: e //incase user want to reuse
                            });
                    }
                }
                let overrideKey = '';
                if (!config.readonly && !cellReadOnly && e.code === 'Enter') {
                    overrideKey = 'ArrowDown';
                }
                return cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, overrideKey);
            }}
                        @input=${(e) => {
                if (cellConfig.allowPasteClearOnly) {
                    e.target.value = valueFormater.fromSource(entity[attribute], cellConfigType, attribute, false);
                    return;
                }
                if (!config.readonly && !cellReadOnly) {
                    entity[attribute] = valueFormater.toSource(e.target.value, cellConfigType, attribute, false);
                }
            }}
                        @change=${(e) => {
                if (cellConfig.allowPasteClearOnly) {
                    e.target.value = valueFormater.fromSource(entity[attribute], cellConfigType, attribute, false);
                    return;
                }
                if (!config.readonly && !cellReadOnly) {
                    entity[attribute] = valueFormater.toSource(e.target.value, cellConfigType, attribute, false);
                }
            }}
                    />
                </div>`, cell);
        }
    }
    else {
        render(html `<div data-dimmed-emtpy class="simple-html-dimmed"></div>`, cell);
    }
}
//# sourceMappingURL=renderRowCell.js.map