import { html } from 'lit-html';
import { IColumns, IDataRow } from '../interfaces';
import { eventIF } from '../eventIF';

export function rowNumberColumnElement(
    colStyle: string,
    col: IColumns,
    updateCallback: Function,
    _data: IDataRow
) {
    return html`
        <free-grid-row-col style=${colStyle} class="free-grid-col">
            <input
                ?readonly=${col.readonly}
                ?disabled=${col.disabled}
                @custom=${eventIF(true, col.editEventType || 'change', updateCallback)}
                type=${col.type}
                .valueAsNumber=${_data}
                class="free-grid-row-input"
            />
        </free-grid-row-col>
    `;
}
