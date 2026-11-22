// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { and, type FilterOperator, where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { GridEvents } from '../gridEvents';
import { INDICATOR_MIN_COLUMN_WIDTH } from '../gridFunctions/filterOperatorIndicator';
import type { GridMenus } from '../gridMenus';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, openFilterMenu, openMenus, sleep, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The operator indicator of a header filter (filterOperatorIndicator.ts, GridConfig.filterOperatorIndicator):
 * the symbol of the operator in the cell - on the right of a text filter, on the left of a number or
 * date filter - and the operator choice a click, a tap or F4 opens, which does what Filter › Operator ›
 * does (headerOperatorMenu.ts).
 */

const rows = () => [
    { name: 'Ann', city: 'Oslo', age: 10, born: new Date(2026, 0, 1), at: new Date(2026, 0, 1, 10), active: true, code: 1 },
    { name: 'Anna', city: 'Bergen', age: 20, born: new Date(2026, 0, 5), at: new Date(2026, 0, 5, 10), active: false, code: 2 },
    { name: 'Joanna', city: 'Oslo', age: 30, born: new Date(2026, 1, 1), at: new Date(2026, 1, 1, 10), active: true, code: 1 },
    { name: 'Bob', city: null, age: null, born: null, at: null, active: null, code: null }
];

const fields = {
    fields: {
        age: 'number' as const,
        born: 'date' as const,
        at: 'datetime' as const,
        active: 'boolean' as const,
        code: 'number' as const
    }
};

const FIELDS = ['name', 'city', 'age', 'born', 'at', 'active', 'code'];

const config = (more: Partial<GridConfig> = {}, columns: GridConfig['columns'] = {}): GridConfig => ({
    columns: { code: { editor: { type: 'select', lookup: 'foi-codes' } }, ...columns },
    layout: { center: FIELDS.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const mount = (more: Partial<GridConfig> = {}, columns: GridConfig['columns'] = {}, menus?: GridMenus) =>
    mountGrid(config(more, columns), rows(), fields, menus ? { menus } : {});

/** the indicator in the header filter cell of a column, null for none */
const indicatorOf = (element: GridElement, field: string) =>
    headerFilterInput(element, field)?.parentElement?.querySelector<HTMLElement>('.simple-html-grid-filter-operator') ?? null;

/** the symbol it shows */
const symbolOf = (element: GridElement, field: string) => indicatorOf(element, field)?.textContent?.trim() ?? null;

/** a key pressed on `target`, as the browser sends it: the event, to see whether it was canceled */
const key = (target: Element, name: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

/** the ids of the items of the open menu, and of those checked */
const menuIds = () =>
    Array.from(openMenus()[0]?.querySelectorAll<HTMLElement>('[data-menu-id]') ?? []).map((e) => e.dataset.menuId);
const checkedIds = () =>
    Array.from(openMenus()[0]?.querySelectorAll<HTMLElement>('[aria-checked="true"]') ?? []).map((e) => e.dataset.menuId);

const TEXT_CHOICE = [
    'filter.operator.equal',
    'filter.operator.notEqualTo',
    'filter.operator.contains',
    'filter.operator.doesNotContain',
    'filter.operator.beginWith',
    'filter.operator.endWith'
];
const RANGE_CHOICE = [
    'filter.operator.equal',
    'filter.operator.notEqualTo',
    'filter.operator.lessThan',
    'filter.operator.lessThanOrEqualTo',
    'filter.operator.greaterThan',
    'filter.operator.greaterThanOrEqualTo',
    'filter.operator.between'
];
/** the end of every choice, under the operators: a line and the toggle of filter as you type (filterOnType.ts) */
const CHOICE_END = ['filter.filterOnTypeSeparator', 'filter.filterOnType'];

const names = (element: GridElement) =>
    ((element as any).grid.gridInterface.getDatasource() as Datasource).getDataRows().map((row) => row.name);

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    const codes = new Datasource();
    codes.setData([
        { code: 1, name: 'One' },
        { code: 2, name: 'Two' }
    ]);
    registerLookup('foi-codes', { datasource: codes, valueField: 'code', labelField: 'name' });
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('operator indicator - where it is and what it shows', () => {
    it('expect it on the right of a text filter and of a lookup column, on the left of a number and the dates', async () => {
        const { element } = await mount();
        const side = (field: string) => {
            const indicator = indicatorOf(element, field);
            const input = headerFilterInput(element, field);
            const right = indicator?.classList.contains('simple-html-grid-filter-operator-right');
            const left = indicator?.classList.contains('simple-html-grid-filter-operator-left');
            // the input's padding makes room on that side, the class of grid.css
            const room = input.classList.contains(`simple-html-grid-cell-filter-input-operator-${right ? 'right' : 'left'}`);
            return right && !left && room ? 'right' : left && !right && room ? 'left' : 'none';
        };
        expect(FIELDS.filter((field) => field !== 'active').map((field) => [field, side(field)])).toEqual([
            ['name', 'right'],
            ['city', 'right'],
            ['age', 'left'],
            ['born', 'left'],
            ['at', 'left'],
            // a lookup column filters as text on its labels, also for a number field
            ['code', 'right']
        ]);
    });

    it('expect none on a boolean column: its filter is a checkbox', async () => {
        const { element } = await mount();
        expect(indicatorOf(element, 'active')).toBeNull();
        expect(headerFilterInput(element, 'active').hasAttribute('aria-describedby')).toBe(false);
    });

    it("expect the symbol of the type's default operator: = for text, ≥ for numbers and dates", async () => {
        const { element } = await mount();
        expect(FIELDS.map((field) => symbolOf(element, field))).toEqual(['=', '=', '≥', '≥', '≥', null, '=']);
    });

    it('expect the symbol of every operator the header filter takes', async () => {
        const { element, gridInterface } = await mount();
        const symbols: Partial<Record<FilterOperator, string | null>> = {};
        const show = (field: string, operators: FilterOperator[]) => {
            for (const operator of operators) {
                gridInterface.setState({ headerFilters: { [field]: { value: null, operator } } });
                symbols[operator] = symbolOf(element, field);
            }
        };
        show('name', ['EQUAL', 'NOT_EQUAL_TO', 'CONTAINS', 'DOES_NOT_CONTAIN', 'BEGIN_WITH', 'END_WITH']);
        show('age', ['LESS_THAN', 'LESS_THAN_OR_EQUAL_TO', 'GREATER_THAN', 'GREATER_THAN_OR_EQUAL_TO', 'BETWEEN']);
        expect(symbols).toEqual({
            EQUAL: '=',
            NOT_EQUAL_TO: '≠',
            CONTAINS: '*a*',
            DOES_NOT_CONTAIN: '!*a*',
            BEGIN_WITH: 'a*',
            END_WITH: '*a',
            LESS_THAN: '<',
            LESS_THAN_OR_EQUAL_TO: '≤',
            GREATER_THAN: '>',
            GREATER_THAN_OR_EQUAL_TO: '≥',
            BETWEEN: 'a..b'
        });
    });

    it("expect the symbol of the column's operator (config), and of the one in the state over it", async () => {
        const { element, gridInterface } = await mount({}, { name: { operator: 'CONTAINS' }, age: { operator: 'BETWEEN' } });
        expect(symbolOf(element, 'name')).toEqual('*a*');
        expect(symbolOf(element, 'age')).toEqual('a..b');

        gridInterface.setState({ headerFilters: { name: { value: 'an', operator: 'BEGIN_WITH' } } });
        expect(symbolOf(element, 'name')).toEqual('a*');
        // a state from before, with an operator the column no longer offers: the column's
        gridInterface.updateConfig({
            columns: { ...config().columns, name: { operator: 'CONTAINS', filterOperators: ['CONTAINS', 'IN'] } }
        });
        expect(symbolOf(element, 'name')).toEqual('*a*');
    });

    it('expect the symbol to follow Operator › of the filter menu', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'name');
        menuEntry('filter.operator.endWith').click();
        expect(symbolOf(element, 'name')).toEqual('*a');
    });

    it('expect its name and tooltip, and the input described by it (a screen reader reads the operator)', async () => {
        const { element } = await mount();
        const indicator = indicatorOf(element, 'age') as HTMLElement;
        expect(indicator.tagName).toEqual('BUTTON');
        expect(indicator.getAttribute('type')).toEqual('button');
        expect(indicator.getAttribute('aria-label')).toEqual('Operator: Greater than or equal');
        expect(indicator.getAttribute('title')).toEqual('Operator: Greater than or equal (F4)');
        expect(indicator.getAttribute('aria-haspopup')).toEqual('menu');
        expect(headerFilterInput(element, 'age').getAttribute('aria-describedby')).toEqual(indicator.id);
        // one id per cell, the grid's prefix first
        const ids = FIELDS.map((field) => indicatorOf(element, field)?.id).filter(Boolean);
        expect(new Set(ids).size).toEqual(ids.length);
        expect(indicator.id).toMatch(/^simple-html-grid-\d+-.+-operator$/);
    });

    it("expect the grid's texts: the symbol, the name and the tooltip translated", async () => {
        const { element } = await mount(
            {
                texts: {
                    'filter.indicator.CONTAINS': '∋',
                    'filter.indicator': 'Operator {operator}',
                    'filter.indicator.tooltip': '{operator} - F4',
                    'filter.operator.contains': 'Inneholder'
                }
            },
            { name: { operator: 'CONTAINS' } }
        );
        const indicator = indicatorOf(element, 'name') as HTMLElement;
        expect(indicator.textContent?.trim()).toEqual('∋');
        expect(indicator.getAttribute('aria-label')).toEqual('Operator Inneholder');
        expect(indicator.getAttribute('title')).toEqual('Inneholder - F4');
    });
});

describe('operator indicator - a click opens the operator choice', () => {
    it("expect the choice under it: the column's operators, the one in use checked", async () => {
        const { element } = await mount({}, { name: { operator: 'CONTAINS' } });
        (indicatorOf(element, 'name') as HTMLElement).click();
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toEqual([...TEXT_CHOICE, ...CHOICE_END]);
        expect(checkedIds()).toEqual(['filter.operator.contains']);

        (indicatorOf(element, 'born') as HTMLElement).click();
        // one menu at a time
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toEqual([...RANGE_CHOICE, ...CHOICE_END]);
        expect(checkedIds()).toEqual(['filter.operator.greaterThanOrEqualTo']);
    });

    it("expect only the column's filterOperators, as Operator › has them", async () => {
        const { element } = await mount({}, { age: { filterOperators: ['EQUAL', 'BETWEEN', 'IS_BLANK'] } });
        (indicatorOf(element, 'age') as HTMLElement).click();
        expect(menuIds()).toEqual(['filter.operator.equal', 'filter.operator.between', ...CHOICE_END]);
        // the type's default is not offered: the first one is used
        expect(checkedIds()).toEqual(['filter.operator.equal']);
    });

    it('expect a pick to do what Operator › does: the state, the filter run again, the event, the symbol', async () => {
        const viaIndicator = await mount();
        const events: GridEvents['filter-operator-change'][] = [];
        viaIndicator.gridInterface.on('filter-operator-change', (data) => events.push(data));
        typeInHeaderFilter(viaIndicator.element, 'name', 'an');
        expect(names(viaIndicator.element)).toEqual([]);

        (indicatorOf(viaIndicator.element, 'name') as HTMLElement).click();
        menuEntry('filter.operator.contains').click();

        expect(openMenus()).toHaveLength(0);
        expect(viaIndicator.gridInterface.getState().headerFilters).toEqual({ name: { value: 'an', operator: 'CONTAINS' } });
        expect(viaIndicator.datasource.getFilter()).toEqual(and(where('name', 'CONTAINS', 'an', { caseSensitive: false })));
        expect(names(viaIndicator.element)).toEqual(['Ann', 'Anna', 'Joanna']);
        expect(events.map(({ field, operator }) => ({ field, operator }))).toEqual([{ field: 'name', operator: 'CONTAINS' }]);
        expect(symbolOf(viaIndicator.element, 'name')).toEqual('*a*');
        // the header filter shows its value still
        expect(headerFilterInput(viaIndicator.element, 'name').value).toEqual('an');

        // the same from the filter menu, in a grid of its own
        document.body.innerHTML = '';
        const viaMenu = await mount();
        typeInHeaderFilter(viaMenu.element, 'name', 'an');
        openFilterMenu(viaMenu.element, 'name');
        menuEntry('filter.operator.contains').click();
        expect(viaMenu.gridInterface.getState()).toEqual(viaIndicator.gridInterface.getState());
        expect(symbolOf(viaMenu.element, 'name')).toEqual('*a*');
    });

    it('expect the text typed and not filtered yet to be filtered on first, as a right click does', async () => {
        const { element, gridInterface } = await mount();
        // typed, no Enter, no blur
        headerFilterInput(element, 'name').value = 'jo';
        (indicatorOf(element, 'name') as HTMLElement).click();
        expect(gridInterface.getState().headerFilters.name.value).toEqual('jo');

        menuEntry('filter.operator.beginWith').click();
        expect(names(element)).toEqual(['Joanna']);
        expect(headerFilterInput(element, 'name').value).toEqual('jo');
    });

    it('expect a BETWEEN picked to show its placeholder, a range typed after to filter', async () => {
        const { element } = await mount();
        (indicatorOf(element, 'age') as HTMLElement).click();
        menuEntry('filter.operator.between').click();
        expect(headerFilterInput(element, 'age').placeholder).toEqual('from..to');
        typeInHeaderFilter(element, 'age', '15..30');
        expect(names(element)).toEqual(['Anna', 'Joanna']);
    });

    it('expect a mouse click to put the focus in the filter input, the mousedown to take none', async () => {
        const { element } = await mount();
        const indicator = indicatorOf(element, 'city') as HTMLElement;
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        indicator.dispatchEvent(mousedown);
        expect(mousedown.defaultPrevented).toBe(true);

        indicator.click();
        expect(document.activeElement).toBe(headerFilterInput(element, 'city'));
        // opened with the mouse: the focus is not moved into the menu
        expect(openMenus()).toHaveLength(1);

        // picked: the header is made anew, the focus is in the new input
        menuEntry('filter.operator.notEqualTo').click();
        expect(document.activeElement).toBe(headerFilterInput(element, 'city'));
        expect(document.activeElement?.isConnected).toBe(true);
    });

    it('expect a tap to open the choice without the focus in the input: no phone keyboard', async () => {
        const { element } = await mount();
        const indicator = indicatorOf(element, 'name') as HTMLElement;
        indicator.dispatchEvent(new PointerEvent('click', { bubbles: true, cancelable: true, pointerType: 'touch' }));
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toEqual([...TEXT_CHOICE, ...CHOICE_END]);
        expect(document.activeElement).not.toBe(headerFilterInput(element, 'name'));
    });

    it('expect a right click (a long press) on it to open the filter menu, as on the input', async () => {
        const { element } = await mount();
        const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100 });
        (indicatorOf(element, 'name') as HTMLElement).dispatchEvent(contextmenu);
        expect(contextmenu.defaultPrevented).toBe(true);
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toContain('filter.filter');
    });

    it('expect the context of the menu: the filter menu of the column, its cell', async () => {
        const { element } = await mount();
        (indicatorOf(element, 'name') as HTMLElement).click();
        // the context the items' callbacks get, as in the filter menu
        expect((element as any).grid.menuTree.context).toMatchObject({
            menu: 'filter',
            field: 'name',
            rowIndex: 0,
            cell: headerFilterInput(element, 'name').parentElement
        });
    });
});

describe('operator indicator - the keyboard', () => {
    it('expect it to be no stop of Tab: Tab goes from a filter to the next filter', async () => {
        const { element } = await mount();
        const name = headerFilterInput(element, 'name');
        name.focus();
        expect(indicatorOf(element, 'name')?.getAttribute('tabindex')).toEqual('-1');
        key(name, 'Tab');
        await sleep(150);
        expect(document.activeElement).toBe(headerFilterInput(element, 'city'));
    });

    it('expect F4 in the filter to open the choice, the focus on its first item; Esc to close it, the focus back', async () => {
        const { element } = await mount();
        const age = headerFilterInput(element, 'age');
        age.focus();
        expect(key(age, 'F4').defaultPrevented).toBe(true);
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toEqual([...RANGE_CHOICE, ...CHOICE_END]);
        expect(document.activeElement?.getAttribute('data-menu-id')).toEqual('filter.operator.equal');

        key(document.activeElement as Element, 'Escape');
        expect(openMenus()).toHaveLength(0);
        expect(document.activeElement).toBe(age);
    });

    it('expect the menu keys in the choice: End, Enter picks, the focus back in the filter', async () => {
        const { element, gridInterface } = await mount();
        const age = headerFilterInput(element, 'age');
        age.focus();
        key(age, 'F4');
        key(document.activeElement as Element, 'End');
        // the last item is Filter as you type, under a line: the arrow goes over the line
        expect(document.activeElement?.getAttribute('data-menu-id')).toEqual('filter.filterOnType');
        key(document.activeElement as Element, 'ArrowUp');
        expect(document.activeElement?.getAttribute('data-menu-id')).toEqual('filter.operator.between');
        key(document.activeElement as Element, 'Enter');

        expect(openMenus()).toHaveLength(0);
        expect(gridInterface.getState().headerFilters.age.operator).toEqual('BETWEEN');
        expect(symbolOf(element, 'age')).toEqual('a..b');
        // the input was made anew with the header, the new one has the focus
        expect(headerFilterInput(element, 'age')).not.toBe(age);
        expect(document.activeElement).toBe(headerFilterInput(element, 'age'));
    });

    it('expect F4 to filter on the text typed first, as a click does', async () => {
        const { element, gridInterface } = await mount();
        const name = headerFilterInput(element, 'name');
        name.focus();
        name.value = 'bob';
        key(name, 'F4');
        expect(gridInterface.getState().headerFilters.name.value).toEqual('bob');
        expect(names(element)).toEqual(['Bob']);
    });

    it('expect F4 with a modifier to be left alone', async () => {
        const { element } = await mount();
        const name = headerFilterInput(element, 'name');
        for (const modifier of ['shiftKey', 'ctrlKey', 'altKey', 'metaKey']) {
            expect(key(name, 'F4', { [modifier]: true }).defaultPrevented).toBe(false);
        }
        expect(openMenus()).toHaveLength(0);
    });

    it('expect Enter in the filter to filter, as before', async () => {
        const { element } = await mount({}, { name: { operator: 'CONTAINS' } });
        const name = headerFilterInput(element, 'name');
        name.value = 'nn';
        // the header filter reads keyCode
        key(name, 'Enter', { keyCode: 13 });
        expect(names(element)).toEqual(['Ann', 'Anna', 'Joanna']);
        expect(openMenus()).toHaveLength(0);
    });
});

describe('operator indicator - a column with one operator', () => {
    it('expect the symbol, not a button: nothing to choose', async () => {
        const { element } = await mount({}, { name: { filterOperators: ['CONTAINS', 'IN', 'IS_BLANK'] } });
        const indicator = indicatorOf(element, 'name') as HTMLElement;
        expect(indicator.tagName).toEqual('SPAN');
        expect(indicator.textContent?.trim()).toEqual('*a*');
        expect(indicator.getAttribute('title')).toEqual('Operator: Contains');
        // the input is described by it, a screen reader does not read it twice
        expect(indicator.getAttribute('aria-hidden')).toEqual('true');
        expect(headerFilterInput(element, 'name').getAttribute('aria-describedby')).toEqual(indicator.id);

        indicator.click();
        expect(openMenus()).toHaveLength(0);
    });

    it('expect F4 to open nothing, and to be left alone', async () => {
        const { element } = await mount({}, { name: { filterOperators: ['CONTAINS'] } });
        const name = headerFilterInput(element, 'name');
        name.focus();
        expect(key(name, 'F4').defaultPrevented).toBe(false);
        expect(openMenus()).toHaveLength(0);
    });
});

describe('operator indicator - turned off, and narrow columns', () => {
    it('expect none with filterOperatorIndicator: false, the inputs as before, F4 left alone - Operator › still there', async () => {
        const { element, gridInterface } = await mount({ filterOperatorIndicator: false });
        expect(element.querySelectorAll('.simple-html-grid-filter-operator')).toHaveLength(0);
        const name = headerFilterInput(element, 'name');
        expect(name.className).not.toMatch(/operator/);
        expect(name.hasAttribute('aria-describedby')).toBe(false);
        expect(gridInterface.__getGridConfig().filterOperatorIndicator).toBe(false);

        name.focus();
        expect(key(name, 'F4').defaultPrevented).toBe(false);
        expect(openMenus()).toHaveLength(0);

        openFilterMenu(element, 'name');
        menuEntry('filter.operator.contains').click();
        expect(gridInterface.getState().headerFilters.name.operator).toEqual('CONTAINS');
    });

    it('expect F4 on a column too narrow for the indicator to open the choice under the cell', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setState({ layout: { center: [{ fields: ['name'], width: INDICATOR_MIN_COLUMN_WIDTH - 10 }] } });
        const name = headerFilterInput(element, 'name');
        expect(indicatorOf(element, 'name')).toBeNull();

        const place = vi.spyOn(name.parentElement as HTMLElement, 'getBoundingClientRect');
        name.focus();
        expect(key(name, 'F4').defaultPrevented).toBe(true);
        expect(openMenus()).toHaveLength(1);
        expect(menuIds()).toEqual([...TEXT_CHOICE, ...CHOICE_END]);
        // placed under the cell: its rect was measured
        expect(place).toHaveBeenCalled();
    });

    it('expect updateConfig() to turn it on and off, on by default', async () => {
        const { element, gridInterface } = await mount();
        expect(gridInterface.__getGridConfig().filterOperatorIndicator).toBe(true);
        gridInterface.updateConfig({ filterOperatorIndicator: false });
        expect(indicatorOf(element, 'name')).toBeNull();
        gridInterface.updateConfig({ filterOperatorIndicator: true });
        expect(symbolOf(element, 'name')).toEqual('=');
    });

    it(`expect none on a column narrower than ${INDICATOR_MIN_COLUMN_WIDTH}px: the input keeps its room`, async () => {
        const { element, gridInterface } = await mount();
        gridInterface.setState({
            layout: {
                center: [
                    { fields: ['name'], width: INDICATOR_MIN_COLUMN_WIDTH - 1 },
                    { fields: ['age'], width: INDICATOR_MIN_COLUMN_WIDTH }
                ]
            }
        });
        expect(indicatorOf(element, 'name')).toBeNull();
        expect(headerFilterInput(element, 'name').className).not.toMatch(/operator/);
        expect(symbolOf(element, 'age')).toEqual('≥');
    });

    it('expect it in a column of stacked fields, for each field', async () => {
        const { element } = await mountGrid({ layout: { center: [{ fields: ['name', 'age'], width: 120 }] } }, rows(), fields);
        expect(symbolOf(element, 'name')).toEqual('=');
        expect(symbolOf(element, 'age')).toEqual('≥');
        expect(indicatorOf(element, 'name')?.id).not.toEqual(indicatorOf(element, 'age')?.id);
    });
});
