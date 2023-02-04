import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function header(_context: DateInterface, config: IDateConfig) {

    if (config.datepicker) {
        return ''
    }

    return html`<!-- function:header -->
        <div class="simple-html-date-header">
            <span class="main">${config.headerTitle} </span>
        </div>`;
}
