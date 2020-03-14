import { html } from 'lit-html';
import { IColumns, ColumnCallBackFn } from '../interfaces';
import { eventIF } from '../eventIF';
import { sorticonElement } from './sorticonElement';
import { GridInterface } from '../gridInterface';

export function headerWithoutFilterElement(
    col: IColumns,
    connector: GridInterface,
    sortCallback: ColumnCallBackFn
) {
    return col.headerRenderLabelCallBackFn
        ? col.headerRenderLabelCallBackFn(html, col, null, null, connector)
        : html`
              <p
                  class="free-grid-label-full"
                  @custom=${eventIF(col.sortable, 'mousedown', sortCallback)}
                  oncontextmenu="return false;"
              >
                  ${col.header || ''} ${sorticonElement(connector, col)}
              </p>
          `;
}
