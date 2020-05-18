import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

export function monthHeader(
    _context: SimpleHtmlDate,
    config: IDateConfig,
    year: number,
    month: number
) {
    return html`<!-- function:monthHeader -->
        <simple-html-date-month-header>
            <span>
                ${config.monthHeader[month]}-${year}
            </span>
        </simple-html-date-month-header>`;
}
