import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function monthHeader(
    _context: DateInterface,
    config: IDateConfig,
    year: number,
    month: number
) {
    return html`<!-- function:monthHeader -->
        <simple-html-date-month-header>
            <span> ${config.monthHeader[month]}-${year} </span>
        </simple-html-date-month-header>`;
}
