import { render, html } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { Entity } from '../datasource/types';
import { contextmenuRow } from './contextmenuRow';
import { Grid, HTMLCellElement, ColType } from './grid';

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

        if (cellConfig?.type === 'date') {
            value = ctx.gridInterface.getDatasource().getDateFormater().fromDate(value);
        }

        if (cellConfig?.type === 'number') {
            value = ctx.gridInterface.getDatasource().getNumberFormater().fromNumber(value);
            if(cellConfig.blankAsZero && value === '' || value === undefined || value === null){
                value = '0';
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

        if (cellConfig.type === 'boolean') {
            render(
                html`<input
                    .checked=${live(value)}
                    type="checkbox"
                    .disabled=${config.readonly ? config.readonly : cellReadOnly}
                    @contextmenu=${(e: MouseEvent) => {
                        e.preventDefault();
                        contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                    }}
                    @click=${() => {
                        ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                        ctx.triggerScrollEvent();
                    }}
                    @change=${(e: any) => {
                        if (!cellReadOnly) {
                            entity[attribute] = e.target.checked ? false : true;
                            e.target.checked = entity[attribute];
                        }
                    }}
                />`,
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
                        .readOnly=${config.readonly ? config.readonly : cellReadOnly}
                        placeholder=${cellConfig.placeHolderRow}
                        @contextmenu=${(e: MouseEvent) => {
                            e.preventDefault();
                            contextmenuRow(ctx, e, cell, row, column, celno, colType, cellType, attribute, rowData);
                        }}
                        @click=${() => {
                            ctx.gridInterface.getDatasource().setRowAsCurrentEntity(row);
                            ctx.triggerScrollEvent();
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
