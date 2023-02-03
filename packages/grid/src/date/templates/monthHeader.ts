import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function monthHeader(_context: DateInterface, config: IDateConfig, year: number, month: number) {
    return html`<!-- function:monthHeader -->
        <div class="simple-html-date-month-header">
            <span> ${config.monthHeader[month]}${config.showYearInMonth ? '-' + year : ''} </span>
        </div>`;
}
