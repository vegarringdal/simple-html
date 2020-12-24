import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function header(_context: SimpleHtmlDate, _config: IDateConfig) {
    return html`<!-- function:header -->
        <simple-html-date-header> todo </simple-html-date-header>`;
}
