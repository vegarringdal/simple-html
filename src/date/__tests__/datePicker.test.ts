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
 * the minute "down" arrow is the first icon in the second (minute) side of the time row
 */
function clickMinuteDown(element: HTMLElement) {
    const minuteSide = element.querySelectorAll('.simple-html-date-time .side')[1];
    minuteSide.querySelectorAll('svg')[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
