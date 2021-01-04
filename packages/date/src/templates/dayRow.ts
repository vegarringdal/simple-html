import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';
import { day } from './day';
import { week } from './week';

export function dayRow(
    context: SimpleHtmlDate,
    config: IDateConfig,
    year: number,
    month: number,
    row: number
) {
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
        <simple-html-date-day-row style="height:${height}"> ${days} </simple-html-date-day-row>`;
}
