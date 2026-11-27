// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';
import '../dateElement';
import { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * The date picker (datepicker: true), rendered on its own.
 */

const config = (overrides: Partial<IDateConfig> = {}): IDateConfig => ({
    monthsToShow: 1,
    monthColumns: 1,
    startMonth: 0,
    startYear: 2026,
    showWeek: true,
    isoWeek: true,
    weekStart: 1,
    rowHeight: 22,
    monthWidth: 230,
    monthMargin: 10,
    hideDimmedDates: false,
    showYearInMonth: false,
    headerTitle: '',
    datepicker: true,
    datepickerDate: new Date(2026, 3, 15, 10, 40),
    ...overrides
});

function mount(dateConfig: IDateConfig) {
    const dateInterface = new DateInterface(dateConfig);
    const element = document.createElement('simple-html-date') as any;
    element.connectInterface(dateInterface);
    document.body.appendChild(element);
    return { dateInterface, element: element as HTMLElement };
}

/**
 * a step of the time row: the hours are the first stepper, the minutes the second; down is the
 * first step of one, up the second
 */
function clickStep(element: HTMLElement, field: 'hour' | 'minute', direction: 'down' | 'up') {
    const stepper = element.querySelectorAll('.simple-html-date-stepper')[field === 'hour' ? 0 : 1];
    const step = stepper.querySelectorAll('.simple-html-date-step')[direction === 'down' ? 0 : 1];
    step.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function clickMinuteDown(element: HTMLElement) {
    clickStep(element, 'minute', 'down');
}

/**
 * the month and year in the header of a date picker: `April 2026`
 */
function title(element: HTMLElement) {
    return element.querySelector('.simple-html-date-month-title')?.textContent?.replace(/\s+/g, ' ').trim();
}

/**
 * the buttons « ‹ › » of the month header, by their position
 */
function clickNav(element: HTMLElement, which: 'previousYear' | 'previousMonth' | 'nextMonth' | 'nextYear') {
    const index = ['previousYear', 'previousMonth', 'nextMonth', 'nextYear'].indexOf(which);
    (element.querySelectorAll('.simple-html-date-nav')[index] as HTMLButtonElement).click();
}

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('date picker - minutes', () => {
    it('expect the minute down arrow to go back one minute', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 40) }));

        clickMinuteDown(element);

        expect(dateInterface.config.datepickerDate?.getMinutes()).toEqual(39);
    });

    it('expect the minute down arrow to wrap from 0 to 59', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 0) }));

        clickMinuteDown(element);

        expect(dateInterface.config.datepickerDate?.getMinutes()).toEqual(59);
    });

    it('expect the minute up arrow to wrap from 59 to 0', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 59) }));

        clickStep(element, 'minute', 'up');

        expect(dateInterface.config.datepickerDate?.getMinutes()).toEqual(0);
    });
});

describe('date picker - hours', () => {
    it('expect the hour arrows to go one hour up and down, and wrap between 23 and 0', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 23, 40) }));
        const hours: number[] = [];

        clickStep(element, 'hour', 'up');
        hours.push(dateInterface.config.datepickerDate?.getHours() as number);
        clickStep(element, 'hour', 'down');
        hours.push(dateInterface.config.datepickerDate?.getHours() as number);
        clickStep(element, 'hour', 'down');
        hours.push(dateInterface.config.datepickerDate?.getHours() as number);

        expect(hours).toEqual([0, 23, 22]);
    });

    it('expect an hour typed past 23 to be 0, as before', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 40) }));
        const hourInput = element.querySelectorAll('.simple-html-date-stepper input')[0] as HTMLInputElement;

        hourInput.value = '30';
        hourInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(dateInterface.config.datepickerDate?.getHours()).toEqual(0);
    });

    it('expect the inputs to be named by the labels in front of them, for a screen reader', () => {
        const { element } = mount(config({ texts: { 'datePicker.hours': 'TT' } }));

        const labels = Array.from(element.querySelectorAll('.simple-html-date-time-label'), (label) => label.textContent?.trim());
        const names = Array.from(element.querySelectorAll('.simple-html-date-stepper input'), (input) =>
            input.getAttribute('aria-label')
        );

        expect(labels).toEqual(['TT', 'MM']);
        expect(names).toEqual(['TT', 'MM']);
    });
});

describe('date picker - the month header', () => {
    it('expect the month and the year on one line', () => {
        const { element } = mount(config());

        expect(title(element)).toEqual('April 2026');
    });

    it('expect ‹ › to show the month before and after, over the end of the year', () => {
        const { element } = mount(config({ datepickerDate: new Date(2026, 0, 15) }));
        const shown: (string | undefined)[] = [];

        clickNav(element, 'previousMonth');
        shown.push(title(element));
        clickNav(element, 'nextMonth');
        clickNav(element, 'nextMonth');
        shown.push(title(element));

        expect(shown).toEqual(['December 2025', 'February 2026']);
    });

    it('expect « » to show the same month a year before and after, the date picked stays', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 40) }));
        const shown: (string | undefined)[] = [];

        clickNav(element, 'previousYear');
        shown.push(title(element));
        clickNav(element, 'nextYear');
        clickNav(element, 'nextYear');
        shown.push(title(element));

        expect(shown).toEqual(['April 2025', 'April 2027']);
        expect(dateInterface.config.datepickerDate?.getTime()).toEqual(new Date(2026, 3, 15, 10, 40).getTime());
        // the day picked is in 2026: not in this month
        expect(element.querySelectorAll('.simple-html-date-day-selected').length).toEqual(0);
    });

    it('expect the buttons to be named for a screen reader, from the texts', () => {
        const { element } = mount(config({ texts: { 'datePicker.nextYear': 'Neste år' } }));

        const names = Array.from(element.querySelectorAll('.simple-html-date-nav'), (button) =>
            button.getAttribute('aria-label')
        );

        expect(names).toEqual(['Previous year', 'Previous month', 'Next month', 'Neste år']);
    });

    it('expect every button to be type button: in a form it does not submit it', () => {
        const { element } = mount(config());

        const types = Array.from(element.querySelectorAll('button'), (button) => button.type);

        // « ‹ › » and Clear / Now / Use
        expect(types).toEqual(Array(7).fill('button'));
    });

    it('expect a click on a button or a step not to reach the page: the grid closes its menu on a click outside it', () => {
        const { element } = mount(config());
        let reached = 0;
        const count = () => reached++;
        document.body.addEventListener('click', count);

        try {
            clickNav(element, 'nextYear');
            clickNav(element, 'previousMonth');
            clickStep(element, 'hour', 'up');
            clickStep(element, 'minute', 'down');
        } finally {
            document.body.removeEventListener('click', count);
        }

        expect(reached).toEqual(0);
    });
});

describe('date picker - today', () => {
    it('expect today to be marked, and no other day', () => {
        const now = new Date();
        const { element } = mount(config({ datepickerDate: now }));

        const marked = Array.from(element.querySelectorAll('.simple-html-date-day-today'), (day) => day.textContent?.trim());

        expect(marked).toEqual([String(now.getDate())]);
    });

    it('expect today to keep its mark when another day is picked, and to have none in another year', () => {
        const { element } = mount(config({ datepickerDate: new Date() }));
        const other = element.querySelector(
            '.simple-html-date-day:not(.simple-html-date-day-dimmed):not(.simple-html-date-day-today)'
        ) as HTMLElement;

        other.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const today = element.querySelector('.simple-html-date-day-today') as HTMLElement;
        const todaySelected = today.classList.contains('simple-html-date-day-selected');
        clickNav(element, 'nextYear');

        expect(todaySelected).toBe(false);
        expect(element.querySelectorAll('.simple-html-date-day-today').length).toEqual(0);
    });
});

describe('calendar - the month header', () => {
    const calendar = (showYearInMonth: boolean) =>
        config({ datepicker: false, datepickerDate: undefined, startMonth: 10, startYear: 2026, showYearInMonth });

    it('expect the name of the month, and the year after it with showYearInMonth', () => {
        expect(title(mount(calendar(false)).element)).toEqual('November');
        expect(title(mount(calendar(true)).element)).toEqual('November-2026');
    });

    it('expect no buttons: the month and year do not change in a calendar', () => {
        const { element } = mount(calendar(true));

        expect(element.querySelectorAll('button').length).toEqual(0);
    });
});

describe('date picker - week starting on sunday', () => {
    // April 2026 starts on a wednesday, so the first row shows three days of March
    const april = () => config({ weekStart: 0, isoWeek: false, startMonth: 3, datepickerDate: new Date(2026, 3, 15) });

    it('expect the days before the 1st to be the last days of the previous month', () => {
        const { element } = mount(april());

        const firstRow = element.querySelector('.simple-html-date-day-row') as HTMLElement;
        const days = Array.from(firstRow.querySelectorAll('.simple-html-date-day')).map((day) => day.textContent?.trim());

        expect(days).toEqual(['29', '30', '31', '1', '2', '3', '4']);
    });

    it('expect clicking the first cell to pick the 29th of March', () => {
        const { dateInterface, element } = mount(april());

        const firstCell = element.querySelector('.simple-html-date-day') as HTMLElement;
        firstCell.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const picked = dateInterface.config.datepickerDate;
        expect([picked?.getMonth(), picked?.getDate()]).toEqual([2, 29]);
    });
});

describe('date picker - bugs found by strict mode', () => {
    it('expect a calendar (datepicker false) to have no time row', () => {
        // the time row sets hours/minutes on the picked date, its arrows threw without one
        const { element } = mount(config({ datepicker: false, datepickerDate: undefined }));

        expect(element.querySelectorAll('.simple-html-date-time').length).toEqual(0);
    });

    it('expect a cleared hour input to keep the hour', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 40) }));
        const hourInput = element.querySelectorAll('.simple-html-date-time input')[0] as HTMLInputElement;

        // a cleared number input reads as NaN, setHours(NaN) made the date invalid
        hourInput.value = '';
        hourInput.dispatchEvent(new Event('change', { bubbles: true }));

        expect(dateInterface.config.datepickerDate?.getHours()).toEqual(10);
    });

    it('expect removing a date element that never got an interface not to throw', () => {
        const element = document.createElement('simple-html-date');
        document.body.appendChild(element);

        expect(() => element.remove()).not.toThrow();
    });
});

describe('date picker - date-select event', () => {
    /**
     * the Clear / Now / Use buttons under the time row
     */
    function button(element: HTMLElement, text: string) {
        return Array.from(element.querySelectorAll('.simple-html-date-time button')).find(
            (b) => b.textContent?.trim() === text
        ) as HTMLButtonElement;
    }

    it('expect Use to send the picked date and Clear to send null, to the same handler', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 40) }));
        const received: (Date | null)[] = [];
        // returns nothing, and still gets both events
        dateInterface.on('date-select', (date) => {
            received.push(date);
        });

        button(element, 'Use').click();
        button(element, 'Clear').click();

        expect(received).toHaveLength(2);
        expect(received[0]?.getTime()).toEqual(new Date(2026, 3, 15, 10, 40).getTime());
        expect(received[1]).toBeNull();
    });

    it('expect Use to be the primary button, the one in the colours of the selected day', () => {
        const { element } = mount(config());

        const primary = Array.from(element.querySelectorAll('.simple-html-date-button-primary'), (b) => b.textContent?.trim());

        expect(primary).toEqual(['Use']);
    });

    it('expect the function on() returns to unsubscribe', () => {
        const { dateInterface, element } = mount(config());
        const received: (Date | null)[] = [];
        const off = dateInterface.on('date-select', (date) => {
            received.push(date);
        });

        off();
        button(element, 'Use').click();

        expect(received).toEqual([]);
    });

    it('expect removing the element to unsubscribe every handler', () => {
        const { dateInterface, element } = mount(config());
        const received: (Date | null)[] = [];
        dateInterface.on('date-select', (date) => {
            received.push(date);
        });
        const use = button(element, 'Use');

        element.remove();
        use.click();

        expect(received).toEqual([]);
    });
});

describe('calendar - setSelected', () => {
    // a calendar of April 2026, the days are matched in the month shown (not the dimmed ones)
    const calendar = () => config({ datepicker: false, datepickerDate: undefined, startMonth: 3, startYear: 2026 });
    const selectedDays = (element: HTMLElement) =>
        Array.from(element.querySelectorAll('.simple-html-date-day-selected')).map((day) => day.textContent?.trim());

    it('expect the dates given to show as selected, whatever their time', () => {
        const { dateInterface, element } = mount(calendar());

        // used to store the Dates and match the days by timestamp: nothing showed as selected
        dateInterface.setSelected([new Date(2026, 3, 10), new Date(2026, 3, 12, 15, 30)]);

        expect(selectedDays(element)).toEqual(['10', '12']);
        expect(dateInterface.getSelected()).toEqual([new Date(2026, 3, 10).getTime(), new Date(2026, 3, 12, 15, 30).getTime()]);
    });

    it('expect a click on a day selected with a time to unselect it', () => {
        const { dateInterface, element } = mount(calendar());
        dateInterface.setSelected([new Date(2026, 3, 12, 15, 30)]);

        const day12 = Array.from(element.querySelectorAll('.simple-html-date-day-selected'))[0] as HTMLElement;
        day12.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(selectedDays(element)).toEqual([]);
        expect(dateInterface.getSelected()).toEqual([]);
    });
});

describe('date picker - week numbers', () => {
    const weeks = (element: HTMLElement) =>
        Array.from(element.querySelectorAll('.simple-html-date-week')).map((week) => week.textContent?.trim());

    it('expect ISO weeks in January 2027: the first row is week 53 of 2026', () => {
        const { element } = mount(config({ startYear: 2027, startMonth: 0, datepickerDate: new Date(2027, 0, 15) }));
        expect(weeks(element).slice(0, 3)).toEqual(['53', '1', '2']);
    });

    it('expect US weeks as Excel WEEKNUM: November 2026, the row of the 22nd is week 48', () => {
        const { element } = mount(
            config({ weekStart: 0, isoWeek: false, startMonth: 10, datepickerDate: new Date(2026, 10, 22) })
        );
        // November 2026 starts on a Sunday: rows from the 1st, 8th, 15th, 22nd, 29th
        expect(weeks(element).slice(0, 5)).toEqual(['45', '46', '47', '48', '49']);
    });
});
