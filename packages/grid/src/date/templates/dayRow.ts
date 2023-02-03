import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { day } from './day';
import { week } from './week';
import { DateInterface } from '../dateInterface';

export function dayRow(context: DateInterface, config: IDateConfig, year: number, month: number, row: number) {
    const rows = new Array(8).fill('x');
    const height = config.rowHeight;

    const days = rows.map((_x, i) => {
        if (i === 0) {
            if (config.showWeek) {
                return week(context, config, year, month, i + row * 7);
            }
            return '';
        } else {
            return day(context, config, year, month, i + row * 7);
        }
    });

    return html`<!-- function:dayRow -->
        <div class="simple-html-date-day-row" style="height:${height}">${days}</div>`;
}
