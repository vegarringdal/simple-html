import { html } from 'lit-html';
import { getText, type TextId } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * the text ids of the names of the days, in javascript's order: Sunday first
 */
const DAYS: TextId[] = [
    'datePicker.day.sunday',
    'datePicker.day.monday',
    'datePicker.day.tuesday',
    'datePicker.day.wednesday',
    'datePicker.day.thursday',
    'datePicker.day.friday',
    'datePicker.day.saturday'
];

export function dayHeader(_context: DateInterface, config: IDateConfig, _year: number, _month: number, block: number) {
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
        <div class="simple-html-date-day-header">${getText(DAYS[newArr[block]], config.texts)}</div>`;
}
