// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the date picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import { and, type FilterCondition, type FilterExpression, where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { footerText, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    headerFilterInput,
    menuEntry,
    menuItem,
    menuTreeIds,
    openFilterMenu,
    openRowMenu,
    typeInHeaderFilter,
    valueCheckbox,
    valueRow
} from './interactionTestHelpers';

/**
 * Case sensitive filters and the operators of each type in the grid: the header filter menu's "Match
 * case" and Operator ›, a column's `filterCaseSensitive` and `filterOperators`, the filter editor's
 * toggle (Aa) and operator picker, BETWEEN in the header filter and the editor, and the footer.
 */

const rows = () => [
    { name: 'Ann', city: 'Oslo', age: 10, born: new Date(2026, 0, 1), active: true, country: 'NO' },
    { name: 'ANN', city: 'OSLO', age: 20, born: new Date(2026, 0, 5), active: false, country: 'no' },
    { name: 'anna', city: 'Bergen', age: 30, born: new Date(2026, 1, 1), active: null, country: 'SE' },
    { name: 'Bob', city: null, age: null, born: null, active: true, country: null }
];

const fields = { fields: { age: 'number' as const, born: 'date' as const, active: 'boolean' as const } };

const config = (columns: GridConfig['columns'] = {}): GridConfig => ({
    columns,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['city'], width: 100 },
            { fields: ['age'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['country'], width: 100 }
        ]
    }
});

const mount = (columns: GridConfig['columns'] = {}) => mountGrid(config(columns), rows(), fields);

const names = (datasource: Datasource) => datasource.getDataRows().map((row) => row.name);

/** the column's conditions at the top of the filter, as the header filter makes them */
const conditionsOn = (filter: FilterExpression | null, field: string): FilterCondition[] =>
    filter && 'children' in filter
        ? filter.children.filter((child): child is FilterCondition => !('children' in child) && child.field === field)
        : [];

/** the ids of the operators shown in Operator › of the open filter menu */
const operatorIds = () => menuTreeIds().filter((id) => id.startsWith('filter.operator.'));

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    const countries = new Datasource();
    countries.setData([
        { code: 'NO', name: 'Norway' },
        { code: 'no', name: 'NORWAY (old)' },
        { code: 'SE', name: 'Sweden' }
    ]);
    registerLookup('fco-countries', { datasource: countries, valueField: 'code', labelField: 'name' });
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('header filter menu - Operator › offers the operators of the type', () => {
    it('expect a text column to offer the text operators that take a typed value', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'name');
        expect(operatorIds()).toEqual([
            'filter.operator.equal',
            'filter.operator.notEqualTo',
            'filter.operator.contains',
            'filter.operator.doesNotContain',
            'filter.operator.beginWith',
            'filter.operator.endWith'
        ]);
    });

    it('expect a number and a date column to offer the comparisons and BETWEEN', async () => {
        const { element } = await mount();
        const range = [
            'filter.operator.equal',
            'filter.operator.notEqualTo',
            'filter.operator.lessThan',
            'filter.operator.lessThanOrEqualTo',
            'filter.operator.greaterThan',
            'filter.operator.greaterThanOrEqualTo',
            'filter.operator.between'
        ];
        openFilterMenu(element, 'age');
        expect(operatorIds()).toEqual(range);
        openFilterMenu(element, 'born');
        expect(operatorIds()).toEqual(range);
    });

    it('expect a boolean column to have no Operator ›, nor Match case', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'active');
        expect(menuTreeIds()).not.toContain('filter.operator');
        expect(menuTreeIds()).not.toContain('filter.matchCase');
    });

    it('expect each operator picked to filter with what the cell has', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'name', 'ann');
        expect(names(datasource)).toEqual(['Ann', 'ANN']);

        openFilterMenu(element, 'name');
        menuEntry('filter.operator.beginWith').click();
        expect(names(datasource)).toEqual(['Ann', 'ANN', 'anna']);

        openFilterMenu(element, 'name');
        menuEntry('filter.operator.doesNotContain').click();
        expect(names(datasource)).toEqual(['Bob']);
    });
});

describe('header filter menu - Match case', () => {
    it('expect a toggle with a ✓ for a text column, off at first', async () => {
        const { element } = await mount();
        openFilterMenu(element, 'name');
        const item = menuEntry('filter.matchCase');
        expect(item.textContent?.trim()).toEqual('Match case');
        expect(item.getAttribute('role')).toEqual('menuitemcheckbox');
        expect(item.getAttribute('aria-checked')).toEqual('false');
        // not for a number
        openFilterMenu(element, 'age');
        expect(menuTreeIds()).not.toContain('filter.matchCase');
    });

    it('expect it on to be state, the header conditions to match case, off again to take it away', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'name', 'Ann');
        expect(names(datasource)).toEqual(['Ann', 'ANN']);

        openFilterMenu(element, 'name');
        menuEntry('filter.matchCase').click();

        expect(names(datasource)).toEqual(['Ann']);
        expect(conditionsOn(datasource.getFilter(), 'name')).toEqual([
            { field: 'name', operator: 'EQUAL', value: 'Ann', caseSensitive: true }
        ]);
        expect(gridInterface.getState().headerFilters.name).toEqual({ value: 'Ann', caseSensitive: true });
        openFilterMenu(element, 'name');
        expect(menuEntry('filter.matchCase').getAttribute('aria-checked')).toEqual('true');

        // typed again: it stays on
        typeInHeaderFilter(element, 'name', 'an*');
        expect(names(datasource)).toEqual(['anna']);

        openFilterMenu(element, 'name');
        menuEntry('filter.matchCase').click();
        expect(names(datasource)).toEqual(['Ann', 'ANN', 'anna']);
        expect(gridInterface.getState().headerFilters.name).toEqual({ value: 'an*' });
    });

    it('expect it on without a value to be kept in the state, and given back by setState()', async () => {
        const { element, datasource, gridInterface } = await mount();
        openFilterMenu(element, 'name');
        menuEntry('filter.matchCase').click();
        const state = JSON.parse(JSON.stringify(gridInterface.getState()));
        expect(state.headerFilters).toEqual({ name: { value: null, caseSensitive: true } });

        gridInterface.resetState();
        expect(gridInterface.getState().headerFilters).toEqual({});
        gridInterface.setState(state);
        typeInHeaderFilter(element, 'name', 'ANN');
        expect(names(datasource)).toEqual(['ANN']);
    });

    it('expect the value list to keep texts that differ in case apart while it is on, its IN to match case', async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'city');
        // off: Oslo and OSLO are one entry
        expect(valueRow('Oslo')).toBeDefined();
        expect(valueRow('OSLO')).toBeUndefined();

        menuEntry('filter.matchCase').click();
        openFilterMenu(element, 'city');
        expect(valueRow('Oslo')).toBeDefined();
        expect(valueRow('OSLO')).toBeDefined();

        // only OSLO: an IN of the values checked
        (document.querySelector('.simple-html-grid-value-all input') as HTMLInputElement).click();
        valueCheckbox('OSLO').click();
        menuItem('Apply').click();

        expect(conditionsOn(datasource.getFilter(), 'city')).toEqual([
            { field: 'city', operator: 'IN', value: ['OSLO'], caseSensitive: true }
        ]);
        expect(datasource.getDataRows().map((row) => row.city)).toEqual(['OSLO']);
    });

    it('expect a lookup column to match its labels with case, and its IN of the values too', async () => {
        const { element, datasource } = await mount({ country: { editor: { type: 'select', lookup: 'fco-countries' } } });
        openFilterMenu(element, 'country');
        expect(menuTreeIds()).toContain('filter.matchCase');
        menuEntry('filter.matchCase').click();

        typeInHeaderFilter(element, 'country', 'Norway*');
        expect(conditionsOn(datasource.getFilter(), 'country')).toEqual([
            { field: 'country', operator: 'IN', value: ['NO'], caseSensitive: true }
        ]);
        // 'no' is the code of another row of the lookup
        expect(names(datasource)).toEqual(['Ann']);
    });
});

describe('ColumnConfig.filterCaseSensitive - a column that always matches case', () => {
    it('expect Match case on, greyed out, with the hint "always", a click to change nothing', async () => {
        const { element, gridInterface } = await mount({ name: { filterCaseSensitive: true } });
        openFilterMenu(element, 'name');
        const item = menuEntry('filter.matchCase');
        expect(item.getAttribute('aria-checked')).toEqual('true');
        expect(item.getAttribute('aria-disabled')).toEqual('true');
        expect(item.querySelector('i')?.textContent).toEqual('(always)');

        item.click();
        expect(gridInterface.getState().headerFilters).toEqual({});
    });

    it('expect the typed value, the value list and the row menu to match case', async () => {
        const { element, datasource } = await mount({ city: { filterCaseSensitive: true } });
        typeInHeaderFilter(element, 'city', 'Oslo');
        expect(conditionsOn(datasource.getFilter(), 'city')).toEqual([
            { field: 'city', operator: 'EQUAL', value: 'Oslo', caseSensitive: true }
        ]);
        expect(names(datasource)).toEqual(['Ann']);

        typeInHeaderFilter(element, 'city', '');
        openFilterMenu(element, 'city');
        expect(valueRow('OSLO')).toBeDefined();

        datasource.filter(null);
        openRowMenu(element, 'city', 1);
        menuEntry('row.filter.replace').click();
        expect(datasource.getFilter()).toEqual(and(where('city', 'EQUAL', 'OSLO', { caseSensitive: true, literal: true })));
        expect(names(datasource)).toEqual(['ANN']);
    });

    it("expect the row menu's filter of a column that does not match case to ignore case, as before", async () => {
        const { element, datasource } = await mount();
        openRowMenu(element, 'city', 1);
        menuEntry('row.filter.replace').click();
        expect(datasource.getFilter()).toEqual(and(where('city', 'EQUAL', 'OSLO', { literal: true })));
    });
});

describe('ColumnConfig.filterOperators - the operators a column offers', () => {
    it('expect Operator › to offer them in the order of the type, the first the header filter takes to be its default', async () => {
        const { element, datasource } = await mount({ name: { filterOperators: ['IS_BLANK', 'BEGIN_WITH', 'CONTAINS'] } });
        openFilterMenu(element, 'name');
        expect(operatorIds()).toEqual(['filter.operator.contains', 'filter.operator.beginWith']);
        expect(menuEntry('filter.operator.contains').getAttribute('aria-checked')).toEqual('true');

        typeInHeaderFilter(element, 'name', 'nn');
        expect(conditionsOn(datasource.getFilter(), 'name')).toEqual([{ field: 'name', operator: 'CONTAINS', value: 'nn' }]);
    });

    it("expect the type's default to stay the default when they have it, `operator` to win", async () => {
        const { element, datasource } = await mount({
            name: { filterOperators: ['CONTAINS', 'EQUAL'] },
            age: { filterOperators: ['EQUAL', 'BETWEEN'], operator: 'BETWEEN' }
        });
        typeInHeaderFilter(element, 'name', 'ann');
        typeInHeaderFilter(element, 'age', '10..20');
        expect(conditionsOn(datasource.getFilter(), 'name')[0].operator).toEqual('EQUAL');
        expect(conditionsOn(datasource.getFilter(), 'age')).toEqual([{ field: 'age', operator: 'BETWEEN', value: [10, 20] }]);
    });

    it('expect Blank › to offer what they have, and to be left out with neither', async () => {
        const { element } = await mount({
            name: { filterOperators: ['EQUAL', 'IS_NOT_BLANK'] },
            city: { filterOperators: ['EQUAL'] }
        });
        openFilterMenu(element, 'name');
        expect(menuTreeIds()).toContain('filter.filter.isNotBlank');
        expect(menuTreeIds()).not.toContain('filter.filter.isBlank');
        openFilterMenu(element, 'city');
        expect(menuTreeIds()).not.toContain('filter.filter.blank');
    });

    it('expect the value list only with IN, and an IN of the checked values without NOT_IN', async () => {
        const { element, datasource } = await mount({
            name: { filterOperators: ['EQUAL'] },
            city: { filterOperators: ['EQUAL', 'IN'] }
        });
        openFilterMenu(element, 'name');
        expect(menuTreeIds()).not.toContain('filter.values');

        openFilterMenu(element, 'city');
        // one unchecked of four: a NOT_IN of it, were NOT_IN offered
        valueCheckbox('Bergen').click();
        menuItem('Apply').click();
        // Oslo and OSLO are one entry, the IN finds both
        expect(conditionsOn(datasource.getFilter(), 'city')).toEqual([
            { field: 'city', operator: 'IN', value: ['NULL', 'Oslo'] }
        ]);
        expect(names(datasource)).toEqual(['Ann', 'ANN', 'Bob']);
    });

    it('expect an operator of the state the column does not offer to be passed by', async () => {
        const { element, datasource, gridInterface } = await mount({ name: { filterOperators: ['CONTAINS', 'BEGIN_WITH'] } });
        gridInterface.setState({ headerFilters: { name: { value: null, operator: 'EQUAL' } } });
        typeInHeaderFilter(element, 'name', 'nn');
        expect(conditionsOn(datasource.getFilter(), 'name')[0].operator).toEqual('CONTAINS');
    });
});

describe('the config checks: filterOperators, operator, filterCaseSensitive', () => {
    const datasource = () => new Datasource({ fields: { age: 'number', active: 'boolean' } });
    const make = (columns: GridConfig['columns']) =>
        new GridInterface({ columns, layout: { center: [{ fields: ['name'], width: 100 }] } }, datasource());

    it('expect a TypeError naming the column for an operator its type does not have', () => {
        expect(() => make({ age: { filterOperators: ['CONTAINS'] } })).toThrow(
            `GridConfig: columns.age.filterOperators has "CONTAINS", not an operator of a number column`
        );
        expect(() => make({ active: { filterOperators: ['LESS_THAN'] } })).toThrow(TypeError);
        expect(() => make({ name: { filterOperators: ['BETWEEN'] } })).toThrow(TypeError);
        expect(() => make({ name: { filterOperators: ['NOPE' as any] } })).toThrow(TypeError);
    });

    it('expect a TypeError for an empty list, one that is no list, and one without an operator for the header filter', () => {
        expect(() => make({ name: { filterOperators: [] } })).toThrow('columns.name.filterOperators is a list of operators');
        expect(() => make({ name: { filterOperators: 'EQUAL' as any } })).toThrow(TypeError);
        expect(() => make({ name: { filterOperators: ['IN', 'IS_BLANK'] } })).toThrow(
            "columns.name.filterOperators needs an operator for the header filter's input"
        );
    });

    it("expect a TypeError for an operator the header filter does not take: not the type's, not of filterOperators, IN", () => {
        expect(() => make({ age: { operator: 'CONTAINS' } })).toThrow(
            'GridConfig: columns.age.operator is "CONTAINS", the header filter of this number column takes'
        );
        expect(() => make({ name: { operator: 'IN' } })).toThrow(TypeError);
        expect(() => make({ name: { operator: 'IS_BLANK' } })).toThrow(TypeError);
        expect(() => make({ name: { filterOperators: ['CONTAINS'], operator: 'EQUAL' } })).toThrow(TypeError);
        expect(() =>
            make({ age: { operator: 'BETWEEN' }, name: { operator: 'END_WITH' }, active: { operator: 'NOT_EQUAL_TO' } })
        ).not.toThrow();
    });

    it('expect a TypeError for filterCaseSensitive on a column that is no text, or that is no boolean', () => {
        expect(() => make({ age: { filterCaseSensitive: true } })).toThrow(
            "GridConfig: columns.age.filterCaseSensitive is for a text column, 'age' is number"
        );
        expect(() => make({ name: { filterCaseSensitive: 'yes' as any } })).toThrow(TypeError);
        expect(() => make({ age: { filterCaseSensitive: false }, name: { filterCaseSensitive: true } })).not.toThrow();
    });

    it('expect a lookup column to be checked as text, it filters on its labels', () => {
        const ds = new Datasource({ fields: { customer: 'number' } });
        const customers = new Datasource({ fields: { id: 'number' } });
        customers.setData([{ id: 1, name: 'ACME' }]);
        registerLookup('fco-customers', { datasource: customers, valueField: 'id', labelField: 'name' });
        const layout = { center: [{ fields: ['customer'], width: 100 }] };
        const editor = { type: 'select' as const, lookup: 'fco-customers' };
        expect(
            () =>
                new GridInterface(
                    { columns: { customer: { editor, filterOperators: ['CONTAINS'], filterCaseSensitive: true } }, layout },
                    ds
                )
        ).not.toThrow();
        expect(() => new GridInterface({ columns: { customer: { editor, filterOperators: ['BETWEEN'] } }, layout }, ds)).toThrow(
            TypeError
        );
    });

    it('expect updateConfig() to check them too, and to leave the grid as it was when it throws', async () => {
        const { gridInterface } = await mount();
        expect(() => gridInterface.updateConfig({ columns: { age: { filterOperators: ['CONTAINS'] } } })).toThrow(TypeError);
        expect(gridInterface.__getGridConfig().columns.age?.filterOperators).toBeUndefined();
    });
});

describe('header filter - BETWEEN typed as from..to', () => {
    const pickBetween = (element: HTMLElement, field: string) => {
        openFilterMenu(element as any, field);
        menuEntry('filter.operator.between').click();
    };

    it('expect from..to, an open end, and one value as both ends', async () => {
        const { element, datasource } = await mount();
        pickBetween(element, 'age');
        expect(headerFilterInput(element, 'age').placeholder).toEqual('from..to');

        typeInHeaderFilter(element, 'age', '10..20');
        expect(conditionsOn(datasource.getFilter(), 'age')).toEqual([{ field: 'age', operator: 'BETWEEN', value: [10, 20] }]);
        expect(names(datasource)).toEqual(['Ann', 'ANN']);

        typeInHeaderFilter(element, 'age', '20..');
        expect(conditionsOn(datasource.getFilter(), 'age')[0].value).toEqual([20, null]);
        expect(names(datasource)).toEqual(['ANN', 'anna']);

        typeInHeaderFilter(element, 'age', '..10');
        // a blank number is 0
        expect(names(datasource)).toEqual(['Ann', 'Bob']);

        typeInHeaderFilter(element, 'age', '30');
        expect(conditionsOn(datasource.getFilter(), 'age')[0].value).toEqual([30, 30]);

        typeInHeaderFilter(element, 'age', '..');
        expect(conditionsOn(datasource.getFilter(), 'age')).toEqual([]);
    });

    it('expect the cell to show its value as from..to, and the state to have [from, to]', async () => {
        const { element, gridInterface } = await mount();
        pickBetween(element, 'age');
        typeInHeaderFilter(element, 'age', '10..20');
        gridInterface.rebuild();
        expect(headerFilterInput(element, 'age').value).toEqual('10..20');
        expect(gridInterface.getState().headerFilters.age).toEqual({ value: [10, 20], operator: 'BETWEEN' });
    });

    it('expect another operator picked after it to take its start, BETWEEN picked after one to take the value as both ends', async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'age', '20');
        pickBetween(element, 'age');
        expect(conditionsOn(datasource.getFilter(), 'age')[0].value).toEqual([20, 20]);
        expect(headerFilterInput(element, 'age').value).toEqual('20..20');

        typeInHeaderFilter(element, 'age', '10..30');
        openFilterMenu(element, 'age');
        menuEntry('filter.operator.greaterThan').click();
        expect(conditionsOn(datasource.getFilter(), 'age')).toEqual([{ field: 'age', operator: 'GREATER_THAN', value: 10 }]);
        expect(headerFilterInput(element, 'age').value).toEqual('10');
    });

    it('expect a date column to take the days with the formatter', async () => {
        const { element, datasource } = await mount();
        pickBetween(element, 'born');
        typeInHeaderFilter(element, 'born', '2026-01-01..2026-01-05');
        expect(names(datasource)).toEqual(['Ann', 'ANN']);
    });

    it('expect the state of JSON to show and filter the same', async () => {
        const { element, datasource, gridInterface } = await mount();
        pickBetween(element, 'born');
        typeInHeaderFilter(element, 'born', '2026-01-02..');
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.resetState();
        gridInterface.setState(saved);
        expect(names(datasource)).toEqual(['ANN', 'anna']);
        expect(headerFilterInput(element, 'born').value).toEqual('2026-01-02..');
    });
});

describe('the footer', () => {
    it("expect a BETWEEN chip as 'Age between 10 and 20', an open end as ≥ or ≤", async () => {
        const { element, datasource } = await mount();
        const chips = () => element.querySelector('.footer-filter-chips')?.textContent?.replace(/\s+/g, ' ').trim();
        datasource.filter(where('age', 'BETWEEN', [10, 20]));
        expect(chips()).toEqual('Age between 10 and 20');
        expect(footerText(element)).toContain('2/4');
        datasource.filter(where('age', 'BETWEEN', [10, null]));
        expect(chips()).toEqual('Age ≥ 10');
        datasource.filter(where('age', 'BETWEEN', [null, 20]));
        expect(chips()).toEqual('Age ≤ 20');
    });

    it('expect "Aa" after the value of a condition that matches case, with its tooltip', async () => {
        const { element, datasource } = await mount();
        datasource.filter(and(where('name', 'EQUAL', 'Ann', { caseSensitive: true }), where('city', 'EQUAL', 'Oslo')));
        const markers = element.querySelectorAll('.footer-filter-case');
        expect(markers).toHaveLength(1);
        expect([markers[0].textContent?.trim(), markers[0].getAttribute('title')]).toEqual(['Aa', 'Match case']);
        expect(markers[0].previousElementSibling?.textContent).toEqual('Ann');
    });
});

describe('filter editor - Match case (Aa) and the operators of the field', () => {
    const container = () => document.querySelector('.filter-editor-content') as HTMLDialogElement;
    const conditionRows = () => Array.from(container().querySelectorAll<HTMLElement>('.filter-editor-condition'));
    const toggleOf = (row: HTMLElement) => row.querySelector<HTMLButtonElement>('.filter-editor-case');
    const openWith = async (filter: FilterExpression | null, columns: GridConfig['columns'] = {}) => {
        const mounted = await mount(columns);
        mounted.datasource.filter(filter);
        mounted.gridInterface.openFilterEditor();
        return mounted;
    };
    const operatorMenu = (row: HTMLElement) => {
        (row.querySelector('.filter-editor-pick-operator') as HTMLElement).click();
        return Array.from(document.querySelectorAll('.simple-html-grid-menu-item'), (item) => item.textContent?.trim());
    };

    it('expect the toggle on a text condition only: named, a tooltip, pressed while it matches case', async () => {
        await openWith(
            and(
                where('name', 'EQUAL', 'Ann', { caseSensitive: true }),
                where('city', 'EQUAL', 'Oslo'),
                where('age', 'EQUAL', 10),
                where('name', 'IS_BLANK')
            )
        );
        const [name, city, age, blank] = conditionRows();
        expect(
            [name, city].map((row) => [
                toggleOf(row)?.textContent?.trim(),
                toggleOf(row)?.getAttribute('aria-label'),
                toggleOf(row)?.getAttribute('data-tooltip'),
                toggleOf(row)?.getAttribute('aria-pressed')
            ])
        ).toEqual([
            ['Aa', 'Match case', 'Match case', 'true'],
            ['Aa', 'Match case', 'Match case', 'false']
        ]);
        expect(toggleOf(age)).toBeNull();
        expect(toggleOf(blank)).toBeNull();
    });

    it('expect a click to turn it on, Apply to give the condition caseSensitive, undo to take it back', async () => {
        const { datasource } = await openWith(and(where('name', 'EQUAL', 'Ann')));
        toggleOf(conditionRows()[0])?.click();
        expect(toggleOf(conditionRows()[0])?.getAttribute('aria-pressed')).toEqual('true');
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('name', 'EQUAL', 'Ann', { caseSensitive: true })));
        expect(names(datasource)).toEqual(['Ann']);

        (container().querySelector('.filter-editor-undo') as HTMLElement).click();
        expect(toggleOf(conditionRows()[0])?.getAttribute('aria-pressed')).toEqual('false');
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('name', 'EQUAL', 'Ann')));
    });

    it('expect a column that always matches case to have it pressed and greyed out, Apply to match case', async () => {
        const { datasource } = await openWith(and(where('city', 'EQUAL', 'Oslo')), { city: { filterCaseSensitive: true } });
        const toggle = toggleOf(conditionRows()[0]) as HTMLButtonElement;
        expect([
            toggle.getAttribute('aria-pressed'),
            toggle.getAttribute('aria-disabled'),
            toggle.getAttribute('aria-label')
        ]).toEqual(['true', 'true', 'Match case: always, for this column']);
        toggle.click();
        expect(toggleOf(conditionRows()[0])?.getAttribute('aria-pressed')).toEqual('true');
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('city', 'EQUAL', 'Oslo', { caseSensitive: true })));
    });

    it("expect the operator picker to offer the field's operators: text, number, boolean, none picked a text's", async () => {
        await openWith(and(where('name', 'EQUAL', 'a'), where('age', 'EQUAL', 1), where('active', 'EQUAL', true)));
        const [name, age, active] = conditionRows();
        expect(operatorMenu(name)).toEqual([
            'Equal',
            'Not Equal To',
            'Contains',
            'Does Not Contain',
            'Begin With',
            'End With',
            'In',
            'Not In',
            'Is Blank',
            'Is Not Blank'
        ]);
        expect(operatorMenu(age)).toEqual([
            'Equal',
            'Not Equal To',
            'Less Than',
            'Less Than Or Equal To',
            'Greater Than',
            'Greater Than Or Equal To',
            'Between',
            'In',
            'Not In',
            'Is Blank',
            'Is Not Blank'
        ]);
        expect(operatorMenu(active)).toEqual(['Equal', 'Not Equal To', 'Is Blank', 'Is Not Blank']);
    });

    it("expect a column's filterOperators to be what the picker offers", async () => {
        await openWith(and(where('name', 'CONTAINS', 'a')), { name: { filterOperators: ['CONTAINS', 'IS_BLANK'] } });
        expect(operatorMenu(conditionRows()[0])).toEqual(['Contains', 'Is Blank']);
    });

    it('expect a lookup column on a text field to offer its filterOperators, on a number field the number operators', async () => {
        const ds = new Datasource({ fields: { customer: 'number' } });
        const customers = new Datasource({ fields: { id: 'number' } });
        customers.setData([{ id: 1, name: 'ACME' }]);
        registerLookup('fco-customers-editor', { datasource: customers, valueField: 'id', labelField: 'name' });
        ds.setData([{ customer: 1 }]);
        const gridInterface = new GridInterface(
            {
                columns: {
                    customer: { editor: { type: 'select', lookup: 'fco-customers-editor' }, filterOperators: ['CONTAINS'] }
                },
                layout: { center: [{ fields: ['customer'], width: 100 }] }
            },
            ds
        );
        await import('../gridElement');
        const element = document.createElement('simple-html-grid') as any;
        document.body.appendChild(element);
        element.connectInterface(gridInterface);
        ds.filter(and(where('customer', 'EQUAL', 1)));
        gridInterface.openFilterEditor();
        expect(operatorMenu(conditionRows()[0])).toContain('Between');
    });

    it('expect a field picked whose type does not offer the operator to take the operator away', async () => {
        await openWith(and(where('name', 'CONTAINS', 'a')));
        (conditionRows()[0].querySelector('.filter-editor-pick-field') as HTMLElement).click();
        menuItem('City').click();
        expect(conditionRows()[0].querySelector('.filter-editor-pick-operator')?.textContent?.trim()).toEqual('Contains');
        (conditionRows()[0].querySelector('.filter-editor-pick-field') as HTMLElement).click();
        menuItem('Age').click();
        expect(conditionRows()[0].querySelector('.filter-editor-pick-operator')?.textContent?.trim()).toEqual('Operator');
    });

    it('expect an operator the type does not offer (a filter saved with v5) to be shown and kept', async () => {
        const { datasource } = await openWith(and(where('age', 'CONTAINS', 20)));
        expect(conditionRows()[0].querySelector('.filter-editor-pick-operator')?.textContent?.trim()).toEqual('Contains');
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('age', 'CONTAINS', 20)));
        expect(names(datasource)).toEqual(['ANN', 'anna']);
    });

    it('expect BETWEEN to have two inputs, From and To, without the switch to a column', async () => {
        const { datasource } = await openWith(and(where('age', 'BETWEEN', [10, 20])));
        const [from, to] = Array.from(conditionRows()[0].querySelectorAll<HTMLInputElement>('.filter-editor-value'));
        expect([from.value, from.getAttribute('aria-label'), from.placeholder]).toEqual(['10', 'From', 'From']);
        expect([to.value, to.getAttribute('aria-label')]).toEqual(['20', 'To']);
        expect(
            conditionRows()[0].querySelector('[data-tooltip="Compare against another column instead of a typed in value"]')
        ).toBeNull();

        to.value = '';
        to.dispatchEvent(new Event('change', { bubbles: true }));
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [10, null])));
        expect(names(datasource)).toEqual(['Ann', 'ANN', 'anna']);
    });

    it('expect BETWEEN picked to take the value as its start, another operator after it its start as the value', async () => {
        const { datasource } = await openWith(and(where('age', 'GREATER_THAN', 15)));
        (conditionRows()[0].querySelector('.filter-editor-pick-operator') as HTMLElement).click();
        menuItem('Between').click();
        const [from, to] = Array.from(conditionRows()[0].querySelectorAll<HTMLInputElement>('.filter-editor-value'));
        expect([from.value, to.value]).toEqual(['15', '']);
        to.value = '25';
        to.dispatchEvent(new Event('change', { bubbles: true }));
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('age', 'BETWEEN', [15, 25])));

        (conditionRows()[0].querySelector('.filter-editor-pick-operator') as HTMLElement).click();
        menuItem('Less Than Or Equal To').click();
        menuItem('Apply').click();
        expect(datasource.getFilter()).toEqual(and(where('age', 'LESS_THAN_OR_EQUAL_TO', 15)));
    });

    it('expect a BETWEEN of dates to open the date picker under each input', async () => {
        await openWith(and(where('born', 'BETWEEN', [new Date(2026, 0, 1), null])));
        const [, to] = Array.from(conditionRows()[0].querySelectorAll<HTMLInputElement>('.filter-editor-value'));
        to.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(document.querySelector('simple-html-date')).not.toBeNull();
    });
});

describe('Match case shown in the header (Aa), in the operator choice and the dialog', () => {
    /** the operator indicator of a column's header filter, and its input */
    const indicatorOf = (element: HTMLElement, field: string) =>
        headerFilterInput(element as never, field).parentElement?.querySelector(
            '.simple-html-grid-filter-operator'
        ) as HTMLElement;
    const shown = (element: HTMLElement, field: string) => {
        const indicator = indicatorOf(element, field);
        return {
            aa: indicator.querySelector('.simple-html-grid-filter-case')?.textContent ?? null,
            name: indicator.getAttribute('aria-label'),
            wide: indicator.classList.contains('simple-html-grid-filter-operator-case'),
            room: headerFilterInput(element as never, field).classList.contains('simple-html-grid-cell-filter-input-case')
        };
    };

    it("expect Aa beside the operator of a column that always matches case, its name saying so, the input's room", async () => {
        const { element } = await mount({ city: { filterCaseSensitive: true } });
        expect(shown(element, 'city')).toEqual({ aa: 'Aa', name: 'Operator: Equal, match case', wide: true, room: true });
        expect(shown(element, 'name')).toEqual({ aa: null, name: 'Operator: Equal', wide: false, room: false });
        // not on a number column, case is a text's
        expect(indicatorOf(element, 'age').querySelector('.simple-html-grid-filter-case')).toBeNull();
    });

    it('expect Match case at the end of the operator choice: on - Aa, the filter matches case - and off again', async () => {
        const { element, datasource, gridInterface } = await mount();
        typeInHeaderFilter(element, 'name', 'Ann');
        expect(names(datasource)).toEqual(['Ann', 'ANN']);

        indicatorOf(element, 'name').click();
        menuEntry('filter.matchCase').click();
        expect(names(datasource)).toEqual(['Ann']);
        expect(gridInterface.getState().headerFilters.name?.caseSensitive).toBe(true);
        expect(shown(element, 'name').aa).toBe('Aa');

        indicatorOf(element, 'name').click();
        expect(menuEntry('filter.matchCase').getAttribute('aria-checked')).toBe('true');
        menuEntry('filter.matchCase').click();
        expect(names(datasource)).toEqual(['Ann', 'ANN']);
        expect(shown(element, 'name').aa).toBeNull();
    });

    it("expect the dialog's Header filter tab to have Match case: Apply sets it, greyed out when always, Reset column off", async () => {
        const { element, datasource, gridInterface } = await mount({ city: { filterCaseSensitive: true } });
        typeInHeaderFilter(element, 'name', 'Ann');
        const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
        const box = () => dialog().querySelector('.column-settings-match-case') as HTMLInputElement | null;
        const apply = () =>
            (
                Array.from(dialog().querySelectorAll('button')).find(
                    (b) => b.textContent?.trim() === 'Apply'
                ) as HTMLButtonElement
            ).click();

        gridInterface.openColumnSettings('name');
        expect(box()?.checked).toBe(false);
        box()?.click();
        apply();
        expect(names(datasource)).toEqual(['Ann']);
        expect(shown(element, 'name').aa).toBe('Aa');

        // always: checked, can not change; its hint says why
        gridInterface.openColumnSettings('city');
        expect([box()?.checked, box()?.disabled]).toEqual([true, true]);
        expect(dialog().querySelector('#' + box()?.getAttribute('aria-describedby'))?.textContent).toContain(
            'filterCaseSensitive'
        );
        // a number column has none
        gridInterface.openColumnSettings('age');
        expect(box()).toBeNull();

        // Reset column: as the column starts - off
        gridInterface.openColumnSettings('name');
        expect(box()?.checked).toBe(true);
        (
            Array.from(dialog().querySelectorAll('button')).find(
                (b) => b.textContent?.trim() === 'Reset column'
            ) as HTMLButtonElement
        ).click();
        expect(box()?.checked).toBe(false);
        apply();
        expect(names(datasource)).toEqual(['Ann', 'ANN']);
    });
});
