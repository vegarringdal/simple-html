import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';
import { dayRow } from './dayRow';
import { headerRow } from './headerRow';
import { monthHeader } from './monthHeader';
import { time } from './time';

export function month(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const width = config.monthWidth;
    const margin = config.monthMargin;

    const monthHeaderTemplate = monthHeader(context, config, year, month);
    const headerRowTemplate = headerRow(context, config, year, month);
    const timeTemplate = time(context, config, year, month);

    const rows = new Array(6).fill('x');
    const rowTemplates = rows.map((_x, i) => {
        return dayRow(context, config, year, month, i);
    });

    return html`<!-- function: month -->

        <div class="simple-html-date-month" style="width:${width}px;margin:${margin}px;">
            ${monthHeaderTemplate} ${headerRowTemplate} ${rowTemplates}${timeTemplate}
        </div>`;
}
