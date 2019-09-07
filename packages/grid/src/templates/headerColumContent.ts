import { IColumns, CallbackEvent } from '../interfaces';
import { FreeGrid } from '..';
import { headerWithFilterElements } from './headerWithFilterElements';
import { headerWithoutFilterElement } from './headerWithoutFilterElement';
import { html } from 'lit-html';

export function headerColumContent(freeGrid: FreeGrid, col: IColumns) {
    // not using click for sort since I can override it so easly if I add drag/drop of columns

    const mouseup = (e: MouseEvent) => {
        col.sortable.beforeSortCallbackFn &&
            col.sortable.beforeSortCallbackFn(<any>e, col, freeGrid);
        if (col.sortable.auto !== false) {
            freeGrid.arrayUtils.sortCallbackBinded(<any>e, col, freeGrid);
        }
    };

    const sortCallback = (e: CallbackEvent) => {
        if ((<any>e).button === 0) {
            e.target.addEventListener('mouseup', mouseup);
            setTimeout(() => {
                e.target.removeEventListener('mouseup', mouseup);
            }, 500);
        } else {
            // temp sorter
            console.log('open menu');
            // open meny
            /*  if (col.allowGrouping) {
                freeGrid.arrayUtils.groupingCallbackBinded(e, col, freeGrid);
            } */
        }
    };
    if (col.headerRenderCallBackFn) {
        return col.headerRenderCallBackFn(html, col, null, null, freeGrid);
    } else {
        if (col.filterable) {
            return headerWithFilterElements(
                col,
                freeGrid,
                sortCallback,
                col.filterable.filterOverLabel
            );
        } else {
            return headerWithoutFilterElement(col, freeGrid, sortCallback);
        }
    }
}
