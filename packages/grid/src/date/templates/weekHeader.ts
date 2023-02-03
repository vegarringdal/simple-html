/* eslint-disable @typescript-eslint/no-unused-vars */
import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { DateInterface } from '../dateInterface';

export function weekHeader(
    _context: DateInterface,
    _config: IDateConfig,
    _year: number,
    _month: number
) {
    return html`<!-- function:weekHeader -->
        <simple-html-date-week-header> W </simple-html-date-week-header>`;
}
