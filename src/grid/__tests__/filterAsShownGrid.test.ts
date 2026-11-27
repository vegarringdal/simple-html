// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { and, or, where } from '../../datasource/filterExpression';
import { assertColumnFormat } from '../columnFormat';
import type { GridConfig, GridState } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    headerFilterInput,
    menuEntry,
    openFilterMenu,
    openLabelMenu,
    openMenus,
    sleep,
    typeInHeaderFilter
} from './interactionTestHelpers';

/**
 * Filter as shown in the grid (ColumnFormat.filterAsShown, filterAsShown.ts, headerFilterFormatter.ts):
 * the header filter of a column with a display format takes the text as its cells show it - a week, a
 * month, a number with its separators - and filters on the whole period with ordinary conditions. The
 * cell shows the text again after a render and after a state from JSON, the date pickers and the range
 * block write and read the display format, a change of the format runs the filter again, and the grid
 * config dialog turns it off. The reading of each format is tested in filterAsShown.test.ts.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
    const codes = new Datasource();
    codes.setData([{ code: 1, name: 'One' }]);
    registerLookup('as-shown-codes', { datasource: codes, valueField: 'code', labelField: 'name' });
});
afterAll(() => {
    if (originalTimeZone === undefined) {
        delete process.env.TZ;
    } else {
        process.env.TZ = originalTimeZone;
    }
});

beforeEach(() => {
    document.body.innerHTML = '';
    // today is Sunday 2026-11-22: the days until, the placeholders. Only Date: the grid's timers run
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10, 0, 0));
});

afterEach(() => {
    vi.useRealTimers();
});

/** a local date and time */
const at = (year: number, month: number, day: number, hours = 0, minutes = 0, seconds = 0) =>
    new Date(year, month - 1, day, hours, minutes, seconds);

const MONDAY = at(2026, 11, 16);
const SUNDAY = at(2026, 11, 22);

/**
 * a: Sunday of week 46, b c d: Monday, Thursday, Sunday of week 47, e: Monday of week 48, f: no date, g:
 * week 40. `at` the same days at 13:45:xx, `credit` and `share` numbers
 */
const rows = () => [
    { name: 'a', due: at(2026, 11, 15), at: at(2026, 11, 15, 13, 45, 1), credit: 1234.5, share: 0.25, wd: at(2026, 11, 15) },
    { name: 'b', due: at(2026, 11, 16), at: at(2026, 11, 22, 13, 45, 30), credit: 1234.4, share: 0.5, wd: at(2026, 11, 16) },
    { name: 'c', due: at(2026, 11, 19), at: at(2026, 11, 22, 13, 46), credit: 99999.25, share: 0.75, wd: at(2026, 11, 19) },
    { name: 'd', due: at(2026, 11, 22), at: null, credit: 0, share: 0, wd: at(2026, 11, 22) },
    { name: 'e', due: at(2026, 11, 23), at: null, credit: null, share: null, wd: null },
    { name: 'f', due: null, at: null, credit: -5, share: 1, wd: null },
    { name: 'g', due: at(2026, 10, 1), at: null, credit: 5, share: 0.1, wd: null }
];

const FIELDS = ['name', 'due', 'at', 'credit', 'share', 'wd', 'code'];

const config = (columns: GridConfig['columns'] = {}): GridConfig => ({
    columns: {
        due: { format: { date: 'weekIso' } },
        at: { format: { date: 'isoTime' } },
        credit: { format: { number: { decimals: 2, thousands: ' ', decimal: ',' } } },
        share: { format: { number: { decimals: 1, percent: true } } },
        wd: { format: { date: 'weekday' } },
        code: { editor: { type: 'select', lookup: 'as-shown-codes' } },
        ...columns
    },
    layout: { center: FIELDS.map((field) => ({ fields: [field], width: 100 })) }
});

const fields = {
    fields: {
        due: 'date' as const,
        at: 'datetime' as const,
        credit: 'number' as const,
        share: 'number' as const,
        wd: 'date' as const,
        code: 'number' as const
    }
};

const mount = (columns: GridConfig['columns'] = {}) => mountGrid(config(columns), rows(), fields);

const names = (datasource: Datasource) => datasource.getRows().map((row) => row.name);

/** the operator of a header filter, as picked in Filter › Operator › */
const pickOperator = (element: GridElement, field: string, id: string) => {
    openFilterMenu(element, field);
    menuEntry(id).click();
};

describe('filter as shown - a week', () => {
    it('expect 2026-W47 with = to be the week: a BETWEEN of Monday and Sunday, the rows of the week', async () => {
        const { element, datasource, gridInterface } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-W47');

        expect(names(datasource)).toEqual(['b', 'c', 'd']);
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
        // the state holds the start of the week typed
        expect(gridInterface.getState().headerFilters.due).toEqual({ value: MONDAY });
    });

    it('expect each operator on the week: ≥ from Monday, > after Sunday, < before Monday, ≤ to Sunday, ≠ the rest and the blank', async () => {
        const { element, datasource, gridInterface } = await mount();
        const rowsOf = (
            operator:
                | 'EQUAL'
                | 'NOT_EQUAL_TO'
                | 'LESS_THAN'
                | 'LESS_THAN_OR_EQUAL_TO'
                | 'GREATER_THAN'
                | 'GREATER_THAN_OR_EQUAL_TO'
        ) => {
            gridInterface.setState({ headerFilters: { due: { value: null, operator } } });
            typeInHeaderFilter(element, 'due', '');
            typeInHeaderFilter(element, 'due', '2026-W47');
            return names(datasource);
        };
        expect(rowsOf('GREATER_THAN_OR_EQUAL_TO')).toEqual(['b', 'c', 'd', 'e']);
        expect(rowsOf('GREATER_THAN')).toEqual(['e']);
        expect(rowsOf('LESS_THAN')).toEqual(['a', 'g']);
        expect(rowsOf('LESS_THAN_OR_EQUAL_TO')).toEqual(['a', 'b', 'c', 'd', 'g']);
        expect(rowsOf('EQUAL')).toEqual(['b', 'c', 'd']);
        expect(rowsOf('NOT_EQUAL_TO')).toEqual(['a', 'e', 'f', 'g']);
        expect(datasource.getFilter()).toEqual(
            and(or(where('due', 'LESS_THAN', MONDAY), where('due', 'GREATER_THAN', SUNDAY), where('due', 'IS_BLANK')))
        );
    });

    it('expect ≠ typed again to replace its OR group, not to add one: the header filter owns it', async () => {
        const { element, datasource } = await mount({ due: { format: { date: 'weekIso' }, operator: 'NOT_EQUAL_TO' } });
        // a condition on another column is kept
        datasource.filter(and(where('credit', 'GREATER_THAN', -10)));
        typeInHeaderFilter(element, 'due', '2026-W47');
        typeInHeaderFilter(element, 'due', '2026-W46');

        expect(datasource.getFilter()).toEqual(
            and(
                where('credit', 'GREATER_THAN', -10),
                or(
                    where('due', 'LESS_THAN', at(2026, 11, 9)),
                    where('due', 'GREATER_THAN', at(2026, 11, 15)),
                    where('due', 'IS_BLANK')
                )
            )
        );
        // the blank date and week 48 too
        expect(names(datasource)).toEqual(['b', 'c', 'd', 'e', 'f', 'g']);

        // emptied: no condition of the column, the group gone
        typeInHeaderFilter(element, 'due', '');
        expect(datasource.getFilter()).toEqual(and(where('credit', 'GREATER_THAN', -10)));
    });

    it('expect the cell to show 2026-W47 again after the header is rendered again', async () => {
        const { element, gridInterface } = await mount();
        typeInHeaderFilter(element, 'due', '2026-w47');
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W47');
    });

    it('expect another operator picked to run the week again', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'due', '2026-W47');
        expect(names(datasource)).toEqual(['b', 'c', 'd', 'e']);

        pickOperator(element, 'due', 'filter.operator.equal');
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W47');
    });

    it('expect BETWEEN 2026-W40..2026-W47 from Monday of week 40 to Sunday of week 47, shown again so', async () => {
        const { element, datasource, gridInterface } = await mount({ due: { format: { date: 'weekIso' }, operator: 'BETWEEN' } });
        typeInHeaderFilter(element, 'due', '2026-W40..2026-W47');

        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [at(2026, 9, 28), SUNDAY])));
        expect(names(datasource)).toEqual(['a', 'b', 'c', 'd', 'g']);
        expect(gridInterface.getState().headerFilters.due.value).toEqual([at(2026, 9, 28), MONDAY]);
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W40..2026-W47');

        // an open end
        typeInHeaderFilter(element, 'due', '2026-W47..');
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, null])));
    });

    it('expect an ISO date typed in the week column to be its week', async () => {
        const { element, datasource, gridInterface } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-11-19');
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W47');
    });

    it('expect text that is no week to be no filter', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'due', '2026-W54');
        expect(datasource.getFilter()).toEqual(and());
        expect(names(datasource)).toHaveLength(7);
    });
});

describe('filter as shown - the state', () => {
    it('expect a state through JSON to show 2026-W47 and to filter the week when it runs again', async () => {
        const first = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(first.element, 'due', '2026-W47');
        const saved: GridState = JSON.parse(JSON.stringify(first.gridInterface.getState()));
        // the Date as its ISO text: Monday 00:00 in Oslo
        expect(saved.headerFilters.due).toEqual({ value: '2026-11-15T23:00:00.000Z' });

        document.body.innerHTML = '';
        const second = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        second.gridInterface.setState(saved);
        expect(headerFilterInput(second.element, 'due').value).toEqual('2026-W47');
        expect(names(second.datasource)).toEqual(['b', 'c', 'd']);

        // run again from the text of the state: Greater than, after Sunday
        pickOperator(second.element, 'due', 'filter.operator.greaterThan');
        expect(second.datasource.getFilter()).toEqual(and(where('due', 'GREATER_THAN', SUNDAY)));
        expect(headerFilterInput(second.element, 'due').value).toEqual('2026-W47');
    });

    it('expect a BETWEEN of weeks through JSON too', async () => {
        const first = await mount({ due: { format: { date: 'weekIso' }, operator: 'BETWEEN' } });
        typeInHeaderFilter(first.element, 'due', '2026-W40..2026-W47');
        const saved: GridState = JSON.parse(JSON.stringify(first.gridInterface.getState()));

        document.body.innerHTML = '';
        const second = await mount({ due: { format: { date: 'weekIso' }, operator: 'BETWEEN' } });
        second.gridInterface.setState(saved);
        expect(headerFilterInput(second.element, 'due').value).toEqual('2026-W40..2026-W47');
        // run again from the texts of the state - as Match case and another operator do: the same range
        pickOperator(second.element, 'due', 'filter.operator.between');
        expect(second.datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [at(2026, 9, 28), SUNDAY])));
    });
});

describe('filter as shown - other formats', () => {
    it('expect a minute of a date and time format to be the minute: 13:45:00 to 13:45:59', async () => {
        const { element, datasource, gridInterface } = await mount({ at: { format: { date: 'isoTime' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'at', '2026-11-22 13:45');
        expect(datasource.getFilter()).toEqual(
            and(where('at', 'BETWEEN', [at(2026, 11, 22, 13, 45), at(2026, 11, 22, 13, 45, 59)]))
        );
        expect(names(datasource)).toEqual(['b']);
        // an ISO date alone: its first minute, as the cell shows it then
        typeInHeaderFilter(element, 'at', '2026-11-22');
        expect(datasource.getFilter()).toEqual(and(where('at', 'BETWEEN', [at(2026, 11, 22), at(2026, 11, 22, 0, 0, 59)])));
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'at').value).toEqual('2026-11-22 00:00');
    });

    it('expect the days until: ≤ 5 is up to the day in 5 days', async () => {
        const { element, datasource, gridInterface } = await mount({
            due: { format: { date: 'daysUntil' }, operator: 'LESS_THAN_OR_EQUAL_TO' }
        });
        expect(headerFilterInput(element, 'due').placeholder).toEqual('Days from today');
        typeInHeaderFilter(element, 'due', '0');
        // today, Sunday 22, and before
        expect(names(datasource)).toEqual(['a', 'b', 'c', 'd', 'g']);
        typeInHeaderFilter(element, 'due', '1');
        expect(datasource.getFilter()).toEqual(and(where('due', 'LESS_THAN_OR_EQUAL_TO', at(2026, 11, 23))));
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'due').value).toEqual('1');
    });

    it('expect a number typed with the separators of the format, shown so again', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'credit', '1 234,5');
        expect(datasource.getFilter()).toEqual(and(where('credit', 'GREATER_THAN_OR_EQUAL_TO', 1234.5)));
        expect(names(datasource)).toEqual(['a', 'c']);
        expect(gridInterface.getState().headerFilters.credit.value).toBe(1234.5);
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'credit').value).toEqual('1 234,5');
        expect(headerFilterInput(element, 'credit').placeholder).toEqual('1 234,5');
    });

    it('expect a percent typed as shown: 50 % is 0.5', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'share', '50 %');
        expect(datasource.getFilter()).toEqual(and(where('share', 'GREATER_THAN_OR_EQUAL_TO', 0.5)));
        expect(names(datasource)).toEqual(['b', 'c', 'f']);
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'share').value).toEqual('50 %');
    });

    it("expect the day of the week to keep to the field's format: no period", async () => {
        const { element, datasource } = await mount({ wd: { format: { date: 'weekday' }, operator: 'EQUAL' } });
        expect(headerFilterInput(element, 'wd').placeholder).toEqual('YYYY-MM-DD');
        typeInHeaderFilter(element, 'wd', '2026-11-16');
        expect(datasource.getFilter()).toEqual(and(where('wd', 'EQUAL', MONDAY)));
        expect(names(datasource)).toEqual(['b']);
    });

    it('expect the placeholder to be today in the display format, a BETWEEN its from..to', async () => {
        const { element, gridInterface } = await mount();
        expect(headerFilterInput(element, 'due').placeholder).toEqual('2026-W47');
        expect(headerFilterInput(element, 'at').placeholder).toEqual('2026-11-22 10:00');
        expect(headerFilterInput(element, 'share').placeholder).toEqual('50 %');
        gridInterface.setState({ headerFilters: { due: { value: null, operator: 'BETWEEN' } } });
        expect(headerFilterInput(element, 'due').placeholder).toEqual('from..to');
    });

    it("expect the column's own placeholderFilter to win", async () => {
        const { element } = await mount({ due: { format: { date: 'weekIso' }, placeholderFilter: 'Week' } });
        expect(headerFilterInput(element, 'due').placeholder).toEqual('Week');
    });
});

describe('filter as shown - turned off', () => {
    it("expect filterAsShown: false to read the field's format: 2026-W47 is no date, 2026-11-16 the day", async () => {
        const { element, datasource, gridInterface } = await mount({
            due: { format: { date: 'weekIso', filterAsShown: false }, operator: 'EQUAL' }
        });
        expect(headerFilterInput(element, 'due').placeholder).toEqual('YYYY-MM-DD');
        typeInHeaderFilter(element, 'due', '2026-W47');
        expect(datasource.getFilter()).toEqual(and());
        typeInHeaderFilter(element, 'due', '2026-11-16');
        expect(datasource.getFilter()).toEqual(and(where('due', 'EQUAL', MONDAY)));
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'due').value).toEqual('2026-11-16');
    });

    it('expect a number with filterAsShown: false to be read by the field formatter', async () => {
        const { element, datasource } = await mount({
            credit: { format: { number: { thousands: ' ', decimal: ',' }, filterAsShown: false } }
        });
        typeInHeaderFilter(element, 'credit', '1 234,5');
        // parseFloat reads up to the space
        expect(datasource.getFilter()).toEqual(and(where('credit', 'GREATER_THAN_OR_EQUAL_TO', 1)));
    });

    it('expect the check of a format: true or false, for a date, datetime or number field, not a lookup column', () => {
        const check =
            (format: unknown, type: 'date' | 'text' | 'number' = 'date', lookup = false) =>
            () =>
                assertColumnFormat(format, 'due', type, lookup, 'GridConfig: columns.due.format');
        expect(check({ date: 'weekIso', filterAsShown: false })).not.toThrow();
        expect(check({ number: {}, filterAsShown: true }, 'number')).not.toThrow();
        expect(check({ date: 'weekIso', filterAsShown: 'no' })).toThrow(
            'GridConfig: columns.due.format.filterAsShown is "no", it is true or false'
        );
        // a text field: its template is filtered as shown, false filters the value
        expect(check({ text: '{due} x', filterAsShown: false }, 'text')).not.toThrow();
        expect(check({ filterAsShown: false }, 'number', true)).toThrow("'due' is a lookup column");
    });

    it('expect a lookup column to find the labels, as always', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'code', 'one');
        expect(datasource.getFilter()).toEqual(and(where('code', 'IN', [1])));
    });
});

describe('filter as shown - the pickers and the range block', () => {
    /** clicks the header filter of a column and waits for its picker */
    async function openPicker(element: GridElement, field: string) {
        headerFilterInput(element, field).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        const picker = await vi.waitFor(() => {
            const found = document.querySelector('simple-html-date');
            if (!found) {
                throw new Error('the picker is not open yet');
            }
            return found as HTMLElement;
        });
        await sleep(0);
        return picker;
    }
    /** the days of the first month shown */
    const days = (picker: HTMLElement) =>
        Array.from(
            picker
                .querySelector('.simple-html-date-month')
                ?.querySelectorAll<HTMLElement>('.simple-html-date-day:not(.simple-html-date-day-dimmed)') ?? []
        );
    const marked = (picker: HTMLElement, className: string) =>
        days(picker)
            .filter((cell) => cell.classList.contains(className))
            .map((cell) => Number(cell.textContent?.trim()));

    it('expect a day picked in a week column to write its week', async () => {
        const { element, datasource } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        const picker = await openPicker(element, 'due');
        days(picker)[17].click();
        (picker.querySelector('.simple-html-date-button-primary') as HTMLElement).click();

        expect(headerFilterInput(element, 'due').value).toEqual('2026-W47');
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
    });

    it('expect the range picker on weeks: from Monday of the first to Sunday of the last, Use writes weeks', async () => {
        const { element, datasource } = await mount({ due: { format: { date: 'weekIso' }, operator: 'BETWEEN' } });
        typeInHeaderFilter(element, 'due', '2026-W46..2026-W47');
        const picker = await openPicker(element, 'due');
        // Monday 9 to Sunday 22 November
        expect(marked(picker, 'simple-html-date-day-selected')).toEqual([9, 22]);

        days(picker)[1].click();
        days(picker)[25].click();
        const use = Array.from(picker.querySelectorAll<HTMLElement>('.simple-html-date-range button')).find(
            (button) => button.textContent?.trim() === 'Use'
        ) as HTMLElement;
        use.click();

        // 2 and 26 November: weeks 45 and 48
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W45..2026-W48');
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [at(2026, 11, 2), at(2026, 11, 29)])));
    });

    it('expect the range block to show and read weeks: its placeholder, From and To, Apply', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'due', '2026-W40');
        openFilterMenu(element, 'due');
        const block = document.querySelector('.simple-html-grid-menu [data-menu-id="filter.range"]') as HTMLElement;
        const inputs = () => Array.from(block.querySelectorAll<HTMLInputElement>('.simple-html-grid-range-input'));
        expect(inputs()[0].value).toEqual('2026-W40');
        expect(inputs()[0].placeholder).toEqual('2026-W47');

        // Between: From and To
        const between = Array.from(block.querySelectorAll<HTMLLabelElement>('.simple-html-grid-range-operator')).find(
            (label) => label.textContent?.trim() === 'Between'
        ) as HTMLLabelElement;
        between.querySelector('input')?.dispatchEvent(new Event('change', { bubbles: true }));
        const [from, to] = inputs();
        from.value = '2026-W40';
        from.dispatchEvent(new Event('input', { bubbles: true }));
        to.value = '2026-W46';
        to.dispatchEvent(new Event('input', { bubbles: true }));
        (
            Array.from(block.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Apply') as HTMLElement
        ).click();

        expect(openMenus()).toHaveLength(0);
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [at(2026, 9, 28), at(2026, 11, 15)])));
        expect(headerFilterInput(element, 'due').value).toEqual('2026-W40..2026-W46');
    });
});

describe('filter as shown - a change of the format', () => {
    it('expect Format › month in the header menu to run the filter again: November, the cell 2026-11', async () => {
        const { element, datasource } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-W47');

        openLabelMenu(element, 'due');
        menuEntry('header.format.date.month').click();

        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [at(2026, 11, 1), at(2026, 11, 30)])));
        expect(names(datasource)).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(headerFilterInput(element, 'due').value).toEqual('2026-11');
    });

    it("expect Default in Format › to run it as the field's: the day", async () => {
        const { element, datasource } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-W47');

        openLabelMenu(element, 'due');
        menuEntry('header.format.default').click();

        expect(datasource.getFilter()).toEqual(and(where('due', 'EQUAL', MONDAY)));
        expect(headerFilterInput(element, 'due').value).toEqual('2026-11-16');
    });

    it('expect setState({ formats }) from code to leave the filter as it is', async () => {
        const { element, datasource, gridInterface } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-W47');
        gridInterface.setState({ formats: { due: { date: 'month' } } });
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
    });

    it('expect the filter editor applied without a change to keep the text of the cell: the ≠ group is the column’s', async () => {
        const { element, datasource, gridInterface } = await mount({
            due: { format: { date: 'weekIso' }, operator: 'NOT_EQUAL_TO' }
        });
        typeInHeaderFilter(element, 'due', '2026-W47');
        const before = datasource.getFilter();
        gridInterface.__clearChangedHeaderFilters(before, structuredClone(before));
        expect(gridInterface.getState().headerFilters.due.value).toEqual(MONDAY);
        // the group changed: the cell is emptied - nothing else of it in the state
        gridInterface.__clearChangedHeaderFilters(before, and());
        expect(gridInterface.getState().headerFilters.due).toBeUndefined();
        expect(headerFilterInput(element, 'due')).toBeTruthy();
    });
});

describe('filter as shown - the grid config dialog', () => {
    const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
    const asShown = () => dialog().querySelector<HTMLInputElement>('.column-settings-filter-as-shown');
    const hint = () => asShown()?.closest('.column-settings-field')?.querySelector('.column-settings-hint')?.textContent?.trim();
    const apply = () =>
        (
            Array.from(dialog().querySelectorAll('button')).find(
                (button) => button.textContent?.trim() === 'Apply'
            ) as HTMLElement
        ).click();

    it('expect Filter as shown under the format, on by default, the hint under it', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('due');
        expect(asShown()?.checked).toBe(true);
        expect(asShown()?.disabled).toBe(false);
        expect(hint()).toEqual(
            'The header filter takes the text as the cells show it: a week, a month, a year is the whole of it'
        );
        gridInterface.openColumnSettings('credit');
        expect(asShown()?.checked).toBe(true);
    });

    it('expect it off and greyed out for the day of the week, the hint says why; none without a format', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('wd');
        expect(asShown()?.checked).toBe(false);
        expect(asShown()?.disabled).toBe(true);
        expect(hint()).toEqual("Not for the day of the week or the time of day: the header filter takes the field's format");
        gridInterface.openColumnSettings('name');
        expect(asShown()).toBeNull();
    });

    it('expect it turned off and applied: filterAsShown false in the state, the header filter run again', async () => {
        const { element, datasource, gridInterface } = await mount({ due: { format: { date: 'weekIso' }, operator: 'EQUAL' } });
        typeInHeaderFilter(element, 'due', '2026-W47');
        gridInterface.openColumnSettings('due');
        const box = asShown() as HTMLInputElement;
        box.checked = false;
        box.dispatchEvent(new Event('change', { bubbles: true }));
        apply();

        expect(gridInterface.getState().formats.due).toEqual({ date: 'weekIso', filterAsShown: false });
        expect(datasource.getFilter()).toEqual(and(where('due', 'EQUAL', MONDAY)));
        expect(headerFilterInput(element, 'due').value).toEqual('2026-11-16');

        // on again: left out of the format
        gridInterface.openColumnSettings('due');
        const again = asShown() as HTMLInputElement;
        again.checked = true;
        again.dispatchEvent(new Event('change', { bubbles: true }));
        apply();
        expect(gridInterface.getState().formats.due).toEqual({ date: 'weekIso' });
        expect(datasource.getFilter()).toEqual(and(where('due', 'BETWEEN', [MONDAY, SUNDAY])));
    });
});
