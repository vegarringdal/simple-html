import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * the title over the months of a calendar (`headerTitle`), a date picker has none
 */
export function header(_context: DateInterface, config: IDateConfig) {
    if (config.datepicker) {
        return '';
    }

    return html`<!-- function:header -->
        <div class="simple-html-date-header">${config.headerTitle}</div>`;
}
