import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';
import { weekHeader } from './weekHeader';
import { dayHeader } from './dayHeader';
import { DateInterface } from '../dateInterface';

export function headerRow(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const rows = new Array(8).fill('x');
    const height = config.rowHeight;

    const row = rows.map((_x, i) => {
        if (i === 0) {
            if (config.showWeek) {
                return weekHeader(context, config, year, month);
            }
            return '';
        } else {
            return dayHeader(context, config, year, month, i - 1);
        }
    });

    return html`<!-- function:headerRow -->
        <div class="simple-html-date-header-row" style="height:${height}px">${row}</div>`;
}
