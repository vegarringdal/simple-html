import { render, html } from 'lit-html';
import { DateElement } from './dateElement';
import { IDateConfig, IStyle } from './interfaces';
import { header } from './templates/header';
import { month } from './templates/month';

export class DateInterface {
    public selected = new Set();
    public lastSelected: Date = null;
    public element: DateElement;
    private config: IDateConfig;
    private isConnected = false;

    constructor(config: IDateConfig) {
        this.config = config;
    }

    connectGridInterface(element: DateElement) {
        this.element = element;
        if (!this.isConnected) {
            this.render();
        }
    }

    connectElement(element: DateElement) {
        this.isConnected = true;
        this.element = element;
        this.render();
    }

    disconnectElement() {
        this.isConnected = false;
        console.log('disconnect');
    }

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
        if (!this.isConnected) {
            return;
        }
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

        render(
            html`<!-- -->

                <!-- main header for entire calender -->
                ${header(this, this.config)}

                <!-- create a block for each month -->
                ${monthTemplates.map((x) => {
                    return x;
                })} `,
            this.element
        );
    }
}
