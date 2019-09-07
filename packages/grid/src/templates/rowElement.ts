import { CallbackEvent, rowCache, IDataRow } from '../interfaces';
import { FreeGrid } from '..';

import { rowElementsCustomRender } from './rowElementsCustomRender';
import { rowElementsStandardRender } from './rowElementsStandardRender';
import { rowElementsGroupRender } from './rowElementsGroupRender';

export function rowElement(freeGrid: FreeGrid, rowData: IDataRow, rowPosition: rowCache) {
    /** current left of column, so they stack nicely */

    const display = rowData ? 'block' : 'none';

    const freeGridRowStyle = `
        display:${display};
        height:${freeGrid.config.rowHeight}px;
        transform:translate3d(0px, ${freeGrid.config.rowHeight * rowPosition.i}px, 0px);
        width:${freeGrid.config.columns
            .map(col => col.width || 100)
            .reduce((total, num) => total + num)}px`;

    const rowClick = (e: CallbackEvent) => {
        freeGrid.config.beforeSelectionChangeCallBackFn &&
            freeGrid.config.beforeSelectionChangeCallBackFn(e, rowPosition.i, freeGrid);
        freeGrid.selection.highlightRow(<any>e, rowPosition.i, freeGrid);

        freeGrid.config.afterSelectionChangeCallBackFn &&
            freeGrid.config.beforeSelectionChangeCallBackFn(e, rowPosition.i, freeGrid);
    };
    const config = freeGrid.config;

    switch (true) {
        case typeof config.rowRenderCallBackFn === 'function':
            return rowElementsCustomRender(
                freeGridRowStyle,
                rowClick,
                freeGrid,
                rowPosition.i,
                rowData
            );
        case rowData && (<IDataRow>rowData).__group:
            return rowElementsGroupRender(
                freeGridRowStyle,
                rowClick,
                freeGrid,
                rowPosition.i,
                rowData
            );
        default:
            return rowElementsStandardRender(
                freeGridRowStyle,
                rowClick,
                freeGrid,
                rowPosition.i,
                rowData
            );
    }
}
