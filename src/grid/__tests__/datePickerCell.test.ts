// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
// the picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { and, where } from '../../datasource/filterExpression';
import type { IDateConfig } from '../../date/interfaces';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, openFilterMenu, sleep, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The date picker the grid opens when a date cell is clicked.
 */

// only the fields to change: datePickerConfig is a Partial<IDateConfig>, it used to need every field
const config = (datePickerConfig?: Partial<IDateConfig>): GridConfig => ({
    readonly: false,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['born'], width: 100 }
        ]
    },
    datePickerConfig
});

const data = () => [{ name: 'a', born: new Date(2001, 4, 17) }];

// the type of a column comes from the datasource
const fields = { fields: { born: 'date' as const } };

/**
 * clicks the date cell, the grid opens the picker in a timeout
 */
/**
 * Clicks the date cell and waits for its picker. It opens in a timer after the click (renderRowCell),
 * and when it opens it sets the timer that ends `menuJustOpened` (showMenu.ts): until then a click
 * outside is taken for the click that opened it. One more task after the picker is there runs after
 * that timer - a fixed sleep raced it on a loaded machine
 */
async function openPicker(element: HTMLElement) {
    const input = element.querySelector('input[data-attribute="born"]') as HTMLInputElement;
    input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

describe('grid date picker', () => {
    it("expect the picker to be the grid's menu: a manual popover on the body, closed on Esc", async () => {
        const { element } = await mountGrid(config(), data(), fields);

        const picker = await openPicker(element);
        const menu = picker.parentElement as HTMLElement;

        expect(menu.parentElement).toBe(document.body);
        expect(menu.className).toEqual('simple-html-grid simple-html-grid-popover');
        expect(menu.popover).toEqual('manual');
        expect(isPopoverShown(menu)).toBe(true);
        // the top layer: no z-index of its own anymore
        expect(menu.style.zIndex).toEqual('');

        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(menu.isConnected).toBe(false);
    });

    it('expect a click in the picker not to close it, a click outside to close it', async () => {
        const { element } = await mountGrid(config(), data(), fields);
        const picker = await openPicker(element);

        (picker.querySelector('.simple-html-date-day') as HTMLElement).click();
        expect(picker.isConnected).toBe(true);

        document.body.click();
        expect(picker.isConnected).toBe(false);
    });

    it('expect the picker to open on the date in the cell', async () => {
        const { element } = await mountGrid(config(), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.simple-html-date-year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect the picker to open on the date when the data holds it as an iso string', async () => {
        const { element } = await mountGrid(config(), [{ name: 'a', born: '2001-05-17' }], fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.simple-html-date-year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
    });

    it('expect weekStart in datePickerConfig not to change the size of the picker', async () => {
        const { element } = await mountGrid(config({ weekStart: 1 }), data(), fields);

        const picker = await openPicker(element);

        // default month width 230 plus a 10px margin on both sides
        expect(picker.style.width).toEqual('250px');
    });

    it('expect weekStart 0 to start the week on sunday', async () => {
        const { element } = await mountGrid(config({ weekStart: 0 }), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Su');
    });

    it('expect every field the grid reads to have a default', async () => {
        const { element } = await mountGrid(config({}), data(), fields);

        const picker = await openPicker(element);

        // English names, weeks from monday with their numbers, 230px month with 10px margins
        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Mo');
        expect(picker.textContent).toContain('May');
        expect(picker.querySelectorAll('.simple-html-date-week').length).toBeGreaterThan(0);
        expect(picker.style.width).toEqual('250px');
        // the dimmed days of the months around are shown
        expect(picker.querySelectorAll('.simple-html-date-day-hidden').length).toEqual(0);
    });

    it('expect the fields given to change only themselves', async () => {
        const { element } = await mountGrid(config({ showWeek: false, monthWidth: 300 }), data(), fields);

        const picker = await openPicker(element);

        expect(picker.querySelectorAll('.simple-html-date-week').length).toEqual(0);
        expect(picker.style.width).toEqual('320px');
        expect(picker.querySelector('.simple-html-date-day-header')?.textContent?.trim()).toEqual('Mo');
    });
});

describe('grid date picker - a header filter', () => {
    /**
     * clicks the header filter of born and waits for its picker, see openPicker
     */
    async function openFilterPicker(element: GridElement) {
        headerFilterInput(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

    /**
     * picks a day of the month shown, then Use
     */
    function pick(picker: HTMLElement, day: string) {
        const days = Array.from(picker.querySelectorAll<HTMLElement>('.simple-html-date-day'));
        days.find((element) => element.textContent?.trim() === day)?.click();
        (picker.querySelector('.simple-html-date-button-primary') as HTMLElement).click();
    }

    it('expect a picked date to be stored as a Date, as a typed one is', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields);

        // an empty filter opens on today
        pick(await openFilterPicker(element), '18');

        // it was the date as text, 'YYYY-MM-18'
        const today = new Date();
        const picked = new Date(today.getFullYear(), today.getMonth(), 18);
        expect(gridInterface.getState().headerFilters.born.value).toEqual(picked);
        expect(datasource.getFilter()).toEqual(and(where('born', 'GREATER_THAN_OR_EQUAL_TO', picked)));
    });

    it('expect the picker to open on the date typed, and the date picked to be shown', async () => {
        const { element, gridInterface } = await mountGrid(config(), data(), fields);
        typeInHeaderFilter(element, 'born', '2001-05-17');
        expect(gridInterface.getState().headerFilters.born.value).toEqual(new Date(2001, 4, 17));

        // it opened on the text the cell had when it was rendered: empty here, today
        const picker = await openFilterPicker(element);
        expect(picker.querySelector('.simple-html-date-year')?.textContent?.trim()).toEqual('2001');
        expect(picker.querySelector('.simple-html-date-day-selected')?.textContent?.trim()).toEqual('17');
        pick(picker, '18');

        expect(gridInterface.getState().headerFilters.born.value).toEqual(new Date(2001, 4, 18));
        expect(headerFilterInput(element, 'born').value).toEqual('2001-05-18');
    });

    it('expect Clear in the picker to clear the header filter', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields);
        typeInHeaderFilter(element, 'born', '2001-05-17');

        const picker = await openFilterPicker(element);
        const clear = Array.from(picker.querySelectorAll<HTMLElement>('.simple-html-date-button')).find(
            (button) => button.textContent?.trim() === 'Clear'
        );
        clear?.click();

        expect(gridInterface.getState().headerFilters).toEqual({});
        expect(datasource.getFilter()).toEqual(and());
        expect(headerFilterInput(element, 'born').value).toEqual('');
    });
});

describe('grid date picker - a header filter with BETWEEN: the range picker', () => {
    /**
     * clicks the header filter of born and waits for its picker, see openPicker
     */
    async function openFilterPicker(element: GridElement) {
        headerFilterInput(element, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

    /** born's header filter with Between, as picked in its menu (Filter › Operator ›) */
    function between(element: GridElement) {
        openFilterMenu(element, 'born');
        menuEntry('filter.operator.between').click();
    }

    /** the days of the first month shown, not the dimmed days of the months around it */
    const days = (picker: HTMLElement) =>
        Array.from(
            picker
                .querySelector('.simple-html-date-month')
                ?.querySelectorAll<HTMLElement>('.simple-html-date-day:not(.simple-html-date-day-dimmed)') ?? []
        );
    const clickDay = (picker: HTMLElement, day: number) => days(picker)[day - 1].click();
    const marked = (picker: HTMLElement, className: string) =>
        days(picker)
            .filter((cell) => cell.classList.contains(className))
            .map((cell) => Number(cell.textContent?.trim()));
    const button = (picker: HTMLElement, text: string) =>
        Array.from(picker.querySelectorAll<HTMLElement>('.simple-html-date-range button')).find(
            (candidate) => candidate.textContent?.trim() === text
        ) as HTMLElement;

    it('expect the range picker, on the from..to of the cell: two months, From and To picked', async () => {
        const { element } = await mountGrid(config(), data(), fields);
        between(element);
        typeInHeaderFilter(element, 'born', '2001-05-10..2001-05-20');

        const picker = await openFilterPicker(element);

        expect(picker.querySelector('.simple-html-date-range')).not.toBeNull();
        expect(picker.querySelectorAll('.simple-html-date-month')).toHaveLength(2);
        expect(picker.querySelector('.simple-html-date-month-title')?.textContent?.replace(/\s+/g, ' ').trim()).toEqual(
            'May 2001'
        );
        expect(marked(picker, 'simple-html-date-day-selected')).toEqual([10, 20]);
        expect(marked(picker, 'simple-html-date-day-in-range')).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19]);
        // the grid's menu, as the date picker
        expect(isPopoverShown(picker.parentElement)).toBe(true);
    });

    it('expect two days picked and Use to filter from..to, the cell to show it, the picker to close', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields);
        between(element);
        typeInHeaderFilter(element, 'born', '2001-05-10..2001-05-20');
        const picker = await openFilterPicker(element);

        // From and To were picked: the next day starts again
        clickDay(picker, 12);
        clickDay(picker, 17);
        button(picker, 'Use').click();

        const range = [new Date(2001, 4, 12), new Date(2001, 4, 17)];
        expect(gridInterface.getState().headerFilters.born).toEqual({ value: range, operator: 'BETWEEN' });
        expect(datasource.getFilter()).toEqual(and(where('born', 'BETWEEN', range)));
        expect(headerFilterInput(element, 'born').value).toEqual('2001-05-12..2001-05-17');
        expect(picker.isConnected).toBe(false);
        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['a']);
    });

    it('expect one day picked to be an open end: from..', async () => {
        const { element, datasource } = await mountGrid(config(), data(), fields);
        between(element);
        typeInHeaderFilter(element, 'born', '2001-05-10..2001-05-20');
        const picker = await openFilterPicker(element);

        clickDay(picker, 18);
        button(picker, 'Use').click();

        expect(headerFilterInput(element, 'born').value).toEqual('2001-05-18..');
        expect(datasource.getFilter()).toEqual(and(where('born', 'BETWEEN', [new Date(2001, 4, 18), null])));
    });

    it('expect Clear to clear the filter, the operator kept', async () => {
        const { element, datasource, gridInterface } = await mountGrid(config(), data(), fields);
        between(element);
        typeInHeaderFilter(element, 'born', '2001-05-10..2001-05-20');
        const picker = await openFilterPicker(element);

        button(picker, 'Clear').click();

        expect(gridInterface.getState().headerFilters.born).toEqual({ value: null, operator: 'BETWEEN' });
        expect(datasource.getFilter()).toEqual(and());
        expect(headerFilterInput(element, 'born').value).toEqual('');
        expect(picker.isConnected).toBe(false);
    });

    it('expect an empty BETWEEN cell to open on today, nothing picked', async () => {
        const { element } = await mountGrid(config(), data(), fields);
        between(element);

        const picker = await openFilterPicker(element);

        const today = new Date();
        expect(picker.querySelector('.simple-html-date-year')?.textContent?.trim()).toEqual(String(today.getFullYear()));
        expect(picker.querySelectorAll('.simple-html-date-day-selected')).toHaveLength(0);
    });

    it('expect a datetime range to be whole days: From at 00:00, To at 23:59:59', async () => {
        const rows = [
            { name: 'early', born: new Date(2001, 4, 12, 0, 0, 0) },
            { name: 'late', born: new Date(2001, 4, 17, 23, 59, 30) },
            { name: 'after', born: new Date(2001, 4, 18, 0, 0, 0) }
        ];
        const { element, datasource } = await mountGrid(config(), rows, { fields: { born: 'datetime' as const } });
        between(element);
        typeInHeaderFilter(element, 'born', '2001-05-10..2001-05-20');
        const picker = await openFilterPicker(element);

        clickDay(picker, 12);
        clickDay(picker, 17);
        button(picker, 'Use').click();

        expect(headerFilterInput(element, 'born').value).toEqual('2001-05-12T00:00:00..2001-05-17T23:59:59');
        expect(datasource.getDataRows().map((row) => row.name)).toEqual(['early', 'late']);
    });

    it('expect another operator after Between to open the date picker again', async () => {
        const { element } = await mountGrid(config(), data(), fields);
        between(element);
        openFilterMenu(element, 'born');
        menuEntry('filter.operator.lessThan').click();

        const picker = await openFilterPicker(element);

        expect(picker.querySelector('.simple-html-date-range')).toBeNull();
        expect(picker.querySelector('.simple-html-date-time')).not.toBeNull();
    });
});
