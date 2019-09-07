import { html } from 'lit-html';
import { IDataRow } from '../interfaces';

export function rowImageColumnElement(colStyle: string, _data: IDataRow) {
    return html`
        <free-grid-row-col style=${colStyle} class="free-grid-col">
            <img .src=${_data} class="free-grid-image-round" />
        </free-grid-row-col>
    `;
}
