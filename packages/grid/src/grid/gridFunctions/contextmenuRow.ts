import { html, render } from 'lit-html';
import { Entity } from '../../datasource/entity';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { getAttributeColumns } from './getAttributeColumns';
import { Grid } from '../grid';
import { HTMLCellElement } from './HTMLCellElement';
import { ColType } from './colType';
import { prettyPrintString } from './prettyPrintString';
import { triggerScrollEvent } from './triggerScrollEvent';
import { removeContextMenu } from './removeContextMenu';
import { DateFormaterYYYYMMDD } from '../../datasource/DateFormaterYYYYMMDD';

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

    const contextMenu = creatElement('div', 'simple-html-grid');
    contextMenu.classList.add('simple-html-grid-reset');
    const rect = cell.getBoundingClientRect();
    contextMenu.style.position = 'absolute';
    contextMenu.style.top = asPx(rect.bottom + 2);
    contextMenu.style.left = asPx(event.clientX - 65);
    contextMenu.style.minWidth = asPx(130);

    function label(attribute: string) {
        if (!ctx) {
            return prettyPrintString(attribute);
        }
        const label = ctx.gridInterface.__getGridConfig().__attributes[attribute].label;
        return label || attribute;
    }

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
                        mso-number-format:"\@";
                    }
                   .date {
                        mso-number-format:"Short Date";
                    }
                    table {
                        border-collapse: collapse;
                        border:.5pt solid windowtext;
                        mso-displayed-decimal-separator:"\.";
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
            tableHeader = tableHeader + '<th>' + label(attribute) + '</th>';
        });
        tableHeader = tableHeader + '</tr>';

        let tableInnerData = '';
        let justData = '';

        const datasource = ctx.gridInterface.getDatasource();
        const attConfig = ctx.gridInterface.__getGridConfig().__attributes;

        const selectedRows = datasource.getSelectedRows();

        const loopData = (entity: Entity) => {
            if (!entity.__group) {
                tableInnerData = tableInnerData + '<tr>';
                attributes.forEach((attribute, i) => {
                    const cellConfig = attConfig[attribute];
                    const colData = entity[attribute];
                    let dataType = cellConfig.type;

                    if (cellConfig.dynamicCellTypeColumn) {
                        dataType = entity[cellConfig.dynamicCellTypeColumn];
                    }

                    if (i > 0) {
                        justData = justData + '\t';
                    }

                    if (dataType === 'date') {
                        const data = DateFormaterYYYYMMDD.fromSource(colData);
                        justData = justData + data;
                        tableInnerData = tableInnerData + '<td>' + data + '</td>';
                    } else if (dataType === 'number') {
                        const data = colData;
                        justData = justData + data;
                        tableInnerData = tableInnerData + '<td class="number">' + (data || '') + '</td >';
                    } else {
                        //
                        justData = justData + colData;
                        tableInnerData = tableInnerData + '<td class="text">' + (colData || '') + '</td>';
                    }
                });
                if (onlyCurrentEntity || overRideCurrentEntity) {
                    justData = justData;
                } else {
                    justData = justData + '\n';
                }

                tableInnerData = tableInnerData + '</tr>';
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

    const clearRows = (attribute: string) => {
        const datasource = ctx.gridInterface.getDatasource();
        const selectedRows = datasource.getSelectedRows();
        selectedRows.forEach((entity) => {
            entity[attribute] = null;
        });
    };

    const pasteIntoCells = (attribute: string, data: any) => {
        const datasource = ctx.gridInterface.getDatasource();
        const attConfig = ctx.gridInterface.__getGridConfig().__attributes;
        const cellConfig = attConfig[attribute];
        const valueFormater = datasource.getValueFormater();

        if (ctx.gridInterface.__getGridConfig().readonly) {
            return;
        }

        datasource.getSelectedRows().forEach((entity) => {
            const cellReadOnly = ctx.gridInterface.__callReadonlySetter(attribute, entity, cellConfig.readonly || false);

            if (cellReadOnly) {
                return;
            }

            entity[attribute] = valueFormater.toSource(data, cellConfig.type, attribute, false);

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
        const type = ctx.gridInterface.__getGridConfig().__attributes[attribute].type;
        if (type !== 'number') {
            return null;
        }

        function add(prev: number, cur: number) {
            let x = parseFloat(cur as any);
            if (isNaN(x)) {
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
        const valueFormater = ds.getValueFormater();
        const allrows = ds.getRows();

        let curValue = 0;
        let maxValue = 0;
        let minValue: number = null;
        selectedRows.forEach((index: number) => {
            const x = allrows[index];
            if (x && x[attribute]) {
                curValue = add(curValue, x[attribute]);
                maxValue = max(maxValue, x[attribute]);
                minValue = min(minValue, x[attribute]);
            }
        });

        const curValueX = Math.round(curValue * 100) / 100;
        const minValueX = Math.round(minValue * 100) / 100;
        const avgValueX = Math.round(avg(selectedRows.length, curValue) * 100) / 100;
        const maxValueX = Math.round(maxValue * 100) / 100;

        return html` <div class="simple-html-grid-menu-section">Summary:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(
                        valueFormater.fromSource(selectedRows.length, 'number', attribute, false)
                    );
                    removeContextMenu(ctx);
                }}
            >
                Count: ${selectedRows.length}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(valueFormater.fromSource(curValueX, 'number', attribute, false));
                    removeContextMenu(ctx);
                }}
            >
                Sum: ${valueFormater.fromSource(curValueX, 'number', attribute, false)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(valueFormater.fromSource(maxValueX, 'number', attribute, false));
                    removeContextMenu(ctx);
                }}
            >
                Max: ${valueFormater.fromSource(maxValueX, 'number', attribute, false)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(valueFormater.fromSource(minValueX, 'number', attribute, false));
                    removeContextMenu(ctx);
                }}
            >
                Min: ${valueFormater.fromSource(minValueX, 'number', attribute, false)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${async () => {
                    await navigator.clipboard.writeText(valueFormater.fromSource(avgValueX, 'number', attribute, false));
                    removeContextMenu(ctx);
                }}
            >
                Avg: ${valueFormater.fromSource(avgValueX, 'number', attribute, false) || 0}
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

        let cellReadOnly = ctx.gridInterface.__callReadonlySetter(attribute, rowData, cellConfig.readonly || false);
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
                    let data;
                    if (navigator.clipboard.readText) {
                        data = await navigator.clipboard.readText();
                        pasteIntoCells(attribute, data);
                    }

                    removeContextMenu(ctx);
                }}
            >
                Cell <i>(sel.rows)</i>
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
                Cell <i>(sel. rows)</i>
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

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Column <i>(sel.rows)</i></div>`;
    };

    const copyAllOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = getAttributeColumns(ctx, false);

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

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Row <i>(sel. rows)</i></div>`;
    };

    const copySelectedColumnsOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = getAttributeColumns(ctx);

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

        return html`<div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Row <i>(sel. rows/col)</i></div>`;
    };

    render(
        html`<div class="simple-html-grid-menu">
            <div class="simple-html-grid-menu-section">Copy:</div>
            <hr class="hr-solid" />

            ${copyCellTemplate()} ${copyColumnOnSelectedRowsTemplate()} ${copyAllOnSelectedRowsTemplate()}
            ${copySelectedColumnsOnSelectedRowsTemplate()} ${pasteAndClearTemplate()} ${summaryTemplate()}
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
