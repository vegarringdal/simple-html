import { html, render } from 'lit-html';
import { Entity } from '../datasource/types';
import { asPx } from './asPx';
import { creatElement } from './createElement';
import { HTMLCellElement, ColType, Grid } from './grid';

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
    ctx.removeContextMenu();

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

    const generateCopyPasteData = (attributes: string[], onlyCurrentEntity: boolean) => {
        const TableOuterTop = `
            <html>
                <body>
                <style>
                    table {
                    border-collapse: collapse;
                    border:.5pt solid windowtext;
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
            tableHeader = tableHeader + '<th>' + ctx.prettyPrintString(attribute) + '</th>';
        });
        tableHeader = tableHeader + '</tr>';

        let tableInnerData = '';
        let justData = '';

        const datasource = ctx.gridInterface.getDatasource();
        const attConfig = ctx.gridInterface.__getGridConfig().__attributes;
        const dateformater = datasource.getDateFormater();
        const numberformater = datasource.getNumberFormater();
        const selectedRows = datasource.getSelectedRows();

        const loopData = (entity: Entity) => {
            if (!entity.__group) {
                tableInnerData = tableInnerData + '<tr>';
                attributes.forEach((attribute, i) => {
                    const cellConfig = attConfig[attribute];
                    const colData = entity[attribute];

                    if (i > 0) {
                        justData = justData + '\t';
                    }

                    if (cellConfig.type === 'date') {
                        //
                        const data = dateformater.fromDate(colData);
                        justData = justData + data;
                        tableInnerData = tableInnerData + '<td>' + data + '</td>';
                    } else if (cellConfig.type === 'number') {
                        //
                        const data = numberformater.fromNumber(colData);
                        justData = justData + data;
                        tableInnerData = tableInnerData + '<td>' + data + '</td >';
                    } else {
                        //
                        justData = justData + colData;
                        tableInnerData = tableInnerData + '<td>' + (colData || '') + '</td>';
                    }
                });
                justData = justData + '\n';
                tableInnerData = tableInnerData + '</tr>';
            }
        };

        if (onlyCurrentEntity) {
            loopData(datasource.currentEntity);
        } else {
            selectedRows.forEach((entity) => {
                loopData(entity);
            });
        }

        return [TableOuterTop + tableHeader + tableInnerData + TableOuterBottom, justData];
    };

    const copyPasteData = (attributes: string[], onlyCurrentEntity: boolean) => {
        const [html, text] = generateCopyPasteData(attributes, onlyCurrentEntity);

        function listener(e: any) {
            e.clipboardData.setData('text/html', html);
            e.clipboardData.setData('text/plain', text);
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
            return parseFloat((prev + cur).toFixed(5));
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
        const numberFormater = ds.getNumberFormater();
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
                @click=${() => {
                    alert('not implemented');
                }}
            >
                Count: ${selectedRows.length}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    alert('not implemented');
                }}
            >
                Sum: ${numberFormater.fromNumber(curValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    alert('not implemented');
                }}
            >
                Max: ${numberFormater.fromNumber(maxValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    alert('not implemented');
                }}
            >
                Min: ${numberFormater.fromNumber(minValueX)}
            </div>
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    alert('not implemented');
                }}
            >
                Avg: ${numberFormater.fromNumber(avgValueX) || 0}
            </div>`;
    };

    /**
     * pasteAndClearTemplate
     * @returns
     */
    const pasteAndClearTemplate = () => {
        if (ctx.gridInterface.__getGridConfig().readonly) {
            return null;
        }

        return html`<div class="simple-html-grid-menu-section">Paste:</div>
            <hr class="hr-solid" />
            <div
                class="simple-html-grid-menu-item"
                @click=${() => {
                    alert('not implemented');
                    ctx.gridInterface.__callSubscribers('paste', {
                        cell,
                        row,
                        column,
                        celno,
                        colType,
                        cellType,
                        attribute,
                        rowData
                    });
                    ctx.removeContextMenu();
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
                    ctx.removeContextMenu();
                    ctx.triggerScrollEvent();
                }}
            >
                Cell <i>(sel. rows)</i>
            </div>`;
    };

    const copyCellTemplate = () => {
        const clickHandle = () => {
            copyPasteData([attribute], true);
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
            ctx.removeContextMenu();
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Cell</div>`;
    };

    const copyColumnOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            copyPasteData([attribute], false);
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
            ctx.removeContextMenu();
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Column <i>(sel.rows)</i></div>`;
    };

    const copyAllOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = ctx.getAttributeColumns(false);

            copyPasteData(attributes, false);
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
            ctx.removeContextMenu();
        };

        return html` <div class="simple-html-grid-menu-item" @click=${() => clickHandle()}>Row <i>(sel. rows)</i></div>`;
    };

    const copySelectedColumnsOnSelectedRowsTemplate = () => {
        const clickHandle = () => {
            const attributes = ctx.getAttributeColumns();

            copyPasteData(attributes, false);
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
            ctx.removeContextMenu();
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
    ctx.contextMenu = contextMenu;
}