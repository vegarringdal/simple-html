import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from '../interfaces';

@customElement('simple-html-date-month')
export default class extends HTMLElement {
    config: IDateConfig;
    @property() month: number;
    @property() year: number;

    render() {
        const rows = new Array(6).fill('x');

        return html`<!---->

            <!--  header for the month -->
            <simple-html-date-month-header .config=${this.config}></simple-html-date-month-header>

            <!--  header for the days -->
            <simple-html-date-header-row .config=${this.config}></simple-html-date-header-row>

            <!-- rows to hold the days -->
            ${rows.map((_x, i) => {
                return html`<simple-html-date-day-row
                    .row=${i}
                    .config=${this.config}
                ></simple-html-date-day-row>`;
            })} `;
    }
}
