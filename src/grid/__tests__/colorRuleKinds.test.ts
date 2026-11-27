// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import { assertColorRules, type ColorRule, colorRuleClasses, colorRuleOf, colorRuleStyle, ruleKind } from '../colorRules';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { registerLookup } from '../lookup';
import { contrastRatio, DARK_ROW, darkModeText, isHexColor, LIGHT_ROWS, readableOn, textContrast } from '../ruleColors';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The three kinds of a colour rule (colorRules.ts) - its value, conditions on fields of the row (AND /
 * OR, a lookup column's label, a calculated column), a formula - and the custom colours (`#rrggbb`,
 * ruleColors.ts): the classes and the custom properties on the cells, black or white text on a custom
 * background, a custom text colour lighter in dark; the checks of the new parts; a state as JSON.
 */

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
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 22, 10, 0));
});
afterEach(() => {
    vi.useRealTimers();
});

const STATUSES = new Datasource();
STATUSES.setData([
    { id: 1, label: 'Open' },
    { id: 2, label: 'Late' }
]);
registerLookup('rule-kinds-statuses', { datasource: STATUSES, valueField: 'id', labelField: 'label' });

const rows = () => [
    { id: 1, name: 'Ann', balance: -10, status: 2, due: new Date(2026, 10, 1) },
    { id: 2, name: 'Bob', balance: 250, status: 2, due: new Date(2026, 10, 30) },
    { id: 3, name: 'Cid', balance: 40, status: 1, due: new Date(2026, 10, 10) }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: { id: 'number', balance: 'number', status: 'number', due: 'date' }
});

const config = (rules: ColorRule[], more: Partial<GridConfig> = {}): GridConfig => ({
    calculatedColumns: { late: { formula: 'DAYS({due}, TODAY())' } },
    columns: {
        status: { editor: { type: 'select', lookup: 'rule-kinds-statuses' } },
        name: { format: { rules } }
    },
    layout: { center: ['name', 'balance', 'status', 'due', 'late'].map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const mount = (rules: ColorRule[], more: Partial<GridConfig> = {}) => mountGrid(config(rules, more), rows(), fields());

/** the cells of the name column on screen, in the order of the rows */
const nameCells = (element: GridElement) =>
    Array.from(element.querySelectorAll<HTMLElement>('.simple-html-grid-col-cell[type="row-cell"]'))
        .filter(
            (cell) =>
                (cell as any).$attribute === 'name' &&
                (cell.closest('.simple-html-grid-row') as HTMLElement).style.display !== 'none'
        )
        .sort((a, b) => (a as any).$row - (b as any).$row);

/** the names whose cell a rule colours */
const coloured = (element: GridElement) =>
    nameCells(element)
        .filter((cell) => cell.classList.contains('simple-html-grid-cell-bg'))
        .map((cell) => cell.querySelector('input')?.value);

describe('colour rules - conditions on fields of the row', () => {
    it('expect all conditions (AND) to colour the cells where each is true, on other fields - a lookup column by its label', async () => {
        const { element } = await mount([
            {
                conditions: [
                    { field: 'status', operator: 'EQUAL', value: 'late' },
                    { field: 'balance', operator: 'GREATER_THAN', value: '0' }
                ],
                background: 'red'
            }
        ]);
        expect(coloured(element)).toEqual(['Bob']);
    });

    it('expect any condition (OR) to colour the cells where one is true', async () => {
        const { element } = await mount([
            {
                conditions: [
                    { field: 'balance', operator: 'LESS_THAN', value: '0' },
                    { field: 'name', operator: 'BEGIN_WITH', value: 'c' }
                ],
                combine: 'OR',
                background: 'teal'
            }
        ]);
        expect(coloured(element)).toEqual(['Ann', 'Cid']);
    });

    it('expect a condition on a calculated column, of its type', async () => {
        const { element, datasource } = await mount([
            { conditions: [{ field: 'late', operator: 'GREATER_THAN', value: '7' }], background: 'amber' }
        ]);
        // late: 21, -8, 12
        expect(coloured(element)).toEqual(['Ann', 'Cid']);
        expect(datasource.getField('late').type).toEqual('number');
    });

    it('expect the first rule that matches to win, whatever its kind', async () => {
        const { gridInterface, datasource } = await mount([
            { expression: '{balance} < 0', background: 'red' },
            { conditions: [{ field: 'status', operator: 'EQUAL', value: 'late' }], background: 'orange' },
            { operator: 'IS_NOT_BLANK', background: 'grey' }
        ]);
        const [ann, bob, cid] = datasource.getAllData();
        expect(colorRuleOf(gridInterface, 'name', ann)?.background).toEqual('red');
        expect(colorRuleOf(gridInterface, 'name', bob)?.background).toEqual('orange');
        expect(colorRuleOf(gridInterface, 'name', cid)?.background).toEqual('grey');
    });
});

describe('colour rules - a formula', () => {
    it('expect a formula that is true to colour the cell, false and a row where it can not be computed not', async () => {
        const { element, gridInterface, datasource } = await mount([
            { expression: 'DAYS({due}, TODAY()) > 7 AND {balance} < 100', background: '#fde68a' }
        ]);
        expect(coloured(element)).toEqual(['Ann', 'Cid']);

        // a division by 0 in a row: no colour, nothing thrown
        gridInterface.setState({ formats: { name: { rules: [{ expression: '100 / {balance} > 1', color: 'red' }] } } });
        datasource.getAllData()[0].balance = 0;
        expect(colorRuleOf(gridInterface, 'name', datasource.getAllData()[0])).toBeNull();
        expect(colorRuleOf(gridInterface, 'name', datasource.getAllData()[2])?.color).toEqual('red');
    });

    it('expect the formula read again when the calculated columns change', async () => {
        const { gridInterface, datasource } = await mount([{ expression: '{late} > 0', color: 'red' }]);
        const [, bob] = datasource.getAllData();
        expect(colorRuleOf(gridInterface, 'name', bob)).toBeNull();

        gridInterface.setState({ calculatedColumns: { late: { formula: 'DAYS(TODAY(), {due})' } } });
        expect(colorRuleOf(gridInterface, 'name', bob)?.color).toEqual('red');
    });

    it('expect the kind of a rule from its parts', () => {
        expect(ruleKind({ operator: 'EQUAL', value: '1', color: 'red' })).toEqual('value');
        expect(ruleKind({ conditions: [], color: 'red' })).toEqual('conditions');
        expect(ruleKind({ expression: 'TRUE', color: 'red' })).toEqual('formula');
    });
});

describe('colour rules - custom colours', () => {
    it('expect #rrggbb only, a custom background with black or white text by its contrast', () => {
        expect(isHexColor('#a1B2c3')).toBe(true);
        for (const value of ['#abc', '#a1b2c3d4', 'a1b2c3', '#a1b2cz', ' #a1b2c3', '#a1b2c3 ', 'red', 1]) {
            expect(isHexColor(value), String(value)).toBe(false);
        }
        expect(readableOn('#fde68a')).toEqual('#000000');
        expect(readableOn('#1e3a8a')).toEqual('#ffffff');
        expect(colorRuleClasses({ operator: 'IS_BLANK', background: '#1e3a8a' })).toEqual([
            'simple-html-grid-cell-text',
            'simple-html-grid-cell-text-custom',
            'simple-html-grid-cell-bg',
            'simple-html-grid-cell-bg-custom'
        ]);
        expect(colorRuleStyle({ operator: 'IS_BLANK', background: '#1e3a8a' })).toEqual({
            '--simple-html-grid-rule-bg': '#1e3a8a',
            '--simple-html-grid-rule-text-light': '#ffffff',
            '--simple-html-grid-rule-text-dark': '#ffffff'
        });
        // a palette text colour on a custom background: the palette's, no custom text
        expect(colorRuleClasses({ operator: 'IS_BLANK', color: 'red', background: '#fde68a' })).toContain(
            'simple-html-grid-cell-text-red'
        );
        expect(colorRuleStyle({ operator: 'IS_BLANK', color: 'red', background: '#fde68a' })).toEqual({
            '--simple-html-grid-rule-bg': '#fde68a'
        });
    });

    it('expect a custom text colour as picked in light, lighter in dark until it has 4.5:1 to the dark rows', () => {
        const style = colorRuleStyle({ operator: 'IS_BLANK', color: '#1d4ed8' });
        expect(style['--simple-html-grid-rule-text-light']).toEqual('#1d4ed8');
        const dark = style['--simple-html-grid-rule-text-dark'];
        expect(isHexColor(dark)).toBe(true);
        expect(contrastRatio(dark, DARK_ROW)).toBeGreaterThanOrEqual(4.5);
        // as little lighter as it takes: one step less would not do
        expect(contrastRatio(dark, DARK_ROW)).toBeLessThan(5);
        // a colour light enough already stays
        expect(darkModeText('#fde68a')).toEqual('#fde68a');
        for (const colour of ['#000000', '#ff0000', '#00ff00', '#0000ff', '#7c3aed', '#123456', '#808080']) {
            expect(contrastRatio(darkModeText(colour), DARK_ROW), colour).toBeGreaterThanOrEqual(4.5);
        }
        // on a custom background: as picked in both
        expect(colorRuleStyle({ operator: 'IS_BLANK', color: '#1d4ed8', background: '#fde68a' })).toMatchObject({
            '--simple-html-grid-rule-text-light': '#1d4ed8',
            '--simple-html-grid-rule-text-dark': '#1d4ed8'
        });
    });

    it('expect the contrast of a custom text colour, for the dialog’s warning: to its custom background, else the light rows', () => {
        expect(textContrast('red', undefined)).toBeNull();
        expect(textContrast('#ffff00', undefined)).toBeCloseTo(
            Math.min(...LIGHT_ROWS.map((row) => contrastRatio('#ffff00', row))),
            5
        );
        expect(textContrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    });

    it('expect the cell to get the classes and the custom properties, and to lose them when it shows another row', async () => {
        const { element, gridInterface } = await mount([
            { operator: 'EQUAL', value: 'Ann', color: '#1d4ed8', background: '#fde68a' }
        ]);
        const [ann, bob] = nameCells(element);

        expect(ann.classList.contains('simple-html-grid-cell-bg-custom')).toBe(true);
        expect(ann.style.getPropertyValue('--simple-html-grid-rule-bg')).toEqual('#fde68a');
        expect(ann.style.getPropertyValue('--simple-html-grid-rule-text-light')).toEqual('#1d4ed8');
        expect(bob.style.getPropertyValue('--simple-html-grid-rule-bg')).toEqual('');

        gridInterface.getDatasource().sort({ attribute: 'balance', ascending: false });
        const first = nameCells(element)[0];
        expect(first.querySelector('input')?.value).toEqual('Bob');
        expect(first.classList.contains('simple-html-grid-cell-bg-custom')).toBe(false);
        expect(first.style.getPropertyValue('--simple-html-grid-rule-bg')).toEqual('');
    });

    it('expect the detail form to have the custom properties too', async () => {
        const { element, datasource } = await mount([{ operator: 'EQUAL', value: 'Ann', background: '#1e3a8a' }], {
            detailForm: { show: true, fields: ['name'] }
        });
        datasource.select(1);
        await Promise.resolve();
        await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

        const input = element.querySelector<HTMLInputElement>('.simple-html-grid-detail-form-field[data-field="name"] input');
        expect(input?.classList.contains('simple-html-grid-cell-bg-custom')).toBe(true);
        expect(input?.style.getPropertyValue('--simple-html-grid-rule-bg')).toEqual('#1e3a8a');
        expect(input?.style.getPropertyValue('--simple-html-grid-rule-text-light')).toEqual('#ffffff');
    });
});

describe('colour rules - the new parts checked (TypeError)', () => {
    const fieldOf = (field: string) =>
        ({
            name: { type: 'text' as const, lookup: false },
            balance: { type: 'number' as const, lookup: false },
            status: { type: 'number' as const, lookup: true }
        })[field as 'name'];
    const check = (rules: unknown) => () =>
        assertColorRules(rules, 'text', false, 'setState: formats.name.rules', (field) =>
            Object.hasOwn({ name: 1, balance: 1, status: 1 }, field) ? fieldOf(field) : undefined
        );

    it('expect one kind of condition: an operator, conditions or an expression', () => {
        expect(check([{ color: 'red' }])).toThrow(
            /rules\[0\] has no condition: a rule has an operator \(and its value\), conditions, or an expression/
        );
        expect(check([{ operator: 'IS_BLANK', expression: 'TRUE', color: 'red' }])).toThrow(
            /rules\[0\] has two kinds of condition/
        );
        expect(check([{ value: 'x', expression: 'TRUE', color: 'red' }])).toThrow(/has a value without an operator/);
    });

    it('expect conditions of fields the grid knows, each with an operator of its type, combine AND or OR', () => {
        expect(check([{ conditions: [], color: 'red' }])).toThrow(/conditions is \[\], it is a list of 1 to 20 conditions/);
        expect(check([{ conditions: [{ field: 'nope', operator: 'EQUAL', value: 'x' }], color: 'red' }])).toThrow(
            /conditions\[0\]\.field is "nope", it is a field of the grid/
        );
        expect(check([{ conditions: [{ field: '__proto__', operator: 'EQUAL', value: 'x' }], color: 'red' }])).toThrow(
            /conditions\[0\]\.field is "__proto__"/
        );
        expect(check([{ conditions: [{ field: 'balance', operator: 'CONTAINS', value: '1' }], color: 'red' }])).toThrow(
            /conditions\[0\]\.operator is "CONTAINS", a number column takes/
        );
        // a lookup column compares its labels, as a text
        expect(check([{ conditions: [{ field: 'status', operator: 'CONTAINS', value: 'la' }], color: 'red' }])).not.toThrow();
        expect(check([{ conditions: [{ field: 'balance', operator: 'EQUAL', value: '' }], color: 'red' }])).toThrow(
            /has no value/
        );
        expect(check([{ conditions: [{ field: 'balance', operator: 'EQUAL', value: '1', extra: 1 }], color: 'red' }])).toThrow(
            /conditions\[0\] has 'extra', a condition has field, operator, value/
        );
        expect(check([{ conditions: [{ field: 'balance', operator: 'IS_BLANK' }], combine: 'XOR', color: 'red' }])).toThrow(
            /combine is "XOR"/
        );
        expect(check([{ operator: 'IS_BLANK', combine: 'OR', color: 'red' }])).toThrow(/combine without conditions/);
        expect(
            check([{ conditions: Array.from({ length: 21 }, () => ({ field: 'balance', operator: 'IS_BLANK' })), color: 'red' }])
        ).toThrow(/1 to 20/);
    });

    it('expect a formula without a problem that is true / false', () => {
        expect(check([{ expression: '', color: 'red' }])).toThrow(/expression is empty: write a formula that is true or false/);
        expect(check([{ expression: '{balance} +', color: 'red' }])).toThrow(/expression: The formula ends too soon/);
        expect(check([{ expression: '{name}', color: 'red' }])).toThrow(/The formula gives a text, it must give true \/ false/);
        expect(check([{ expression: '{balance} < 0 AND {name} = "x"', color: 'red' }])).not.toThrow();
    });

    it('expect the grid to check them in the state, and a state of every kind to come back from JSON', async () => {
        const rules: ColorRule[] = [
            { operator: 'EQUAL', value: 'Ann', color: 'red' },
            { conditions: [{ field: 'late', operator: 'GREATER_THAN', value: '0' }], combine: 'OR', background: '#abcdef' },
            { expression: '{late} > 10', bold: true }
        ];
        const { gridInterface } = await mount(rules);

        expect(() =>
            gridInterface.setState({
                formats: { name: { rules: [{ conditions: [{ field: 'nope', operator: 'EQUAL', value: 'x' }], color: 'red' }] } }
            })
        ).toThrow(/setState: formats\.name\.rules\[0\]\.conditions\[0\]\.field is "nope"/);
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));
        gridInterface.setState({ formats: {} });
        gridInterface.setState(saved);
        expect(gridInterface.getState().formats.name).toEqual({ rules });
    });
});
