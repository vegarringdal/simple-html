import { html } from 'lit-html';
import { IColumns, ColumnCallBackFn } from '../interfaces';
import { sorticonElement } from './sorticonElement';
import { eventIF } from '../eventIF';
import { filterInputElement } from './filterInputElement';
import { GridInterface } from '../gridInterface';

export function headerWithFilterElements(
    col: IColumns,
    connector: GridInterface,
    sortCallback: ColumnCallBackFn,
    atTop: boolean
) {
    const _class = `free-grid-label-${atTop ? 'top' : 'bottom'}`;

    const paragraphElement = col.headerRenderLabelCallBackFn
        ? col.headerRenderLabelCallBackFn(html, col, null, null, connector)
        : html`
              <p
                  class=${_class}
                  @custom=${eventIF(col.sortable, 'mousedown', sortCallback)}
                  oncontextmenu="return false;"
              >
                  ${col.header || ''} ${sorticonElement(connector, col)}
              </p>
          `;

    const inputElement = html`
        ${filterInputElement(col, connector, col.filterable.filterOverLabel)}
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
