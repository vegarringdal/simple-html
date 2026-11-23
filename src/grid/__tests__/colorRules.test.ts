// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { declarations, readCss } from '../../__tests__/themeCss';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { type Entity, isGroupRow } from '../../datasource/entity';
import { type FilterCondition, type FilterOperator, where } from '../../datasource/filterExpression';
import { registerCellRenderer } from '../cellRendererRegistry';
import {
    assertColorRules,
    COLOR_RULE_CLASSES,
    type ColorRule,
    colorRuleClasses,
    colorRuleOf,
    colorRuleProblem,
    PALETTE_COLORS,
    ruleCondition,
    ruleOperatorsFor
} from '../colorRules';
import type { ColumnFormat } from '../columnFormat';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { headerOperators } from '../gridFunctions/columnFilterOptions';
import { filterCallback } from '../gridFunctions/filterCallback';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf } from './interactionTestHelpers';

/**
 * The colour rules of a column (ColumnFormat.rules, colorRules.ts): a rule matches the rows the column's
 * header filter keeps with the same operator and text - checked against the header filter itself
 * (filterCallback) and the datasource's filter, for every type and operator; the first rule that matches
 * wins; the classes on the cells - every kind of cell, a cell reused for another row while scrolling, an
 * edit as it is typed - and on the detail form's values; the TypeErrors of a rule that does not fit.
 * The dialog is in columnSettingsRules.test.ts, the colours in the theme tests and the browser.
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

const CODES = new Datasource();
CODES.setData([
    { code: 1, label: 'One' },
    { code: 2, label: 'Two' },
    { code: 3, label: 'Three' }
]);
registerLookup('rules-test-codes', { datasource: CODES, valueField: 'code', labelField: 'label' });

// a custom cell: its text in the host, as a renderer of your own draws it
registerCellRenderer('rules-test-badge', (host) => ({
    update: ({ text }) => {
        host.textContent = text;
    }
}));

const LAYOUT = ['name', 'tag', 'age', 'born', 'updated', 'active', 'code', 'flag', 'site', 'badge', 'notes'];

/** blanks, 0, negatives, upper and lower case, wildcard characters, a value the lookup has not */
const rows = (): Entity[] => [
    {
        id: 1,
        name: 'Ann',
        tag: 'Late',
        age: 10,
        born: new Date(2026, 10, 22),
        updated: new Date(2026, 10, 22, 13, 45),
        active: true,
        code: 1,
        flag: '1',
        site: 'acme',
        badge: 'waiting',
        notes: 'one\ntwo'
    },
    {
        id: 2,
        name: 'ann marie',
        tag: 'late',
        age: 0,
        born: new Date(2026, 0, 1),
        updated: new Date(2026, 0, 1, 8, 0),
        active: false,
        code: 2,
        flag: '0',
        site: '',
        badge: 'done',
        notes: 'late'
    },
    {
        id: 3,
        name: 'Bob',
        tag: 'on time',
        age: -5,
        born: null,
        updated: null,
        active: null,
        code: 3,
        flag: '1',
        site: 'bob',
        badge: 'open',
        notes: ''
    },
    {
        id: 4,
        name: '',
        tag: '',
        age: null,
        born: new Date(2025, 5, 30),
        updated: new Date(2025, 5, 30, 23, 59),
        active: true,
        code: null,
        flag: null,
        site: 'x',
        badge: null,
        notes: null
    },
    {
        id: 5,
        name: 'p_mp',
        tag: 'LATE',
        age: 30,
        born: new Date(2026, 10, 23),
        updated: new Date(2026, 10, 23, 0, 0),
        active: false,
        code: 99,
        flag: '1',
        site: 'y',
        badge: 'waiting',
        notes: 'x'
    },
    {
        id: 6,
        name: null,
        tag: null,
        age: 20.5,
        born: new Date(2026, 10, 22, 23, 59),
        updated: new Date(2026, 10, 22, 13, 45, 30),
        active: true,
        code: 2,
        flag: '0',
        site: 'z',
        badge: 'open',
        notes: 'y'
    }
];

const fields = (): DatasourceOptions => ({
    fields: {
        id: 'number',
        age: 'number',
        born: 'date',
        updated: 'datetime',
        active: 'boolean',
        code: 'number',
        notes: { multiline: true }
    }
});

/** the columns, a format given for a column in place of its own */
const columns = (formats: Record<string, ColumnFormat>): GridConfig['columns'] => {
    const own: NonNullable<GridConfig['columns']> = {
        // a text column that always matches case
        tag: { filterCaseSensitive: true },
        code: { editor: { type: 'select', lookup: 'rules-test-codes' } },
        flag: { format: { checkbox: {} } },
        site: { format: { link: { url: 'https://example.com/{site}' } } },
        badge: { renderer: 'rules-test-badge' }
    };
    for (const [field, format] of Object.entries(formats)) {
        own[field] = { ...own[field], format };
    }
    return own;
};

const config = (formats: Record<string, ColumnFormat> = {}): GridConfig => ({
    readonly: false,
    columns: columns(formats),
    // all on screen: 1000px wide
    layout: { center: LAYOUT.map((field) => ({ fields: [field], width: 80 })) }
});

const mount = (formats: Record<string, ColumnFormat> = {}, data = rows()) => mountGrid(config(formats), data, fields());

/**
 * a grid of one column: the header filter runs again and again, each run renders the grid - one column
 * keeps it quick
 */
const mountColumn = (field: string) => {
    const one = config();
    one.layout = { center: [{ fields: [field], width: 100 }] };
    return mountGrid(one, rows(), fields());
};

/** the ids of the rows a rule matches, of all the rows */
function ruleIds({ datasource, gridInterface }: MountedGrid, field: string, rule: ColorRule): number[] {
    return datasource
        .getAllData()
        .filter((row) => colorRuleOf(gridInterface, field, row, { rules: [rule] }) !== null)
        .map((row) => row.id as number)
        .sort((a, b) => a - b);
}

/** the ids of the rows shown, then the filter taken away */
function shownIds({ datasource, gridInterface }: MountedGrid, field: string): number[] {
    const ids = datasource
        .getRows()
        .filter((row) => !isGroupRow(row))
        .map((row) => row.id as number)
        .sort((a, b) => a - b);
    datasource.filter(null);
    gridInterface.__setHeaderFilterValue(field, null);
    return ids;
}

/** the ids of the rows the column's header filter keeps with the operator and the text typed */
function headerFilterIds(mounted: MountedGrid, field: string, operator: FilterOperator, text: string): number[] {
    mounted.gridInterface.__setHeaderFilterOperator(field, operator);
    filterCallback(gridOf(mounted.element), text, field);
    return shownIds(mounted, field);
}

/**
 * every operator of the header filter of a column, with each text: the rule matches what it keeps
 * @param only the operators to compare, of the header's: Between for the texts `from..to`
 */
function expectSameAsHeaderFilter(mounted: MountedGrid, field: string, texts: string[], only?: FilterOperator[]) {
    const { gridInterface } = mounted;
    const column = gridInterface.__getGridConfig().columns[field];
    const type = gridInterface.__getLookupColumn(field) ? 'text' : gridInterface.getDatasource().getField(field).type;
    let compared = 0;
    for (const operator of headerOperators(column, type).filter((each) => !only || only.includes(each))) {
        for (const text of texts) {
            // a Between of a text without `..`: both ends, as the header filter takes it
            const ends = text.includes('..') ? text.split('..') : [text, text];
            const value: ColorRule['value'] = operator === 'BETWEEN' ? [ends[0], ends[1]] : text;
            const rule: ColorRule = { operator, value, color: 'red' };
            const header = headerFilterIds(mounted, field, operator, text);
            expect(ruleIds(mounted, field, rule), `${field} ${operator} ${text}`).toEqual(header);
            compared++;
        }
    }
    return compared;
}

describe('colour rules - the same rows as the header filter', () => {
    it('expect a text column: every operator, wildcards, case ignored - blanks too', async () => {
        const mounted = await mountColumn('name');

        const compared = expectSameAsHeaderFilter(mounted, 'name', ['ann', 'ANN', 'an*', '%n', 'p_mp', '_', 'b', 'zz']);

        expect(compared).toEqual(6 * 8);
        // what the filter keeps: a sample written out
        expect(ruleIds(mounted, 'name', { operator: 'CONTAINS', value: 'ann', color: 'red' })).toEqual([1, 2]);
        expect(ruleIds(mounted, 'name', { operator: 'NOT_EQUAL_TO', value: 'ann', color: 'red' })).toEqual([2, 3, 4, 5, 6]);
    });

    it('expect a column with filterCaseSensitive to match case, as its header filter does', async () => {
        const mounted = await mountColumn('tag');

        expectSameAsHeaderFilter(mounted, 'tag', ['late', 'Late', 'LATE', 'L*']);
        expect(ruleIds(mounted, 'tag', { operator: 'EQUAL', value: 'late', color: 'red' })).toEqual([2]);
    });

    it('expect a number column: every operator, 0 and a blank as 0, a decimal, text the formatter reads as 0, Between', async () => {
        const mounted = await mountColumn('age');

        expectSameAsHeaderFilter(mounted, 'age', ['10', '0', '-5', '20.5', 'abc', ' 30 ']);
        expectSameAsHeaderFilter(mounted, 'age', ['0..20', '..10', '15..', '-10..0'], ['BETWEEN']);
        // a blank compares as 0, as in the filter
        expect(ruleIds(mounted, 'age', { operator: 'LESS_THAN', value: '1', color: 'red' })).toEqual([2, 3, 4]);
        expect(ruleIds(mounted, 'age', { operator: 'BETWEEN', value: ['10', '20.5'], color: 'red' })).toEqual([1, 6]);
    });

    it('expect a date and a datetime column: the day, the second, Between, a blank date', async () => {
        const mounted = await mountColumn('born');

        expectSameAsHeaderFilter(mounted, 'born', ['2026-11-22', '2026-01-01', '2025-06-30']);
        expectSameAsHeaderFilter(mounted, 'born', ['2026-01-01..2026-11-22', '..2026-01-01', '2026-11-23..'], ['BETWEEN']);
        expectSameAsHeaderFilter(mounted, 'updated', ['2026-11-22T13:45:00', '2026-01-01T08:00:00']);
        // the day, the time does not count
        expect(ruleIds(mounted, 'born', { operator: 'EQUAL', value: '2026-11-22', color: 'red' })).toEqual([1, 6]);
    });

    it('expect a lookup column to compare the label its cells show, as its header filter: a value no lookup row has never', async () => {
        const mounted = await mountColumn('code');

        expectSameAsHeaderFilter(mounted, 'code', ['one', 'T*', 'thr', 'o', 'e', 'zz']);
        expect(ruleIds(mounted, 'code', { operator: 'EQUAL', value: 'two', color: 'red' })).toEqual([2, 6]);
        // 99 is no code of the lookup, a blank is none: neither matches, as in the header filter
        expect(ruleIds(mounted, 'code', { operator: 'NOT_EQUAL_TO', value: 'one', color: 'red' })).toEqual([2, 3, 6]);
    });

    it('expect a checkbox column: checked and not, as its header checkbox - a blank is unchecked', async () => {
        const mounted = await mountColumn('active');
        const ctx = gridOf(mounted.element);

        for (const text of ['true', 'false']) {
            filterCallback(ctx, text, 'active');
            const shown = shownIds(mounted, 'active');
            expect(ruleIds(mounted, 'active', { operator: 'EQUAL', value: text, color: 'red' })).toEqual(shown);
        }
        expect(ruleIds(mounted, 'active', { operator: 'EQUAL', value: 'false', color: 'red' })).toEqual([2, 3, 5]);
    });

    it('expect Is Blank, Is Not Blank and Not Equal of a checkbox to match what the filter keeps (0 is blank)', async () => {
        const mounted = await mountColumn('name');
        const cases: [string, FilterOperator, string | undefined][] = [
            ['name', 'IS_BLANK', undefined],
            ['name', 'IS_NOT_BLANK', undefined],
            ['age', 'IS_BLANK', undefined],
            ['age', 'IS_NOT_BLANK', undefined],
            ['born', 'IS_BLANK', undefined],
            ['code', 'IS_BLANK', undefined],
            ['code', 'IS_NOT_BLANK', undefined],
            ['active', 'IS_BLANK', undefined],
            ['active', 'NOT_EQUAL_TO', 'true']
        ];

        for (const [field, operator, text] of cases) {
            mounted.datasource.filter(where(field, operator, text === 'true' ? true : undefined));
            const shown = shownIds(mounted, field);
            const rule: ColorRule = text === undefined ? { operator, color: 'red' } : { operator, value: text, color: 'red' };
            expect(ruleIds(mounted, field, rule), `${field} ${operator}`).toEqual(shown);
        }
        // 0 is blank
        expect(ruleIds(mounted, 'age', { operator: 'IS_BLANK', color: 'red' })).toEqual([2, 4]);
    });

    it('expect a value the column does not read, and no value, to match no cell - the header filter filters nothing with them', async () => {
        const mounted = await mountColumn('born');

        expect(headerFilterIds(mounted, 'born', 'EQUAL', '22.11.2026')).toEqual([1, 2, 3, 4, 5, 6]);
        expect(ruleIds(mounted, 'born', { operator: 'EQUAL', value: '22.11.2026', color: 'red' })).toEqual([]);
        expect(ruleIds(mounted, 'name', { operator: 'EQUAL', value: '', color: 'red' })).toEqual([]);
        expect(ruleIds(mounted, 'age', { operator: 'BETWEEN', value: ['', ' '], color: 'red' })).toEqual([]);
    });
});

describe('colour rules - the condition', () => {
    const datasource = new Datasource(fields());
    const formatter = (field: string) => datasource.getField(field).formatter;

    it('expect the text as typed for a text, parsed for a number and a date, true / false for a checkbox', () => {
        expect(ruleCondition({ operator: 'CONTAINS', value: ' an ' }, 'name', 'text', formatter('name'), false)).toEqual({
            field: 'name',
            operator: 'CONTAINS',
            value: ' an '
        });
        expect(
            (
                ruleCondition(
                    { operator: 'LESS_THAN', value: ' 1.5 ' },
                    'age',
                    'number',
                    formatter('age'),
                    false
                ) as FilterCondition | null
            )?.value
        ).toBe(1.5);
        expect(
            (
                ruleCondition(
                    { operator: 'EQUAL', value: '2026-11-22' },
                    'born',
                    'date',
                    formatter('born'),
                    false
                ) as FilterCondition | null
            )?.value
        ).toEqual(new Date(2026, 10, 22));
        expect(
            (
                ruleCondition(
                    { operator: 'EQUAL', value: 'true' },
                    'active',
                    'boolean',
                    formatter('active'),
                    false
                ) as FilterCondition | null
            )?.value
        ).toBe(true);
        expect(ruleCondition({ operator: 'EQUAL', value: 'yes' }, 'active', 'boolean', formatter('active'), false)).toBeNull();
    });

    it('expect a Between of two ends, an empty end open; none without an end; no value for Is Blank; the case', () => {
        expect(
            (
                ruleCondition(
                    { operator: 'BETWEEN', value: ['10', ''] },
                    'age',
                    'number',
                    formatter('age'),
                    false
                ) as FilterCondition | null
            )?.value
        ).toEqual([10, null]);
        expect(ruleCondition({ operator: 'BETWEEN', value: ['', ''] }, 'age', 'number', formatter('age'), false)).toBeNull();
        expect(ruleCondition({ operator: 'IS_BLANK' }, 'age', 'number', formatter('age'), false)).toEqual({
            field: 'age',
            operator: 'IS_BLANK'
        });
        expect(
            (ruleCondition({ operator: 'EQUAL', value: 'a' }, 'name', 'text', formatter('name'), true) as FilterCondition | null)
                ?.caseSensitive
        ).toBe(true);
    });

    it('expect the operators of a type without IN and NOT_IN', () => {
        expect(ruleOperatorsFor('boolean')).toEqual(['EQUAL', 'NOT_EQUAL_TO', 'IS_BLANK', 'IS_NOT_BLANK']);
        expect(ruleOperatorsFor('text')).not.toContain('IN');
        expect(ruleOperatorsFor('number')).toContain('BETWEEN');
        expect(ruleOperatorsFor('number')).not.toContain('NOT_IN');
    });

    it('expect the problems: no value, nothing to colour', () => {
        expect(colorRuleProblem({ operator: 'EQUAL', value: ' ', color: 'red' })).toBe('value');
        expect(colorRuleProblem({ operator: 'BETWEEN', value: ['', ''], color: 'red' })).toBe('value');
        expect(colorRuleProblem({ operator: 'BETWEEN', value: ['', '5'], color: 'red' })).toBeNull();
        expect(colorRuleProblem({ operator: 'IS_BLANK' })).toBe('style');
        expect(colorRuleProblem({ operator: 'IS_BLANK', bold: true })).toBeNull();
    });

    it('expect the classes of a rule: the colour and its kind, bold; none for no rule', () => {
        expect(colorRuleClasses({ operator: 'IS_BLANK', color: 'red', background: 'grey', bold: true })).toEqual([
            'simple-html-grid-cell-text',
            'simple-html-grid-cell-text-red',
            'simple-html-grid-cell-bg',
            'simple-html-grid-cell-bg-grey',
            'simple-html-grid-cell-bold'
        ]);
        expect(colorRuleClasses(null)).toEqual([]);
    });
});

describe('colour rules - the first rule that matches wins', () => {
    it('expect the order of the list to decide, a cell no rule matches to have none', async () => {
        const mounted = await mount();
        const { datasource, gridInterface } = mounted;
        const rules: ColorRule[] = [
            { operator: 'LESS_THAN', value: '0', color: 'red' },
            { operator: 'LESS_THAN', value: '15', background: 'yellow' },
            { operator: 'IS_BLANK', background: 'grey' }
        ];
        const ruleOf = (id: number) =>
            colorRuleOf(gridInterface, 'age', datasource.getAllData().find((row) => row.id === id) as Entity, { rules });

        // -5: the first; 10 and 0 (blank, but less than 15 first): the second; 30: none
        expect(ruleOf(3)).toBe(rules[0]);
        expect(ruleOf(1)).toBe(rules[1]);
        expect(ruleOf(2)).toBe(rules[1]);
        expect(ruleOf(4)).toBe(rules[1]);
        expect(ruleOf(5)).toBeNull();
        // the list the other way: the blank first
        expect(colorRuleOf(gridInterface, 'age', datasource.getAllData()[1], { rules: [rules[2], rules[1]] })).toBe(rules[2]);
        // the column's own rules when no format is given, none without
        expect(colorRuleOf(gridInterface, 'age', datasource.getAllData()[0])).toBeNull();
    });
});

/** the cell element of a row and field on screen (the rows from 0, as displayed) */
function cellOf(element: GridElement, row: number, field: string): HTMLCellElement {
    const cells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[];
    const cell = cells.find(
        (each) =>
            each.$row === row &&
            each.$attribute === field &&
            (each.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
    );
    if (!cell) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return cell;
}

/** the classes of colour rules a cell has */
const colorsOf = (cell: Element) => COLOR_RULE_CLASSES.filter((name) => cell.classList.contains(name));

describe('colour rules - the cells', () => {
    it('expect the classes of the rule on every kind of cell: input, checkbox, link, custom, multiline, lookup', async () => {
        const red: ColorRule[] = [{ operator: 'IS_NOT_BLANK', color: 'red', background: 'yellow', bold: true }];
        const { element } = await mount({
            name: { rules: red },
            active: { rules: [{ operator: 'EQUAL', value: 'true', background: 'green' }] },
            flag: { checkbox: {}, rules: [{ operator: 'EQUAL', value: '1', background: 'blue' }] },
            site: { link: { url: 'https://example.com/{site}' }, rules: [{ operator: 'EQUAL', value: 'acme', color: 'purple' }] },
            badge: { rules: [{ operator: 'EQUAL', value: 'waiting', background: 'orange' }] },
            notes: { rules: [{ operator: 'CONTAINS', value: 'two', color: 'grey' }] },
            code: { rules: [{ operator: 'EQUAL', value: 'one', color: 'green' }] }
        });

        expect(colorsOf(cellOf(element, 0, 'name'))).toEqual([
            'simple-html-grid-cell-text',
            'simple-html-grid-cell-bg',
            'simple-html-grid-cell-bold',
            'simple-html-grid-cell-text-red',
            'simple-html-grid-cell-bg-yellow'
        ]);
        // the cells of a blank name: none
        expect(colorsOf(cellOf(element, 3, 'name'))).toEqual([]);
        // a checkbox: of a boolean column and of a text column shown as checkboxes
        expect(colorsOf(cellOf(element, 0, 'active'))).toContain('simple-html-grid-cell-bg-green');
        expect(cellOf(element, 0, 'active').querySelector('input[type="checkbox"]')).not.toBeNull();
        expect(colorsOf(cellOf(element, 1, 'active'))).toEqual([]);
        expect(colorsOf(cellOf(element, 0, 'flag'))).toContain('simple-html-grid-cell-bg-blue');
        expect(colorsOf(cellOf(element, 1, 'flag'))).toEqual([]);
        // a link, a custom cell, a multiline cell, a lookup column's label
        expect(cellOf(element, 0, 'site').querySelector('a')).not.toBeNull();
        expect(colorsOf(cellOf(element, 0, 'site'))).toContain('simple-html-grid-cell-text-purple');
        expect(colorsOf(cellOf(element, 0, 'badge'))).toContain('simple-html-grid-cell-bg-orange');
        expect(colorsOf(cellOf(element, 1, 'badge'))).toEqual([]);
        expect(colorsOf(cellOf(element, 0, 'notes'))).toContain('simple-html-grid-cell-text-grey');
        expect(colorsOf(cellOf(element, 0, 'code'))).toContain('simple-html-grid-cell-text-green');
        expect(colorsOf(cellOf(element, 1, 'code'))).toEqual([]);
    });

    it("expect a cell reused for another row while scrolling to have its row's colours, and lose the ones before", async () => {
        // a negative age every third row
        const many = Array.from({ length: 300 }, (_, i) => ({ ...rows()[0], id: i + 1, age: i % 3 === 0 ? -1 : i }));
        const { element, gridInterface } = await mount(
            { age: { rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }] } },
            many
        );
        const scroller = element.querySelector('.simple-html-grid-body-scroller') as HTMLElement;
        const rowHeight = gridInterface.__getGridConfig().__rowHeight;
        const onScreen = () =>
            (Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[]).filter(
                (cell) =>
                    cell.$attribute === 'age' && (cell.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
            );
        const expectColours = () => {
            const cells = onScreen();
            expect(cells.length).toBeGreaterThan(5);
            for (const cell of cells) {
                expect(cell.classList.contains('simple-html-grid-cell-text-red'), `row ${cell.$row}`).toBe(cell.$row % 3 === 0);
            }
        };
        const first = cellOf(element, 0, 'age');

        expectColours();
        expect(first.classList.contains('simple-html-grid-cell-text-red')).toBe(true);
        // a step at a time: a jump of more than 500px is rendered when the scrolling stops
        for (const to of [10, 20, 31]) {
            scroller.scrollTop = rowHeight * to;
            scroller.dispatchEvent(new Event('scroll'));
            expectColours();
        }
        // the cell element that showed row 0 shows another row now
        expect(first.$row).not.toBe(0);
        expect(first.classList.contains('simple-html-grid-cell-text-red')).toBe(first.$row % 3 === 0);
    });

    it('expect the colour to follow the value as it is typed, an undo, a value set from code', async () => {
        const { element, datasource } = await mount({ age: { rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }] } });
        const input = cellOf(element, 0, 'age').querySelector('input') as HTMLInputElement;

        input.focus();
        input.value = '-3';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(colorsOf(cellOf(element, 0, 'age'))).toContain('simple-html-grid-cell-text-red');
        input.blur();

        datasource.undo();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(colorsOf(cellOf(element, 0, 'age'))).toEqual([]);

        datasource.getAllData()[1].age = -7;
        await new Promise((resolve) => requestAnimationFrame(resolve));
        expect(colorsOf(cellOf(element, 1, 'age'))).toContain('simple-html-grid-cell-text-red');
    });

    it('expect the rules of setState() and updateConfig(), none after resetState(); a group row has none', async () => {
        const { element, datasource, gridInterface } = await mount();
        expect(colorsOf(cellOf(element, 0, 'name'))).toEqual([]);

        gridInterface.setState({ formats: { name: { rules: [{ operator: 'EQUAL', value: 'ann', background: 'red' }] } } });
        expect(colorsOf(cellOf(element, 0, 'name'))).toContain('simple-html-grid-cell-bg-red');

        gridInterface.resetState();
        expect(colorsOf(cellOf(element, 0, 'name'))).toEqual([]);

        gridInterface.updateConfig(config({ name: { rules: [{ operator: 'EQUAL', value: 'ann', background: 'blue' }] } }));
        expect(colorsOf(cellOf(element, 0, 'name'))).toContain('simple-html-grid-cell-bg-blue');

        // grouped: the first row on screen is a group row, its cells have no colours
        datasource.group([{ attribute: 'name', title: 'Name' }]);
        const groupCells = (Array.from(element.querySelectorAll('.simple-html-grid-col-cell')) as HTMLCellElement[]).filter(
            (cell) => cell.$row === 0 && cell.$attribute === 'name'
        );
        expect(groupCells.length).toBeGreaterThan(0);
        for (const cell of groupCells) {
            expect(colorsOf(cell)).toEqual([]);
        }
    });

    it('expect an error and a match of Find on the cell beside the classes - grid.css lets them win', async () => {
        const validated = fields();
        validated.fields = { ...validated.fields, name: { validate: [{ id: 'maxLength', value: 3 }] } };
        const { element, datasource, gridInterface } = await mountGrid(
            config({ name: { rules: [{ operator: 'IS_NOT_BLANK', color: 'red', background: 'red' }] } }),
            rows(),
            validated
        );

        // ann marie is too long
        datasource.validate();
        gridInterface.refresh();
        expect(cellOf(element, 1, 'name').classList.contains('simple-html-cell-error')).toBe(true);
        expect(colorsOf(cellOf(element, 1, 'name'))).toContain('simple-html-grid-cell-bg-red');

        gridInterface.find('ann');
        const cell = cellOf(element, 0, 'name');
        expect(cell.classList.contains('simple-html-cell-find-match')).toBe(true);
        expect(colorsOf(cell)).toContain('simple-html-grid-cell-bg-red');
    });

    it('expect the values of the detail form in the colours of their rule, as their cells', async () => {
        const { element, datasource, gridInterface } = await mount({
            age: { rules: [{ operator: 'LESS_THAN', value: '0', color: 'red', background: 'yellow' }] },
            notes: { rules: [{ operator: 'CONTAINS', value: 'two', color: 'grey' }] }
        });
        gridInterface.setState({ detailForm: { show: true, fields: ['age', 'notes', 'name'] } });
        const field = (name: string) =>
            element.querySelector(
                `.simple-html-grid-detail-form-field[data-field="${name}"] .simple-html-grid-detail-form-input`
            ) as HTMLElement;

        datasource.setRowAsCurrentEntity(2);
        gridInterface.refresh();
        expect(colorsOf(field('age'))).toContain('simple-html-grid-cell-text-red');
        expect(colorsOf(field('age'))).toContain('simple-html-grid-cell-bg-yellow');
        expect(colorsOf(field('name'))).toEqual([]);

        datasource.setRowAsCurrentEntity(0);
        gridInterface.refresh();
        expect(colorsOf(field('age'))).toEqual([]);
        // a textarea for the notes of two lines
        expect(field('notes').tagName).toEqual('TEXTAREA');
        expect(colorsOf(field('notes'))).toContain('simple-html-grid-cell-text-grey');
    });

    it('expect the state as JSON to give the rules back', async () => {
        const { gridInterface } = await mount({
            age: { rules: [{ operator: 'BETWEEN', value: ['0', '10'], background: 'green', bold: true }] }
        });
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));

        gridInterface.setState({ formats: {} });
        expect(gridInterface.getState().formats).toEqual({});
        gridInterface.setState(saved);

        expect(gridInterface.getState().formats.age).toEqual({
            rules: [{ operator: 'BETWEEN', value: ['0', '10'], background: 'green', bold: true }]
        });
    });
});

describe('colour rules - what a rule takes (TypeError)', () => {
    const check =
        (rules: unknown, type: 'text' | 'number' | 'boolean' | 'date' = 'number', lookup = false) =>
        () =>
            assertColorRules(rules, type, lookup, 'GridConfig: columns.age.format.rules');

    it('expect a list of rules, each an object of the keys a rule has', () => {
        expect(check({ operator: 'EQUAL' })).toThrow(
            new TypeError(
                `GridConfig: columns.age.format.rules is {"operator":"EQUAL"}, it is a list of rules: [{ operator: 'LESS_THAN', value: '0', color: 'red' }]`
            )
        );
        expect(check(['red'])).toThrow(/rules\[0\] is "red", it is a rule/);
        expect(check([{ operator: 'EQUAL', value: '1', colour: 'red' }])).toThrow(
            /rules\[0\] has 'colour', a rule has operator, value, datePreset, week, conditions, combine, expression, color, background, bold/
        );
        expect(check([])).not.toThrow();
    });

    it("expect an operator of the column's type, not IN / NOT_IN; a lookup column's of a text", () => {
        expect(check([{ operator: 'CONTAINS', value: '1', color: 'red' }])).toThrow(
            /rules\[0\]\.operator is "CONTAINS", a number column takes 'EQUAL', 'NOT_EQUAL_TO', 'LESS_THAN'/
        );
        expect(check([{ operator: 'IN', value: '1', color: 'red' }])).toThrow(
            /a rule compares one value, give each value a rule/
        );
        expect(check([{ operator: 'BETWEEN', value: ['1', '2'], color: 'red' }], 'number', true)).toThrow(
            /a lookup column compares its labels, it takes 'EQUAL'/
        );
        expect(check([{ operator: 'CONTAINS', value: 'o', color: 'red' }], 'number', true)).not.toThrow();
        expect(check([{ operator: 'LESS_THAN', value: '1', color: 'red' }], 'boolean')).toThrow(TypeError);
        expect(check([{ operator: 'nope', value: '1', color: 'red' }])).toThrow(TypeError);
    });

    it('expect a value of text, [from, to] for Between, none for Is Blank - and one there', () => {
        expect(check([{ operator: 'EQUAL', value: 1, color: 'red' }])).toThrow(
            /rules\[0\]\.value is 1, it is text as typed in the header filter: '100', 'late', '2026-11-22'/
        );
        expect(check([{ operator: 'BETWEEN', value: '1..2', color: 'red' }])).toThrow(/BETWEEN takes \[from, to\]/);
        expect(check([{ operator: 'BETWEEN', value: ['1', 2], color: 'red' }])).toThrow(/BETWEEN takes \[from, to\]/);
        expect(check([{ operator: 'IS_BLANK', value: '', color: 'red' }])).toThrow(/rules\[0\] has a value, IS_BLANK takes none/);
        expect(check([{ operator: 'EQUAL', value: '', color: 'red' }])).toThrow(
            /rules\[0\] has no value: EQUAL compares with one/
        );
        expect(check([{ operator: 'EQUAL', color: 'red' }])).toThrow(/rules\[0\]\.value is undefined/);
        expect(check([{ operator: 'BETWEEN', value: ['', ''], color: 'red' }])).toThrow(/has no value/);
        expect(check([{ operator: 'BETWEEN', value: ['', '5'], color: 'red' }])).not.toThrow();
    });

    it('expect a colour of the palette or #rrggbb - nothing else reaches css - bold true or false, and something to colour', () => {
        expect(check([{ operator: 'IS_BLANK', color: '#ff0000', background: '#00FF7f' }])).not.toThrow();
        expect(check([{ operator: 'IS_BLANK', color: 'pink', background: 'teal' }])).not.toThrow();
        expect(check([{ operator: 'IS_BLANK', color: '#ff00' }])).toThrow(
            /rules\[0\]\.color is "#ff00", it is a colour of the palette \('red', 'orange', 'amber', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'purple', 'pink', 'brown', 'grey'\) or a custom colour '#rrggbb'/
        );
        for (const hostile of [
            'magenta',
            '#gg0000',
            '#ff0000ff',
            'red;background:url(x)',
            '#ff0000;',
            ' #ff0000',
            'var(--x)',
            'url(javascript:alert(1))'
        ]) {
            expect(check([{ operator: 'IS_BLANK', background: hostile }]), hostile).toThrow(/rules\[0\]\.background is/);
        }
        expect(check([{ operator: 'IS_BLANK', bold: 'yes' }])).toThrow(/rules\[0\]\.bold is "yes", it is true or false/);
        expect(check([{ operator: 'IS_BLANK' }])).toThrow(
            /rules\[0\] colours nothing: give it a color, a background or bold: true/
        );
        expect(check([{ operator: 'IS_BLANK', bold: false }])).toThrow(/colours nothing/);
        // the second rule is named
        expect(check([{ operator: 'IS_BLANK', bold: true }, { operator: 'IS_BLANK' }])).toThrow(/rules\[1\] colours nothing/);
    });

    it('expect the grid to check the rules of the config and of setState(), nothing changed by a bad one', async () => {
        const { gridInterface } = await mount();
        const before = gridInterface.getState().formats;

        expect(() =>
            gridInterface.setState({ formats: { age: { rules: [{ operator: 'CONTAINS', value: '1', color: 'red' }] } } })
        ).toThrow(/setState: formats\.age\.rules\[0\]\.operator is "CONTAINS"/);
        expect(gridInterface.getState().formats).toEqual(before);
        await expect(
            mountGrid(config({ age: { rules: [{ operator: 'IS_BLANK', color: 'magenta' as never }] } }), rows(), fields())
        ).rejects.toThrow(/GridConfig: columns\.age\.format\.rules\[0\]\.color is "magenta"/);
        // a lookup column takes rules
        expect(() =>
            gridInterface.setState({ formats: { code: { rules: [{ operator: 'EQUAL', value: 'one', color: 'red' }] } } })
        ).not.toThrow();
    });
});

describe('colour rules - grid.css', () => {
    const css = readCss('grid.css');
    /** the body of the rule with exactly this selector */
    const rule = (selector: string) => {
        const start = css.indexOf(`${selector} {`);
        expect(start, selector).toBeGreaterThan(-1);
        return declarations(css.slice(start, css.indexOf('}', start) + 1));
    };
    const WINS = ':not(.simple-html-cell-error, .simple-html-cell-find-match)';

    it("expect each colour's text and background from the palette's variables - not on an error or a match of Find", () => {
        for (const colour of PALETTE_COLORS) {
            expect(rule(`.simple-html-grid .simple-html-grid-cell-text-${colour}${WINS}`)).toEqual([
                ['color', `var(--simple-html-grid-palette-${colour}-color)`]
            ]);
            expect(rule(`.simple-html-grid .simple-html-grid-cell-bg-${colour}${WINS}`)).toEqual([
                ['background-color', `var(--simple-html-grid-palette-${colour}-bg-color)`]
            ]);
        }
        // a custom colour: the custom properties the grid sets on the cell, the text in light and dark
        expect(rule(`.simple-html-grid .simple-html-grid-cell-text-custom${WINS}`)).toEqual([
            ['color', 'light-dark(var(--simple-html-grid-rule-text-light), var(--simple-html-grid-rule-text-dark))']
        ]);
        expect(rule(`.simple-html-grid .simple-html-grid-cell-bg-custom${WINS}`)).toEqual([
            ['background-color', 'var(--simple-html-grid-rule-bg)']
        ]);
    });

    it("expect the text of a cell - its input, lines, custom cell, link - to take the cell's colour, bold to be the headers' weight", () => {
        const inherit = css.slice(css.indexOf(`.simple-html-grid\n    .simple-html-grid-cell-text${WINS}`));
        expect(inherit.slice(0, inherit.indexOf('{'))).toContain('.simple-html-grid-cell-link[href]');
        expect(declarations(inherit.slice(0, inherit.indexOf('}') + 1))).toEqual([['color', 'inherit']]);
        expect(css).toContain('.simple-html-grid .simple-html-grid-cell-bold,');
        expect(css).toMatch(/simple-html-grid-cell-bold[^{]*\{\s*font-weight: var\(--simple-html-grid-font-weight-header\);/);
    });
});
