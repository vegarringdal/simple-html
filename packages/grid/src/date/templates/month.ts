import { IDateConfig } from '../interfaces';
import { monthHeader } from './monthHeader';
import { headerRow } from './headerRow';
import { dayRow } from './dayRow';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function month(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const width = config.monthWidth;
    const margin = config.monthMargin;

    const monthHeaderTemplate = monthHeader(context, config, year, month);
    const headerRowTemplate = headerRow(context, config, year, month);

    const rows = new Array(6).fill('x');
    const rowTemplates = rows.map((_x, i) => {
        return dayRow(context, config, year, month, i);
    });

    return html`<!-- function: month -->

        <div class="simple-html-date-month" style="width:${width};margin:${margin};">
            ${monthHeaderTemplate} ${headerRowTemplate} ${rowTemplates}
        </div>`;
}
