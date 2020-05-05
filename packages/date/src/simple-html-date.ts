import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from './interfaces';

@customElement('simple-html-date')
export class SimpleHtmlDate extends HTMLElement {
    @property() config: IDateConfig;

    render() {
        const config = this.config;
        let month = 2; // todo
        let year = 2020; // todo
        const months = new Array(config.months || 1).fill('x');

        // -----------------------------------------------------------
        // -> simple-html-date-header -> only if more then 1 month
        // -> simple-html-date-month * 1 per month (option)
        // // -> simple-html-date-month-header * 1

        // // -> simple-html-date-header-row * 1
        // // // -> simple-html-date-week-header * 1
        // // // -> simple-html-date-day-header * 7

        // // -> simple-html-date-day-row * 6
        // // // -> simple-html-date-week * 1
        // // // -> simple-html-date-day * 7
        // -----------------------------------------------------------

        return html`<!-- -->

            <!-- main header for entire calender -->
            <simple-html-date-header></simple-html-date-header>

            <!-- create a block for each month -->
            ${months.map(() => {
                //generate template
                const template = html`<simple-html-date-month
                    .month=${month}
                    .year=${year}
                    .config=${config}
                ></simple-html-date-month>`;

                // push up month
                if (month === 12) {
                    month = 1;
                    year = year + 1;
                }

                return template;
            })} `;
    }
}
