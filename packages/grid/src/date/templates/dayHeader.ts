import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function dayHeader(
    _context: DateInterface,
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
