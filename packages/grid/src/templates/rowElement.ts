import { CallbackEvent, rowCache, IEntity } from '../interfaces';
import { rowElementsCustomRender } from './rowElementsCustomRender';
import { rowElementsStandardRender } from './rowElementsStandardRender';
import { rowElementsGroupRender } from './rowElementsGroupRender';
import { GridInterface } from '../gridInterface';

export function rowElement(connector: GridInterface, rowData: IEntity, rowPosition: rowCache) {
    /** current left of column, so they stack nicely */

    const display = rowData ? 'block' : 'none';

    const freeGridRowStyle = `
        display:${display};
        height:${connector.config.rowHeight}px;
        transform:translate3d(0px, ${connector.config.rowHeight * rowPosition.i}px, 0px);
        width:${connector.config.columns
            .map(col => col.width || 100)
            .reduce((total, num) => total + num)}px`;

    const rowClick = (e: CallbackEvent) => {
        connector.config.beforeSelectionChangeCallBackFn &&
            connector.config.beforeSelectionChangeCallBackFn(e, rowPosition.i, connector);
        connector.selection.highlightRow(<any>e, rowPosition.i);

        connector.config.afterSelectionChangeCallBackFn &&
            connector.config.beforeSelectionChangeCallBackFn(e, rowPosition.i, connector);
    };
    const config = connector.config;

    switch (true) {
        case typeof config.rowRenderCallBackFn === 'function':
            return rowElementsCustomRender(
                freeGridRowStyle,
                rowClick,
                connector,
                rowPosition.i,
                rowData
            );
        case rowData && (<IEntity>rowData).__group:
            return rowElementsGroupRender(
                freeGridRowStyle,
                rowClick,
                connector,
                rowPosition.i,
                rowData
            );
        default:
            return rowElementsStandardRender(
                freeGridRowStyle,
                rowClick,
                connector,
                rowPosition.i,
                rowData
            );
    }
}
