// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import type { Datasource } from '../../datasource/dataSource';
import { and, where } from '../../datasource/filterExpression';
import { NumberFormatterDot } from '../../datasource/numberFormatterDot';
import type { GridConfig, GridState } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { FILTER_ON_TYPE_DELAY, filterTextParses } from '../gridFunctions/filterOnType';
import { GridInterface } from '../gridInterface';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, openFilterMenu, openMenus } from './interactionTestHelpers';

/**
 * Filter as you type (filterOnType.ts): the header filter filters after a pause in typing - not before,
 * once with Enter or leaving the cell, the focus and the caret kept, a date or number only when the text
 * is one. Turned on and off in the operator choice, Filter › and the grid config dialog, kept in the state;
 * the defaults of the column and the grid.
 */

// local dates: a time zone with summer time. Node reads TZ again when it is set
const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
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
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

const rows = () => [
    { name: 'Ann', age: 10, born: new Date(2026, 10, 16), due: new Date(2026, 10, 16), active: true },
    { name: 'Anna', age: -5, born: new Date(2026, 10, 23), due: new Date(2026, 10, 23), active: false },
    { name: 'Bob', age: 30, born: null, due: null, active: null }
];

const FIELDS = ['name', 'age', 'born', 'due', 'active'];

const config = (more: Partial<GridConfig> = {}, columns: GridConfig['columns'] = {}): GridConfig => ({
    columns: {
        name: { operator: 'BEGIN_WITH' },
        due: { format: { date: 'weekIso' }, operator: 'EQUAL' },
        ...columns
    },
    layout: { center: FIELDS.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const fields = { fields: { age: 'number' as const, born: 'date' as const, due: 'date' as const, active: 'boolean' as const } };

/** a grid whose name, age, born and due filter as you type, unless `more` / `columns` say else */
const mount = (more: Partial<GridConfig> = { filterOnType: true }, columns: GridConfig['columns'] = {}) =>
    mountGrid(config(more, columns), rows(), fields);

const names = (datasource: Datasource) => datasource.getRows().map((row) => row.name);

/** typing in a header filter, as the browser does it: the text, the caret at its end, an input event */
const typeText = (element: GridElement, field: string, text: string) => {
    const input = headerFilterInput(element, field);
    input.focus();
    input.value = text;
    input.setSelectionRange(text.length, text.length);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return input;
};

/** a key on the header filter, as the browser sends it */
const press = (element: GridElement, field: string, key: string) =>
    headerFilterInput(element, field).dispatchEvent(
        new KeyboardEvent('keydown', { key, keyCode: key === 'Enter' ? 13 : 0, bubbles: true, cancelable: true })
    );

/** the pause, its timers run: only setTimeout, the grid's Date stays real */
const fakePause = () => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

describe('filter as you type - the pause', () => {
    it('expect the filter after a pause in typing, not before, no Enter needed - a key starts the pause again', async () => {
        const { element, datasource } = await mount();
        fakePause();
        typeText(element, 'name', 'an');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY - 1);
        expect(datasource.getFilter()).toBeNull();

        typeText(element, 'name', 'ann');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY - 1);
        expect(datasource.getFilter()).toBeNull();
        vi.advanceTimersByTime(1);
        expect(datasource.getFilter()).toEqual(and(where('name', 'BEGIN_WITH', 'ann')));
        expect(names(datasource)).toEqual(['Ann', 'Anna']);
    });

    it('expect the focus and the caret to stay in the input', async () => {
        const { element } = await mount();
        fakePause();
        const input = typeText(element, 'name', 'anna');
        input.setSelectionRange(2, 2);
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);

        expect(document.activeElement).toBe(headerFilterInput(element, 'name'));
        expect(headerFilterInput(element, 'name').value).toEqual('anna');
        expect(headerFilterInput(element, 'name').selectionStart).toBe(2);
    });

    it('expect Enter in the pause to filter once: the pause is canceled', async () => {
        const { element, datasource } = await mount();
        fakePause();
        const filter = vi.spyOn(datasource, 'filter');
        typeText(element, 'name', 'bo');
        press(element, 'name', 'Enter');
        expect(filter).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY * 2);
        expect(filter).toHaveBeenCalledTimes(1);
        expect(names(datasource)).toEqual(['Bob']);
    });

    it('expect Enter after the pause not to filter again on the same text', async () => {
        const { element, datasource } = await mount();
        fakePause();
        const filter = vi.spyOn(datasource, 'filter');
        typeText(element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(filter).toHaveBeenCalledTimes(1);
        press(element, 'name', 'Enter');
        expect(filter).toHaveBeenCalledTimes(1);
    });

    it('expect Enter to filter again without filter as you type, as before', async () => {
        const { element, datasource } = await mount({});
        fakePause();
        const filter = vi.spyOn(datasource, 'filter');
        typeText(element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(filter).toHaveBeenCalledTimes(0);
        press(element, 'name', 'Enter');
        press(element, 'name', 'Enter');
        expect(filter).toHaveBeenCalledTimes(2);
    });

    it('expect leaving the cell in the pause to filter once', async () => {
        const { element, datasource } = await mount();
        fakePause();
        const filter = vi.spyOn(datasource, 'filter');
        const input = typeText(element, 'name', 'bo');
        input.dispatchEvent(new Event('blur'));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY * 2);
        expect(filter).toHaveBeenCalledTimes(1);
    });

    it('expect nothing when the cell shows another column when the pause ends: the grid reuses its cells', async () => {
        const { element, datasource } = await mount();
        fakePause();
        const input = typeText(element, 'name', 'bo');
        (input.parentElement as unknown as { $attribute: string }).$attribute = 'age';
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();
    });

    it('expect empty text to remove the filter', async () => {
        const { element, datasource } = await mount();
        fakePause();
        typeText(element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        typeText(element, 'name', '');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toEqual(and());
        expect(names(datasource)).toHaveLength(3);
    });
});

describe('filter as you type - a number or a date only when the text is one', () => {
    it('expect a date half typed not to filter, the whole date to', async () => {
        const { element, datasource } = await mount();
        fakePause();
        typeText(element, 'born', '202');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();
        typeText(element, 'born', '2026-11-20');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(names(datasource)).toEqual(['Anna']);
    });

    it('expect a week filtered as shown when it is a week: not 2026-W, 2026-W47', async () => {
        const { element, datasource } = await mount();
        fakePause();
        typeText(element, 'due', '2026-W');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();
        typeText(element, 'due', '2026-W47');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(names(datasource)).toEqual(['Ann']);
    });

    it('expect a BETWEEN when each end typed is one: an open end, not one half typed', () => {
        const parses = (text: string, type: 'date' | 'number' | 'text' = 'date') =>
            filterTextParses(type === 'number' ? NumberFormatterDot : DateFormatterYYYYMMDD, type, 'BETWEEN', text);
        expect(parses('2026-11-01..')).toBe(true);
        expect(parses('..2026-11-30')).toBe(true);
        expect(parses('2026-11-01..2026-11-30')).toBe(true);
        expect(parses('2026-11-01..202')).toBe(false);
        expect(parses('..')).toBe(true);
        expect(parses('10..2', 'number')).toBe(true);
        expect(parses('10..-', 'number')).toBe(false);
        // text: any
        expect(parses('a..', 'text')).toBe(true);
    });

    it('expect a number when the text has a digit: not -, -5', async () => {
        const { element, datasource } = await mount();
        fakePause();
        typeText(element, 'age', '-');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();
        typeText(element, 'age', '-5');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN_OR_EQUAL_TO', -5)));
    });
});

describe('filter as you type - on and off', () => {
    /** the ids of the open menu and those with a ✓ */
    const menuIds = () =>
        Array.from(openMenus()[0]?.querySelectorAll<HTMLElement>('[data-menu-id]') ?? []).map((e) => e.dataset.menuId);
    const indicator = (element: GridElement, field: string) =>
        headerFilterInput(element, field).parentElement?.querySelector<HTMLElement>(
            '.simple-html-grid-filter-operator'
        ) as HTMLElement;

    it('expect it off by default: typing does not filter', async () => {
        const { element, datasource } = await mount({});
        fakePause();
        typeText(element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();
    });

    it("expect the column's filterOnType to win over the grid's, the user's over both", async () => {
        const { element, datasource, gridInterface } = await mount({ filterOnType: true }, { age: { filterOnType: false } });
        fakePause();
        typeText(element, 'age', '20');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(datasource.getFilter()).toBeNull();

        gridInterface.setState({ headerFilters: { age: { value: null, filterOnType: true } } });
        typeText(element, 'age', '20');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(names(datasource)).toEqual(['Bob']);
    });

    it('expect the toggle at the bottom of the operator choice, under a line: a ✓ while it is on, state', async () => {
        const { element, datasource, gridInterface } = await mount({});
        indicator(element, 'name').click();
        expect(menuIds().slice(-3)).toEqual(['filter.filterOnTypeSeparator', 'filter.filterOnType', 'filter.matchCase']);
        const item = menuEntry('filter.filterOnType');
        expect(item.textContent?.trim()).toContain('Filter as you type');
        expect(item.getAttribute('aria-checked')).toEqual('false');
        item.click();
        expect(gridInterface.getState().headerFilters.name).toEqual({ value: null, filterOnType: true });

        indicator(element, 'name').click();
        expect(menuEntry('filter.filterOnType').getAttribute('aria-checked')).toEqual('true');
        gridInterface.closeMenu();

        // typing filters now, without Enter
        fakePause();
        typeText(element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(names(datasource)).toEqual(['Bob']);
        vi.useRealTimers();

        // off again: the column's default, left out of the state
        indicator(element, 'name').click();
        menuEntry('filter.filterOnType').click();
        expect(gridInterface.getState().headerFilters.name).toEqual({ value: 'bo' });
    });

    it('expect it in Filter › after Match case, not on a boolean column', async () => {
        const { element, gridInterface } = await mount({});
        openFilterMenu(element, 'age');
        menuEntry('filter.filterOnType').click();
        expect(gridInterface.getState().headerFilters.age).toEqual({ value: null, filterOnType: true });

        openFilterMenu(element, 'active');
        expect(menuEntry('filter.filterOnType')).toBeNull();
    });

    it('expect a boolean column never to filter as you type: its checkbox filters on a click', async () => {
        const { element, gridInterface } = await mount({ filterOnType: true });
        expect(indicator(element, 'active')).toBeNull();
        openFilterMenu(element, 'active');
        expect(menuEntry('filter.filterOnType')).toBeNull();
        expect(gridInterface.getState().headerFilters).toEqual({});
    });

    it('expect the state through JSON, and resetState() back to the defaults', async () => {
        const first = await mount({});
        first.gridInterface.setState({ headerFilters: { name: { value: null, filterOnType: true } } });
        const saved: GridState = JSON.parse(JSON.stringify(first.gridInterface.getState()));
        expect(saved.headerFilters).toEqual({ name: { value: null, filterOnType: true } });

        document.body.innerHTML = '';
        const second = await mount({});
        second.gridInterface.setState(saved);
        fakePause();
        typeText(second.element, 'name', 'bo');
        vi.advanceTimersByTime(FILTER_ON_TYPE_DELAY);
        expect(names(second.datasource)).toEqual(['Bob']);

        second.gridInterface.resetState();
        expect(second.gridInterface.getState().headerFilters).toEqual({});
    });

    it('expect the check of the config: true or false', async () => {
        const { datasource } = await mount({});
        expect(() => new GridInterface(config({}, { name: { filterOnType: 'yes' as unknown as boolean } }), datasource)).toThrow(
            'GridConfig: columns.name.filterOnType is true or false, got "yes"'
        );
    });
});

describe('filter as you type - the grid config dialog', () => {
    const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
    const box = () => dialog().querySelector<HTMLInputElement>('.column-settings-filter-on-type') as HTMLInputElement;
    const button = (text: string) =>
        Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
            (each) => each.textContent?.trim() === text
        ) as HTMLButtonElement;
    const toggle = () => {
        box().checked = !box().checked;
        box().dispatchEvent(new Event('change', { bubbles: true }));
    };

    it('expect the checkbox after the operator, its hint, Apply to set the state', async () => {
        const { gridInterface } = await mount({});
        gridInterface.openColumnSettings('name');
        expect(box().checked).toBe(false);
        // after the operator's field
        const fields = Array.from(dialog().querySelectorAll('.column-settings-field'));
        const operatorField = fields.findIndex((field) => field.querySelector('.column-settings-operator'));
        expect(fields[operatorField + 1].contains(box())).toBe(true);
        expect(fields[operatorField + 1].querySelector('.column-settings-hint')?.textContent?.trim()).toEqual(
            'After a short pause, no Enter needed'
        );

        toggle();
        button('Apply').click();
        expect(gridInterface.getState().headerFilters.name).toEqual({ value: null, filterOnType: true });

        // Reset column: the column's default, applied
        button('Reset column').click();
        expect(box().checked).toBe(false);
        button('Apply').click();
        expect(gridInterface.getState().headerFilters.name).toBeUndefined();
    });

    it('expect it on when the grid filters as you type, none for a checkbox column', async () => {
        const { gridInterface } = await mount({ filterOnType: true });
        gridInterface.openColumnSettings('age');
        expect(box().checked).toBe(true);
        gridInterface.openColumnSettings('active');
        expect(dialog().querySelector('.column-settings-filter-on-type')).toBeNull();
    });
});
