import { customElement, property } from '@simple-html/core';
import { html } from 'lit-html';
import { IDateConfig, IStyle } from './interfaces';
import { month } from './templates/month';
import { header } from './templates/header';

@customElement('simple-html-date')
export class SimpleHtmlDate extends HTMLElement {
    selected = new Set();
    lastSelected: Date = null;
    @property() config: IDateConfig;

    selectRangeWithFromTo(fromDate: Date, toDate: Date) {
        console.warn('Not implemented', fromDate, toDate);
    }

    styleRange(StyleArray: IStyle[]) {
        // rerun in you have priorty colors, start with lowest
        console.warn('Not implemented', StyleArray);
    }

    getSelected() {
        return Array.from(this.selected);
    }

    clearSelection() {
        this.selected = new Set();
        this.render();
    }

    setSelected(newSelectedDates: Date[]) {
        this.selected = new Set(newSelectedDates);
        this.render();
    }

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
                <div class="simple-html-date-col">${columns.map((x) => x)}</div>`);
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
