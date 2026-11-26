// @vitest-environment happy-dom

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { CalculatedColumn } from '../calculatedColumns';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry } from './interactionTestHelpers';

/**
 * The grid config dialog (columnSettings.ts) with calculated columns, and the three kinds of a colour
 * rule in it (columnSettingsRules.ts): Add calculated column, its field name, label and formula with
 * their problems at once, the type it gives and its value in the row of the preview, Remove, Apply (the
 * state, the layout), the resets; a rule's kind - Value, Conditions (a field picker, Add condition, All /
 * Any), Formula (its result in the row, its problems) - and the custom colour picker with its contrast
 * warning. How it looks, and the keys, are in the browser check (calculated-column-check.js).
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

const rows = () => [
    { id: 1, name: 'Ann', price: 10, qty: 3, due: new Date(2026, 10, 20), status: 'late' },
    { id: 2, name: 'Bob', price: 2, qty: 4, due: new Date(2026, 10, 25), status: 'open' }
];

const fields = (): DatasourceOptions => ({ key: 'id', fields: { id: 'number', price: 'number', qty: 'number', due: 'date' } });

const START: Record<string, CalculatedColumn> = { total: { formula: '{price} * {qty}', label: 'Total' } };

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    calculatedColumns: START,
    layout: { center: ['name', 'price', 'qty', 'total', 'status'].map((field) => ({ fields: [field], width: 90 })) },
    ...more
});

const mount = (more: Partial<GridConfig> = {}) => mountGrid(config(more), rows(), fields());

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const byId = <T extends HTMLElement = HTMLElement>(part: string) => dialog().querySelector(`[id$="-settings-${part}"]`) as T;
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const options = () => Array.from(dialog().querySelectorAll<HTMLElement>('[role="option"]'), (option) => option.dataset.field);
const option = (field: string) => dialog().querySelector(`[role="option"][data-field="${field}"]`) as HTMLElement;
const badges = (field: string) =>
    Array.from(option(field).querySelectorAll('.column-settings-badge'), (badge) => badge.textContent?.trim());
const section = () => dialog().querySelector('.column-settings-calculated') as HTMLElement;
const problems = (within: Element = section()) =>
    Array.from(within.querySelectorAll('.column-settings-problem'), (problem) => problem.textContent?.trim());
const text = (selector: string) => dialog().querySelector(selector)?.textContent?.trim();

/** types into an input of the dialog, as the user */
function type(part: string, value: string) {
    const element = byId<HTMLInputElement>(part);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** picks a radio button or turns a checkbox of the dialog on, as a click */
function check(part: string) {
    const element = byId<HTMLInputElement>(part);
    element.checked = true;
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('column settings - a calculated column', () => {
    it('expect Add calculated column: calc_1 at the end of the list, picked, its formula focused - a problem until it has one', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('name');

        button('Add calculated column').click();

        expect(options()).toEqual(['name', 'price', 'qty', 'total', 'status', 'calc_1']);
        expect(option('calc_1').getAttribute('aria-selected')).toEqual('true');
        expect(document.activeElement).toBe(byId('calculated-formula'));
        expect(byId<HTMLInputElement>('calculated-name').value).toEqual('calc_1');
        expect(byId<HTMLInputElement>('calculated-label').value).toEqual('Calculated 1');
        expect(problems()).toEqual(['Write the formula']);
        expect(badges('calc_1')).toEqual(['Error']);
        expect(button('Apply').getAttribute('aria-disabled')).toEqual('true');
        // the next one is calc_2
        button('Add calculated column').click();
        expect(byId<HTMLInputElement>('calculated-name').value).toEqual('calc_2');
    });

    it('expect the formula: its type and its value in the row of the preview, its problems at once', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('name');
        button('Add calculated column').click();

        type('calculated-formula', '{price} * {qty} + 1');
        expect(text('.column-settings-calculated-type')).toEqual('Gives: Number');
        expect(text('.column-settings-calculated-value')).toEqual('In this row: 31');
        expect(problems()).toEqual([]);
        expect(badges('calc_1')).toEqual(['Calculated']);
        expect(text('.column-settings-calculated-pending')).toEqual(
            'Apply first: then the format and the colour rules of a Number column'
        );

        type('calculated-formula', 'IF({status} = "late", "yes", "no")');
        expect(text('.column-settings-calculated-type')).toEqual('Gives: Text');
        expect(text('.column-settings-calculated-value')).toEqual('In this row: yes');

        type('calculated-formula', '{name} * 2');
        expect(problems()).toEqual(['* takes a number: {name} is a text']);
        expect(byId('calculated-formula').getAttribute('aria-invalid')).toEqual('true');
        type('calculated-formula', '{calc_1} + 1');
        expect(problems()).toEqual(['{calc_1} is computed from itself']);
        type('calculated-formula', '{price} / 0');
        // a problem of the row holds nothing back
        expect(problems()).toEqual(['Divides by 0 in this row: no value']);
        expect(button('Apply').getAttribute('aria-disabled')).toBeNull();
    });

    it('expect the { } button to list the fields a formula can name and put one in at the caret', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('name');
        button('Add calculated column').click();
        type('calculated-formula', ' * 2');
        byId<HTMLInputElement>('calculated-formula').setSelectionRange(0, 0);

        (section().querySelector('.column-settings-insert') as HTMLElement).click();
        const listed = Array.from(document.querySelectorAll<HTMLElement>('[data-menu-id^="filterEditor.field."]'), (entry) =>
            entry.getAttribute('data-menu-id')?.replace('filterEditor.field.', '')
        );
        expect(listed).toContain('total');
        expect(listed).not.toContain('calc_1');
        menuEntry('filterEditor.field.price').click();

        expect(byId<HTMLInputElement>('calculated-formula').value).toEqual('{price} * 2');
    });

    it('expect Apply: the state has it, the layout ends with it, the rows answer it', async () => {
        const { gridInterface, datasource } = await mount();
        gridInterface.openColumnSettings('name');
        button('Add calculated column').click();
        type('calculated-formula', 'DAYS({due}, TODAY())');
        type('calculated-label', 'Days');

        button('Apply').click();

        expect(gridInterface.getState().calculatedColumns).toEqual({
            ...START,
            calc_1: { formula: 'DAYS({due}, TODAY())', label: 'Days' }
        });
        expect(gridInterface.getState().layout.center.at(-1)).toEqual({ fields: ['calc_1'], width: 100 });
        expect(datasource.getAllData().map((row) => row.calc_1)).toEqual([2, -3]);
        // applied: its field name stays, its settings are those of a number column
        expect(byId('calculated-name')).toBeNull();
        expect(text('.column-settings-calculated-name')).toEqual('calc_1');
        expect(dialog().querySelector('.column-settings-calculated-pending')).toBeNull();
        expect(dialog().querySelector('.column-settings-format')).not.toBeNull();
        expect(dialog().querySelector('.column-settings-rules')).not.toBeNull();
    });

    it('expect the field name of a new one: renamed as typed, a name it can not have a problem', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('name');
        button('Add calculated column').click();
        type('calculated-formula', '{qty} * 2');

        type('calculated-name', '2x');
        expect(problems()).toEqual(['The field name is a letter, then letters, digits and _ - 64 at most']);
        type('calculated-name', 'price');
        expect(problems()).toEqual(['The field name is a field already: give the column a name of its own']);
        type('calculated-name', 'total');
        expect(problems()).toEqual(['The field name is a field already: give the column a name of its own']);
        type('calculated-name', 'constructor');
        expect(problems()).toEqual(['The field name is a letter, then letters, digits and _ - 64 at most']);
        expect(button('Apply').getAttribute('aria-disabled')).toEqual('true');

        type('calculated-name', 'double_qty');
        expect(problems()).toEqual([]);
        expect(options().at(-1)).toEqual('double_qty');
        button('Apply').click();
        expect(gridInterface.getState().calculatedColumns.double_qty).toEqual({ formula: '{qty} * 2', label: 'Calculated 1' });
    });

    it('expect Remove: a new one gone at once, an applied one leaves the state and the layout on Apply', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('total');

        expect(badges('total')).toEqual(['Calculated']);
        expect(byId<HTMLInputElement>('calculated-label').value).toEqual('Total');
        button('Remove calculated column').click();

        expect(options()).toEqual(['name', 'price', 'qty', 'status']);
        expect(gridInterface.getState().calculatedColumns).toEqual(START);
        button('Apply').click();
        expect(gridInterface.getState().calculatedColumns).toEqual({});
        expect(gridInterface.getState().layout.center.map((column) => column.fields[0])).toEqual([
            'name',
            'price',
            'qty',
            'status'
        ]);
    });

    it('expect its label typed to be the label shown: a label of its format goes', async () => {
        const { gridInterface } = await mount({ columns: { total: { format: { label: 'Sum', number: { decimals: 2 } } } } });
        gridInterface.openColumnSettings('total');

        type('calculated-label', 'Order total');
        button('Apply').click();

        expect(gridInterface.getState().calculatedColumns.total.label).toEqual('Order total');
        expect(gridInterface.getState().formats.total).toEqual({ number: { decimals: 2 } });
        expect(text('.column-settings-heading-label')).toEqual('Order total');
    });

    it('expect Reset all to go back to the calculated columns the grid starts with, Reset column to its formula', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('total');
        type('calculated-formula', '{price} + {qty}');
        button('Reset column').click();
        expect(byId<HTMLInputElement>('calculated-formula').value).toEqual('{price} * {qty}');

        button('Add calculated column').click();
        type('calculated-formula', '1');
        button('Reset all').click();
        expect(options()).toEqual(['name', 'price', 'qty', 'total', 'status']);
    });

    it('expect a colour rule on a calculated column removed in the dialog to be a problem: Apply waits', async () => {
        const { gridInterface } = await mount({
            columns: {
                name: {
                    format: { rules: [{ conditions: [{ field: 'total', operator: 'GREATER_THAN', value: '10' }], color: 'red' }] }
                }
            }
        });
        gridInterface.openColumnSettings('total');
        button('Remove calculated column').click();

        expect(badges('name')).toEqual(['Error']);
        expect(button('Apply').getAttribute('aria-disabled')).toEqual('true');
    });
});

describe('column settings - the kinds of a colour rule', () => {
    it('expect Value to Conditions: the rule’s own condition the first, Add condition, a field picked, All / Any', async () => {
        const { gridInterface } = await mount({
            columns: { name: { format: { rules: [{ operator: 'EQUAL', value: 'Ann', color: 'red' }] } } }
        });
        gridInterface.openColumnSettings('name');

        expect(byId<HTMLInputElement>('rule-0-kind-value').checked).toBe(true);
        check('rule-0-kind-conditions');
        expect(byId('rule-0-condition-0-field').getAttribute('aria-label')).toEqual('Field: Name');
        expect(byId<HTMLInputElement>('rule-0-condition-0-value').value).toEqual('Ann');
        expect(byId('rule-0-combine')).toBeNull();

        button('Add condition').click();
        byId('rule-0-condition-1-field').click();
        menuEntry('filterEditor.field.price').click();
        // a number field: its operator, no value yet - a problem
        expect(byId('rule-0-condition-1-operator').getAttribute('aria-label')).toEqual('Operator: Greater than or equal');
        expect(problems(dialog().querySelector('.column-settings-rule') as Element)).toEqual(['Write the value to compare with']);
        type('rule-0-condition-1-value', '5');
        expect(byId('rule-0-combine').getAttribute('aria-label')).toContain('All of them');
        byId('rule-0-combine').click();
        menuEntry('columnSettings.rules.combine.OR').click();

        button('Apply').click();
        expect(gridInterface.getState().formats.name.rules).toEqual([
            {
                conditions: [
                    { field: 'name', operator: 'EQUAL', value: 'Ann' },
                    { field: 'price', operator: 'GREATER_THAN_OR_EQUAL_TO', value: '5' }
                ],
                combine: 'OR',
                color: 'red'
            }
        ]);

        // back to Value: the column's own condition
        check('rule-0-kind-value');
        expect(byId('rule-0-operator').getAttribute('aria-label')).toEqual('Operator: Equal');
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('Ann');
    });

    it('expect Formula: its problems at once, true / false only, its result in the row of the preview', async () => {
        const { gridInterface } = await mount({
            columns: { name: { format: { rules: [{ operator: 'EQUAL', value: 'Ann', color: 'red' }] } } }
        });
        gridInterface.openColumnSettings('name');
        const rule = () => dialog().querySelector('.column-settings-rule') as Element;

        check('rule-0-kind-formula');
        expect(problems(rule())).toEqual(['Write the formula, true or false']);
        type('rule-0-expression', '{price} * 2');
        expect(problems(rule())).toEqual(['The formula gives a number, it must give true / false']);
        type('rule-0-expression', '{total} > 20 AND {status} = "LATE"');
        expect(problems(rule())).toEqual([]);
        expect(text('.column-settings-rule-result')).toEqual('True in this row: the rule colours the cell');
        type('rule-0-expression', '{total} > 200');
        expect(text('.column-settings-rule-result')).toEqual('False in this row');

        button('Apply').click();
        expect(gridInterface.getState().formats.name.rules).toEqual([{ expression: '{total} > 200', color: 'red' }]);
    });

    it('expect the colour picker: a custom colour, no swatch checked, a warning for a text colour hard to read', async () => {
        const { gridInterface } = await mount({
            columns: { name: { format: { rules: [{ operator: 'EQUAL', value: 'Ann', color: 'red' }] } } }
        });
        gridInterface.openColumnSettings('name');
        const picker = byId<HTMLInputElement>('rule-0-color-custom');

        expect(picker.type).toEqual('color');
        expect(picker.getAttribute('aria-label')).toEqual('Custom colour');
        picker.value = '#ffff00';
        picker.dispatchEvent(new Event('input', { bubbles: true }));

        expect(byId<HTMLInputElement>('rule-0-color-custom').getAttribute('aria-label')).toEqual('Custom colour: #ffff00');
        expect(dialog().querySelectorAll('input[name$="-rule-0-color"]:checked')).toHaveLength(0);
        expect(problems(dialog().querySelector('.column-settings-rule') as Element)).toEqual([
            'The text colour has 1.0:1 to the light rows, under 4.5:1: hard to read'
        ]);
        // on a custom background of enough contrast: no warning
        const background = byId<HTMLInputElement>('rule-0-background-custom');
        background.value = '#000000';
        background.dispatchEvent(new Event('input', { bubbles: true }));
        expect(problems(dialog().querySelector('.column-settings-rule') as Element)).toEqual([]);

        button('Apply').click();
        expect(gridInterface.getState().formats.name.rules).toEqual([
            { operator: 'EQUAL', value: 'Ann', color: '#ffff00', background: '#000000' }
        ]);
        // the preview in the rule's colours: the custom properties on it
        const preview = dialog().querySelector('.column-settings-preview-cell') as HTMLElement;
        expect(preview.style.getPropertyValue('--simple-html-grid-rule-bg')).toEqual('#000000');
    });
});

describe('column settings - a calculated column added and removed in a narrow dialog', () => {
    it('expect Add calculated column to show its settings, Remove the list again', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings();
        const body = () => dialog().querySelector('.column-settings-body') as HTMLElement;
        expect(body().classList.contains('column-settings-detail')).toBe(false);
        button('Add calculated column').click();
        // a phone shows the settings of the new column, its formula is typed next
        expect(body().classList.contains('column-settings-detail')).toBe(true);
        button('Remove calculated column').click();
        expect(body().classList.contains('column-settings-detail')).toBe(false);
    });
});
