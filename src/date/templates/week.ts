import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { getWeekNumbers } from '../utils/getWeekNumber';

export function week(_context: DateInterface, config: IDateConfig, year: number, month: number, block: number) {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month === 11 ? 0 : month + 1, 0);

    let dayOfWeek = firstDayOfMonth.getDay() - (config.isoWeek ? 1 : 0); // we only want monday or sunday
    if (dayOfWeek < 0) {
        // if less than 0, we need to push it out 1 week. so we always show entire month
        dayOfWeek = dayOfWeek + 7;
    }

    let day = block - dayOfWeek + 1;

    // if more then last day of month
    if (day > lastDayOfMonth.getDate()) {
        day = day - lastDayOfMonth.getDate();
        if (month === 11) {
            month = 0;
            year++;
        } else {
            month++;
        }
    }

    // if less that first we need to count downwards
    if (day < 1) {
        // setDate(0) is the last day of the previous month, -1 the one before - same fix as day.ts
        firstDayOfMonth.setDate(day);
        day = firstDayOfMonth.getDate();
        if (month === 0) {
            month = 11;
            year--;
        } else {
            month--;
        }
    }

    return html`<!-- function:week -->
        <div class="simple-html-date-week">${getWeekNumbers(new Date(year, month, day), config.isoWeek)}</div>`;
}
