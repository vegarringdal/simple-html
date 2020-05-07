import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from './interfaces';
import { month } from './templates/month';
import { header } from './templates/header';

@customElement('simple-html-date')
export class SimpleHtmlDate extends HTMLElement {
    selected = new Set();
    lastSelected: Date = null;
    @property() config: IDateConfig;

    render() {
        let currentMonth = this.config.startMonth;
        let currentYear = this.config.startYear;
        const monthTemplates = [];

        let i = 0;
        while (i < this.config.monthsToShow) {
            const columns = [];
            for (let y = 0; y < this.config.monthColumns; y++) {
                // add to i so we dont get to many
                i++;
                if (i <= this.config.monthsToShow) {
                    const template = month(this, this.config, currentYear, currentMonth);

                    // push up month
                    if (currentMonth === 11) {
                        currentMonth = 0;
                        currentYear++;
                    } else {
                        currentMonth++;
                    }
                    columns.push(template);
                }
            }
            monthTemplates.push(html`<!-- month column -->
                <div class="simple-html-date-col">
                    ${columns.map((x) => x)}
                </div>`);
        }

        return html`<!-- -->

            <!-- main header for entire calender -->
            ${header(this, this.config)}

            <!-- create a block for each month -->
            ${monthTemplates.map((x) => {
                return x;
            })} `;
    }
}
