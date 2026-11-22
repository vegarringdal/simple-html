import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { isRangePicker } from '../utils/rangePicker';
import { dayRow } from './dayRow';
import { headerRow } from './headerRow';
import { monthHeader } from './monthHeader';
import { time } from './time';

/**
 * A month: its header, the names of the days, six weeks and - in a date picker - the time row
 * @param index the place of the month among the months shown, 0 for the first: a range picker has
 * « ‹ before its first month and › » after its last
 */
export function month(context: DateInterface, config: IDateConfig, year: number, month: number, index = 0) {
    const width = config.monthWidth;
    const margin = config.monthMargin;

    const monthHeaderTemplate = monthHeader(context, config, year, month, index);
    const headerRowTemplate = headerRow(context, config, year, month);
    // the time row sets hours/minutes on the picked date, a calendar (datepicker false) has none - nor a
    // range picker: it picks days, its Clear / Use are under the months (range.ts)
    const timeTemplate = config.datepicker && !isRangePicker(config) ? time(context, config, year, month) : null;

    const rows = new Array(6).fill('x');
    const rowTemplates = rows.map((_x, i) => {
        return dayRow(context, config, year, month, i);
    });

    return html`<!-- function: month -->

        <div class="simple-html-date-month" style="width:${width}px;margin:${margin}px;">
            ${monthHeaderTemplate} ${headerRowTemplate} ${rowTemplates}${timeTemplate}
        </div>`;
}
