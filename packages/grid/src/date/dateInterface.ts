import { render, html } from 'lit-html';
import { DateElement } from './dateElement';
import { IDateConfig, IStyle } from './interfaces';
import { header } from './templates/header';
import { month } from './templates/month';

export class DateInterface {
    public selected = new Set();
    public lastSelected: Date = null;
    public element: DateElement;
    public config: IDateConfig;
    private isConnected = false;

    constructor(config: IDateConfig) {
        this.config = config;
    }

    connectGridInterface(element: DateElement) {
        this.element = element;
        if (!this.isConnected) {
            this.checkDatePicker();
            this.render();
        }
    }

    connectElement(element: DateElement) {
        this.isConnected = true;
        this.element = element;
        this.checkDatePicker();
        this.render();
    }

    checkDatePicker() {
        if (this.config.datepicker) {
            if (!this.config.datepickerDate) {
                this.config.datepickerDate = new Date();
               
            }

            this.config.startYear = this.config.datepickerDate.getFullYear();
            this.config.startMonth = this.config.datepickerDate.getMonth();
            this.config.datepickerHour = this.config.datepickerDate.getHours();
            this.config.datepickerMinute = this.config.datepickerDate.getMinutes();
            this.config.datepickerDate.setSeconds(0)
            this.config.datepickerDate.setMilliseconds(0)
            this.selected.add(this.config.datepickerDate.getTime());
        }
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

    gotoNow() {
        this.config = structuredClone(this.config);
        this.selected = new Set();
        const newDate = new Date();
        newDate.setSeconds(0)
        newDate.setMilliseconds(0)
        this.selected.add(newDate.getTime());
        this.config.datepickerDate = newDate
        this.checkDatePicker();
        console.log(this.config, this.selected, newDate)
        this.render();
    }

    setSelected(newSelectedDates: Date[]) {
        this.selected = new Set(newSelectedDates);
        this.render();
    }

    nextMonth() {
        this.config = structuredClone(this.config);
        this.config.startMonth = this.config.startMonth + 1;
        if (this.config.startMonth > 11) {
            this.config.startMonth = 0;
            this.config.startYear = this.config.startYear + 1;
        }
        this.render();
    }
    prevMonth() {
        this.config = structuredClone(this.config);
        this.config.startMonth = this.config.startMonth - 1;
        if (this.config.startMonth < 0) {
            this.config.startMonth = 11;
            this.config.startYear = this.config.startYear - 1;
        }
        this.render();
    }

    render() {
        if (!this.isConnected) {
            return;
        }
        let currentMonth = this.config.startMonth;
        let currentYear = this.config.startYear;
        const monthTemplates = [];
        const monthMargin = parseInt(this.config.monthMargin.replace('px', '')) * this.config.monthColumns * 2;
        const monthWidth = parseInt(this.config.monthWidth.replace('px', '')) * this.config.monthColumns;
        this.element.style.width = monthMargin + monthWidth + 'px';

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
