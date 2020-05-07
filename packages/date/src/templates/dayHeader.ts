import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

export function dayHeader(
    _context: SimpleHtmlDate,
    config: IDateConfig,
    _year: number,
    _month: number,
    block: number
) {
    let start = config.weekStart;
    const newArr = [];
    for (let i = 0; i < 7; i++) {
        newArr.push(start);
        start++;
        if (start > 6) {
            start = 0;
        }
    }

    return html`<!-- function:dayHeader -->
        <simple-html-date-day-header>
            ${config.weekHeader[newArr[block]]}
        </simple-html-date-day-header>`;
}
