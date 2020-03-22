
import { html } from 'lit-html';
import { rowTextColumnElement } from './rowTextColumnElement';
import { rowCheckboxColumnElement } from './rowCheckboxColumnElement';
import { rowNumberColumnElement } from './rowNumberColumnElement';
import { rowImageColumnElement } from './rowImageColumnElement';
import { rowDateColumnElement } from './rowDateColumnElement';
import { CallbackEvent, IEntity } from '../interfaces';
import { GridInterface } from '../gridInterface';

export function rowElementsStandardRender(
    freeGridRowStyle: string,
    rowClick: Function,
    connector: GridInterface,
    rowNo: number,
    rowData: IEntity
) {
    const grouping = connector.config.groupingSet && connector.config.groupingSet.length;
    let curleft = rowData && grouping ? rowData.__groupLvl * 15 : 0;

    return html`
        <free-grid-row
            style=${freeGridRowStyle}
            class="free-grid-row ${connector.selection.isSelected(rowNo)
                ? 'free-grid-selected-row'
                : ''}"
            @click=${rowClick}
        >
            <!-- ------------------------------ -->
            <!-- We now get row based on config -->
            <!-- ------------------------------ -->
            ${html`
                <free-grid-col
                    class="free-grid-col free-grid-grouping-row"
                    style="width:${rowData && grouping ? rowData.__groupLvl * 15 : 0}px;left:0"
                >
                </free-grid-col>
            `}
            ${connector.config.columns.map(col => {
                if (!col.hide) {
                    // common style
                    const colStyle = `width:${col.width || 100}px; left:${curleft}px`;
                    const _data = rowData ? rowData[col.attribute] : '';

                    // callback on cell edit
                    const updateCallback = (e: CallbackEvent) => {
                        col.beforeEditCallbackFn &&
                            col.beforeEditCallbackFn(e, col, rowNo, rowData, connector);

                        // filter out based on type so we know what type to use
                        if (col.autoUpdateData !== false) {
                            switch (col.type) {
                                case 'boolean':
                                    rowData[col.attribute] = e.target.checked;
                                    break;
                                case 'image':
                                    // rowData[col.attribute] = e.target.checked;
                                    // we need this ever ?
                                    break;
                                case 'date':
                                    rowData[col.attribute] = e.target.valueAsDate;
                                    break;
                                case 'number':
                                    rowData[col.attribute] = e.target.valueAsNumber;
                                    break;
                                default:
                                    rowData[col.attribute] = e.target.value;
                            }
                            connector.publishEvent('attribute-change')
                        }
                        

                        col.afterEditCallbackFn &&
                            col.afterEditCallbackFn(e, col, rowNo, rowData, connector);
                    };

                    let template;
                    if (col.rowRenderCallBackFn) {
                        // custom column, supply them with lit.html
                        template = html`
                            <free-grid-row-col style=${colStyle} class="free-grid-col">
                                ${col.rowRenderCallBackFn(html, col, rowNo, rowData, connector)}
                            </free-grid-row-col>
                        `;
                    } else {
                        // only part seperating thiese are value type, use directive ?
                        switch (col.type) {
                            case 'boolean':
                                template = rowCheckboxColumnElement(
                                    colStyle,
                                    col,
                                    updateCallback,
                                    _data
                                );
                                break;
                            case 'image':
                                template = rowImageColumnElement(colStyle, _data);
                                break;
                            case 'date':
                                template = rowDateColumnElement(
                                    colStyle,
                                    col,
                                    updateCallback,
                                    _data
                                );
                                break;
                            case 'number':
                                template = rowNumberColumnElement(
                                    colStyle,
                                    col,
                                    updateCallback,
                                    _data
                                );
                                break;
                            default:
                                template = rowTextColumnElement(
                                    colStyle,
                                    col,
                                    updateCallback,
                                    _data
                                );
                        }
                    }
                    curleft = curleft + (col.width || 100);

                    return template;
                } else {
                    return html``;
                }
            })}
        </free-grid-row>
    `;
}
