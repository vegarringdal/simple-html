/* eslint-disable @typescript-eslint/no-unused-vars */

import { html } from 'lit-html';
import { getText } from '../../texts';
import type { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

export function weekHeader(_context: DateInterface, config: IDateConfig, _year: number, _month: number) {
    return html`<!-- function:weekHeader -->
        <div class="simple-html-date-week-header">${getText('datePicker.week', config.texts)}</div>`;
}
