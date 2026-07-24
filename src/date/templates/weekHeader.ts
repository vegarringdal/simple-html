/* eslint-disable @typescript-eslint/no-unused-vars */

import { html } from 'lit-html';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

export function weekHeader(_context: DateInterface, _config: IDateConfig, _year: number, _month: number) {
    return html`<!-- function:weekHeader -->
        <div class="simple-html-date-week-header">W</div>`;
}
