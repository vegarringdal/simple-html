import { html } from 'lit-html';
import { IColumns, ColumnCallBackFn } from '../interfaces';
import { FreeGrid } from '..';
import { eventIF } from '../eventIF';
import { sorticonElement } from './sorticonElement';

export function headerWithoutFilterElement(
    col: IColumns,
    freeGrid: FreeGrid,
    sortCallback: ColumnCallBackFn
) {
    return col.headerRenderLabelCallBackFn
        ? col.headerRenderLabelCallBackFn(html, col, null, null, freeGrid)
        : html`
              <p
                  class="free-grid-label-full"
                  @custom=${eventIF(col.sortable, 'mousedown', sortCallback)}
                  oncontextmenu="return false;"
              >
                  ${col.header || ''} ${sorticonElement(freeGrid, col)}
              </p>
          `;
}
