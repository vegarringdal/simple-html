import { html } from 'lit-html';
import { IColumns, IEntity } from '../interfaces';
import { eventIF } from '../eventIF';

export function rowTextColumnElement(
    colStyle: string,
    col: IColumns,
    updateCallback: Function,
    _data: IEntity
) {
    return html`
        <free-grid-row-col style=${colStyle} class="free-grid-col">
            <input
                ?readonly=${col.readonly}
                ?disabled=${col.disabled}
                @custom=${eventIF(true, col.editEventType || 'change', updateCallback)}
                type="${col.type || 'text'}"
                .value=${_data}
                class="free-grid-row-input"
            />
        </free-grid-row-col>
    `;
}
