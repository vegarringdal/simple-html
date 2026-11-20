import { html, render } from 'lit-html';
import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import { DateFormatterYYYYMMDDTHHMMSS } from '../../datasource/DateFormatterYYYYMMDDTHHMMSS';
import { type Entity, type GroupRow, isGroupRow } from '../../datasource/entity';
import type { FilterArgument } from '../../datasource/filterArgument';
import type { Grid } from '../grid';
import { asPx } from './asPx';
import type { ColType } from './colType';
import { createElement } from './createElement';
import { getAttributeColumns } from './getAttributeColumns';
import { getCellType } from './getCellType';
import { getColumnLabel } from './getColumnLabel';
import type { HTMLCellElement } from './HTMLCellElement';
import { rebuildHeaderColumns } from './rebuildHeaderColumns';
import { removeContextMenu } from './removeContextMenu';
import { triggerScrollEvent } from './triggerScrollEvent';

export function contextmenuRow(
    ctx: Grid,
    event: MouseEvent,
    cell: HTMLCellElement,
    row: number,
    column: number,
    celno: number,
    colType: ColType,
    cellType: string,
    attribute: string,
    rowData: Entity
) {
    removeContextMenu(ctx);

    const contextMenu = createElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(event.clientX - 65);
    contextMenu.style.minWidth = asPx(130);

    const label = (attribute: string) => getColumnLabel(ctx, attribute);

    if (event.clientX + 70 > window.innerWidth) {
        contextMenu.style.left = asPx(window.innerWidth - 150);
    }
    if (event.clientX - 65 < 0) {
        contextMenu.style.left = asPx(5);
    }

    const generateCopyPasteData = (attributes: string[], onlyCurrentEntity: boolean, overRideCurrentEntity: any = null) => {
        const TableOuterTop = `
            <html>
                <body>
                <style>
                   .number {
                        mso-number-format:"General";
                    }
                   .text{
                        mso-number-format:"@";
                    }
                   .date {
                        mso-number-format:"Short Date";
                    }
                    table {
                        border-collapse: collapse;
                        border:.5pt solid windowtext;
                        mso-displayed-decimal-separator:".";
                    }
                    td,
                    th {
                        border-collapse: collapse;
                        padding:3px;
                        border:.5pt solid windowtext;
                    }
                </style>
            <table>`;
        const TableOuterBottom = '</table></body></html>';

        let tableHeader = '<tr>';
        attributes.forEach((attribute) => {
            tableHeader = `${tableHeader}<th>${label(attribute)}</th>`;
        });
        tableHeader = `${tableHeader}</tr>`;

        let tableInnerData = '';
        let justData = '';

        const datasource = ctx.gridInterface.getDatasource();

        const selectedRows = datasource.getSelectedRows();

        const loopData = (entity: Entity | GroupRow | null) => {
            if (entity && !isGroupRow(entity)) {
                tableInnerData = `${tableInnerData}<tr>`;
                attributes.forEach((attribute, i) => {
                    const colData = entity[attribute];
                    const dataType = getCellType(ctx, attribute, entity);

                    if (i > 0) {
                        justData = `${justData}\t`;
                    }

                    // dates are copied in a fixed format, whatever the field's formatter shows
                    if (dataType === 'date' || dataType === 'datetime') {
                        const formatter = dataType === 'date' ? DateFormatterYYYYMMDD : DateFormatterYYYYMMDDTHHMMSS;
                        const data = formatter.format(colData);
                        justData = justData + data;
                        tableInnerData = `${tableInnerData}<td>${data}</td>`;
                    } else if (dataType === 'number') {
                        const data = colData;
                        justData = justData + data;
                        tableInnerData = `${tableInnerData}<td class="number">${data || ''}</td >`;
                    } else {
                        //
                        justData = justData + colData;
                        tableInnerData = `${tableInnerData}<td class="text">${colData || ''}</td>`;
                    }
                });
                // single entity copy is one line only, so no trailing carriage return
                if (!onlyCurrentEntity && !overRideCurrentEntity) {
                    justData = `${justData}\r\n`;
                }

                tableInnerData = `${tableInnerData}</tr>`;
            }
        };

        if (onlyCurrentEntity) {
            if (overRideCurrentEntity) {
                loopData(overRideCurrentEntity);
            } else {
                loopData(datasource.currentEntity);
            }
        } else {
            selectedRows.forEach((entity) => {
                loopData(entity);
            });
        }

        return [TableOuterTop + tableHeader + tableInnerData + TableOuterBottom, justData];
    };

    const copyData = (attributes: string[], onlyCurrentEntity: boolean, overRideCurrentEntity: any = null) => {
        const [html, text] = generateCopyPasteData(attributes, onlyCurrentEntity, overRideCurrentEntity);

        function listener(e: any) {
            // we only want text if it is
            if (onlyCurrentEntity) {
                e.clipboardData.setData('text/plain', text);
            } else {
                e.clipboardData.setData('text/html', html);
                e.clipboardData.setData('text/plain', text);
            }

            e.preventDefault();
        }
        document.addEventListener('copy', listener);
        document.execCommand('copy');
        document.removeEventListener('copy', listener);
    };

    /**
     * is this cell readonly for this row - same rule the cell rendering uses: the readonly
     * setter decides, and when it gives no answer the column config does
     */
    const isCellReadOnly = (attribute: string, entity: Entity) => {
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];
        const cellReadOnly = ctx.gridInterface.__callReadonlySetter(attribute, entity, cellConfig.readonly || false);
        if (cellReadOnly === true || cellReadOnly === false) {
            return cellReadOnly;
        }
        return cellConfig.readonly || false;
    };

    /**
     * clear and paste work on every selected row, not just the one right clicked, so each row
     * has to be checked on its own
     */
    const clearRows = (attribute: string) => {
        if (ctx.gridInterface.__getGridConfig().readonly) {
            return;
        }

        const datasource = ctx.gridInterface.getDatasource();
        const selectedRows = datasource.getSelectedRows();
        selectedRows.forEach((entity) => {
            if (!isCellReadOnly(attribute, entity)) {
                entity[attribute] = null;
            }
        });
    };

    const pasteIntoCells = (attribute: string, data: string) => {
        const datasource = ctx.gridInterface.getDatasource();
        const formatter = datasource.getFormatter(attribute);

        if (ctx.gridInterface.__getGridConfig().readonly) {
            return;
        }

        datasource.getSelectedRows().forEach((entity) => {
            if (isCellReadOnly(attribute, entity)) {
                return;
            }

            entity[attribute] = formatter.parse(data);

            ctx.gridInterface.__callSubscribers('paste', {
                cell,
                row,
                column,
                celno,
                colType,
                cellType,
                attribute,
                entity
            });
        });

        triggerScrollEvent(ctx);
    };

    /**
     * summaryTemplate
     * @returns
     */
    const summaryTemplate = () => {
        const { type, formatter } = ctx.gridInterface.getDatasource().getField(attribute);
        if (type !== 'number') {
            return null;
        }

        function add(prev: number, cur: number) {
            let x = parseFloat(cur as any);
            if (Number.isNaN(x)) {
                x = 0;
            }

            return parseFloat((prev + x).toFixed(5));
        }

        function max(prev: number, cur: number) {
            return cur > prev ? cur : prev;
        }

        function min(prev: number | null, cur: number) {
            if (prev === null) {
                return cur;
            }

            return cur < prev ? cur : prev;
        }

        function avg(no: number, sum: number) {
            return Math.round(sum / no);
        }

        const ds = ctx.gridInterface.getDatasource();
        const selectedRows = ds.getSelection().getSelectedRows();
        const allrows = ds.getRows();

        let curValue = 0;
        let maxValue = 0;
        let minValue: number | null = null;
        selectedRows.forEach((index: number) => {
            const x = allrows[index];
            if (x?.[attribute]) {
                curValue = add(curValue, x[attribute]);
                maxValue = max(maxValue, x[attribute]);
                minValue = min(minValue, x[attribute]);
            }
        });

        const curValueX = Math.round(curValue * 100) / 100;
        // null * 100 is 0
        const minValueX = Math.round((minValue ?? 0) * 100) / 100;
        const avgValueX = Math.round(avg(selectedRows.length, curValue) * 100) / 100;
        const maxValueX = Math.round(maxValue * 100) / 100;

        return html` <div class="simple-html-grid-menu-section">Summary:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(String(selectedRows.length));
                    removeContextMenu(ctx);
                }}
            >
                Count: ${selectedRows.length}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(formatter.format(curValueX));
                    removeContextMenu(ctx);
                }}
            >
                Sum: ${formatter.format(curValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(formatter.format(maxValueX));
                    removeContextMenu(ctx);
                }}
            >
                Max: ${formatter.format(maxValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(formatter.format(minValueX));
                    removeContextMenu(ctx);
                }}
            >
                Min: ${formatter.format(minValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(formatter.format(avgValueX));
                    removeContextMenu(ctx);
                }}
            >
                Avg: ${formatter.format(avgValueX) || 0}
            </div>`;
    };

    /**
     * pasteAndClearTemplate
     * @returns
     */
    const pasteAndClearTemplate = () => {
        const cellConfig = ctx.gridInterface.__getGridConfig().__attributes[attribute];

        if (ctx.gridInterface.__getGridConfig().readonly) {
            return null;
        }

        let cellReadOnly: boolean | null | undefined = ctx.gridInterface.__callReadonlySetter(
            attribute,
            rowData,
            cellConfig.readonly || false
        );
        if (cellReadOnly !== false && cellReadOnly !== true) {
            cellReadOnly = cellConfig.readonly;
        }

        if (cellReadOnly === true) {
            return null;
        }

        return html`<div class="simple-html-grid-menu-section">Paste:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    let data: string;
                    if (navigator.clipboard.readText) {
                        data = await navigator.clipboard.readText();
                        pasteIntoCells(attribute, data);
                    }

                    removeContextMenu(ctx);
                }}
            >
                Cell <i>(selected rows)</i>
            </div>
            <div class="simple-html-grid-menu-section">Clear:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    clearRows(attribute);
                    ctx.gridInterface.__callSubscribers('clear', {
                        cell,
                        row,
                        column,
                        celno,
                        colType,
                        cellType,
                        attribute,
                        rowData
                    });
                    removeContextMenu(ctx);
                    triggerScrollEvent(ctx);
                }}
            >
                Cell <i>(selected rows)</i>
            </div>`;
    };

    /**
     * Filter on the value in the cell that was right clicked.
     *
     * Replace throws away whatever filter is there and keeps only this one, add keeps the
     * existing filter and puts this condition in front of it, joined with AND.
     */
    const filterTemplate = () => {
        if (isGroupRow(rowData)) {
            // a group row has no value of its own to filter on
            return null;
        }

        const datasource = ctx.gridInterface.getDatasource();
        const value = rowData?.[attribute];
        const isBlank = value === null || value === undefined || value === '';

        const conditionForCell = (): FilterArgument =>
            ({
                type: 'CONDITION',
                attribute,
                attributeType: datasource.getField(attribute).type,
                valueType: 'VALUE',
                // filtering a blank cell on EQUAL '' would match nothing useful
                operator: isBlank ? 'IS_BLANK' : 'EQUAL',
                value: isBlank ? null : value
            }) as FilterArgument;

        const applyFilter = (filterArgument: FilterArgument, clearHeaderFilters: boolean) => {
            datasource.filter(filterArgument);
            if (clearHeaderFilters) {
                // the header filter conditions are gone, so their inputs must not keep showing the
                // old text. __attributes, not attributes: a column only named in the column rows
                // is not in the attributes array
                const attributes = ctx.gridInterface.__getGridConfig().__attributes;
                Object.keys(attributes).forEach((key) => {
                    attributes[key].currentFilterValue = '';
                });
            }
            rebuildHeaderColumns(ctx);
            removeContextMenu(ctx);
        };

        const replaceFilter = () => {
            applyFilter(
                {
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: [conditionForCell()]
                } as FilterArgument,
                true
            );
        };

        const addToFilter = () => {
            const current = datasource.getFilter();
            let existing: FilterArgument[] = [];
            if (current?.logicalOperator === 'OR' && current.filterArguments?.length) {
                // kept whole - spreading its conditions into the AND would turn "a OR b" into "a AND b"
                existing = [current];
            } else if (current?.filterArguments?.length) {
                existing = current.filterArguments;
            } else if (current) {
                // a single condition that was never wrapped in a group
                existing = [current];
            }

            // the existing conditions are kept, header filters included, so the header inputs
            // keep their text
            applyFilter(
                {
                    type: 'GROUP',
                    logicalOperator: 'AND',
                    filterArguments: [conditionForCell(), ...existing]
                } as FilterArgument,
                false
            );
        };

        return html`<div class="simple-html-grid-menu-section">Filter:</div>
            <hr class="hr-solid" />
            <div class="simple-html-grid-menu-item" @click=${() => replaceFilter()}>Replace filter <i>(all)</i></div>
            <div class="simple-html-grid-menu-item" @click=${() => addToFilter()}>Add to filter <i>(and)</i></div>`;
    };

    /**
     * dim cells that repeat the value of the row above
     */
    const dimRepeatedTemplate = () => {
        const gridConfig = ctx.gridInterface.__getGridConfig();
        const enabled = gridConfig.dimRepeatedValues === true;

        return html`<div class="simple-html-grid-menu-section">View:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    gridConfig.dimRepeatedValues = !enabled;
                    removeContextMenu(ctx);
                    triggerScrollEvent(ctx);
                }}
            >
                ${enabled ? '✓ ' : ''}Use dimmed values
            </div>`;
    };

    const copyCellTemplate = () => {
        const clickHandle = () => {
            copyData([attribute], true, rowData);
            ctx.gridInterface.__callSubscribers('copy-cell', {
                cell,
                row,
                column,
                celno,
                colType,
                cellType,
                attribute,
                rowData
            });
            removeContextMenu(ctx);
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Cell Value</div>`;
    };

    const copyColumnOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            copyData([attribute], false);
            ctx.gridInterface.__callSubscribers('copy-column', {
                cell,
                row,
                column,
                celno,
                colType,
                cellType,
                attribute,
                rowData
            });
            removeContextMenu(ctx);
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Column <i>(selected rows)</i></div>`;
    };

    const copyAllOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = getAttributeColumns(ctx.gridInterface, false);

            copyData(attributes, false);
            ctx.gridInterface.__callSubscribers('copy-row', {
                cell,
                row,
                column,
                celno,
                colType,
                cellType,
                attribute,
                rowData
            });
            removeContextMenu(ctx);
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Row <i>(selected rows)</i></div>`;
    };

    const copySelectedColumnsOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = getAttributeColumns(ctx.gridInterface);

            copyData(attributes, false);
            ctx.gridInterface.__callSubscribers('copy-row-col', {
                cell,
                row,
                column,
                celno,
                colType,
                cellType,
                attribute,
                rowData
            });
            removeContextMenu(ctx);
        };

        return html`<div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Row <i>(selected rows/col)</i></div>`;
    };

    render(
        html`<div class="simple-html-grid-menu">
            <div class="simple-html-grid-menu-section">Copy:</div>
            <hr class="hr-solid" />

            ${copyCellTemplate()} ${copyColumnOnSelectedRowsTemplate()} ${copyAllOnSelectedRowsTemplate()}
            ${copySelectedColumnsOnSelectedRowsTemplate()} ${filterTemplate()} ${dimRepeatedTemplate()}
            ${pasteAndClearTemplate()} ${summaryTemplate()}
        </div>`,
        contextMenu
    );

    document.body.appendChild(contextMenu);

    const menuRect = contextMenu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight) {
        contextMenu.style.top = asPx(rect.top - menuRect.height);
    }

    ctx.contextMenu = contextMenu;
}
