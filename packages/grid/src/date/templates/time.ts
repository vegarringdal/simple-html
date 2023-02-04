import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function time(context: DateInterface, config: IDateConfig, year: number, month: number) {
    const width = config.monthWidth;
    const margin = config.monthMargin;

  

    return html`
        <div class="simple-html-date-time" style="width:${width}">
            
        </div>`;
}
