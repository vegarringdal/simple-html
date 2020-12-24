/* eslint-disable @typescript-eslint/no-unused-vars */
import { IDateConfig } from '../interfaces';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

export function weekHeader(
    _context: SimpleHtmlDate,
    _config: IDateConfig,
    _year: number,
    _month: number
) {
    return html`<!-- function:weekHeader -->
        <simple-html-date-week-header> W </simple-html-date-week-header>`;
}
