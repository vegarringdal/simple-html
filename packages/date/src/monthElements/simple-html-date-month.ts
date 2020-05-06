import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { SimpleHtmlDate } from '../simple-html-date';

@customElement('simple-html-date-month')
export default class extends HTMLElement {
    ref: SimpleHtmlDate;
    @property() month: number;
    @property() year: number;

    render() {
        const rows = new Array(6).fill('x');
        this.style.width = this.ref.config.monthWith;
        this.style.margin = this.ref.config.monthMargin;

        return html`<!---->

            <!--  header for the month -->
            <simple-html-date-month-header
                .ref=${this.ref}
                .month=${this.month}
                .year=${this.year}
            ></simple-html-date-month-header>

            <!--  header for the days -->
            <simple-html-date-header-row .ref=${this.ref}></simple-html-date-header-row>

            <!-- rows to hold the days -->
            ${rows.map((_x, i) => {
                return html`<simple-html-date-day-row
                    .ref=${this.ref}
                    .month=${this.month}
                    .year=${this.year}
                    .row=${i}
                ></simple-html-date-day-row>`;
            })} `;
    }
}
