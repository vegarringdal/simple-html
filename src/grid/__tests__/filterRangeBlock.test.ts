// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { and, type FilterOperator, where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { GridHooks } from '../gridHooks';
import { MENU_IDS, type MenuEntry } from '../gridMenus';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { headerFilterInput, menuEntry, openFilterMenu, openMenus, sleep, typeInHeaderFilter } from './interactionTestHelpers';

/**
 * The range block of the filter menu of a number, date or datetime column (`filter.range`): the operators
 * of Operator › as a row of buttons, an input - From and To for Between - Cancel and Apply. Applying is
 * what picking the operator in Operator › and typing the value in the header filter does.
 */

const rows = () => [
    { name: 'Ann', age: 10, born: new Date(2026, 0, 1), at: new Date(2026, 0, 1, 8, 0, 0), active: true, customer: 1 },
    // the 5th at 15:30: a date filter compares the day
    { name: 'Bob', age: 20, born: new Date(2026, 0, 5, 15, 30), at: new Date(2026, 0, 5, 12, 0, 0), active: false, customer: 2 },
    { name: 'Cid', age: 30, born: new Date(2026, 1, 1), at: new Date(2026, 1, 1, 18, 30, 0), active: true, customer: 1 },
    { name: 'Dan', age: null, born: null, at: null, active: null, customer: null }
];

const fields = {
    fields: {
        age: 'number' as const,
        born: 'date' as const,
        at: 'datetime' as const,
        active: 'boolean' as const,
        customer: 'number' as const
    }
};

const config = (columns: GridConfig['columns'] = {}, extra: Partial<GridConfig> = {}): GridConfig => ({
    columns: {
        age: { label: 'Age' },
        customer: { label: 'Customer', editor: { type: 'select', lookup: 'frb-customers' } },
        ...columns
    },
    layout: {
        center: ['name', 'age', 'born', 'at', 'active', 'customer'].map((field) => ({ fields: [field], width: 100 }))
    },
    ...extra
});

const mount = (columns: GridConfig['columns'] = {}, hooks: GridHooks = {}, extra: Partial<GridConfig> = {}) =>
    mountGrid(config(columns, extra), rows(), fields, hooks);

const names = (datasource: Datasource) => datasource.getDataRows().map((row) => row.name);

// the block and its parts, in the open menu
const block = () => document.querySelector<HTMLElement>('.simple-html-grid-menu [data-menu-id="filter.range"]');
const operatorLabels = () => Array.from(block()?.querySelectorAll<HTMLLabelElement>('.simple-html-grid-range-operator') ?? []);
/** what each operator shows: =, ≠, <, ≤, >, ≥ - Between its name */
const symbols = () => operatorLabels().map((label) => label.textContent?.trim());
/** the operator showing `symbol`, its label: a click on it is a click on its radio */
const operator = (symbol: string) => operatorLabels().find((label) => label.textContent?.trim() === symbol) as HTMLLabelElement;
const radio = (symbol: string) => operator(symbol).querySelector('input') as HTMLInputElement;
/** the symbol of the operator picked */
const picked = () =>
    operatorLabels()
        .find((label) => label.querySelector('input')?.checked)
        ?.textContent?.trim();
const inputs = () => Array.from(block()?.querySelectorAll<HTMLInputElement>('.simple-html-grid-range-input') ?? []);
const button = (text: string) =>
    Array.from(block()?.querySelectorAll<HTMLButtonElement>('button') ?? []).find(
        (candidate) => candidate.textContent?.trim() === text
    ) as HTMLButtonElement;
const menuOpen = () => openMenus().length > 0;

/** types into an input of the block, as a user: its value, then an input event */
const type = (input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
};

/** a key on `target`, as the browser sends it. @returns the event: was it canceled? */
const press = (target: Element, key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

/** the text of the footer's chips */
const chips = (element: GridElement) =>
    element.querySelector('.footer-filter-chips')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    const customers = new Datasource({ fields: { id: 'number' } });
    customers.setData([
        { id: 1, name: 'ACME' },
        { id: 2, name: 'Globex' }
    ]);
    registerLookup('frb-customers', { datasource: customers, valueField: 'id', labelField: 'name' });
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('filter menu - the range block: where it is shown', () => {
    it('expect it on a number, a date and a datetime column, under Filter › as the main tool', async () => {
        const { element } = await mount();
        for (const field of ['age', 'born', 'at']) {
            openFilterMenu(element, field);
            const shown = Array.from(document.querySelectorAll('.simple-html-grid-menu[role="menu"] > [data-menu-id]')).map(
                (entry) => entry.getAttribute('data-menu-id')
            );
            expect(shown, field).toEqual(['filter.filter', 'filter.range']);
        }
    });

    it('expect none on a text column (the value list), a boolean (its checkbox) and a lookup on a number field', async () => {
        const { element } = await mount();
        for (const field of ['name', 'active', 'customer']) {
            openFilterMenu(element, field);
            expect(block(), field).toBeNull();
        }
        // the lookup column filters on its labels: the value list
        openFilterMenu(element, 'customer');
        expect(document.querySelector('[data-menu-id="filter.values"]')).not.toBeNull();
    });

    it('expect MENU_IDS.filter to have it after the value list, every block in the defaults', async () => {
        const seen: string[][] = [];
        const filter = (defaults: MenuEntry[]) => {
            seen.push(defaults.map((entry) => entry.id));
            return defaults;
        };
        const { element } = await mount({}, { menus: { filter } });
        openFilterMenu(element, 'age');
        expect(MENU_IDS.filter.slice(-2)).toEqual(['filter.values', 'filter.range']);
        expect(seen[0]).toEqual(['filter.filter', 'filter.values', 'filter.range']);
    });

    it('expect a menus.filter hook to remove it, or to put a block of its own in its place', async () => {
        const { element } = await mount(
            {},
            {
                menus: {
                    filter: (defaults, context) =>
                        context.field === 'born'
                            ? defaults.filter((entry) => entry.id !== 'filter.range')
                            : defaults.map((entry) =>
                                  entry.id === 'filter.range'
                                      ? {
                                            type: 'block',
                                            id: 'my.range',
                                            element: Object.assign(document.createElement('div'), { textContent: 'mine' })
                                        }
                                      : entry
                              )
                }
            }
        );
        openFilterMenu(element, 'born');
        expect(block()).toBeNull();
        expect(document.querySelector('[data-menu-id="filter.filter"]')).not.toBeNull();

        openFilterMenu(element, 'age');
        expect(block()).toBeNull();
        expect(document.querySelector('.simple-html-grid-menu')?.textContent).toContain('mine');
    });
});

describe('filter menu - the range block: what it shows', () => {
    it("expect the operators of Operator › in the type's order: symbols, named for a screen reader, with tooltips", async () => {
        const { element } = await mount();
        openFilterMenu(element, 'age');

        expect(symbols()).toEqual(['=', '≠', '<', '≤', '>', '≥', 'Between']);
        const group = block()?.querySelector('.simple-html-grid-range-operators') as HTMLElement;
        expect([group.getAttribute('role'), group.getAttribute('aria-label')]).toEqual(['radiogroup', 'Operator']);
        expect(operatorLabels().map((label) => label.querySelector('input')?.getAttribute('aria-label'))).toEqual([
            'Equal',
            'Not Equal',
            'Less than',
            'Less than or equal',
            'Greater than',
            'Greater than or equal',
            'Between'
        ]);
        // Between shows its name, it has no tooltip
        expect(operatorLabels().map((label) => label.getAttribute('data-tooltip'))).toEqual([
            'Equal',
            'Not Equal',
            'Less than',
            'Less than or equal',
            'Greater than',
            'Greater than or equal',
            null
        ]);
        // radios of one group: one stop of Tab, the arrows move between them
        const radios = operatorLabels().map((label) => label.querySelector('input') as HTMLInputElement);
        expect(radios.every((input) => input.type === 'radio' && input.name === radios[0].name)).toBe(true);
        // the symbol is not read out, the name is
        expect(operatorLabels()[0].querySelector('span')?.getAttribute('aria-hidden')).toEqual('true');
    });

    it("expect the type's default picked, one input named Value with the type's placeholder, Cancel and Apply", async () => {
        const { element } = await mount();
        openFilterMenu(element, 'age');

        expect(picked()).toEqual('≥');
        expect(inputs().map((input) => [input.value, input.getAttribute('aria-label'), input.placeholder])).toEqual([
            ['', 'Value', 'Number']
        ]);
        expect(Array.from(block()?.querySelectorAll('button') ?? []).map((b) => [b.textContent?.trim(), b.type])).toEqual([
            ['Cancel', 'button'],
            ['Apply', 'button']
        ]);
        expect(button('Apply').classList.contains('simple-html-grid-button-primary')).toBe(true);
    });

    it("expect a date's and a datetime's placeholder to be the formatter's format", async () => {
        const { element } = await mount();
        openFilterMenu(element, 'born');
        expect(inputs()[0].placeholder).toEqual('YYYY-MM-DD');
        openFilterMenu(element, 'at');
        expect(inputs()[0].placeholder).toEqual('YYYY-MM-DDTHH:MM:SS');
    });

    it('expect Between to show From and To, each named by its label', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'born');
        operator('Between').click();

        const [from, to] = inputs();
        const labelOf = (input: HTMLInputElement) => block()?.querySelector(`label[for="${input.id}"]`)?.textContent?.trim();
        expect([labelOf(from), labelOf(to)]).toEqual(['From', 'To']);
        expect([from.placeholder, to.placeholder]).toEqual(['YYYY-MM-DD', 'YYYY-MM-DD']);
        expect(from.id).not.toEqual(to.id);
    });

    it("expect the column's filterOperators, its default the first of them, its `operator` to win", async () => {
        const { element, gridInterface } = await mount({
            age: { filterOperators: ['EQUAL', 'GREATER_THAN', 'BETWEEN', 'IS_BLANK'] }
        });
        openFilterMenu(element, 'age');
        expect(symbols()).toEqual(['=', '>', 'Between']);
        expect(picked()).toEqual('=');
        gridInterface.closeMenu();

        const between = await mount({ age: { filterOperators: ['LESS_THAN', 'BETWEEN'], operator: 'BETWEEN' } });
        openFilterMenu(between.element, 'age');
        expect(symbols()).toEqual(['<', 'Between']);
        expect(picked()).toEqual('Between');
        expect(inputs()).toHaveLength(2);
    });
});

describe('filter menu - the range block: opens with the header filter', () => {
    it('expect the value typed and the operator', async () => {
        const { element } = await mount();
        typeInHeaderFilter(element, 'age', '20');
        openFilterMenu(element, 'age');
        expect([picked(), inputs()[0].value]).toEqual(['≥', '20']);

        openFilterMenu(element, 'age');
        menuEntry('filter.operator.lessThan').click();
        openFilterMenu(element, 'age');
        expect([picked(), inputs()[0].value]).toEqual(['<', '20']);
    });

    it("expect a BETWEEN's [from, to] in From and To, an open end empty", async () => {
        const { element } = await mount();
        openFilterMenu(element, 'age');
        menuEntry('filter.operator.between').click();
        typeInHeaderFilter(element, 'age', '10..20');
        openFilterMenu(element, 'age');
        expect([picked(), ...inputs().map((input) => input.value)]).toEqual(['Between', '10', '20']);

        typeInHeaderFilter(element, 'age', '..20');
        openFilterMenu(element, 'age');
        expect(inputs().map((input) => input.value)).toEqual(['', '20']);
    });

    it('expect a date as its formatter shows it, a state set from JSON too', async () => {
        const { element, gridInterface } = await mount();
        typeInHeaderFilter(element, 'born', '2026-01-05');
        openFilterMenu(element, 'born');
        expect(inputs()[0].value).toEqual('2026-01-05');

        gridInterface.setState(
            JSON.parse(
                JSON.stringify({ headerFilters: { at: { value: [new Date(2026, 0, 2, 10, 0, 0), null], operator: 'BETWEEN' } } })
            )
        );
        openFilterMenu(element, 'at');
        expect([picked(), ...inputs().map((input) => input.value)]).toEqual(['Between', '2026-01-02T10:00:00', '']);
    });
});

/**
 * What the grid has after a filter: the header filter's state, what its cell shows, the filter, the rows,
 * the chips of the footer, getFilterString() and the filter-operator-change events
 */
function snapshot({ element, datasource, gridInterface }: MountedGrid, field: string, events: FilterOperator[]) {
    return {
        state: gridInterface.getState().headerFilters,
        cell: headerFilterInput(element, field).value,
        filter: datasource.getFilter(),
        rows: names(datasource),
        chips: chips(element),
        filterString: datasource.getFilterString(),
        events: [...events]
    };
}

/** mounts a grid that records the filter-operator-change events */
async function mountRecording() {
    const mounted = await mount();
    const events: FilterOperator[] = [];
    mounted.gridInterface.on('filter-operator-change', (data) => events.push(data.operator));
    return { mounted, events };
}

/**
 * The same filter made twice, on two grids: with the range block - the operator clicked, the value typed,
 * Apply - and as a user does it without it: the operator picked in Operator › (not when it is the one in
 * use), the value typed in the header filter
 */
async function bothWays(field: string, symbol: string, menuId: string, texts: string[]) {
    const block = await mountRecording();
    openFilterMenu(block.mounted.element, field);
    const usedBefore = picked() === symbol;
    operator(symbol).click();
    inputs().forEach((input, i) => {
        type(input, texts[i]);
    });
    button('Apply').click();
    expect(menuOpen()).toBe(false);

    const typing = await mountRecording();
    if (!usedBefore) {
        openFilterMenu(typing.mounted.element, field);
        menuEntry(menuId).click();
    }
    typeInHeaderFilter(typing.mounted.element, field, texts.length === 2 ? `${texts[0]}..${texts[1]}` : texts[0]);

    return { block: snapshot(block.mounted, field, block.events), typing: snapshot(typing.mounted, field, typing.events) };
}

const OPERATORS = [
    { symbol: '=', id: 'filter.operator.equal' },
    { symbol: '≠', id: 'filter.operator.notEqualTo' },
    { symbol: '<', id: 'filter.operator.lessThan' },
    { symbol: '≤', id: 'filter.operator.lessThanOrEqualTo' },
    { symbol: '>', id: 'filter.operator.greaterThan' },
    { symbol: '≥', id: 'filter.operator.greaterThanOrEqualTo' },
    { symbol: 'Between', id: 'filter.operator.between' }
];

describe('filter menu - the range block: Apply is what typing in the header filter does', () => {
    const cases = [
        { field: 'age', value: ['20'], range: ['15', '30'] },
        { field: 'born', value: ['2026-01-05'], range: ['2026-01-02', '2026-02-01'] },
        { field: 'at', value: ['2026-01-05T12:00:00'], range: ['2026-01-01T09:00:00', '2026-02-01T18:30:00'] }
    ];
    for (const { field, value, range } of cases) {
        for (const { symbol, id } of OPERATORS) {
            it(`expect ${field} ${symbol}: the state, the cell, the filter, the rows, the chip, the events`, async () => {
                const { block, typing } = await bothWays(field, symbol, id, symbol === 'Between' ? range : value);
                expect(block).toEqual(typing);
                // it did filter
                expect(block.rows).not.toEqual(['Ann', 'Bob', 'Cid', 'Dan']);
                expect(block.chips).not.toEqual('');
            });
        }
    }

    it('expect the numbers, the operator as state with one event when it changed, none when it did not', async () => {
        const { mounted, events } = await mountRecording();
        openFilterMenu(mounted.element, 'age');
        operator('>').click();
        type(inputs()[0], '15');
        button('Apply').click();
        expect(mounted.gridInterface.getState().headerFilters).toEqual({ age: { value: 15, operator: 'GREATER_THAN' } });
        expect(mounted.datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN', 15)));
        expect(names(mounted.datasource)).toEqual(['Bob', 'Cid']);
        expect(headerFilterInput(mounted.element, 'age').value).toEqual('15');
        expect(events).toEqual(['GREATER_THAN']);

        openFilterMenu(mounted.element, 'age');
        type(inputs()[0], '25');
        button('Apply').click();
        expect(names(mounted.datasource)).toEqual(['Cid']);
        expect(events).toEqual(['GREATER_THAN']);
    });

    it("expect = on a date to be the day, whatever the time of the row's date", async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'born');
        operator('=').click();
        type(inputs()[0], '2026-01-05');
        button('Apply').click();
        expect(names(datasource)).toEqual(['Bob']);
    });

    it('expect Between with both ends, From only and To only - an open end - and the cell to show from..to', async () => {
        const { element, datasource, gridInterface } = await mount();
        const between = (from: string, to: string) => {
            openFilterMenu(element, 'age');
            operator('Between').click();
            const [fromInput, toInput] = inputs();
            type(fromInput, from);
            type(toInput, to);
            button('Apply').click();
            return [
                gridInterface.getState().headerFilters.age?.value,
                headerFilterInput(element, 'age').value,
                names(datasource)
            ];
        };

        expect(between('10', '20')).toEqual([[10, 20], '10..20', ['Ann', 'Bob']]);
        expect(between('20', '')).toEqual([[20, null], '20..', ['Bob', 'Cid']]);
        // a blank number is 0
        expect(between('', '10')).toEqual([[null, 10], '..10', ['Ann', 'Dan']]);
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [null, 10])));
        expect(headerFilterInput(element, 'age').placeholder).toEqual('from..to');
    });

    it('expect an input left empty to be no filter on the column, as an empty cell - the rest of the filter kept', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'name', 'Bob');
        typeInHeaderFilter(element, 'age', '20');
        openFilterMenu(element, 'age');
        type(inputs()[0], '  ');
        button('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('name', 'EQUAL', 'Bob')));
        expect(gridInterface.getState().headerFilters).toEqual({ name: { value: 'Bob' } });
        expect(headerFilterInput(element, 'age').value).toEqual('');

        // Between with neither end: the operator kept, no value - as typing nothing with it
        openFilterMenu(element, 'age');
        operator('Between').click();
        button('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('name', 'EQUAL', 'Bob')));
        expect(gridInterface.getState().headerFilters.age).toEqual({ value: null, operator: 'BETWEEN' });
    });

    it('expect a filter of another column, from code, to be kept: the column condition is ANDed with it', async () => {
        const { element, datasource } = await mount();
        datasource.filter(where('name', 'EQUAL', 'Cid'));
        openFilterMenu(element, 'age');
        type(inputs()[0], '10');
        button('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('name', 'EQUAL', 'Cid'), where('age', 'GREATER_THAN_OR_EQUAL_TO', 10)));
        expect(names(datasource)).toEqual(['Cid']);
    });
});

describe('filter menu - the range block: a draft until Apply', () => {
    it('expect picking an operator and typing to filter nothing, Cancel to close and leave all as it was', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'age', '20');
        openFilterMenu(element, 'age');
        operator('<').click();
        type(inputs()[0], '5');
        expect(names(datasource)).toEqual(['Bob', 'Cid']);

        button('Cancel').click();
        expect(menuOpen()).toBe(false);
        expect(gridInterface.getState().headerFilters).toEqual({ age: { value: 20 } });
        expect(datasource.getFilter()).toEqual(and(where('age', 'GREATER_THAN_OR_EQUAL_TO', 20)));
        expect(headerFilterInput(element, 'age').value).toEqual('20');
    });

    it('expect Esc in an input to close the menu without filtering, the focus back on the header filter', async () => {
        const { element, datasource } = await mount();
        const cell = headerFilterInput(element, 'age');
        cell.focus();
        openFilterMenu(element, 'age');
        inputs()[0].focus();
        type(inputs()[0], '5');

        press(inputs()[0], 'Escape');

        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toBeNull();
        expect(document.activeElement).toBe(cell);
    });

    it('expect Between picked to take the value as From, another operator after it the first end as the value', async () => {
        const { element } = await mount();
        typeInHeaderFilter(element, 'age', '10');
        openFilterMenu(element, 'age');
        operator('Between').click();
        expect(inputs().map((input) => input.value)).toEqual(['10', '']);
        type(inputs()[0], '');
        type(inputs()[1], '30');

        operator('≤').click();
        expect(inputs().map((input) => input.value)).toEqual(['30']);
    });

    it('expect an operator clicked to give the focus to the input: click, type, Enter', async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'age');
        operator('>').click();
        expect(document.activeElement).toBe(inputs()[0]);

        operator('Between').click();
        expect(document.activeElement).toBe(inputs()[0]);
        type(inputs()[0], '15');

        const enter = press(inputs()[0], 'Enter');
        expect(enter.defaultPrevented).toBe(true);
        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [15, null])));
    });

    it('expect Enter in To, and on an operator, to apply as Apply does', async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'age');
        operator('Between').click();
        type(inputs()[1], '20');
        press(inputs()[1], 'Enter');
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [null, 20])));

        openFilterMenu(element, 'age');
        press(radio('Between'), 'Enter');
        expect(menuOpen()).toBe(false);
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [null, 20])));
    });

    it('expect the Enter that ends the composing of a character not to apply', async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'age');
        type(inputs()[0], '20');
        expect(press(inputs()[0], 'Enter', { isComposing: true }).defaultPrevented).toBe(false);
        expect(menuOpen()).toBe(true);
        expect(datasource.getFilter()).toBeNull();
    });
});

describe('filter menu - the range block: the keyboard', () => {
    /** opens the filter menu from the keyboard, Shift+F10 on the header filter: the focus on Filter › */
    async function openByKey(field: string) {
        const mounted = await mount();
        const cell = headerFilterInput(mounted.element, field);
        cell.focus();
        press(cell, 'F10', { shiftKey: true });
        openFilterMenu(mounted.element, field);
        return { ...mounted, cell };
    }
    const focusedId = () => document.activeElement?.getAttribute('data-menu-id');

    it("expect Tab from Filter › to be the browser's: into the block, the operator picked its first stop", async () => {
        await openByKey('age');
        expect(focusedId()).toEqual('filter.filter');
        expect(press(document.activeElement as HTMLElement, 'Tab').defaultPrevented).toBe(false);
        expect(menuOpen()).toBe(true);

        // the stops of Tab in the block, in order: the radio checked (one stop for the group), the input,
        // Cancel, Apply - checked in a real browser
        const stops = Array.from(block()?.querySelectorAll<HTMLElement>('input, button') ?? []).filter(
            (control) => !(control instanceof HTMLInputElement && control.type === 'radio' && !control.checked)
        );
        expect(stops.map((control) => control.getAttribute('aria-label') ?? control.textContent?.trim())).toEqual([
            'Greater than or equal',
            'Value',
            'Cancel',
            'Apply'
        ]);
        expect(stops.every((control) => control.tabIndex === 0)).toBe(true);
    });

    it('expect Shift+Tab out of the block to get back to Filter ›, the stop of Tab of the menu', async () => {
        await openByKey('age');
        radio('≥').focus();
        const filterItem = document.querySelector('[data-menu-id="filter.filter"]') as HTMLElement;
        expect(filterItem.tabIndex).toEqual(0);
        expect(press(radio('≥'), 'Tab', { shiftKey: true }).defaultPrevented).toBe(false);
        expect(menuOpen()).toBe(true);
    });

    it('expect the block taking the focus to close the Filter › submenu open beside it', async () => {
        await openByKey('age');
        press(document.activeElement as HTMLElement, 'ArrowRight');
        expect(openMenus()).toHaveLength(2);

        radio('≥').focus();

        expect(openMenus()).toHaveLength(1);
        expect(menuOpen()).toBe(true);
    });

    it('expect an operator picked from the keyboard (the arrows of the radios) to keep the focus on it', async () => {
        await openByKey('age');
        radio('≥').focus();
        // the browser checks the next radio on ArrowRight: the key, then its change
        press(radio('≥'), 'ArrowRight');
        radio('Between').checked = true;
        radio('Between').dispatchEvent(new Event('change', { bubbles: true }));

        expect(picked()).toEqual('Between');
        expect(inputs()).toHaveLength(2);
        expect(document.activeElement).toBe(radio('≥'));
    });
});

describe('filter menu - the range block: tooltips', () => {
    it("expect an operator's name as its tooltip, in the menu, gone when the menu closes", async () => {
        const { element } = await mount();
        openFilterMenu(element, 'age');
        operator('>').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const tooltip = document.querySelector('.simple-html-grid-tooltip') as HTMLElement;
        expect(tooltip.textContent).toEqual('Greater than');
        expect(block()?.closest('[popover]')?.contains(tooltip)).toBe(true);

        press(inputs()[0], 'Escape');
        expect(menuOpen()).toBe(false);
        expect(tooltip.isConnected).toBe(false);
    });

    it('expect no tooltip with `tooltips: false`', async () => {
        const { element } = await mount({}, {}, { tooltips: false });
        openFilterMenu(element, 'age');
        operator('>').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        const tooltip = document.querySelector<HTMLElement>('.simple-html-grid-tooltip');
        expect(tooltip === null || tooltip.style.display === 'none').toBe(true);
    });
});

describe('filter menu - the range block: the date picker', () => {
    /** the date picker open from the block, its `<simple-html-date>` */
    const picker = () => document.querySelector<HTMLElement>('simple-html-date');
    /** the days of the first month shown, not the dimmed days of the months around it */
    const days = () =>
        Array.from(
            picker()
                ?.querySelector('.simple-html-date-month')
                ?.querySelectorAll<HTMLElement>('.simple-html-date-day:not(.simple-html-date-day-dimmed)') ?? []
        );
    const clickDay = (day: number) => days()[day - 1].click();
    const selectedDays = () =>
        days()
            .filter((cell) => cell.classList.contains('simple-html-date-day-selected'))
            .map((cell) => Number(cell.textContent?.trim()));
    /** a button of the picker: Clear, Now, Use */
    const pickerButton = (text: string) =>
        Array.from(picker()?.querySelectorAll<HTMLElement>('button.simple-html-date-button') ?? []).find(
            (candidate) => candidate.textContent?.trim() === text
        ) as HTMLElement;
    const title = () => picker()?.querySelector('.simple-html-date-month-title')?.textContent?.replace(/\s+/g, ' ').trim();
    const click = (input: HTMLInputElement) => input.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const pointerdown = (target: Element) => target.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    /**
     * the filter menu of `field`, and a task after it: until then a click is taken for the click that
     * opened the menu (menuJustOpened) - a click in the picker must keep the menu open also after it
     */
    const openMenu = async (element: GridElement, field: string) => {
        openFilterMenu(element, field);
        await sleep(0);
    };

    it('expect a click in the value input of a date column to open the date picker, the menu staying open', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        type(inputs()[0], '2026-01-05');

        click(inputs()[0]);

        expect(picker()).not.toBeNull();
        // on the date the input holds, the date picker of one date: its time, Clear / Now / Use
        expect(title()).toEqual('January 2026');
        expect(selectedDays()).toEqual([5]);
        expect(picker()?.querySelector('.simple-html-date-time')).not.toBeNull();
        // a popover of its own in the menu's popover: it closes with the menu
        const popover = picker()?.parentElement as HTMLElement;
        expect(popover.popover).toEqual('manual');
        expect(isPopoverShown(popover)).toBe(true);
        expect(block()?.closest('[popover]')?.contains(popover)).toBe(true);
        expect(menuOpen()).toBe(true);
    });

    it('expect a day and Use to fill the input, the picker to close, nothing filtered until Apply', async () => {
        const { element, datasource } = await mount();
        await openMenu(element, 'born');
        type(inputs()[0], '2026-01-05');
        click(inputs()[0]);

        clickDay(18);
        expect(menuOpen()).toBe(true);
        pickerButton('Use').click();

        expect(inputs()[0].value).toEqual('2026-01-18');
        expect(picker()).toBeNull();
        expect(menuOpen()).toBe(true);
        expect(datasource.getFilter()).toBeNull();

        button('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('born', 'GREATER_THAN_OR_EQUAL_TO', new Date(2026, 0, 18))));
        expect(names(datasource)).toEqual(['Cid']);
        expect(menuOpen()).toBe(false);
    });

    it('expect Clear to empty the input, Cancel to leave the filter as it was', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'born', '2026-01-05');
        const before = datasource.getFilter();
        await openMenu(element, 'born');
        click(inputs()[0]);

        pickerButton('Clear').click();

        expect(inputs()[0].value).toEqual('');
        expect(menuOpen()).toBe(true);
        button('Cancel').click();
        expect(datasource.getFilter()).toEqual(before);
        expect(headerFilterInput(element, 'born').value).toEqual('2026-01-05');
    });

    it("expect a datetime's date and time picked in the input", async () => {
        const { element } = await mount();
        await openMenu(element, 'at');
        type(inputs()[0], '2026-01-02T10:30:00');
        click(inputs()[0]);

        clickDay(5);
        pickerButton('Use').click();

        expect(inputs()[0].value).toEqual('2026-01-05T10:30:00');
    });

    it('expect From or To of Between to open the range picker on both, Use to fill both, Apply to filter', async () => {
        const { element, datasource } = await mount();
        await openMenu(element, 'born');
        operator('Between').click();
        type(inputs()[0], '2026-01-01');

        click(inputs()[1]);

        expect(picker()?.querySelector('.simple-html-date-range')).not.toBeNull();
        expect(title()).toEqual('January 2026');
        expect(selectedDays()).toEqual([1]);
        // From is picked, the next day is To
        clickDay(5);
        pickerButton('Use').click();

        expect(inputs().map((input) => input.value)).toEqual(['2026-01-01', '2026-01-05']);
        expect(picker()).toBeNull();
        expect(datasource.getFilter()).toBeNull();
        button('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('born', 'BETWEEN', [new Date(2026, 0, 1), new Date(2026, 0, 5)])));
        expect(names(datasource)).toEqual(['Ann', 'Bob']);
        expect(headerFilterInput(element, 'born').value).toEqual('2026-01-01..2026-01-05');
    });

    it('expect Clear of the range picker to empty From and To', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        operator('Between').click();
        type(inputs()[0], '2026-01-01');
        type(inputs()[1], '2026-01-09');
        click(inputs()[0]);
        expect(selectedDays()).toEqual([1, 9]);

        pickerButton('Clear').click();

        expect(inputs().map((input) => input.value)).toEqual(['', '']);
    });

    it("expect a datetime's range to be whole days: To at 23:59:59", async () => {
        const { element, datasource } = await mount();
        await openMenu(element, 'at');
        operator('Between').click();
        type(inputs()[0], '2026-01-01');
        click(inputs()[0]);

        clickDay(5);
        pickerButton('Use').click();

        expect(inputs().map((input) => input.value)).toEqual(['2026-01-01T00:00:00', '2026-01-05T23:59:59']);
        button('Apply').click();
        // Bob at 12:00 on the 5th is in, Cid on February 1st not
        expect(names(datasource)).toEqual(['Ann', 'Bob']);
    });

    it('expect Esc to close the picker only - from the input or the picker - a second Esc the menu', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        click(inputs()[0]);

        expect(press(inputs()[0], 'Escape').defaultPrevented).toBe(true);
        expect(picker()).toBeNull();
        expect(menuOpen()).toBe(true);

        click(inputs()[0]);
        press(picker() as HTMLElement, 'Escape');
        expect(picker()).toBeNull();
        expect(menuOpen()).toBe(true);

        press(inputs()[0], 'Escape');
        expect(menuOpen()).toBe(false);
    });

    it('expect a press in the menu outside the picker to close it, one in its input to leave it open', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        click(inputs()[0]);

        pointerdown(inputs()[0]);
        click(inputs()[0]);
        expect(picker()).not.toBeNull();
        expect(document.querySelectorAll('simple-html-date')).toHaveLength(1);

        pointerdown(operator('>'));
        expect(picker()).toBeNull();
        expect(menuOpen()).toBe(true);
    });

    it('expect another operator picked to close the picker of the input before', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        click(inputs()[0]);

        // from the keyboard: no press before the change
        radio('Between').checked = true;
        radio('Between').dispatchEvent(new Event('change', { bubbles: true }));

        expect(picker()).toBeNull();
        expect(inputs()).toHaveLength(2);
    });

    it('expect the picker to close with the menu', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        click(inputs()[0]);

        button('Cancel').click();

        expect(menuOpen()).toBe(false);
        expect(picker()).toBeNull();
    });

    it('expect a click in the picker - a day, Use - not to be a click outside the menu', async () => {
        const { element } = await mount();
        await openMenu(element, 'born');
        type(inputs()[0], '2026-01-05');
        click(inputs()[0]);
        const reached = vi.fn();
        document.addEventListener('click', reached);

        clickDay(9);
        pickerButton('Use').click();
        document.removeEventListener('click', reached);

        expect(reached).not.toHaveBeenCalled();
        expect(menuOpen()).toBe(true);
        expect(inputs()[0].value).toEqual('2026-01-09');
    });

    it('expect a press in the picker not to take the focus from the input, but in its hour and minute inputs', async () => {
        const { element } = await mount();
        await openMenu(element, 'at');
        click(inputs()[0]);
        const mousedown = (target: Element) => {
            const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            target.dispatchEvent(event);
            return event.defaultPrevented;
        };

        expect(mousedown(days()[3])).toBe(true);
        expect(mousedown(pickerButton('Use'))).toBe(true);
        expect(mousedown(picker()?.querySelector('.simple-html-date-stepper input') as HTMLElement)).toBe(false);
    });

    it('expect no picker on a number column', async () => {
        const { element } = await mount();
        await openMenu(element, 'age');

        click(inputs()[0]);
        operator('Between').click();
        click(inputs()[1]);

        expect(picker()).toBeNull();
    });
});
