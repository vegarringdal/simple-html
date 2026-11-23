// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { BooleanFormatter } from '../../datasource/booleanFormatter';
import { DateFormatterYYYYMMDD } from '../../datasource/DateFormatterYYYYMMDD';
import { Datasource } from '../../datasource/dataSource';
import type { Entity } from '../../datasource/entity';
import type { Formatter } from '../../datasource/formatter';
import { NumberFormatterComma } from '../../datasource/numberFormatterComma';
import { NumberFormatterDot } from '../../datasource/numberFormatterDot';
import type { GridConfig } from '../gridConfig';
import {
    assertImportOptions,
    cellText,
    decimalMarkOf,
    headerFields,
    importFields,
    planImport,
    positionFields,
    readBoolean,
    readDate,
    readNumber
} from '../gridFunctions/importRows';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openLabelMenu, openRowMenu } from './interactionTestHelpers';

/**
 * importRows.ts: the columns matched to fields, the values read as typing reads them (with the forms of
 * numbers and dates a file has), the problems, and the rows added - new rows, validated, one step of the
 * undo history. gridInterface.importRows() and the permissions of the menus' entries
 */

const originalTimeZone = process.env.TZ;
beforeAll(() => {
    process.env.TZ = 'Europe/Oslo';
    stubCanvas();
    stubElementSizes();
});
afterAll(() => {
    process.env.TZ = originalTimeZone;
});
beforeEach(() => {
    document.body.innerHTML = '';
});

const nextTask = () => new Promise((resolve) => setTimeout(resolve));

const COUNTRIES = new Datasource();
COUNTRIES.setData([
    { code: 'NO', name: 'Norway' },
    { code: 'SE', name: 'Sweden' }
]);
registerLookup('import-countries', { datasource: COUNTRIES, valueField: 'code', labelField: 'name' });

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    layout: {
        center: [
            { fields: ['name'], width: 100 },
            { fields: ['age'], width: 100 },
            { fields: ['born'], width: 100 },
            { fields: ['active'], width: 100 },
            { fields: ['price'], width: 100 },
            { fields: ['country'], width: 100 },
            { fields: ['note'], width: 100 }
        ]
    },
    columns: {
        name: { label: 'Full name' },
        // readonly: never imported
        note: { readonly: true },
        country: { editor: { type: 'select', lookup: 'import-countries' } },
        // hidden: in the config, not in the layout
        city: {},
        id: { readonly: true }
    },
    ...more
});

const options = () => ({
    key: 'id',
    fields: {
        id: 'number' as const,
        name: { validate: ['required'] },
        age: { type: 'number' as const, label: 'Years', validate: [{ id: 'min', value: 0 }] },
        born: 'date' as const,
        active: 'boolean' as const,
        price: { type: 'number' as const, formatter: 'numberComma' }
    }
});

/** a grid interface without a grid on the page: importRows() works there too */
function unmounted(more: Partial<GridConfig> = {}) {
    const datasource = new Datasource<any>(options());
    datasource.setData([{ id: 1, name: 'Old', age: 50 }]);
    return { datasource, gridInterface: new GridInterface(config(more), datasource) };
}

describe('import - the columns to fields', () => {
    it('expect the fields of the layout, then the other columns, without the readonly ones', () => {
        expect(importFields(unmounted().gridInterface)).toEqual(['name', 'age', 'born', 'active', 'price', 'country', 'city']);
    });

    it("expect a header to name the fields by the column's label, the field's name or label, in any case", () => {
        const { gridInterface } = unmounted();
        expect(headerFields(gridInterface, ['  FULL   NAME ', 'years', 'Born', 'unknown', null, 'AGE', 'note'])).toEqual([
            'name',
            'age',
            'born',
            null,
            null,
            // age once: a second column of it is skipped; note is readonly
            null,
            null
        ]);
        expect(headerFields(gridInterface, ['Ann', 36, new Date()])).toBeNull();
    });

    it('expect by position the fields of the layout from the start field, a readonly one and the ones past the end skipped', () => {
        const { gridInterface } = unmounted();
        expect(positionFields(gridInterface, 3)).toEqual(['name', 'age', 'born']);
        expect(positionFields(gridInterface, 4, 'price')).toEqual(['price', 'country', null, null]);
        expect(positionFields(gridInterface, 1, 'nothing')).toEqual(['name']);
    });
});

describe('import - the values, as typing reads them', () => {
    it('expect numbers with the separators of a file, and nothing that is no number', () => {
        const read = (cell: unknown, mark: '.' | ',' = '.', formatter: Formatter = NumberFormatterDot) =>
            readNumber(cell as never, formatter, mark);
        expect(read('1 234,5', ',')).toBe(1234.5);
        expect(read('1.234.567,25', ',', NumberFormatterComma)).toBe(1234567.25);
        expect(read(' 1 234,50 ', ',')).toBe(1234.5);
        expect(read('1,234.5')).toBe(1234.5);
        expect(read("1'234.5")).toBe(1234.5);
        // the other mark once, not between groups of three: the decimal mark, as typing reads it
        expect(read('12,5')).toBe(12.5);
        expect(read('1.5', ',')).toBe(1.5);
        // between groups of three: thousands, by the mark picked
        expect(read('1,234')).toBe(1234);
        expect(read('1.234', ',')).toBe(1234);
        expect(read('-5')).toBe(-5);
        expect(read('+3e2')).toBe(300);
        expect(read(7)).toBe(7);
        for (const wrong of ['12 kg', '1.2.3', '1,2,3', '=1+1', 'abc', '12%', true, new Date(), Number.NaN, '1,23,4']) {
            expect(read(wrong), String(wrong)).toBeNull();
        }
    });

    it("expect the decimal mark of a number field's formatter", () => {
        expect(decimalMarkOf(NumberFormatterComma)).toBe(',');
        expect(decimalMarkOf(NumberFormatterDot)).toBe('.');
    });

    it('expect dates as ISO, with dots, with slashes in the order picked, with a time - none that is no day', () => {
        const read = (cell: unknown, order: 'DMY' | 'MDY' = 'DMY') => readDate(cell as never, DateFormatterYYYYMMDD, order);
        expect(read('2026-11-20')).toEqual(new Date(2026, 10, 20));
        expect(read('2026-11-20 13:45')).toEqual(new Date(2026, 10, 20, 13, 45));
        expect(read('2026-11-20T13:45:12')).toEqual(new Date(2026, 10, 20, 13, 45, 12));
        expect(read('20.11.2026')).toEqual(new Date(2026, 10, 20));
        expect(read('1.2.2026 8:05')).toEqual(new Date(2026, 1, 1, 8, 5));
        expect(read('31/12/2026')).toEqual(new Date(2026, 11, 31));
        expect(read('12/31/2026', 'MDY')).toEqual(new Date(2026, 11, 31));
        // an instant: the grid's CSV of raw values writes toISOString()
        expect(read('2026-11-19T23:00:00.000Z')).toEqual(new Date(2026, 10, 20));
        expect(read(new Date(2026, 0, 1))).toEqual(new Date(2026, 0, 1));
        for (const wrong of [
            '12/31/2026',
            '31.02.2026',
            '2026-13-01',
            '2026-11-20 25:00',
            '20.11.26',
            'tomorrow',
            46346,
            true,
            new Date(Number.NaN)
        ]) {
            expect(read(wrong), String(wrong)).toBeNull();
        }
    });

    it("expect another form of date read by the field's formatter, when it writes the date back as the text", () => {
        const compact: Formatter = {
            format: (value) => (value instanceof Date ? DateFormatterYYYYMMDD.format(value).replaceAll('-', '') : ''),
            parse: (text) => DateFormatterYYYYMMDD.parse(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6)}`)
        };
        expect(readDate('20261120', compact, 'DMY')?.toDateString()).toBe(new Date(2026, 10, 20).toDateString());
        expect(readDate('2026112', compact, 'DMY')).toBeNull();
    });

    it("expect booleans as true / false / 1 / 0 and the formatter's own words, in any case", () => {
        const yesNo: Formatter = {
            ...BooleanFormatter,
            format: (value) => (value === true ? 'Yes' : value === false ? 'No' : '')
        };
        expect([true, 'TRUE', ' 1 ', 1, 'yes'].map((cell) => readBoolean(cell, yesNo))).toEqual([true, true, true, true, true]);
        expect([false, 'false', '0', 0, 'NO'].map((cell) => readBoolean(cell, yesNo))).toEqual([
            false,
            false,
            false,
            false,
            false
        ]);
        expect(['ja', 2, new Date()].map((cell) => readBoolean(cell, BooleanFormatter))).toEqual([null, null, null]);
    });

    it('expect a cell as text: numbers with String(), dates as the date - with the time when it has one', () => {
        expect([null, 'x', 12.5, true, new Date(2026, 10, 20), new Date(2026, 10, 20, 8, 5)].map(cellText)).toEqual([
            '',
            'x',
            '12.5',
            'true',
            '2026-11-20',
            '2026-11-20T08:05:00'
        ]);
    });
});

describe('import - the rows read and their problems', () => {
    it('expect the header skipped, empty rows left out, each problem with its row, field, value and kind', () => {
        const { gridInterface } = unmounted();
        const plan = planImport(
            gridInterface,
            [
                [],
                ['Full name', 'Age', 'Born', 'Active', 'Price', 'Country', 'Notes'],
                ['Ann', '36', '2026-11-20', 'true', '12,5', 'Norway', 'x'],
                ['', '', null],
                [null, 'abc', 'bad', 'maybe', '-1', 'Mars']
            ],
            { header: true }
        );
        expect(plan.header).toBe(1);
        expect(plan.fields).toEqual(['name', 'age', 'born', 'active', 'price', 'country', null]);
        expect(plan.rows.map((row) => row.index)).toEqual([2, 4]);
        expect(plan.rows[0]).toEqual({
            index: 2,
            values: { name: 'Ann', age: 36, born: new Date(2026, 10, 20), active: true, price: 12.5, country: 'NO' },
            problems: []
        });
        expect(plan.rows[1].values).toEqual({ name: null, age: null, born: null, active: null, price: -1, country: 'Mars' });
        expect(plan.rows[1].problems).toEqual([
            { row: 4, field: 'age', value: 'abc', kind: 'value', message: 'Not a number: abc' },
            { row: 4, field: 'born', value: 'bad', kind: 'value', message: 'Not a date: bad' },
            { row: 4, field: 'active', value: 'maybe', kind: 'value', message: 'Not true or false: maybe' },
            { row: 4, field: 'name', value: null, kind: 'rule', message: 'Required' }
        ]);
    });

    it('expect the fields given to win, a field twice or one that can not be imported skipped', () => {
        const { gridInterface } = unmounted();
        const plan = planImport(gridInterface, [['Ann', 'x', '5', '6']], { fields: ['name', 'note', 'age', 'age'] });
        expect(plan.fields).toEqual(['name', null, 'age', null]);
        expect(plan.rows[0].values).toEqual({ name: 'Ann', age: 5 });
    });

    it('expect a formula to stay text in a text field, and a problem in a number field', () => {
        const { gridInterface } = unmounted();
        const plan = planImport(gridInterface, [['=HYPERLINK("http://x","y")', '=1+1']], { fields: ['name', 'age'] });
        expect(plan.rows[0].values).toEqual({ name: '=HYPERLINK("http://x","y")', age: null });
        expect(plan.rows[0].problems.map((problem) => problem.message)).toEqual(['Not a number: =1+1']);
    });
});

describe('gridInterface.importRows', () => {
    it('expect new rows, validated, the values that could not be read in the row error', async () => {
        const { datasource, gridInterface } = unmounted();
        const result = gridInterface.importRows(
            [
                ['Full name', 'Age', 'Price'],
                ['Ann', '36', '1 234,5'],
                ['Bob', 'old', '2'],
                ['', '-3', '']
            ],
            { header: true }
        );
        expect(result.rows.map((row) => [row.name, row.age, row.price, row.__rowState])).toEqual([
            ['Ann', 36, 1234.5, 'N'],
            ['Bob', null, 2, 'N'],
            [null, -3, null, 'N']
        ]);
        expect(result.skipped).toBe(0);
        expect(result.problems.map((problem) => [problem.row, problem.field, problem.kind])).toEqual([
            [2, 'age', 'value'],
            [3, 'name', 'rule'],
            [3, 'age', 'rule']
        ]);
        expect(result.rows[1].__rowError).toBe('Not imported: Years: Not a number: old');
        expect(result.rows[0].__rowError ?? null).toBeNull();
        // the rules broken show on the cells: the errors are kept
        expect(datasource.getErrors(result.rows).map((error) => error.field)).toEqual(['name', 'age']);
        expect(datasource.getChanges().newEntities).toHaveLength(3);
        expect(datasource.currentEntity).toBe(result.rows[0]);
    });

    it("expect invalidRows: 'skip' to leave out every row with a problem", () => {
        const { datasource, gridInterface } = unmounted();
        const result = gridInterface.importRows(
            [
                ['Ann', '36'],
                ['Bob', 'old'],
                ['', '1']
            ],
            { fields: ['name', 'age'], invalidRows: 'skip' }
        );
        expect(result.rows.map((row) => row.name)).toEqual(['Ann']);
        expect(result.skipped).toBe(2);
        expect(result.problems).toHaveLength(2);
        expect(datasource.hasErrors()).toBe(false);
    });

    it('expect the import to be one step of the undo history: undo takes the rows out, redo brings them back', async () => {
        const { datasource, gridInterface } = unmounted();
        const [old] = datasource.getDataRows();
        old.name = 'Edited';
        await nextTask();
        const { rows } = gridInterface.importRows([['Ann'], ['Bob']], { fields: ['name'] });
        await nextTask();
        expect(datasource.undo()).toBe(true);
        expect(rows.map((row) => row.__rowState)).toEqual(['D', 'D']);
        expect(datasource.getChanges().newEntities).toEqual([]);
        // the edit before is a step of its own
        expect(old.name).toBe('Edited');
        expect(datasource.redo()).toBe(true);
        expect(rows.map((row) => row.__rowState)).toEqual(['N', 'N']);
        datasource.undo();
        datasource.undo();
        expect(old.name).toBe('Old');
    });

    it('expect a lookup column to take the label, a hidden column by position given', () => {
        const { gridInterface } = unmounted();
        const { rows } = gridInterface.importRows([['Sweden', 'Bergen']], { fields: ['country', 'city'] });
        expect([rows[0].country, rows[0].city]).toEqual(['SE', 'Bergen']);
    });

    it('expect code not to be stopped by readonly or the permissions, as addNewEmpty() is not', () => {
        const { gridInterface } = unmounted({ readonly: true, edit: { add: false } });
        expect(gridInterface.importRows([['Ann']], { fields: ['name'] }).rows).toHaveLength(1);
    });

    it('expect a TypeError for rows that are not rows of cells and for options it does not know', () => {
        const { gridInterface } = unmounted();
        expect(() => gridInterface.importRows('a,b' as never)).toThrow(TypeError);
        expect(() => gridInterface.importRows([['a'], 'b'] as never)).toThrow(TypeError);
        expect(() => gridInterface.importRows([], { headers: true } as never)).toThrow(/'headers' is not an option/);
        expect(() => gridInterface.importRows([], { decimalMark: ';' } as never)).toThrow(/decimalMark/);
        expect(() => gridInterface.importRows([], true as never)).toThrow(TypeError);
        expect(() => assertImportOptions({ fields: ['a', 1] })).toThrow(/fields/);
        expect(() => assertImportOptions({ header: undefined, invalidRows: 'skip', dateOrder: 'MDY' })).not.toThrow();
    });
});

describe('import - the permissions of the menus and the dialog', () => {
    const rows = () => [{ id: 1, name: 'Ann', age: 3 }];

    it('expect Paste › As new rows… and Import rows… with importMenu in an editable grid that may add rows', async () => {
        const { element } = await mountGrid(config({ importMenu: true }), rows(), options());
        openRowMenu(element, 'age');
        expect(menuEntry('row.paste.newRows')).not.toBeNull();
        openLabelMenu(element, 'age');
        expect(menuEntry('header.import')).not.toBeNull();
    });

    for (const [name, more] of [
        ['without importMenu', {}],
        ['readonly', { importMenu: true, readonly: true }],
        ['add: false', { importMenu: true, edit: { add: false } }]
    ] as const) {
        it(`expect no import entry: ${name}`, async () => {
            const { element, gridInterface } = await mountGrid(config(more as Partial<GridConfig>), rows(), options());
            openLabelMenu(element, 'age');
            expect(menuEntry('header.import')).toBeNull();
            if (!('readonly' in more)) {
                openRowMenu(element, 'age');
                expect(menuEntry('row.paste.newRows')).toBeNull();
            }
            // openImport() is the app's: importMenu is about the grid's menus only
            gridInterface.openImport('a\tb');
            expect(document.querySelector('.import-dialog') !== null).toBe(name === 'without importMenu');
        });
    }

    it('expect add only (change: false) to be enough: the rows added are new', async () => {
        const { gridInterface } = await mountGrid(
            config({ edit: { add: true, change: false, delete: false } }),
            rows(),
            options()
        );
        gridInterface.openImport('Full name\nCid');
        expect(document.querySelector('.import-dialog')).not.toBeNull();
    });

    it('expect openImport() to do nothing without a grid on the page, and to throw for a source it does not take', () => {
        const { gridInterface } = unmounted();
        gridInterface.openImport('a');
        expect(document.querySelector('.import-dialog')).toBeNull();
        expect(() => gridInterface.openImport(42 as never)).toThrow(TypeError);
    });

    it('expect a new row of the import to be editable with add only, a row that was there not', async () => {
        const { datasource, gridInterface } = await mountGrid(config({ edit: { add: true, change: false } }), rows(), options());
        const { rows: added } = gridInterface.importRows([['Cid']], { fields: ['name'] });
        expect(gridInterface.__isCellReadonly(added[0] as Entity, 'name')).toBe(false);
        expect(gridInterface.__isCellReadonly(datasource.getDataRows()[0] as Entity, 'name')).toBe(true);
    });
});
