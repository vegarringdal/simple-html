// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { and, type FilterExpression, where } from '../../datasource/filterExpression';
import { toSqlWhere } from '../../sql';
import {
    DATE_PRESETS,
    type DatePreset,
    DEFAULT_DATE_PRESETS,
    datePresetDays,
    datePresetRange,
    isDatePreset,
    takesDatePresets,
    weekStartOf
} from '../datePresets';
import type { GridConfig, GridState } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { refilterChangedFormats } from '../gridFunctions/headerFilterFormatter';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, headerFilterInput, menuEntry, openFilterMenu, openMenus } from './interactionTestHelpers';

/**
 * Quick date filters (datePresets.ts, gridFunctions/datePresetFilter.ts, datePresetBlock.ts): the days of
 * each on a given day, the buttons of the filter menu, the header filter keeping the quick date, the
 * state computing it again on another day, and the SQL of it.
 */

/** a day as YYYY-MM-DD, null as null: the days of a range read at a glance */
const ymd = (date: Date | null) =>
    date
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        : null;
const days = (preset: DatePreset, now: Date, weekStart = 1) => datePresetDays(preset, now, weekStart).map(ymd);

describe('quick dates - the days of each', () => {
    // a Sunday: the last day of an ISO week
    const sunday = new Date(2026, 10, 22, 15, 30);

    it('expect every quick date on Sunday 2026-11-22, the week from Monday', () => {
        const expected: Record<DatePreset, [string | null, string]> = {
            today: ['2026-11-22', '2026-11-22'],
            yesterday: ['2026-11-21', '2026-11-21'],
            thisWeek: ['2026-11-16', '2026-11-22'],
            lastWeek: ['2026-11-09', '2026-11-15'],
            thisMonth: ['2026-11-01', '2026-11-30'],
            lastMonth: ['2026-10-01', '2026-10-31'],
            thisQuarter: ['2026-10-01', '2026-12-31'],
            lastQuarter: ['2026-07-01', '2026-09-30'],
            thisYear: ['2026-01-01', '2026-12-31'],
            lastYear: ['2025-01-01', '2025-12-31'],
            last7Days: ['2026-11-16', '2026-11-22'],
            last30Days: ['2026-10-24', '2026-11-22'],
            next7Days: ['2026-11-22', '2026-11-28'],
            overdue: [null, '2026-11-21']
        };
        for (const preset of DATE_PRESETS) {
            expect(days(preset, sunday), preset).toEqual(expected[preset]);
        }
    });

    it('expect the days at 00:00, new Dates, whatever the time of now', () => {
        for (const preset of DATE_PRESETS) {
            for (const day of datePresetDays(preset, sunday, 1)) {
                if (day) {
                    expect([day.getHours(), day.getMinutes(), day.getSeconds(), day.getMilliseconds()], preset).toEqual([
                        0, 0, 0, 0
                    ]);
                    expect(day).not.toBe(sunday);
                }
            }
        }
    });

    it('expect the week of an ISO start (Monday) and of a Sunday start', () => {
        // Sunday: the last day of the ISO week, the first of a Sunday week
        expect(days('thisWeek', sunday, 1)).toEqual(['2026-11-16', '2026-11-22']);
        expect(days('thisWeek', sunday, 0)).toEqual(['2026-11-22', '2026-11-28']);
        expect(days('lastWeek', sunday, 0)).toEqual(['2026-11-15', '2026-11-21']);
        // Monday: the first of the ISO week, the second of a Sunday week
        const monday = new Date(2026, 10, 23);
        expect(days('thisWeek', monday, 1)).toEqual(['2026-11-23', '2026-11-29']);
        expect(days('thisWeek', monday, 0)).toEqual(['2026-11-22', '2026-11-28']);
        // Saturday, the last day of a Sunday week
        expect(days('thisWeek', new Date(2026, 10, 21), 0)).toEqual(['2026-11-15', '2026-11-21']);
        // a Saturday start
        expect(days('thisWeek', sunday, 6)).toEqual(['2026-11-21', '2026-11-27']);
    });

    it('expect the new year: the week, the month, the quarter and the year before are last year', () => {
        // Friday 1 January 2027
        const newYear = new Date(2027, 0, 1);
        expect(days('yesterday', newYear)).toEqual(['2026-12-31', '2026-12-31']);
        expect(days('thisWeek', newYear)).toEqual(['2026-12-28', '2027-01-03']);
        expect(days('lastWeek', newYear)).toEqual(['2026-12-21', '2026-12-27']);
        expect(days('thisMonth', newYear)).toEqual(['2027-01-01', '2027-01-31']);
        expect(days('lastMonth', newYear)).toEqual(['2026-12-01', '2026-12-31']);
        expect(days('thisQuarter', newYear)).toEqual(['2027-01-01', '2027-03-31']);
        expect(days('lastQuarter', newYear)).toEqual(['2026-10-01', '2026-12-31']);
        expect(days('lastYear', newYear)).toEqual(['2026-01-01', '2026-12-31']);
        expect(days('last7Days', newYear)).toEqual(['2026-12-26', '2027-01-01']);
        expect(days('last30Days', newYear)).toEqual(['2026-12-03', '2027-01-01']);
        // New Year's Eve: the next 7 days into the new year
        expect(days('next7Days', new Date(2026, 11, 31))).toEqual(['2026-12-31', '2027-01-06']);
    });

    it('expect the ends of the months and quarters: 28, 29, 30 and 31 days', () => {
        expect(days('lastMonth', new Date(2026, 2, 31))).toEqual(['2026-02-01', '2026-02-28']);
        expect(days('thisMonth', new Date(2026, 3, 15))).toEqual(['2026-04-01', '2026-04-30']);
        expect(days('thisMonth', new Date(2026, 4, 31))).toEqual(['2026-05-01', '2026-05-31']);
        expect(days('next7Days', new Date(2026, 0, 31))).toEqual(['2026-01-31', '2026-02-06']);
        // the first day of a quarter, the last day of one
        expect(days('thisQuarter', new Date(2026, 3, 1))).toEqual(['2026-04-01', '2026-06-30']);
        expect(days('lastQuarter', new Date(2026, 3, 1))).toEqual(['2026-01-01', '2026-03-31']);
        expect(days('thisQuarter', new Date(2026, 2, 31))).toEqual(['2026-01-01', '2026-03-31']);
        expect(days('thisQuarter', new Date(2026, 8, 30))).toEqual(['2026-07-01', '2026-09-30']);
        expect(days('lastQuarter', new Date(2026, 6, 1))).toEqual(['2026-04-01', '2026-06-30']);
    });

    it('expect a leap year: 29 February', () => {
        expect(days('yesterday', new Date(2028, 2, 1))).toEqual(['2028-02-29', '2028-02-29']);
        expect(days('lastMonth', new Date(2028, 2, 1))).toEqual(['2028-02-01', '2028-02-29']);
        expect(days('thisMonth', new Date(2028, 1, 10))).toEqual(['2028-02-01', '2028-02-29']);
        expect(days('lastMonth', new Date(2027, 2, 1))).toEqual(['2027-02-01', '2027-02-28']);
        expect(days('last7Days', new Date(2028, 2, 3))).toEqual(['2028-02-26', '2028-03-03']);
        // 2028 has 366 days, its last day is 31 December
        expect(days('lastYear', new Date(2029, 5, 1))).toEqual(['2028-01-01', '2028-12-31']);
    });

    it('expect a week over the change to summer time to be whole days at 00:00', () => {
        // Europe: the clocks go forward on Sunday 29 March 2026, the US on 8 March
        for (const now of [new Date(2026, 2, 29, 12), new Date(2026, 2, 8, 12), new Date(2026, 9, 25, 12)]) {
            const [from, to] = datePresetDays('thisWeek', now, 1);
            expect(from?.getHours()).toEqual(0);
            expect(to.getHours()).toEqual(0);
            expect(to.getDate() - (from?.getDate() ?? 0)).toEqual(6);
        }
    });

    it('expect a date the days, a datetime from 00:00:00 to 23:59:59 - an open start stays open', () => {
        const [from, to] = datePresetRange('thisMonth', 'date', sunday, 1);
        expect([from?.getTime(), to.getTime()]).toEqual([new Date(2026, 10, 1).getTime(), new Date(2026, 10, 30).getTime()]);
        const [timeFrom, timeTo] = datePresetRange('thisMonth', 'datetime', sunday, 1);
        expect(timeFrom?.getTime()).toEqual(new Date(2026, 10, 1).getTime());
        expect(timeTo.getTime()).toEqual(new Date(2026, 10, 30, 23, 59, 59).getTime());
        expect(datePresetRange('overdue', 'datetime', sunday, 1)).toEqual([null, new Date(2026, 10, 21, 23, 59, 59)]);
    });

    it('expect the ids, their order in pairs, the defaults without Overdue', () => {
        expect(DATE_PRESETS).toEqual([
            'today',
            'yesterday',
            'thisWeek',
            'lastWeek',
            'thisMonth',
            'lastMonth',
            'thisQuarter',
            'lastQuarter',
            'thisYear',
            'lastYear',
            'last7Days',
            'last30Days',
            'next7Days',
            'overdue'
        ]);
        expect(DEFAULT_DATE_PRESETS).toEqual(DATE_PRESETS.filter((id) => id !== 'overdue'));
        expect(Object.isFrozen(DATE_PRESETS)).toBe(true);
        expect(DATE_PRESETS.every(isDatePreset)).toBe(true);
        expect([isDatePreset('tomorrow'), isDatePreset(null), isDatePreset(1)]).toEqual([false, false, false]);
    });

    it('expect the week start of the date picker: Monday by default, any whole number made a day', () => {
        expect(weekStartOf(undefined)).toEqual(1);
        expect(weekStartOf({})).toEqual(1);
        expect(weekStartOf({ weekStart: 0 })).toEqual(0);
        expect(weekStartOf({ weekStart: 6 })).toEqual(6);
        expect(weekStartOf({ weekStart: 7 })).toEqual(0);
        expect(weekStartOf({ weekStart: -1 })).toEqual(6);
        expect(weekStartOf({ weekStart: 1.5 })).toEqual(1);
    });

    it('expect a date or datetime column with BETWEEN to take them, nothing else', () => {
        expect(takesDatePresets('date', ['EQUAL', 'BETWEEN'])).toBe(true);
        expect(takesDatePresets('datetime', ['BETWEEN'])).toBe(true);
        expect(takesDatePresets('date', ['EQUAL', 'GREATER_THAN'])).toBe(false);
        expect(takesDatePresets('number', ['BETWEEN'])).toBe(false);
        expect(takesDatePresets('text', ['EQUAL'])).toBe(false);
    });
});

// ------------------------------------------------------------------ the grid

/**
 * orders around Sunday 2026-11-22 10:00, the day the clock is set to: `order` a date, `seen` a datetime
 */
const rows = () => [
    { name: 'today', order: new Date(2026, 10, 22), seen: new Date(2026, 10, 22, 23, 59, 30), amount: 1 },
    { name: 'yesterday', order: new Date(2026, 10, 21), seen: new Date(2026, 10, 21, 8, 0, 0), amount: 2 },
    { name: 'monday', order: new Date(2026, 10, 16), seen: new Date(2026, 10, 16, 0, 0, 0), amount: 3 },
    { name: 'lastSunday', order: new Date(2026, 10, 15), seen: new Date(2026, 10, 15, 12, 0, 0), amount: 4 },
    { name: 'november1', order: new Date(2026, 10, 1), seen: new Date(2026, 10, 1, 0, 0, 0), amount: 5 },
    { name: 'october31', order: new Date(2026, 9, 31), seen: new Date(2026, 9, 31, 23, 59, 59), amount: 6 },
    { name: 'july', order: new Date(2026, 6, 1), seen: new Date(2026, 6, 1, 12, 0, 0), amount: 7 },
    { name: 'lastYear', order: new Date(2025, 11, 31), seen: new Date(2025, 11, 31, 23, 0, 0), amount: 8 },
    { name: 'saturday', order: new Date(2026, 10, 28), seen: new Date(2026, 10, 28, 23, 59, 59), amount: 9 },
    { name: 'nextSunday', order: new Date(2026, 10, 29), seen: new Date(2026, 10, 29, 0, 0, 0), amount: 10 },
    { name: 'blank', order: null, seen: null, amount: 11 }
];

const fields = {
    fields: {
        order: 'date' as const,
        seen: 'datetime' as const,
        amount: 'number' as const
    }
};

const config = (columns: GridConfig['columns'] = {}, extra: Partial<GridConfig> = {}): GridConfig => ({
    columns: {
        order: { label: 'Order' },
        seen: { label: 'Seen' },
        ...columns
    },
    layout: {
        center: ['name', 'order', 'seen', 'amount'].map((field) => ({ fields: [field], width: 120 }))
    },
    ...extra
});

const mount = (columns: GridConfig['columns'] = {}, extra: Partial<GridConfig> = {}) =>
    mountGrid(config(columns, extra), rows(), fields);

const names = (datasource: Datasource) => datasource.getDataRows().map((row) => row.name);

/** the quick dates block of the open menu, and its buttons */
const block = () => document.querySelector<HTMLElement>('.simple-html-grid-menu [data-menu-id="filter.dates"]');
const buttons = () => Array.from(block()?.querySelectorAll<HTMLButtonElement>('button') ?? []);
const button = (preset: DatePreset) =>
    block()?.querySelector<HTMLButtonElement>(`[data-preset="${preset}"]`) as HTMLButtonElement;

/** a quick date picked in the filter menu of a column */
const pick = (element: GridElement, field: string, preset: DatePreset) => {
    openFilterMenu(element, field);
    button(preset).click();
};

/** the text of the footer's chips */
const chips = (element: GridElement) =>
    element.querySelector('.footer-filter-chips')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** the operator indicator of a header filter cell: its symbol */
const indicator = (element: GridElement, field: string) =>
    headerFilterInput(element, field).parentElement?.querySelector('.simple-html-grid-filter-operator')?.textContent?.trim();

/** a key on `target`, as the browser sends it */
const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

/** types into the header filter and leaves it with Enter */
const typeAndEnter = (element: GridElement, field: string, text: string) => {
    const input = headerFilterInput(element, field);
    input.value = text;
    press(input, 'Enter', { keyCode: 13 });
};

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
    // Sunday 22 November 2026, 10:00. Only Date: the grid's timers run
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10, 0, 0));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('quick dates - the block of the filter menu', () => {
    it('expect it under the range block of a date and a datetime column, not of a number or a text', async () => {
        const { element } = await mount();
        for (const field of ['order', 'seen']) {
            openFilterMenu(element, field);
            const shown = Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"] > [data-menu-id]')).map(
                (entry) => entry.getAttribute('data-menu-id')
            );
            expect(shown, field).toEqual(['filter.filter', 'filter.range', 'filter.dates']);
        }
        for (const field of ['name', 'amount']) {
            openFilterMenu(element, field);
            expect(block(), field).toBeNull();
        }
    });

    it('expect every quick date but Overdue by default, in pairs, named by the texts', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'order');
        expect(buttons().map((entry) => entry.dataset.preset)).toEqual([...DEFAULT_DATE_PRESETS]);
        expect(buttons().map((entry) => entry.textContent?.trim())).toEqual([
            'Today',
            'Yesterday',
            'This week',
            'Last week',
            'This month',
            'Last month',
            'This quarter',
            'Last quarter',
            'This year',
            'Last year',
            'Last 7 days',
            'Last 30 days',
            'Next 7 days'
        ]);
        expect([block()?.getAttribute('role'), block()?.getAttribute('aria-label')]).toEqual(['group', 'Quick dates']);
    });

    it('expect datePresets to choose them and their order, false or [] none', async () => {
        const { element } = await mount({
            order: { label: 'Order', datePresets: ['overdue', 'today', 'next7Days'] },
            seen: { label: 'Seen', datePresets: false }
        });
        openFilterMenu(element, 'order');
        expect(buttons().map((entry) => entry.dataset.preset)).toEqual(['overdue', 'today', 'next7Days']);
        openFilterMenu(element, 'seen');
        expect(block()).toBeNull();

        const none = await mount({ order: { datePresets: [] } });
        openFilterMenu(none.element, 'order');
        expect(block()).toBeNull();
    });

    it('expect none on a column whose operators have no BETWEEN', async () => {
        const { element } = await mount({ order: { filterOperators: ['EQUAL', 'GREATER_THAN'] } });
        openFilterMenu(element, 'order');
        expect(block()).toBeNull();
        expect(document.querySelector('[data-menu-id="filter.range"]')).not.toBeNull();
    });

    it("expect the days of each as its tooltip, as the field shows a date - a datetime's seconds, Overdue before today", async () => {
        const { element } = await mount({ seen: { datePresets: ['today', 'thisMonth', 'overdue'] } });
        openFilterMenu(element, 'order');
        expect(button('today').dataset.tooltip).toEqual('2026-11-22');
        expect(button('thisMonth').dataset.tooltip).toEqual('2026-11-01 – 2026-11-30');
        expect(button('thisWeek').dataset.tooltip).toEqual('2026-11-16 – 2026-11-22');
        openFilterMenu(element, 'seen');
        expect(button('today').dataset.tooltip).toEqual('2026-11-22T00:00:00 – 2026-11-22T23:59:59');
        expect(button('overdue').dataset.tooltip).toEqual('Before 2026-11-22T00:00:00');
    });

    it('expect the week to start on the date picker’s weekStart', async () => {
        const { element, datasource } = await mount({}, { datePickerConfig: { weekStart: 0 } });
        openFilterMenu(element, 'order');
        expect(button('thisWeek').dataset.tooltip).toEqual('2026-11-22 – 2026-11-28');
        button('thisWeek').click();
        expect(names(datasource)).toEqual(['today', 'saturday']);
    });
});

describe('quick dates - one click filters', () => {
    // the rows of each on Sunday 2026-11-22, the date column
    const expected: Record<DatePreset, string[]> = {
        today: ['today'],
        yesterday: ['yesterday'],
        thisWeek: ['today', 'yesterday', 'monday'],
        lastWeek: ['lastSunday'],
        thisMonth: ['today', 'yesterday', 'monday', 'lastSunday', 'november1', 'saturday', 'nextSunday'],
        lastMonth: ['october31'],
        thisQuarter: ['today', 'yesterday', 'monday', 'lastSunday', 'november1', 'october31', 'saturday', 'nextSunday'],
        lastQuarter: ['july'],
        thisYear: ['today', 'yesterday', 'monday', 'lastSunday', 'november1', 'october31', 'july', 'saturday', 'nextSunday'],
        lastYear: ['lastYear'],
        last7Days: ['today', 'yesterday', 'monday'],
        last30Days: ['today', 'yesterday', 'monday', 'lastSunday', 'november1', 'october31'],
        next7Days: ['today', 'saturday'],
        overdue: ['yesterday', 'monday', 'lastSunday', 'november1', 'october31', 'july', 'lastYear']
    };

    it('expect each to filter its days of the date column, and to close the menu', async () => {
        const { element, datasource } = await mount({ order: { label: 'Order', datePresets: [...DATE_PRESETS] } });
        for (const preset of DATE_PRESETS) {
            pick(element, 'order', preset);
            expect(names(datasource), preset).toEqual(expected[preset]);
            expect(openMenus(), preset).toHaveLength(0);
        }
    });

    it('expect each to filter the same days of the datetime column, from 00:00:00 to 23:59:59', async () => {
        const { element, datasource } = await mount({ seen: { label: 'Seen', datePresets: [...DATE_PRESETS] } });
        for (const preset of DATE_PRESETS) {
            pick(element, 'seen', preset);
            expect(names(datasource), preset).toEqual(expected[preset]);
        }
    });

    it('expect the cell to show its name, the indicator Between, the chip its name, the state the quick date', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'thisMonth');

        expect(headerFilterInput(element, 'order').value).toEqual('This month');
        expect(indicator(element, 'order')).toEqual('a..b');
        expect(chips(element)).toEqual('Order = This month');
        expect(gridInterface.getState().headerFilters).toEqual({
            order: { value: [new Date(2026, 10, 1), new Date(2026, 10, 30)], operator: 'BETWEEN', datePreset: 'thisMonth' }
        });
        // the filter is plain: a BETWEEN of the days
        expect(datasource.getFilter()).toEqual(and(where('order', 'BETWEEN', [new Date(2026, 10, 1), new Date(2026, 10, 30)])));

        // the menu again: the one in use filled, the stop of Tab; the range block shows its days
        openFilterMenu(element, 'order');
        expect(buttons().filter((entry) => entry.getAttribute('aria-current') === 'true')).toEqual([button('thisMonth')]);
        expect(buttons().filter((entry) => entry.tabIndex === 0)).toEqual([button('thisMonth')]);
        const ends = Array.from(document.querySelectorAll<HTMLInputElement>('.simple-html-grid-range-input')).map(
            (input) => input.value
        );
        expect(ends).toEqual(['2026-11-01', '2026-11-30']);
    });

    it("expect a datetime's chip and state: To at 23:59:59", async () => {
        const { element, gridInterface } = await mount();
        pick(element, 'seen', 'today');
        expect(headerFilterInput(element, 'seen').value).toEqual('Today');
        expect(chips(element)).toEqual('Seen = Today');
        expect(gridInterface.getState().headerFilters.seen).toEqual({
            value: [new Date(2026, 10, 22), new Date(2026, 10, 22, 23, 59, 59)],
            operator: 'BETWEEN',
            datePreset: 'today'
        });
    });

    it('expect the other columns’ conditions kept, the column’s own replaced', async () => {
        const { element, datasource } = await mount();
        typeAndEnter(element, 'amount', '3');
        pick(element, 'order', 'thisMonth');
        pick(element, 'order', 'thisWeek');
        expect(datasource.getFilter()).toEqual(
            and(
                where('amount', 'GREATER_THAN_OR_EQUAL_TO', 3),
                where('order', 'BETWEEN', [new Date(2026, 10, 16), new Date(2026, 10, 22)])
            )
        );
        expect(names(datasource)).toEqual(['monday']);
        // a chip each: only the quick date is a name
        expect(chips(element)).toEqual('Amount ≥ 3 AND Order = This week');
    });

    it('expect filter-operator-change when the operator was another one, not when it was Between', async () => {
        const { element, gridInterface } = await mount();
        const events: string[] = [];
        gridInterface.on('filter-operator-change', (data) => events.push(`${data.field} ${data.operator}`));
        pick(element, 'order', 'today');
        pick(element, 'order', 'thisWeek');
        expect(events).toEqual(['order BETWEEN']);
    });

    it('expect the keyboard: one stop of Tab, the arrows in two columns, Home / End, Enter clicks', async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'order');
        expect(buttons().filter((entry) => entry.tabIndex === 0)).toEqual([button('today')]);
        button('today').focus();

        expect(press(button('today'), 'ArrowRight').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button('yesterday'));
        press(button('yesterday'), 'ArrowDown');
        expect(document.activeElement).toBe(button('lastWeek'));
        press(button('lastWeek'), 'ArrowLeft');
        expect(document.activeElement).toBe(button('thisWeek'));
        press(button('thisWeek'), 'ArrowUp');
        expect(document.activeElement).toBe(button('today'));
        // at the edge the focus stays
        expect(press(button('today'), 'ArrowUp').defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(button('today'));
        press(button('today'), 'End');
        expect(document.activeElement).toBe(button('next7Days'));
        press(button('next7Days'), 'Home');
        expect(document.activeElement).toBe(button('today'));
        press(button('today'), 'ArrowDown');
        // the one moved to is the stop of Tab
        expect(buttons().filter((entry) => entry.tabIndex === 0)).toEqual([button('thisWeek')]);
        // other keys are the menu's and the browser's
        expect(press(button('thisWeek'), 'Tab').defaultPrevented).toBe(false);

        // Enter on a button is its click (the browser's): filters, the menu closes
        (document.activeElement as HTMLButtonElement).click();
        expect(names(datasource)).toEqual(['today', 'yesterday', 'monday']);
        expect(openMenus()).toHaveLength(0);
    });

    it('expect a menus.filter hook to see it and remove it', async () => {
        const seen: string[][] = [];
        const { element } = await mountGrid(config(), rows(), fields, {
            menus: {
                filter: (defaults) => {
                    seen.push(defaults.map((entry) => entry.id));
                    return defaults.filter((entry) => entry.id !== 'filter.dates');
                }
            }
        });
        openFilterMenu(element, 'order');
        expect(seen[0]).toContain('filter.dates');
        expect(block()).toBeNull();
    });
});

describe('quick dates - the header filter keeps it until something else replaces it', () => {
    it('expect Enter on its name to filter on it again, the name typed in any case to be the quick date', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'today');
        typeAndEnter(element, 'order', 'Today');
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('today');
        expect(names(datasource)).toEqual(['today']);

        typeAndEnter(element, 'order', '  last week ');
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('lastWeek');
        expect(headerFilterInput(element, 'order').value).toEqual('Last week');
        expect(names(datasource)).toEqual(['lastSunday']);
    });

    it('expect a date typed to replace it: the operator stays Between, the day is fixed', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'thisMonth');
        typeAndEnter(element, 'order', '2026-11-16');
        expect(gridInterface.getState().headerFilters.order).toEqual({
            value: [new Date(2026, 10, 16), new Date(2026, 10, 16)],
            operator: 'BETWEEN'
        });
        expect(names(datasource)).toEqual(['monday']);
        expect(chips(element)).toEqual('Order between 2026-11-16 and 2026-11-16');
    });

    it('expect another operator to replace it with its first day, Between again to keep it', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'thisWeek');
        // Between picked again in Operator ›: still This week
        openFilterMenu(element, 'order');
        menuEntry('filter.operator.between').click();
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('thisWeek');
        expect(headerFilterInput(element, 'order').value).toEqual('This week');

        openFilterMenu(element, 'order');
        menuEntry('filter.operator.greaterThanOrEqualTo').click();
        expect(gridInterface.getState().headerFilters.order).toEqual({
            value: new Date(2026, 10, 16),
            operator: 'GREATER_THAN_OR_EQUAL_TO'
        });
        expect(headerFilterInput(element, 'order').value).toEqual('2026-11-16');
        expect(names(datasource)).toEqual(['today', 'yesterday', 'monday', 'saturday', 'nextSunday']);
    });

    it('expect Clear Filter and Is blank to replace it', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'today');
        openFilterMenu(element, 'order');
        menuEntry('filter.filter.clear').click();
        // the operator picked stays, the quick date is gone
        expect(gridInterface.getState().headerFilters.order).toEqual({ value: null, operator: 'BETWEEN' });
        expect(datasource.getFilter()).toEqual(and());
        expect(headerFilterInput(element, 'order').value).toEqual('');

        pick(element, 'order', 'today');
        openFilterMenu(element, 'order');
        menuEntry('filter.filter.isBlank').click();
        expect(gridInterface.getState().headerFilters.order?.datePreset).toBeUndefined();
        expect(names(datasource)).toEqual(['blank']);
    });

    it('expect the range block’s Apply with nothing changed to keep it, a date changed to make it fixed', async () => {
        const { element, gridInterface } = await mount();
        pick(element, 'order', 'thisMonth');
        const apply = () =>
            Array.from(document.querySelectorAll<HTMLButtonElement>('[data-menu-id="filter.range"] button'))
                .find((entry) => entry.textContent?.trim() === 'Apply')
                ?.click();

        openFilterMenu(element, 'order');
        apply();
        expect(openMenus()).toHaveLength(0);
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('thisMonth');

        openFilterMenu(element, 'order');
        const to = document.querySelectorAll<HTMLInputElement>('.simple-html-grid-range-input')[1];
        to.value = '2026-11-20';
        to.dispatchEvent(new Event('input', { bubbles: true }));
        apply();
        expect(gridInterface.getState().headerFilters.order).toEqual({
            value: [new Date(2026, 10, 1), new Date(2026, 10, 20)],
            operator: 'BETWEEN'
        });
    });

    it('expect filter as you type kept with it, a display format changed to run it again', async () => {
        const { element, datasource, gridInterface } = await mount({ order: { label: 'Order', format: { date: 'weekIso' } } });
        pick(element, 'order', 'thisMonth');
        // the month, not the weeks of its days: a quick date is no period of the format
        expect(names(datasource)).toEqual(['today', 'yesterday', 'monday', 'lastSunday', 'november1', 'saturday', 'nextSunday']);
        gridInterface.__setHeaderFilterOnType('order', true);
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('thisMonth');

        // the format changed by the user (Format ›): the header filter runs again, still the month
        const before = gridInterface.getState().formats;
        gridInterface.setState({ formats: { order: { date: 'month' } } });
        refilterChangedFormats(gridOf(element), before);
        expect(gridInterface.getState().headerFilters.order).toMatchObject({ datePreset: 'thisMonth', filterOnType: true });
        expect(datasource.getFilter()).toEqual(and(where('order', 'BETWEEN', [new Date(2026, 10, 1), new Date(2026, 10, 30)])));
        expect(headerFilterInput(element, 'order').value).toEqual('This month');
    });

    it('expect the filter editor’s Apply to keep it when the column’s conditions are as they were', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'thisMonth');
        const before = datasource.getFilter();
        // as the filter editor's Apply does: the conditions of order unchanged, then changed
        gridInterface.__clearChangedHeaderFilters(
            before,
            and(where('order', 'BETWEEN', [new Date(2026, 10, 1), new Date(2026, 10, 30)]))
        );
        expect(gridInterface.getState().headerFilters.order?.datePreset).toEqual('thisMonth');
        gridInterface.__clearChangedHeaderFilters(
            before,
            and(where('order', 'BETWEEN', [new Date(2026, 10, 1), new Date(2026, 10, 20)]))
        );
        expect(gridInterface.getState().headerFilters.order).toEqual({ value: null, operator: 'BETWEEN' });
    });
});

describe('quick dates - relative: the state computes them again', () => {
    it('expect a state saved today to filter on the days of the day it is set: through JSON, another month', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeAndEnter(element, 'amount', '2');
        pick(element, 'order', 'thisMonth');
        const saved = JSON.parse(JSON.stringify(gridInterface.getState())) as GridState;

        // ten days later: December
        vi.setSystemTime(new Date(2026, 11, 2, 9, 0, 0));
        gridInterface.setState(saved);
        expect(gridInterface.getState().headerFilters.order).toEqual({
            value: [new Date(2026, 11, 1), new Date(2026, 11, 31)],
            operator: 'BETWEEN',
            datePreset: 'thisMonth'
        });
        // the column's condition replaced, the other column's kept
        expect(datasource.getFilter()).toEqual(
            and(
                where('amount', 'GREATER_THAN_OR_EQUAL_TO', 2),
                where('order', 'BETWEEN', [new Date(2026, 11, 1), new Date(2026, 11, 31)])
            )
        );
        expect(names(datasource)).toEqual([]);
        expect(headerFilterInput(element, 'order').value).toEqual('This month');
        expect(chips(element)).toEqual('Amount ≥ 2 AND Order = This month');
    });

    it('expect headerFilters alone, value null, to filter on it', async () => {
        const { datasource, gridInterface } = await mount();
        gridInterface.setState({ headerFilters: { order: { value: null, datePreset: 'yesterday' } } });
        expect(names(datasource)).toEqual(['yesterday']);
        expect(gridInterface.getState().headerFilters.order).toEqual({
            value: [new Date(2026, 10, 21), new Date(2026, 10, 21)],
            operator: 'BETWEEN',
            datePreset: 'yesterday'
        });
    });

    it('expect initialState to filter on it when the grid is made, resetState() on the day it is called', async () => {
        const { datasource, gridInterface } = await mountGrid(
            config({}, { initialState: { headerFilters: { order: { value: null, datePreset: 'today' } } } }),
            rows(),
            fields
        );
        expect(names(datasource)).toEqual(['today']);

        vi.setSystemTime(new Date(2026, 10, 28, 12, 0, 0));
        gridInterface.resetState();
        expect(names(datasource)).toEqual(['saturday']);
    });

    it('expect one a column can not take to be dropped, the rest of the header filter kept', async () => {
        const { gridInterface } = await mount({ seen: { filterOperators: ['EQUAL', 'GREATER_THAN'] } });
        gridInterface.setState({
            headerFilters: {
                name: { value: 'x', datePreset: 'today' },
                amount: { value: 3, datePreset: 'today' },
                seen: { value: null, datePreset: 'today' },
                order: { value: null, datePreset: 'tomorrow' as DatePreset }
            }
        });
        expect(gridInterface.getState().headerFilters).toEqual({ name: { value: 'x' }, amount: { value: 3 } });
        expect(gridInterface.getDatasource().getFilter()).toBeNull();
    });

    it('expect refreshDatePresets() to filter again when the day changed, nothing on the same day', async () => {
        const { element, datasource, gridInterface } = await mount();
        pick(element, 'order', 'today');
        const filter = vi.spyOn(datasource, 'filter');

        gridInterface.refreshDatePresets();
        expect(filter).not.toHaveBeenCalled();

        vi.setSystemTime(new Date(2026, 10, 28, 8, 0, 0));
        gridInterface.refreshDatePresets();
        expect(filter).toHaveBeenCalledTimes(1);
        expect(names(datasource)).toEqual(['saturday']);
        expect(gridInterface.getState().headerFilters.order?.value).toEqual([new Date(2026, 10, 28), new Date(2026, 10, 28)]);
        expect(headerFilterInput(element, 'order').value).toEqual('Today');
    });

    it('expect the window getting the focus back, and the page shown again, to refresh them - not once the grid left the page', async () => {
        const { element, datasource } = await mount();
        pick(element, 'order', 'today');

        vi.setSystemTime(new Date(2026, 10, 21, 8, 0, 0));
        window.dispatchEvent(new Event('focus'));
        expect(names(datasource)).toEqual(['yesterday']);

        vi.setSystemTime(new Date(2026, 10, 16, 8, 0, 0));
        document.dispatchEvent(new Event('visibilitychange'));
        expect(names(datasource)).toEqual(['monday']);

        element.remove();
        vi.setSystemTime(new Date(2026, 10, 22, 8, 0, 0));
        window.dispatchEvent(new Event('focus'));
        expect(names(datasource)).toEqual(['monday']);
    });

    it('expect toSqlWhere to get plain date ranges: from the first day to before the day after the last', async () => {
        const { element, datasource } = await mount();
        pick(element, 'order', 'thisMonth');
        pick(element, 'seen', 'today');
        const options = {
            dialect: 'postgres' as const,
            // the zone the grid made its days in: the browser's
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            columns: {
                order: { column: 'order_date', type: 'date' as const },
                seen: { column: 'seen', type: 'datetime' as const }
            }
        };
        expect(toSqlWhere(datasource.getFilter() as FilterExpression, options)).toEqual({
            sql: '(("order_date" IS NOT NULL AND "order_date" >= CAST($1 AS timestamp) AND "order_date" < CAST($2 AS timestamp)) AND ("seen" IS NOT NULL AND "seen" >= CAST($3 AS timestamp) AND "seen" < CAST($4 AS timestamp)))',
            params: ['2026-11-01 00:00:00', '2026-12-01 00:00:00', '2026-11-22 00:00:00', '2026-11-23 00:00:00']
        });

        // Overdue: before today
        const overdue = await mount({ order: { datePresets: ['overdue'] } });
        pick(overdue.element, 'order', 'overdue');
        expect(toSqlWhere(overdue.datasource.getFilter() as FilterExpression, options)).toEqual({
            sql: '("order_date" IS NOT NULL AND "order_date" < CAST($1 AS timestamp))',
            params: ['2026-11-22 00:00:00']
        });
    });
});

describe('quick dates - the config check', () => {
    const make = (columns: GridConfig['columns']) => () => new GridInterface(config(columns), new Datasource(fields));

    it('expect false, [] and a list of quick dates on a date or datetime column', () => {
        expect(make({ order: { datePresets: false }, seen: { datePresets: [] } })).not.toThrow();
        expect(make({ order: { datePresets: [...DATE_PRESETS] } })).not.toThrow();
    });

    it('expect a TypeError for an id that is none, no list, another type, no BETWEEN', () => {
        expect(make({ order: { datePresets: ['tomorrow'] as unknown as DatePreset[] } })).toThrow(
            /columns\.order\.datePresets is false or a list of quick dates \('today', .*'overdue'\), got \["tomorrow"\]/
        );
        expect(make({ order: { datePresets: true as unknown as false } })).toThrow(/got true/);
        expect(make({ amount: { datePresets: ['today'] } })).toThrow(
            /columns\.amount\.datePresets is for a date or datetime column, this one filters as number/
        );
        expect(make({ name: { datePresets: ['today'] } })).toThrow(/filters as text/);
        expect(make({ order: { filterOperators: ['EQUAL'], datePresets: ['today'] } })).toThrow(/needs 'BETWEEN'/);
        // updateConfig checks it too
        const gridInterface = make({})();
        expect(() =>
            gridInterface.updateConfig({ columns: { order: { datePresets: ['x'] as unknown as DatePreset[] } } })
        ).toThrow(TypeError);
    });
});
