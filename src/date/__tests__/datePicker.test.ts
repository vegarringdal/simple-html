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
    weekHeader: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    monthHeader: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
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

        expect(dateInterface.config.datepickerDate.getMinutes()).toEqual(39);
    });

    it('expect the minute down arrow to wrap from 0 to 59', () => {
        const { dateInterface, element } = mount(config({ datepickerDate: new Date(2026, 3, 15, 10, 0) }));

        clickMinuteDown(element);

        expect(dateInterface.config.datepickerDate.getMinutes()).toEqual(59);
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
        expect([picked.getMonth(), picked.getDate()]).toEqual([2, 29]);
    });
});
