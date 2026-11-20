import { html, render } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { type Entity, isGroupRow } from '../../datasource/entity';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import { cellRowKeyNavigationCellRowHandler } from './cellRowKeyNavigationCellRowHandler';
import type { ColType } from './colType';
import { contextmenuDate } from './contextmenuDate';
import { contextmenuRow } from './contextmenuRow';
import { createElement } from './createElement';
import { DIV } from './DIV';
import { getCellType } from './getCellType';
import type { HTMLCellElement } from './HTMLCellElement';
import { isRepeatedValue } from './isRepeatedValue';
import { triggerScrollEvent } from './triggerScrollEvent';

export function renderRowCell(
    ctx: Grid,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
) {
    const entity = ctx.gridInterface.getDatasource().getRow(row);

    // a group row has no cells, the grid hides them
    if (isGroupRow(entity)) {
        return;
    }

    if (attribute) {
        const config = ctx.gridInterface.__getGridConfig();
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
        const datasource = ctx.gridInterface.getDatasource();

        // the field's type, and the type of this cell - dynamicCellTypeColumn can change it per row
        const fieldType = datasource.getField(attribute).type;
        const cellConfigType = getCellType(ctx, attribute, entity);
        const formatter = datasource.getFormatter(attribute, cellConfigType);

        let showPlaceHolder = true;
        if (config.placeHolderRowCurrentEntityOnly) {
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

        // a checkbox shows the raw value, every other cell the text from the field's formatter
        const checked = Boolean(entity?.[attribute]);
        let value = formatter.format(entity?.[attribute]);

        if (cellConfigType === 'boolean' ? checked : value) {
            if (dimmed === 'simple-html-mandatory') {
                dimmed = '';
            }
        }

        if (fieldType === 'number') {
            if (cellConfig.numberOverride === 'BLANK_TO_ZERO' && value === '') {
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
            render(
                html` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${dimmed + dimmedClass}></div>
                    <input
                        style="width:100%;"
                        role="cell"
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        aria-label=${attribute}
                        .checked=${live(checked)}
                        type="checkbox"
                        class=${`cellpos-${colType}-${row}-${column}-${celno} ${inputClass}${repeatedClass}`}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @keydown=${(e: any) => {
                            return cellRowKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e, '');
                        }}
                        @click=${() => {
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                        }}
                        @change=${(e: any) => {
                            if (!cellReadOnly && !config.readonly) {
                                if (cellConfig.allowPasteClearOnly) {
                                    // nothing
                                } else {
                                    // booleans are not parsed, the checkbox gives the value
                                    entity[attribute] = !e.target.checked;
                                    e.target.checked = Boolean(entity[attribute]);
                                }
                            }
                        }}
                    />
                </div>`,
                cell as any
            );
        } else {
            let skipFocus = false;
            render(
                html` <div style="width:100%;height:100%;">
                    <div data-attribute-dimmed=${attribute} class=${dimmed + dimmedClass}></div>
                    <input
                        role="cell"
                        aria-label=${attribute}
                        data-attribute=${attribute}
                        data-repeated-value=${repeated ? 'true' : 'false'}
                        style=${
                            cellConfigType === 'number' ? 'text-align: right;width:100%;height:100%;' : 'width:100%;height:100%;'
                        }
                        .value=${live(value)}
                        class=${`simple-html-grid-cell-input cellpos-${colType}-${row}-${column}-${celno}  ${inputClass}${repeatedClass}`}
                        .readOnly=${config.readonly ? config.readonly : cellReadOnly}
                        placeholder=${showPlaceHolder ? cellConfig.placeHolderRow : ''}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @click=${(e: any) => {
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                            if (!cellReadOnly && !config.readonly) {
                                setTimeout(() => {
                                    if (cellConfigType === 'date' || cellConfigType === 'datetime') {
                                        const current = entity[attribute];
                                        contextmenuDate(
                                            ctx,
                                            e,
                                            cell,
                                            // a Date as it is. Text in the data (an iso string) is read by
                                            // the formatter, anything else opens the picker on today
                                            typeof current === 'string' ? formatter.parse(current) : current,
                                            (value: Date | null) => {
                                                rowData[attribute] = value;
                                                ctx.gridInterface.triggerScrollEvent();
                                            }
                                        );
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
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
                            }
                        }}
                        @focus=${(e: any) => {
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
                                const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0] as HTMLElement;
                                if (input) {
                                    input.style.right = asPx(30);
                                }

                                const el = createElement(DIV, 'simple-html-grid-focus-button');
                                el.style.position = 'absolute';
                                el.style.top = asPx(0);
                                el.style.bottom = asPx(0);
                                el.style.right = asPx(0);
                                el.style.width = asPx(30);
                                el.onmousedown = (event: MouseEvent) => {
                                    // dont steal focus from the cell input - its blur removes this button
                                    // after 100ms, so a slow click (mousedown -> mouseup) lost its target
                                    event.preventDefault();
                                };
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
                                const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0] as HTMLElement;
                                if (input) {
                                    // same as null, style properties turn null into ''
                                    input.style.right = '';
                                }
                            }, 100);

                            cell.$focused = false;
                        }}
                        @keydown=${(e: any) => {
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
                        @input=${(e: any) => {
                            if (cellConfig.allowPasteClearOnly) {
                                e.target.value = formatter.format(entity[attribute]);
                                return;
                            }

                            if (!config.readonly && !cellReadOnly) {
                                entity[attribute] = formatter.parse(e.target.value);
                            }
                        }}
                        @change=${(e: any) => {
                            if (cellConfig.allowPasteClearOnly) {
                                e.target.value = formatter.format(entity[attribute]);
                                return;
                            }

                            if (!config.readonly && !cellReadOnly) {
                                entity[attribute] = formatter.parse(e.target.value);
                            }
                        }}
                    />
                </div>`,
                cell as any
            );
        }
    } else {
        render(html`<div data-dimmed-emtpy class="simple-html-dimmed"></div>`, cell as any);
    }
}
