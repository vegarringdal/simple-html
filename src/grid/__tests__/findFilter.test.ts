// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { FilterExpression } from '../../datasource/filterExpression';
import { registerFormatter } from '../../datasource/formatterRegistry';
import { TextFormatter } from '../../datasource/textFormatter';
import type { GridConfig } from '../gridConfig';
import { FIND_DELAY_MS } from '../gridFunctions/findBar';
import { findRowFilter } from '../gridFunctions/findMatches';
import { registerLookup } from '../lookup';
import { type MountedGrid, mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { sleep } from './interactionTestHelpers';

/**
 * Find's "Filter rows" as a filter for a backend (findFilter.ts, `gridInterface.getFindFilter()`): an OR
 * of a condition per field whose cells SQL can match the way the grid shows them. The rows it selects -
 * here by the grid's own datasource - are the rows "Filter rows" shows, or fewer: never a row without a
 * match. The SQL of it is tested on SQLite in src/sql/__tests__/sqlFindSqlite.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    const offices = new Datasource();
    offices.setData([
        { code: 'k0', name: 'Oslo office' },
        { code: 'k1', name: 'Bergen office' },
        { code: 'k2', name: 'OSLO west' },
        // a value IN takes for the blank cells, and a blank: no value to pick
        { code: 'NULL', name: 'Oslo null' },
        { code: '', name: 'Oslo blank' }
    ]);
    registerLookup('findFilter-offices', { datasource: offices, valueField: 'code', labelField: 'name' });
    const teams = new Datasource({ fields: { id: 'number' } });
    teams.setData([
        { id: 1, name: 'Team Oslo' },
        { id: 2, name: 'Team Blue' }
    ]);
    registerLookup('findFilter-teams', { datasource: teams, valueField: 'id', labelField: 'name' });
    registerFormatter('findFilter-upper', { ...TextFormatter, format: (value) => TextFormatter.format(value).toUpperCase() });
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** a grid of these fields, one column each, in this order */
function mount(
    fields: string[],
    rows: Record<string, unknown>[],
    options: DatasourceOptions,
    columns: GridConfig['columns'] = {}
) {
    return mountGrid(
        {
            readonly: false,
            layout: { left: [], center: fields.map((field) => ({ fields: [field], width: 100 })), right: [] },
            columns
        },
        rows,
        { key: 'id', ...options }
    );
}

/** the ids of the rows shown */
const shownIds = ({ datasource }: MountedGrid) => datasource.getDataRows().map((row) => row.id as number);

/** the ids of the rows a filter selects, by the grid's datasource - every row, not only the ones shown */
function selectedIds({ datasource }: MountedGrid, filter: FilterExpression | null): number[] {
    const all = new Datasource({ key: 'id', fields: datasourceFields(datasource) });
    all.setData(datasource.getAllData().map((row) => ({ ...row })));
    all.filter(filter);
    return all.getDataRows().map((row) => row.id as number);
}

/** the types of the fields of a datasource, for a copy of it */
function datasourceFields(datasource: Datasource): Record<string, 'text' | 'number' | 'date' | 'datetime' | 'boolean'> {
    const fields: Record<string, 'text' | 'number' | 'date' | 'datetime' | 'boolean'> = {};
    for (const field of ['id', 'name', 'notes', 'office', 'team', 'age', 'balance', 'born', 'stamp', 'active']) {
        fields[field] = datasource.getField(field).type;
    }
    return fields;
}

const TEXT_ROWS = () => [
    { id: 1, name: 'Acme', notes: 'one\ntwo Acme' },
    { id: 2, name: 'ACME corp', notes: null },
    { id: 3, name: '50% off', notes: 'acme\nlast' },
    { id: 4, name: '500', notes: '' },
    { id: 5, name: 'a_b', notes: 'x' },
    { id: 6, name: 'axb', notes: 'a*b' },
    { id: 7, name: null, notes: 'aXb' }
];

describe('getFindFilter - when there is one', () => {
    it('expect null while "Filter rows" shows every row: off, the bar closed, an empty text', async () => {
        const mounted = await mount(['name'], TEXT_ROWS(), { fields: {} });
        const { gridInterface } = mounted;

        expect(gridInterface.getFindFilter()).toBeNull();
        gridInterface.find('acme');
        expect(gridInterface.getFindFilter()).toBeNull();
        gridInterface.find('', { filterRows: true });
        expect(gridInterface.getFindFilter()).toBeNull();
        gridInterface.find('acme');
        expect(gridInterface.getFindFilter()).not.toBeNull();
        gridInterface.closeFind();
        expect(gridInterface.getFindFilter()).toBeNull();
    });

    it('expect null while the grid is not on the page, and fields that are no list of names to throw', async () => {
        const mounted = await mount(['name'], TEXT_ROWS(), { fields: {} });
        mounted.gridInterface.find('acme', { filterRows: true });

        for (const fields of [[], 'name', [1], null]) {
            expect(() => mounted.gridInterface.getFindFilter({ fields } as never), String(fields)).toThrow(TypeError);
        }
        expect(() => mounted.gridInterface.getFindFilter(true as never)).toThrow(TypeError);

        mounted.element.remove();
        expect(mounted.gridInterface.getFindFilter()).toBeNull();
    });
});

describe('getFindFilter - the conditions', () => {
    it('expect a text field to be CONTAINS the text, literal - caseSensitive with Match case; a multiline field the same', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: { notes: { multiline: true } } });
        const { gridInterface } = mounted;

        gridInterface.find('acme', { filterRows: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [
                { field: 'name', operator: 'CONTAINS', value: 'acme', literal: true },
                { field: 'notes', operator: 'CONTAINS', value: 'acme', literal: true }
            ]
        });

        gridInterface.find('Acme', { caseSensitive: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [
                { field: 'name', operator: 'CONTAINS', value: 'Acme', caseSensitive: true, literal: true },
                { field: 'notes', operator: 'CONTAINS', value: 'Acme', caseSensitive: true, literal: true }
            ]
        });
    });

    it('expect the same rows as "Filter rows" on text: the wildcards as characters, the case, every line', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: { notes: { multiline: true } } });
        const { gridInterface } = mounted;
        const cases: [string, boolean, number[]][] = [
            ['acme', false, [1, 2, 3]],
            ['Acme', true, [1]],
            ['ACME', true, [2]],
            // a wildcard of the filter is a character of Find: 50% is not 500
            ['50%', false, [3]],
            ['a_b', false, [5]],
            ['a*b', false, [6]],
            ['%', false, [3]],
            ['_', false, [5]],
            ['*', false, [6]],
            ['axb', false, [6, 7]],
            ['axb', true, [6]],
            ['two', false, [1]],
            ['zzz', false, []]
        ];
        for (const [text, caseSensitive, ids] of cases) {
            gridInterface.find(text, { filterRows: true, caseSensitive });
            expect(shownIds(mounted), `${text} ${caseSensitive}`).toEqual(ids);
            expect(selectedIds(mounted, gridInterface.getFindFilter()), `${text} ${caseSensitive}`).toEqual(ids);
        }
    });

    it('expect a lookup column to be IN the values whose label holds the text - as they are on a text field', async () => {
        const rows = [
            { id: 1, office: 'k0', team: 1 },
            { id: 2, office: 'k1', team: 2 },
            { id: 3, office: 'k2', team: 1 },
            // a value the lookup has no row for: the cell shows the value
            { id: 4, office: 'oslo-x', team: 9 },
            { id: 5, office: null, team: null },
            { id: 6, office: 'K0', team: 2 }
        ];
        const columns = {
            office: { editor: { type: 'select' as const, lookup: 'findFilter-offices' } },
            team: { editor: { type: 'select' as const, lookup: 'findFilter-teams' } }
        };
        const mounted = await mount(['office', 'team'], rows, { fields: { team: 'number' } }, columns);
        const { gridInterface } = mounted;

        gridInterface.find('oslo', { filterRows: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [
                // not 'NULL' (the blank cells in a list) and not '' (no value)
                { field: 'office', operator: 'IN', value: ['k0', 'k2'], caseSensitive: true },
                { field: 'team', operator: 'IN', value: [1] }
            ]
        });
        // "oslo-x" shows its value, which the filter has not: fewer rows, never more
        expect(shownIds(mounted)).toEqual([1, 3, 4]);
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([1, 3]);

        gridInterface.find('OSLO', { caseSensitive: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'office', operator: 'IN', value: ['k2'], caseSensitive: true }]
        });
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([3]);

        // the label, not the value
        gridInterface.find('k1', { caseSensitive: false });
        expect(gridInterface.getFindFilter()).toEqual({ field: 'office', operator: 'IN', value: [] });
    });

    it('expect a number field to be EQUAL the number the text reads as, when its cell shows the text', async () => {
        const rows = [
            { id: 1, age: 30, balance: 12.5 },
            { id: 2, age: 130, balance: 30 },
            { id: 3, age: 0, balance: 0 },
            { id: 4, age: null, balance: null },
            { id: 5, age: 3, balance: 2.5 }
        ];
        const options = { fields: { age: 'number' as const, balance: { type: 'number' as const, formatter: 'numberComma' } } };
        const mounted = await mount(['age', 'balance'], rows, options);
        const { gridInterface } = mounted;
        const filterOf = (text: string) => {
            gridInterface.find(text, { filterRows: true });
            return gridInterface.getFindFilter();
        };

        expect(filterOf('30')).toEqual({
            group: 'OR',
            children: [
                { field: 'age', operator: 'EQUAL', value: 30 },
                { field: 'balance', operator: 'EQUAL', value: 30 }
            ]
        });
        // Find marks 130 too: the filter has the number, not a part of its text
        expect(shownIds(mounted)).toEqual([1, 2]);
        expect(selectedIds(mounted, filterOf('30'))).toEqual([1, 2]);
        expect(filterOf('3')).toEqual({
            group: 'OR',
            children: [
                { field: 'age', operator: 'EQUAL', value: 3 },
                { field: 'balance', operator: 'EQUAL', value: 3 }
            ]
        });
        expect(shownIds(mounted)).toEqual([1, 2, 5]);
        expect(selectedIds(mounted, filterOf('3'))).toEqual([5]);

        // the decimal comma of the balance's formatter: the age reads 12,5 as 12.5 too, but shows 12.5
        expect(filterOf('12,5')).toEqual({ group: 'OR', children: [{ field: 'balance', operator: 'EQUAL', value: 12.5 }] });
        // not a number, or more than one: no condition
        expect(filterOf('30abc')).toEqual({ field: 'age', operator: 'IN', value: [] });
        expect(filterOf('1e1')).toEqual({ field: 'age', operator: 'IN', value: [] });
        // 0: EQUAL 0 selects the blank rows too, whose cells show nothing
        expect(filterOf('0')).toEqual({ field: 'age', operator: 'IN', value: [] });
    });

    it("expect the column's number format and numberOverride: the number shown, a blank shown as 0", async () => {
        const rows = [
            { id: 1, age: 30, balance: 30 },
            { id: 2, age: 0, balance: 0 },
            { id: 3, age: null, balance: null }
        ];
        const columns = {
            age: { format: { number: { decimals: 2 as const } } },
            balance: { numberOverride: 'BLANK_TO_ZERO' as const }
        };
        const mounted = await mount(['age', 'balance'], rows, { fields: { age: 'number', balance: 'number' } }, columns);
        const { gridInterface } = mounted;

        // the age shows 30.00, 0.00 and nothing; the balance 30, 0 and 0
        gridInterface.find('30.0', { filterRows: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'age', operator: 'EQUAL', value: 30 }]
        });
        gridInterface.find('0', { filterRows: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'balance', operator: 'EQUAL', value: 0 }]
        });
        expect(shownIds(mounted)).toEqual([1, 2, 3]);
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([2, 3]);
    });

    it('expect a date field to be EQUAL the day the text is, a datetime field the second - all of what a cell shows', async () => {
        const rows = [
            { id: 1, born: new Date(2026, 0, 15, 10, 30), stamp: new Date(2026, 0, 15, 10, 30, 5, 200) },
            { id: 2, born: new Date(2026, 0, 15, 23, 59), stamp: new Date(2026, 0, 15, 10, 30, 6) },
            { id: 3, born: new Date(2026, 0, 16), stamp: null },
            { id: 4, born: null, stamp: new Date(2026, 1, 1) }
        ];
        const mounted = await mount(['born', 'stamp'], rows, { fields: { born: 'date', stamp: 'datetime' } });
        const { gridInterface } = mounted;

        gridInterface.find('2026-01-15', { filterRows: true });
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'born', operator: 'EQUAL', value: new Date(2026, 0, 15) }]
        });
        expect(shownIds(mounted)).toEqual([1, 2]);
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([1, 2]);

        gridInterface.find('2026-01-15T10:30:05');
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'stamp', operator: 'EQUAL', value: new Date(2026, 0, 15, 10, 30, 5) }]
        });
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([1]);

        // a part of a date: the formatter makes a day of it (the current day of January), which is not
        // the text - no condition. Find marks every date of January 2026
        gridInterface.find('2026-01');
        expect(shownIds(mounted)).toEqual([1, 2, 3]);
        expect(gridInterface.getFindFilter()).toEqual({ field: 'born', operator: 'IN', value: [] });
    });

    it('expect no condition where SQL can not match the cells as they show: a boolean, checkboxes, a type per row, a formatter or a template of its own', async () => {
        const rows = [{ id: 1, active: true, flag: 'acme', kind: 'text', value: 'acme', upper: 'acme', tag: 'acme', name: 'x' }];
        const columns = {
            flag: { format: { checkbox: {} } },
            value: { dynamicCellTypeColumn: 'kind' },
            tag: { format: { text: '#{value}' } }
        };
        const options = { fields: { active: 'boolean' as const, upper: { formatter: 'findFilter-upper' } } };
        const mounted = await mount(['active', 'flag', 'value', 'upper', 'tag', 'name'], rows, options, columns);
        const { gridInterface } = mounted;

        gridInterface.find('acme', { filterRows: true });
        // Find marks the value of the dynamic type, the upper case and the template - not the checkboxes
        expect(shownIds(mounted)).toEqual([1]);
        // only the plain text field is in it: it does not show the text, the row is not selected
        expect(gridInterface.getFindFilter()).toEqual({
            group: 'OR',
            children: [{ field: 'name', operator: 'CONTAINS', value: 'acme', literal: true }]
        });
        expect(selectedIds(mounted, gridInterface.getFindFilter())).toEqual([]);
    });

    it('expect a condition of no row when no field gives one: IN [] on the first field', async () => {
        const mounted = await mount(['active', 'age'], [{ id: 1, active: true, age: 3 }], {
            fields: { active: 'boolean', age: 'number' }
        });
        mounted.gridInterface.find('true', { filterRows: true });

        expect(mounted.gridInterface.getFindFilter()).toEqual({ field: 'active', operator: 'IN', value: [] });
        expect(shownIds(mounted)).toEqual([]);
        expect(selectedIds(mounted, mounted.gridInterface.getFindFilter())).toEqual([]);
    });
});

describe('getFindFilter - the fields of a backend', () => {
    it('expect only the fields given, and the condition of no row on the first of them', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: {} });
        const { gridInterface } = mounted;
        gridInterface.find('acme', { filterRows: true });

        expect(gridInterface.getFindFilter({ fields: ['notes', 'age'] })).toEqual({
            group: 'OR',
            children: [{ field: 'notes', operator: 'CONTAINS', value: 'acme', literal: true }]
        });
        // a field Find does not search is no condition
        expect(gridInterface.getFindFilter({ fields: ['age', 'born'] })).toEqual({ field: 'age', operator: 'IN', value: [] });
        // the fields of the layout, in its order
        expect(gridInterface.getFindFilter({ fields: ['notes', 'name'] })).toEqual(gridInterface.getFindFilter());
    });
});

describe('getFindFilter - never a row without a match', () => {
    it('expect the rows it selects to be rows "Filter rows" shows, for many texts and both cases', async () => {
        const rows = Array.from({ length: 60 }, (_, i) => ({
            id: i,
            name: ['Acme', 'ACME corp', '50% off', 'a_b', 'axb', null, `name ${i}`][i % 7],
            notes: i % 5 === 0 ? `line\nAcme ${i}` : `note ${i}`,
            office: ['k0', 'k1', 'k2', 'zz', null][i % 5],
            age: [30, 130, 0, null, 3, 2.5][i % 6],
            born: i % 4 === 0 ? null : new Date(2026, 0, 1 + (i % 20), i % 24),
            active: i % 2 === 0
        }));
        const columns = { office: { editor: { type: 'select' as const, lookup: 'findFilter-offices' } } };
        const options = {
            fields: { notes: { multiline: true }, age: 'number' as const, born: 'date' as const, active: 'boolean' as const }
        };
        const mounted = await mount(['name', 'notes', 'office', 'age', 'born', 'active'], rows, options, columns);
        const { gridInterface } = mounted;
        const texts = [
            'acme',
            'Acme',
            'ACME',
            '50%',
            '_',
            'a_b',
            'oslo',
            'OSLO',
            'office',
            '30',
            '3',
            '0',
            '2.5',
            '2026-01-05',
            '2026',
            'true',
            'zz',
            'name 1',
            'line'
        ];
        let compared = 0;
        for (const text of texts) {
            for (const caseSensitive of [false, true]) {
                gridInterface.find(text, { filterRows: true, caseSensitive });
                const shown = shownIds(mounted);
                const selected = selectedIds(mounted, gridInterface.getFindFilter());
                expect(
                    selected.filter((id) => !shown.includes(id)),
                    `${text} ${caseSensitive}`
                ).toEqual([]);
                compared += selected.length;
            }
        }
        expect(compared).toBeGreaterThan(200);
    });
});

describe('find-filter-change', () => {
    const afterDelay = () => sleep(FIND_DELAY_MS + 30);

    it('expect it when the filter changes: on, the text, Match case, the columns, off - with getFindFilter()', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: {} });
        const { gridInterface } = mounted;
        const events: (FilterExpression | null)[] = [];
        gridInterface.on('find-filter-change', ({ filter }) => {
            events.push(filter);
            expect(filter).toEqual(gridInterface.getFindFilter());
        });

        // Find without "Filter rows": no filter, no event
        gridInterface.find('acme');
        expect(events).toEqual([]);
        gridInterface.find('acme', { filterRows: true });
        gridInterface.find('acme 2');
        gridInterface.find('acme 2', { caseSensitive: true });
        gridInterface.setState({ layout: { left: [], center: [{ fields: ['name'], width: 100 }], right: [] } });
        await afterDelay();
        gridInterface.closeFind();

        const condition = (value: string, fields: string[], caseSensitive = false) => ({
            group: 'OR',
            children: fields.map((field) => ({
                field,
                operator: 'CONTAINS',
                value,
                ...(caseSensitive ? { caseSensitive } : {}),
                literal: true
            }))
        });
        expect(events).toEqual([
            condition('acme', ['name', 'notes']),
            condition('acme 2', ['name', 'notes']),
            condition('acme 2', ['name', 'notes'], true),
            condition('acme 2', ['name'], true),
            null
        ]);
    });

    it('expect none for a step, a change of the data or the same filter again', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: {} });
        const { gridInterface, datasource } = mounted;
        gridInterface.find('acme', { filterRows: true });
        const events: unknown[] = [];
        gridInterface.on('find-filter-change', (event) => events.push(event));

        gridInterface.findNext();
        gridInterface.find('acme', { filterRows: true });
        datasource.setData([...TEXT_ROWS(), { id: 8, name: 'acme 8', notes: '' }]);
        await afterDelay();
        expect(shownIds(mounted)).toEqual([1, 2, 3, 8]);
        expect(events).toEqual([]);
    });

    it('expect it when the footer\'s Clear turns "Filter rows" off', async () => {
        const mounted = await mount(['name'], TEXT_ROWS(), { fields: {} });
        const { gridInterface, element } = mounted;
        gridInterface.find('acme', { filterRows: true });
        const events: unknown[] = [];
        gridInterface.on('find-filter-change', ({ filter }) => events.push(filter));

        (element.querySelector('.footer-filter-clear') as HTMLButtonElement).click();

        expect(events).toEqual([null]);
    });
});

describe('findRowFilter and getFindFilter agree on a text layout', () => {
    it('expect the row predicate of "Filter rows" and the filter to select the same rows', async () => {
        const mounted = await mount(['name', 'notes'], TEXT_ROWS(), { fields: { notes: { multiline: true } } });
        const { gridInterface, datasource } = mounted;
        for (const text of ['a', 'A', 'b', '*', '%', '_', '\n', 'one', 'o']) {
            for (const caseSensitive of [false, true]) {
                gridInterface.find(text, { filterRows: true, caseSensitive });
                const predicate = findRowFilter({ gridInterface }, text, caseSensitive);
                const byPredicate = datasource
                    .getAllData()
                    .filter(predicate)
                    .map((row) => row.id);
                expect(selectedIds(mounted, gridInterface.getFindFilter()), JSON.stringify(text)).toEqual(byPredicate);
            }
        }
    });
});
