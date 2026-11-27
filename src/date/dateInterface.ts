import { html, nothing, render } from 'lit-html';
import { Emitter, type EventHandler } from '../emitter';
import type { DateElement } from './dateElement';
import type { DateEvents } from './dateEvents';
import type { IDateConfig, IStyle } from './interfaces';
import { header } from './templates/header';
import { month } from './templates/month';
import { rangeFooter } from './templates/range';
import { isRangePicker, rangeDays, rangeMonths } from './utils/rangePicker';

/**
 * A date picker, a range picker or a calendar: its config, the selected dates and the `date-select` and
 * `range-select` events. It is shown in a `<simple-html-date>` element ({@link DateElement}). The grid uses
 * one for its date cells and date header filters; make one yourself for a date picker or calendar outside
 * a grid. See {@link IDateConfig} for the modes.
 *
 * Import `@simple-html/grid/date.css` for its styles. `@simple-html/grid/theme-tredespace.css` gives it
 * the TreDeSpace theme too, under `data-grid-theme="tredespace"` (see the theming guide).
 *
 * @example
 * ```ts
 * import { type DateElement, DateInterface, type IDateConfig } from '@simple-html/grid';
 * import '@simple-html/grid/date.css';
 *
 * declare const config: IDateConfig; // see IDateConfig, with datepicker: true
 *
 * const dateInterface = new DateInterface(config);
 * const element = document.createElement('simple-html-date') as DateElement;
 * element.classList.add('simple-html-date');
 * element.connectInterface(dateInterface);
 * host.appendChild(element);
 *
 * dateInterface.on('date-select', (date) => {
 *     console.log(date ? date.toISOString() : 'cleared');
 * });
 * ```
 */
export class DateInterface {
    /**
     * The selected dates, as timestamps (`date.getTime()`: the day at 00:00 for a day clicked in a
     * calendar, the picked time in a date picker, From and To in a range picker). A day is shown selected
     * when a timestamp falls on it, whatever its time. Read it with {@link getSelected}, set it with
     * {@link setSelected}.
     */
    public selected = new Set<number>();
    /**
     * The day clicked last, the start of a shift+click range. `null` after a day was clicked off again.
     */
    public lastSelected: Date | null = null;
    /**
     * The element it is shown in: `undefined` until connected, `null` after the element left the page.
     */
    public element?: DateElement | null;
    /**
     * The config. The picker replaces it with a changed copy when the month or time changes
     * (`nextMonth()`, `gotoNow()` ...), so read it here, not from the object you passed in.
     */
    public config: IDateConfig;
    /**
     * the handlers subscribed with on()
     */
    private events = new Emitter<DateEvents>();

    /**
     * @param config what to show, see {@link IDateConfig}. Not copied: a date picker sets the start
     * month and year, the time and `datepickerDate` in it
     *
     * @example
     * ```ts
     * import { DateInterface, type IDateConfig } from '@simple-html/grid';
     *
     * declare const config: IDateConfig;
     * const dateInterface = new DateInterface({ ...config, datepicker: false, monthsToShow: 3, monthColumns: 3 });
     * ```
     */
    constructor(config: IDateConfig) {
        this.config = config;
    }

    /**
     * Called by `element.connectInterface()`: shows the picker in the element. You do not need to call it.
     *
     * @param element the `<simple-html-date>` element
     */
    connectGridInterface(element: DateElement) {
        this.element = element;
        if (this.element) {
            this.checkDatePicker();
            this.render();
        }
    }

    /**
     * Called by the element when it is put on the page: renders the picker in it. You do not need to call
     * it.
     *
     * @param element the `<simple-html-date>` element
     */
    connectElement(element: DateElement) {
        this.element = element;
        this.checkDatePicker();
        this.render();
    }

    /**
     * Called when the element connects: in a date picker it sets the start month and year, the hour and
     * the minutes from `datepickerDate` (today when it is blank) and selects that date. In a range picker
     * it makes `datepickerRange` days (see {@link IDateConfig.datepickerRange}), shows the month of From
     * and selects From and To. Does nothing in a calendar. You do not need to call it.
     */
    checkDatePicker() {
        if (isRangePicker(this.config)) {
            const range = rangeDays(this.config.datepickerRange);
            const shown = range[0] ?? range[1] ?? new Date();
            this.config.datepickerRange = range;
            this.config.startYear = shown.getFullYear();
            this.config.startMonth = shown.getMonth();
            this.selected = new Set(range.flatMap((day) => (day ? [day.getTime()] : [])));
            return;
        }
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
     * Called by the element when it is removed from the page: forgets the element and unsubscribes every
     * handler subscribed with {@link on}. You do not need to call it.
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
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * const input = document.querySelector('input')!;
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

    /**
     * Not implemented: it only logs a warning.
     *
     * @param fromDate the first date of the range
     * @param toDate the last date of the range
     */
    selectRangeWithFromTo(fromDate: Date, toDate: Date) {
        console.warn('Not implemented', fromDate, toDate);
    }

    /**
     * Not implemented: it only logs a warning.
     *
     * @param StyleArray the dates to style, see {@link IStyle}
     */
    styleRange(StyleArray: IStyle[]) {
        // rerun in you have priorty colors, start with lowest
        console.warn('Not implemented', StyleArray);
    }

    /**
     * The selected dates, as timestamps: the days clicked in a calendar (at 00:00), the date picked in a
     * date picker, the dates given to {@link setSelected} (with their time). In the order they were
     * selected.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * const dates = dateInterface.getSelected().map((time) => new Date(time));
     * ```
     */
    getSelected(): number[] {
        return Array.from(this.selected);
    }

    /**
     * Unselects every day and renders the picker again. In a range picker From and To too: the range
     * picked is `[null, null]`.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.clearSelection();
     * dateInterface.getSelected(); // []
     * ```
     */
    clearSelection() {
        this.selected = new Set();
        if (isRangePicker(this.config)) {
            this.config.datepickerRange = [null, null];
        }
        this.render();
    }

    /**
     * Goes to the current date and time: picks it, shows its month. What the date picker's "Now" button
     * does. Does not send `date-select`.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.gotoNow();
     * ```
     */
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

    /**
     * Replaces the selected days and renders the picker again. A day is shown selected when one of the
     * dates falls on it - the time of a date does not matter. They are kept as timestamps, see
     * {@link getSelected}.
     *
     * @param newSelectedDates the days to select
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.setSelected([new Date(2026, 10, 20), new Date(2026, 10, 21, 9, 30)]);
     * ```
     */
    setSelected(newSelectedDates: Date[]) {
        this.selected = new Set(newSelectedDates.map((date) => date.getTime()));
        this.render();
    }

    /**
     * Shows the same month a year later, what the » button in the month header of a date picker does.
     * The date picked stays as it is.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.nextYear();
     * dateInterface.config.startYear; // one later
     * ```
     */
    nextYear() {
        this.config = structuredClone(this.config);
        this.config.startYear = this.config.startYear + 1;
        this.render();
    }

    /**
     * Shows the same month a year before, what the « button in the month header of a date picker does.
     * The date picked stays as it is.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.prevYear();
     * ```
     */
    prevYear() {
        this.config = structuredClone(this.config);
        this.config.startYear = this.config.startYear - 1;
        this.render();
    }

    /**
     * Shows the next month, what the › button in the month header of a date picker does.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.nextMonth();
     * dateInterface.config.startMonth; // one later, 0 again after December
     * ```
     */
    nextMonth() {
        this.config = structuredClone(this.config);
        this.config.startMonth = this.config.startMonth + 1;
        if (this.config.startMonth > 11) {
            this.config.startMonth = 0;
            this.config.startYear = this.config.startYear + 1;
        }
        this.render();
    }
    /**
     * Shows the month before, what the ‹ button in the month header of a date picker does.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.prevMonth();
     * ```
     */
    prevMonth() {
        this.config = structuredClone(this.config);
        this.config.startMonth = this.config.startMonth - 1;
        if (this.config.startMonth < 0) {
            this.config.startMonth = 11;
            this.config.startYear = this.config.startYear - 1;
        }
        this.render();
    }

    /**
     * Renders the picker in its element again. The methods that change what is shown call it; call it
     * after changing `config` yourself. Does nothing while no element is connected.
     *
     * @example
     * ```ts
     * import { DateInterface } from '@simple-html/grid';
     *
     * declare const dateInterface: DateInterface;
     *
     * dateInterface.config.hideDimmedDates = true;
     * dateInterface.render();
     * ```
     */
    render() {
        if (!this.element) {
            return;
        }

        // a date picker shows one month, a range picker two - one in a narrow window
        if (this.config.datepicker) {
            const months = isRangePicker(this.config) ? rangeMonths(this.config) : 1;
            this.config.monthsToShow = months;
            this.config.monthColumns = months;
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
                    const template = month(this, this.config, currentYear, currentMonth, i - 1);

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
                })}

                <!-- a range picker: From and To picked, Clear / Use - under the months, across them -->
                ${isRangePicker(this.config) ? rangeFooter(this, this.config) : nothing} `,
            this.element
        );
    }
}
