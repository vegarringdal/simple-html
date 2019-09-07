import { html } from 'lit-html';
import { IColumns, ColumnCallBackFn } from '../interfaces';
import { FreeGrid } from '..';
import { sorticonElement } from './sorticonElement';
import { eventIF } from '../eventIF';
import { filterInputElement } from './filterInputElement';

export function headerWithFilterElements(
    col: IColumns,
    freeGrid: FreeGrid,
    sortCallback: ColumnCallBackFn,
    atTop: boolean
) {
    const _class = `free-grid-label-${atTop ? 'top' : 'bottom'}`;

    const paragraphElement = col.headerRenderLabelCallBackFn
        ? col.headerRenderLabelCallBackFn(html, col, null, null, freeGrid)
        : html`
              <p
                  class=${_class}
                  @custom=${eventIF(col.sortable, 'mousedown', sortCallback)}
                  oncontextmenu="return false;"
              >
                  ${col.header || ''} ${sorticonElement(freeGrid, col)}
              </p>
          `;

    const inputElement = html`
        ${filterInputElement(col, freeGrid, col.filterable.filterOverLabel)}
    `;

    if (atTop) {
        return html`
            ${inputElement}${paragraphElement}
        `;
    } else {
        return html`
            ${paragraphElement}${inputElement}
        `;
    }
}
