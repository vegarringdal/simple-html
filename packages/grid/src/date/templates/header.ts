import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function header(_context: DateInterface, _config: IDateConfig) {
    return html`<!-- function:header -->
        <simple-html-date-header> todo </simple-html-date-header>`;
}
