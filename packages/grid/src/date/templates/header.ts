import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function header(_context: DateInterface, config: IDateConfig) {
    const monthMargin = parseInt(config.monthMargin.replace('px', '')) * config.monthColumns * 2;
    const monthWidth = parseInt(config.monthWidth.replace('px', '')) * config.monthColumns;

    return html`<!-- function:header -->
        <div class="simple-html-date-header" style="width:${monthWidth + monthMargin}px">
            <span>${config.headerTitle} </span>
        </div>`;
}
