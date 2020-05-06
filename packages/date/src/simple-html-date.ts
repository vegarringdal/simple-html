import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig } from './interfaces';

@customElement('simple-html-date')
export class SimpleHtmlDate extends HTMLElement {
    @property() config: IDateConfig;

    public triggerEvent(eventName: string, data?: any) {
        const event = new CustomEvent(eventName, {
            bubbles: true,
            detail: {
                data
            }
        });
        this.dispatchEvent(event);
    }

    valuesChanged() {
        this.triggerEvent('update');
    }

    render() {
        let month = this.config.startMonth;
        let year = this.config.startYear;
        const months = [];

        let i = 0;
        while (i < this.config.monthsToShow) {
            const columns = [];
            for (let y = 0; y < this.config.monthColumns; y++) {
                // add to i so we dont get to many
                i++;
                if (i <= this.config.monthsToShow) {
                    const template = html`<simple-html-date-month
                        .ref=${this}
                        .month=${month}
                        .year=${year}
                    ></simple-html-date-month>`;

                    // push up month
                    if (month === 11) {
                        month = 0;
                        year = year + 1;
                    } else {
                        month = month + 1;
                    }
                    columns.push(template);
                }
            }
            months.push(html`<div class="simple-html-date-col">${columns.map((x) => x)}</div>`);
        }

        return html`<!-- -->

            <!-- main header for entire calender -->
            <simple-html-date-header .ref=${this}></simple-html-date-header>

            <!-- create a block for each month -->
            ${months.map((x) => {
                //generate template

                return x;
            })} `;
    }
}
