import { html } from 'lit-html';
import { IColumns } from '../interfaces';
import { eventIF } from '../eventIF';

export function rowCheckboxColumnElement(
    colStyle: string,
    col: IColumns,
    updateCallback: Function,
    _data: any
) {
    return html`
        <free-grid-row-col style=${colStyle} class="free-grid-col">
            <input
                ?readonly=${col.readonly}
                ?disabled=${col.disabled}
                @custom=${eventIF(true, col.editEventType || 'change', updateCallback)}
                type="checkbox"
                .checked=${_data}
                class="free-grid-row-checkbox-100"
            />
        </free-grid-row-col>
    `;
}
