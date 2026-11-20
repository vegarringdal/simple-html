import { html, render } from 'lit-html';
import { Emitter, type EventHandler } from '../emitter';
import type { DateElement } from './dateElement';
import type { DateEvents } from './dateEvents';
import type { IDateConfig, IStyle } from './interfaces';
import { header } from './templates/header';
import { month } from './templates/month';

export class DateInterface {
    public selected = new Set();
    public lastSelected: Date | null = null;
    // undefined until connected, null after disconnectElement()
    public element?: DateElement | null;
    public config: IDateConfig;
    /**
     * the handlers subscribed with on()
     */
    private events = new Emitter<DateEvents>();

    constructor(config: IDateConfig) {
        this.config = config;
    }

    connectGridInterface(element: DateElement) {
        this.element = element;
        if (this.element) {
            this.checkDatePicker();
            this.render();
        }
    }

    connectElement(element: DateElement) {
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
            this.config.datepickerDate.setSeconds(0);
            this.config.datepickerDate.setMilliseconds(0);
            this.selected.add(this.config.datepickerDate.getTime());
        }
    }

    /**
     * called when the element is removed from the dom, unsubscribes every handler
     */
    disconnectElement() {
        this.element = null;
        this.events.clear();
    }

    /**
     * @internal
     * sends an event to the handlers subscribed with on(), used by the templates
     */
    __callSubscribers<Type extends keyof DateEvents>(type: Type, data: DateEvents[Type]): void {
        this.events.emit(type, data);
    }

    /**
     * Subscribes to an event of the date picker. The handler gets the event's payload, typed
     * from {@link DateEvents} - see there for every event and what it sends.
     *
     * The handler stays subscribed until you call the function this returns, or the date element
     * is removed from the dom. What the handler returns is ignored (in v5 it had to return `true`
     * to stay subscribed).
     *
     * @param type the event name
     * @param handler called with the payload every time the event is sent
     * @returns a function that unsubscribes the handler
     *
     * @example
     * ```ts
     * const off = dateInterface.on('date-select', (date) => {
     *     input.value = date ? date.toLocaleString() : '';
     * });
     *
     * off(); // unsubscribe
     * ```
     */
    on<Type extends keyof DateEvents>(type: Type, handler: EventHandler<DateEvents[Type]>): () => void {
        return this.events.on(type, handler);
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
        newDate.setSeconds(0);
        newDate.setMilliseconds(0);
        this.selected.add(newDate.getTime());
        this.config.datepickerDate = newDate;
        this.checkDatePicker();
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
        if (!this.element) {
            return;
        }

        if (this.config.datepicker) {
            this.config.monthsToShow = 1;
            this.config.monthColumns = 1;
        }

        let currentMonth = this.config.startMonth;
        let currentYear = this.config.startYear;
        const monthTemplates = [];
        const monthMargin = this.config.monthMargin * this.config.monthColumns * 2;
        const monthWidth = this.config.monthWidth * this.config.monthColumns;
        this.element.style.width = `${monthMargin + monthWidth}px`;

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
            monthTemplates.push(
                html`<!-- month column -->
                    <div class="simple-html-date-col">${columns.map((x) => x)}</div>`
            );
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
