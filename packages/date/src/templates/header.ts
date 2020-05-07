import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

export function header(_context: SimpleHtmlDate, _config: IDateConfig) {
    return html`<!-- function:header -->
        <simple-html-date-header>
            todo
        </simple-html-date-header>`;
}
