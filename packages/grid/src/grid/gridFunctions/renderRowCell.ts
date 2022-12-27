import { render, html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { Entity } from '../../datasource/entity';
import { contextmenuRow } from './contextmenuRow';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { triggerScrollEvent } from './triggerScrollEvent';
import { creatElement } from './createElement';
import { DIV } from './DIV';
import { asPx } from './asPx';
import { cellKeyNavigationCellRowHandler } from './cellKeyNavigationHandler';

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
    let value = (entity && entity[attribute]?.toString()) || '';

    if (entity?.__group) {
        return;
    }

    if (attribute) {
        const config = ctx.gridInterface.__getGridConfig();
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

        let showPlaceHolder = true;
        if (config.placeHolderRowCurrentEnityOnly) {
            if (rowData !== ctx.gridInterface.getDatasource().currentEntity) {
                showPlaceHolder = false;
            }
        }

        if (cellConfig?.type === 'date') {
            value = ctx.gridInterface.getDatasource().getDateFormater().fromDate(value);
        }

        if (cellConfig?.type === 'number') {
            value = ctx.gridInterface.getDatasource().getNumberFormater().fromNumber(value);
            if ((cellConfig.numberOverride === 'BLANK_TO_ZERO' && value === '') || value === undefined || value === null) {
                value = '0';
            }
            if ((cellConfig.numberOverride === 'ZERO_TO_BLANK' && value === '0') || value === 0) {
                value = '';
            }
        }

        if (cellConfig.type === 'boolean') {
            value = (entity && entity[attribute]) || false;
        }
        let dimmed = '';

        let cellReadOnly = ctx.gridInterface.__callReadonlySetter(attribute, rowData, cellConfig.readonly || false);
        if (cellReadOnly !== false && cellReadOnly !== true) {
            cellReadOnly = cellConfig.readonly;
        }

        if (!config.readonly && cellReadOnly) {
            dimmed = 'simple-html-readonly';
        }
        if (!config.readonly && !cellReadOnly && cellConfig.mandatory) {
            dimmed = 'simple-html-mandatory';
        }

        if (cellConfig.type === 'boolean') {
            render(
                html` <div>
                    <div class=${dimmed}></div>
                    <input
                        .checked=${live(value)}
                        type="checkbox"
                        class=${`cellpos-${colType}-${row}-${column}-${celno}`}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @keydown=${(e: any) => {
                            return cellKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                        }}
                        @click=${() => {
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                        }}
                        @change=${(e: any) => {
                            if (!config.readonly) {
                                entity[attribute] = e.target.checked ? false : true;
                                e.target.checked = entity[attribute];
                            }
                        }}
                    />
                </div>`,
                cell as any
            );
        } else {
            let skipFocus = false;
            render(
                html` <div>
                    <div class=${dimmed}></div>
                    <input
                        style=${cellConfig?.type === 'number' ? 'text-align: right' : ''}
                        .value=${live(value?.toString())}
                        class=${`simple-html-grid-cell-input cellpos-${colType}-${row}-${column}-${celno}`}
                        .readOnly=${config.readonly ? config.readonly : cellReadOnly}
                        placeholder=${showPlaceHolder ? cellConfig.placeHolderRow : ''}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @click=${() => {
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            triggerScrollEvent(ctx);
                        }}
                        @mousedown=${(e: MouseEvent) => {
                            if (e.button === 2) {
                                skipFocus = true;
                            }
                        }}
                        @focus=${() => {
                            if (skipFocus) {
                                skipFocus = false;
                                return;
                            }
                            ctx.gridInterface.__callSubscribers('cell-row-focus', {
                                cell,
                                row,
                                column,
                                celno,
                                colType,
                                cellType,
                                attribute,
                                rowData
                            });

                            const addFocusButton = () => {
                                const input = cell.getElementsByClassName('simple-html-grid-cell-input')[0] as HTMLElement;
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
                                        rowData
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
                                    if (!config.readonly && !cellConfig.readonly) {
                                        addFocusButton();
                                    }
                                    break;
                                case 'ALWAYS':
                                    addFocusButton();
                            }
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
                                    input.style.right = null;
                                }
                            }, 100);
                        }}
                        @keydown=${(e: any) => {
                            return cellKeyNavigationCellRowHandler(ctx, cell, row, column, celno, colType, e);
                        }}
                        @input=${(e: any) => {
                            if (!cellReadOnly && cellConfig?.type !== 'date') {
                                entity[attribute] = e.target.value;
                            }
                            if (!cellReadOnly && cellConfig.type === 'date') {
                                entity[attribute] = ctx.gridInterface.getDatasource().getDateFormater().toDate(e.target.value);
                            }
                            if (!cellReadOnly && cellConfig.type === 'number') {
                                entity[attribute] = ctx.gridInterface
                                    .getDatasource()
                                    .getNumberFormater()
                                    .toNumber(e.target.value);
                            }
                        }}
                        @change=${(e: any) => {
                            if (!cellReadOnly && cellConfig?.type === 'date') {
                                entity[attribute] = ctx.gridInterface.getDatasource().getDateFormater().toDate(e.target.value);
                            }
                        }}
                    />
                </div>`,
                cell as any
            );
        }
    } else {
        render(html`<div class="simple-html-dimmed"></div>`, cell as any);
    }
}
