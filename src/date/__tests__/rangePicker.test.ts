// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../dateElement';
import { DateInterface } from '../dateInterface';
import type { IDateConfig } from '../interfaces';

/**
 * The range picker (datepicker: true, rangepicker: true), rendered on its own: two months side by side -
 * one in a narrow window - From and To picked with two clicks, the days between marked, the line of
 * From and To, Clear and Use sending `range-select`.
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
    rangepicker: true,
    ...overrides
});

function mount(dateConfig: IDateConfig) {
    const dateInterface = new DateInterface(dateConfig);
    const element = document.createElement('simple-html-date') as any;
    element.connectInterface(dateInterface);
    document.body.appendChild(element);
    return { dateInterface, element: element as HTMLElement };
}

/** the width of the window, for the test: a phone is 390px wide */
function windowWidth(width: number) {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(width);
}

/** the month headers: `November 2026` */
const titles = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.simple-html-date-month-title'), (title) =>
        title.textContent?.replace(/\s+/g, ' ').trim()
    );

/** the days of the month shown at `monthIndex` (not the dimmed days of the months around it) */
const days = (element: HTMLElement, monthIndex = 0) =>
    Array.from(
        element
            .querySelectorAll('.simple-html-date-month')
            [monthIndex].querySelectorAll<HTMLElement>('.simple-html-date-day:not(.simple-html-date-day-dimmed)')
    );

/** clicks the day `day` of the month shown at `monthIndex` */
const clickDay = (element: HTMLElement, day: number, monthIndex = 0) => {
    days(element, monthIndex)
        .find((cell) => cell.textContent?.trim() === String(day))
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

/** the numbers of the days of the first month with `className` */
const marked = (element: HTMLElement, className: string, monthIndex = 0) =>
    days(element, monthIndex)
        .filter((cell) => cell.classList.contains(className))
        .map((cell) => Number(cell.textContent?.trim()));

/** the From and To line: [label, day] of each */
const ends = (element: HTMLElement) =>
    Array.from(element.querySelectorAll('.simple-html-date-range-end'), (end) => [
        end.querySelector('.simple-html-date-range-label')?.textContent?.trim(),
        end.querySelector('.simple-html-date-range-day')?.textContent?.trim()
    ]);

/** the button with this text, of the bottom of the range picker */
const button = (element: HTMLElement, text: string) =>
    Array.from(element.querySelectorAll<HTMLButtonElement>('.simple-html-date-range button')).find(
        (candidate) => candidate.textContent?.trim() === text
    ) as HTMLButtonElement;

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('range picker - the months', () => {
    it('expect two months side by side, from the month of From', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 22), new Date(2026, 11, 3)] }));

        expect(titles(element)).toEqual(['November 2026', 'December 2026']);
        expect(element.querySelectorAll('.simple-html-date-col')).toHaveLength(1);
        // two months of 230px, a margin of 10px on each side of each
        expect(element.style.width).toEqual('500px');
        expect([dateInterface.config.monthsToShow, dateInterface.config.monthColumns]).toEqual([2, 2]);
    });

    it('expect one month when the window is too narrow for two - a phone', () => {
        windowWidth(390);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 22), null] }));

        expect(titles(element)).toEqual(['November 2026']);
        expect(element.style.width).toEqual('250px');
        expect(dateInterface.config.monthsToShow).toEqual(1);
        // From, To and the buttons are there too
        expect(ends(element)).toEqual([
            ['From', '22 November 2026'],
            ['To', '–']
        ]);
    });

    it('expect two months from a window of two months and 10px on', () => {
        windowWidth(509);
        expect(titles(mount(config()).element)).toHaveLength(1);
        document.body.innerHTML = '';
        windowWidth(510);
        expect(titles(mount(config()).element)).toHaveLength(2);
    });

    it('expect « ‹ once before the first month and › » once after the last, a space where they are not', () => {
        windowWidth(1024);
        const { element } = mount(config());
        const headers = element.querySelectorAll('.simple-html-date-month-header');
        const names = (header: Element) =>
            Array.from(header.querySelectorAll('.simple-html-date-nav'), (nav) => nav.getAttribute('aria-label'));

        expect(names(headers[0])).toEqual(['Previous year', 'Previous month']);
        expect(names(headers[1])).toEqual(['Next month', 'Next year']);
        // the name of the month stays in the middle: a space as wide as the two buttons
        expect(headers[0].lastElementChild?.className).toEqual('simple-html-date-nav-space');
        expect(headers[1].firstElementChild?.className).toEqual('simple-html-date-nav-space');
    });

    it('expect the four buttons around the one month of a narrow window', () => {
        windowWidth(390);
        const { element } = mount(config());

        expect(element.querySelectorAll('.simple-html-date-nav')).toHaveLength(4);
        expect(element.querySelectorAll('.simple-html-date-nav-space')).toHaveLength(0);
    });

    it('expect ‹ › « » to move both months', () => {
        windowWidth(1024);
        const { element } = mount(config({ datepickerRange: [new Date(2026, 11, 1), null] }));
        const click = (name: string) =>
            (element.querySelector(`.simple-html-date-nav[aria-label="${name}"]`) as HTMLButtonElement).click();

        click('Next month');
        expect(titles(element)).toEqual(['January 2027', 'February 2027']);
        click('Previous month');
        click('Previous month');
        expect(titles(element)).toEqual(['November 2026', 'December 2026']);
        click('Next year');
        expect(titles(element)).toEqual(['November 2027', 'December 2027']);
        click('Previous year');
        expect(titles(element)).toEqual(['November 2026', 'December 2026']);
    });

    it('expect no hours and minutes, no Now: Clear and Use under the months', () => {
        windowWidth(1024);
        const { element } = mount(config());

        expect(element.querySelector('.simple-html-date-time')).toBeNull();
        expect(Array.from(element.querySelectorAll('button.simple-html-date-button'), (b) => b.textContent?.trim())).toEqual([
            'Clear',
            'Use'
        ]);
        // under the months, not in one: as wide as both
        expect(element.querySelector('.simple-html-date-range')?.parentElement).toBe(element);
        expect(button(element, 'Use').className).toContain('simple-html-date-button-primary');
    });

    it('expect it to open on today when no range is given, nothing picked', () => {
        windowWidth(1024);
        const today = new Date();
        const { element, dateInterface } = mount(config({ datepickerRange: null }));

        expect([dateInterface.config.startYear, dateInterface.config.startMonth]).toEqual([
            today.getFullYear(),
            today.getMonth()
        ]);
        expect(element.querySelectorAll('.simple-html-date-day-selected')).toHaveLength(0);
        expect(ends(element)).toEqual([
            ['From', '–'],
            ['To', '–']
        ]);
    });

    it('expect it to open on the month of To when From is open', () => {
        windowWidth(1024);
        const { element } = mount(config({ datepickerRange: [null, new Date(2026, 4, 10)] }));

        expect(titles(element)[0]).toEqual('May 2026');
        expect(marked(element, 'simple-html-date-day-selected')).toEqual([10]);
    });
});

describe('range picker - picking From and To', () => {
    it('expect the range it opens on: From and To selected, the days between in range', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 22), new Date(2026, 10, 26)] }));

        expect(marked(element, 'simple-html-date-day-selected')).toEqual([22, 26]);
        expect(marked(element, 'simple-html-date-day-in-range')).toEqual([23, 24, 25]);
        expect(dateInterface.getSelected()).toEqual([new Date(2026, 10, 22).getTime(), new Date(2026, 10, 26).getTime()]);
        expect(ends(element)).toEqual([
            ['From', '22 November 2026'],
            ['To', '26 November 2026']
        ]);
    });

    it('expect the first click to be From, the next one To, the days between marked', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [null, null] }));
        // no range: it opens on today, go to November 2026
        dateInterface.config.startYear = 2026;
        dateInterface.config.startMonth = 10;
        dateInterface.render();

        clickDay(element, 10);
        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 10), null]);
        expect(marked(element, 'simple-html-date-day-selected')).toEqual([10]);
        expect(marked(element, 'simple-html-date-day-in-range')).toEqual([]);
        expect(ends(element)[1]).toEqual(['To', '–']);

        clickDay(element, 13);
        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 10), new Date(2026, 10, 13)]);
        expect(marked(element, 'simple-html-date-day-selected')).toEqual([10, 13]);
        expect(marked(element, 'simple-html-date-day-in-range')).toEqual([11, 12]);
        expect(ends(element)).toEqual([
            ['From', '10 November 2026'],
            ['To', '13 November 2026']
        ]);
    });

    it('expect To before From to be swapped: the earlier day is From', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 20), null] }));

        clickDay(element, 15);

        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 15), new Date(2026, 10, 20)]);
        expect(marked(element, 'simple-html-date-day-in-range')).toEqual([16, 17, 18, 19]);
    });

    it('expect a third click to start again: a new From, no To', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 2), new Date(2026, 10, 5)] }));

        clickDay(element, 20);

        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 20), null]);
        expect(marked(element, 'simple-html-date-day-selected')).toEqual([20]);
        expect(marked(element, 'simple-html-date-day-in-range')).toEqual([]);
    });

    it('expect the same day twice to be a range of that day', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 2), null] }));

        clickDay(element, 2);

        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 2), new Date(2026, 10, 2)]);
    });

    it('expect a range over the two months: To in the second, the days between in both', () => {
        windowWidth(1024);
        const { element } = mount(config({ datepickerRange: [new Date(2026, 10, 28), null] }));

        clickDay(element, 2, 1);

        expect(marked(element, 'simple-html-date-day-selected', 0)).toEqual([28]);
        expect(marked(element, 'simple-html-date-day-in-range', 0)).toEqual([29, 30]);
        expect(marked(element, 'simple-html-date-day-in-range', 1)).toEqual([1]);
        expect(marked(element, 'simple-html-date-day-selected', 1)).toEqual([2]);
        // the dimmed days of the month around are not marked: they are marked in their own month
        expect(element.querySelectorAll('.simple-html-date-day-dimmed.simple-html-date-day-in-range')).toHaveLength(0);
    });

    it('expect the range given as days at 00:00, From before To - the dates given not changed', () => {
        windowWidth(1024);
        const from = new Date(2026, 10, 28, 23, 59, 59);
        const to = new Date(2026, 10, 22, 13, 30);
        const { dateInterface } = mount(config({ datepickerRange: [from, to] }));

        expect(dateInterface.config.datepickerRange).toEqual([new Date(2026, 10, 22), new Date(2026, 10, 28)]);
        expect(from).toEqual(new Date(2026, 10, 28, 23, 59, 59));
        expect(to).toEqual(new Date(2026, 10, 22, 13, 30));
    });

    it('expect a day click not to reach the page: the grid closes its menu on a click outside it', () => {
        windowWidth(1024);
        const { element } = mount(config({ datepickerRange: [new Date(2026, 10, 2), null] }));
        const reached = vi.fn();
        document.addEventListener('click', reached);

        clickDay(element, 5);
        document.removeEventListener('click', reached);

        expect(reached).not.toHaveBeenCalled();
    });

    it('expect clearSelection() to clear From and To', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 2), new Date(2026, 10, 5)] }));

        dateInterface.clearSelection();

        expect(dateInterface.config.datepickerRange).toEqual([null, null]);
        expect(dateInterface.getSelected()).toEqual([]);
        expect(element.querySelectorAll('.simple-html-date-day-in-range, .simple-html-date-day-selected')).toHaveLength(0);
    });
});

describe('range picker - range-select', () => {
    it('expect Use to send From and To, Clear null', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 22), null] }));
        const sent: unknown[] = [];
        dateInterface.on('range-select', (range) => sent.push(range));

        clickDay(element, 28);
        button(element, 'Use').click();
        button(element, 'Clear').click();

        expect(sent).toEqual([[new Date(2026, 10, 22), new Date(2026, 10, 28)], null]);
    });

    it('expect Use to send an open end as null: [from, null] after one click, [null, null] for none', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 2), new Date(2026, 10, 5)] }));
        const sent: unknown[] = [];
        dateInterface.on('range-select', (range) => sent.push(range));

        clickDay(element, 20);
        button(element, 'Use').click();
        dateInterface.clearSelection();
        button(element, 'Use').click();

        expect(sent).toEqual([
            [new Date(2026, 10, 20), null],
            [null, null]
        ]);
    });

    it('expect Use to send copies: a handler changing them does not change the range picked', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [new Date(2026, 10, 22), new Date(2026, 10, 28)] }));
        dateInterface.on('range-select', (range) => range?.[1]?.setHours(23, 59, 59));

        button(element, 'Use').click();

        expect(dateInterface.config.datepickerRange?.[1]).toEqual(new Date(2026, 10, 28));
    });

    it('expect picking days not to send it', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(config({ datepickerRange: [null, null] }));
        const handler = vi.fn();
        dateInterface.on('range-select', handler);
        dateInterface.on('date-select', handler);

        clickDay(element, 3);
        clickDay(element, 9);

        expect(handler).not.toHaveBeenCalled();
    });

    it('expect the From and To line to be read out when it changes', () => {
        windowWidth(1024);
        const { element } = mount(config());

        expect(element.querySelector('.simple-html-date-range-ends')?.getAttribute('aria-live')).toEqual('polite');
    });

    it("expect the picker's own texts", () => {
        windowWidth(1024);
        const { element } = mount(
            config({
                datepickerRange: [new Date(2026, 10, 22), null],
                texts: {
                    'datePicker.from': 'Fra',
                    'datePicker.to': 'Til',
                    'datePicker.rangeOpen': '…',
                    'datePicker.month.november': 'november'
                }
            })
        );

        expect(ends(element)).toEqual([
            ['Fra', '22 november 2026'],
            ['Til', '…']
        ]);
    });
});

describe('range picker - the other modes are as they were', () => {
    it('expect a date picker without rangepicker: one month, the time, Clear / Now / Use', () => {
        windowWidth(1024);
        const { element } = mount(config({ rangepicker: undefined, datepickerDate: new Date(2026, 3, 15, 10, 40) }));

        expect(titles(element)).toEqual(['April 2026']);
        expect(element.querySelector('.simple-html-date-time')).not.toBeNull();
        expect(element.querySelector('.simple-html-date-range')).toBeNull();
        expect(element.querySelectorAll('.simple-html-date-nav')).toHaveLength(4);
    });

    it('expect a calendar to ignore rangepicker: its months, a click selects the day', () => {
        windowWidth(1024);
        const { element, dateInterface } = mount(
            config({ datepicker: false, rangepicker: true, monthsToShow: 3, monthColumns: 3, startMonth: 0, startYear: 2026 })
        );

        expect(element.querySelectorAll('.simple-html-date-month')).toHaveLength(3);
        expect(element.querySelector('.simple-html-date-range')).toBeNull();
        clickDay(element, 5);
        clickDay(element, 7);
        expect(dateInterface.getSelected()).toEqual([new Date(2026, 0, 5).getTime(), new Date(2026, 0, 7).getTime()]);
        expect(element.querySelectorAll('.simple-html-date-day-in-range')).toHaveLength(0);
    });
});
