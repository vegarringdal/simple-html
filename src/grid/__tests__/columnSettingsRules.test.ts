// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { ColorRule } from '../colorRules';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, openMenus } from './interactionTestHelpers';

/**
 * The Colour rules of a column in the grid config dialog (columnSettingsRules.ts): the section on every
 * kind of column, Add rule, a rule's operator (the operators of the column's filter, not IN / NOT_IN)
 * and value (two for Between, none for Is Blank, a checkbox for a boolean column), its swatches, Bold,
 * Move up / Move down / Remove and where the focus goes, the problems that hold Apply back, the badge,
 * the preview in the rule's colours - and Apply, Cancel, Reset column, Reset all, the state as JSON.
 * The keys of the swatches (the browser's radio buttons) and how it looks are in the browser check.
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

const STATUSES = new Datasource();
STATUSES.setData([
    { id: 1, label: 'Open' },
    { id: 2, label: 'Waiting' }
]);
registerLookup('rules-settings-statuses', { datasource: STATUSES, valueField: 'id', labelField: 'label' });

const LAYOUT = ['name', 'balance', 'born', 'active', 'status'];

const rows = () => [
    { id: 1, name: 'Ann', balance: -10, born: new Date(2026, 10, 22), active: true, status: 2 },
    { id: 2, name: 'Bob', balance: 250, born: null, active: false, status: 1 }
];

const fields = (): DatasourceOptions => ({
    fields: { id: 'number', balance: 'number', born: 'date', active: 'boolean', status: 'number' }
});

/** the rules the balance starts with, in the config */
const START: ColorRule[] = [{ operator: 'LESS_THAN', value: '0', color: 'red' }];

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        name: { label: 'Name' },
        balance: { label: 'Balance', format: { rules: START } },
        born: { label: 'Born' },
        active: { label: 'Active' },
        status: { label: 'Status', editor: { type: 'select', lookup: 'rules-settings-statuses' } }
    },
    layout: { center: LAYOUT.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const mount = (more: Partial<GridConfig> = {}) => mountGrid(config(more), rows(), fields());

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const section = () => dialog().querySelector('.column-settings-rules') as HTMLElement;
const rules = () => Array.from(dialog().querySelectorAll<HTMLElement>('.column-settings-rule'));
const byId = <T extends HTMLElement = HTMLElement>(part: string) => dialog().querySelector(`[id$="-settings-${part}"]`) as T;
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const option = (field: string) => dialog().querySelector(`[role="option"][data-field="${field}"]`) as HTMLElement;
const badges = (field: string) =>
    Array.from(option(field).querySelectorAll('.column-settings-badge'), (badge) => badge.textContent?.trim());
const problems = (index = 0) =>
    Array.from(rules()[index].querySelectorAll('.column-settings-problem'), (problem) => problem.textContent?.trim());
/** the value of a rule: its input when it is open, else the end of its one line (a closed rule) */
const ruleValue = (index: number) => {
    const input = rules()[index].querySelector<HTMLInputElement>('input.filter-editor-value');
    return input
        ? input.value
        : (rules()[index].querySelector('.column-settings-rule-summary')?.textContent?.trim().split(' ').pop() ?? '');
};
const previewCell = () => dialog().querySelector('.column-settings-preview-cell') as HTMLElement;
const apply = () => button('Apply');
/** the swatches of a rule: its text colours or its backgrounds */
const swatches = (index: number, kind: 'color' | 'background') =>
    Array.from(dialog().querySelectorAll<HTMLInputElement>(`input[name$="-settings-rule-${index}-${kind}"]`));
const pickedSwatch = (index: number, kind: 'color' | 'background') =>
    swatches(index, kind)
        .find((swatch) => swatch.checked)
        ?.getAttribute('aria-label');

/** types into an input of the dialog, as the user: the value, then its input event */
function type(part: string, value: string) {
    const element = byId<HTMLInputElement>(part);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** picks a swatch, as a click: checked, then its change event */
function pick(index: number, kind: 'color' | 'background', name: string) {
    const swatch = swatches(index, kind).find((each) => each.getAttribute('aria-label') === name) as HTMLInputElement;
    swatch.checked = true;
    swatch.dispatchEvent(new Event('change', { bubbles: true }));
}

/** turns a checkbox of the dialog on or off, as a click */
function toggle(part: string) {
    const element = byId<HTMLInputElement>(part);
    element.checked = !element.checked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/** the entries of the operator menu of a rule: the ids of their texts, the header filter's */
const OPERATOR_IDS: Record<string, string> = {
    EQUAL: 'filter.operator.equal',
    NOT_EQUAL_TO: 'filter.operator.notEqualTo',
    LESS_THAN: 'filter.operator.lessThan',
    LESS_THAN_OR_EQUAL_TO: 'filter.operator.lessThanOrEqualTo',
    GREATER_THAN: 'filter.operator.greaterThan',
    GREATER_THAN_OR_EQUAL_TO: 'filter.operator.greaterThanOrEqualTo',
    BETWEEN: 'filter.operator.between',
    CONTAINS: 'filter.operator.contains',
    DOES_NOT_CONTAIN: 'filter.operator.doesNotContain',
    BEGIN_WITH: 'filter.operator.beginWith',
    END_WITH: 'filter.operator.endWith',
    IS_BLANK: 'filter.filter.isBlank',
    IS_NOT_BLANK: 'filter.filter.isNotBlank'
};

/** picks an operator of a rule: its picker, then the entry of the menu */
function pickOperator(index: number, operator: string) {
    byId(`rule-${index}-operator`).click();
    menuEntry(OPERATOR_IDS[operator]).click();
}

/** the operators the menu of a rule's picker offers, then the menu closed */
function offered(index: number): string[] {
    byId(`rule-${index}-operator`).click();
    const operatorOf = new Map(Object.entries(OPERATOR_IDS).map(([operator, id]) => [id, operator]));
    const ids = Array.from(openMenus()[0].querySelectorAll('[data-menu-id]'), (entry) =>
        operatorOf.get(entry.getAttribute('data-menu-id') ?? '')
    ).filter((operator): operator is string => !!operator);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (openMenus()[0]?.querySelector('[data-menu-id]') as HTMLElement | undefined)?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    return ids;
}

/** the cell element of a displayed row and a field */
function cellOf(element: GridElement, row: number, field: string): HTMLCellElement {
    return (Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[]).find(
        (cell) =>
            cell.$row === row &&
            cell.$attribute === field &&
            (cell.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
    ) as HTMLCellElement;
}

describe('column settings - colour rules: the section', () => {
    it('expect every kind of column to have it: a heading, the hint, No rules, Add rule', async () => {
        const { gridInterface } = await mount();

        for (const field of ['name', 'born', 'active', 'status']) {
            gridInterface.openColumnSettings(field);
            expect(section().getAttribute('role')).toEqual('group');
            expect(document.getElementById(section().getAttribute('aria-labelledby') as string)?.textContent).toEqual(
                'Colour rules'
            );
            expect(document.getElementById(section().getAttribute('aria-describedby') as string)?.textContent?.trim()).toEqual(
                'The first rule that matches colours the cell. The value is compared as the header filter compares it'
            );
            expect(section().querySelector('.column-settings-rules-empty')?.textContent?.trim()).toEqual('No rules');
            expect(byId('rules-add').textContent?.trim()).toEqual('Add rule');
        }
    });

    it("expect the config's rules in the dialog: the operator, the value, the swatches picked, the badge", async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');

        expect(rules()).toHaveLength(1);
        expect(rules()[0].getAttribute('role')).toEqual('group');
        expect(rules()[0].getAttribute('aria-label')).toEqual('Rule 1');
        expect(byId('rule-0-operator').getAttribute('aria-label')).toEqual('Operator: Less than');
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('0');
        expect(byId<HTMLInputElement>('rule-0-value').getAttribute('aria-label')).toEqual('Value');
        expect(pickedSwatch(0, 'color')).toEqual('Red');
        expect(pickedSwatch(0, 'background')).toEqual('None');
        expect(byId<HTMLInputElement>('rule-0-bold').checked).toBe(false);
        expect(badges('balance')).toEqual(['Colours']);
        expect(badges('name')).toEqual([]);
    });

    it('expect the swatches: a radio group named Text colour or Background, None and the fourteen colours, each named', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');

        for (const [kind, label] of [
            ['color', 'Text colour'],
            ['background', 'Background']
        ] as const) {
            const group = swatches(0, kind)[0].parentElement as HTMLElement;
            expect(group.getAttribute('role')).toEqual('radiogroup');
            expect(document.getElementById(group.getAttribute('aria-labelledby') as string)?.textContent).toEqual(label);
            expect(swatches(0, kind).map((swatch) => swatch.getAttribute('aria-label'))).toEqual([
                'None',
                'Red',
                'Orange',
                'Amber',
                'Yellow',
                'Lime',
                'Green',
                'Teal',
                'Cyan',
                'Blue',
                'Indigo',
                'Purple',
                'Pink',
                'Brown',
                'Grey'
            ]);
            expect(swatches(0, kind).every((swatch) => swatch.type === 'radio')).toBe(true);
            // a tooltip with the name: the colour is not the only way to tell
            expect(swatches(0, kind)[1].getAttribute('data-tooltip')).toEqual('Red');
        }
        expect(swatches(0, 'color')[1].classList.contains('column-settings-swatch-text-red')).toBe(true);
        expect(swatches(0, 'background')[1].classList.contains('column-settings-swatch-bg-red')).toBe(true);
    });
});

describe('column settings - colour rules: editing', () => {
    it('expect Add rule: the column filter operator, red on red, the focus on its operator - no value yet a problem', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('name');

        byId('rules-add').click();

        expect(rules()).toHaveLength(1);
        expect(document.activeElement).toBe(byId('rule-0-operator'));
        expect(byId('rule-0-operator').getAttribute('aria-label')).toEqual('Operator: Equal');
        expect(pickedSwatch(0, 'color')).toEqual('Red');
        expect(pickedSwatch(0, 'background')).toEqual('Red');
        expect(problems()).toEqual(['Write the value to compare with']);
        expect(byId('rule-0-value').getAttribute('aria-invalid')).toEqual('true');
        expect(badges('name')).toEqual(['Error']);
        expect(apply().getAttribute('aria-disabled')).toEqual('true');

        // Apply does nothing while it has a problem
        apply().click();
        expect(gridInterface.getState().formats.name).toBeUndefined();

        type('rule-0-value', 'ann');
        expect(problems()).toEqual([]);
        expect(byId('rule-0-value').getAttribute('aria-invalid')).toEqual('false');
        expect(badges('name')).toEqual(['Colours']);
        expect(apply().getAttribute('aria-disabled')).toBeNull();
        // the state's rule: its parts in the order of a rule, whatever was set first
        apply().click();
        expect(JSON.stringify(gridInterface.getState().formats.name)).toEqual(
            '{"rules":[{"operator":"EQUAL","value":"ann","color":"red","background":"red"}]}'
        );
    });

    it("expect the column's filter operators in the picker, not In / Not In; a lookup column's of a text", async () => {
        const { gridInterface } = await mount({
            columns: { ...config().columns, name: { label: 'Name', filterOperators: ['EQUAL', 'CONTAINS', 'IS_BLANK'] } }
        });

        gridInterface.openColumnSettings('balance');
        expect(offered(0)).toEqual([
            'EQUAL',
            'NOT_EQUAL_TO',
            'LESS_THAN',
            'LESS_THAN_OR_EQUAL_TO',
            'GREATER_THAN',
            'GREATER_THAN_OR_EQUAL_TO',
            'BETWEEN',
            'IS_BLANK',
            'IS_NOT_BLANK'
        ]);
        gridInterface.openColumnSettings('name');
        byId('rules-add').click();
        expect(offered(0)).toEqual(['EQUAL', 'CONTAINS', 'IS_BLANK']);
        gridInterface.openColumnSettings('status');
        byId('rules-add').click();
        expect(offered(0)).toContain('CONTAINS');
        expect(offered(0)).not.toContain('LESS_THAN');
    });

    it('expect Between to have From and To, the value its From; Is Blank none; back to one value', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');

        pickOperator(0, 'BETWEEN');
        expect(byId<HTMLInputElement>('rule-0-from').value).toEqual('0');
        expect(byId<HTMLInputElement>('rule-0-to').value).toEqual('');
        expect(byId('rule-0-from').getAttribute('aria-label')).toEqual('From');
        expect(byId('rule-0-to').getAttribute('aria-label')).toEqual('To');
        type('rule-0-to', '100');

        pickOperator(0, 'IS_BLANK');
        expect(byId('rule-0-value')).toBeNull();
        expect(byId('rule-0-from')).toBeNull();
        expect(problems()).toEqual([]);

        pickOperator(0, 'GREATER_THAN');
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('');
        expect(problems()).toEqual(['Write the value to compare with']);

        type('rule-0-value', '5');
        pickOperator(0, 'BETWEEN');
        type('rule-0-from', '');
        type('rule-0-to', '9');
        pickOperator(0, 'EQUAL');
        // the end that has a value
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('9');
        apply().click();
        expect(gridInterface.getState().formats.balance?.rules).toEqual([{ operator: 'EQUAL', value: '9', color: 'red' }]);
    });

    it('expect the swatches and Bold to set the style: None takes it out, nothing at all a problem', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');

        pick(0, 'background', 'Yellow');
        pick(0, 'color', 'None');
        expect(pickedSwatch(0, 'color')).toEqual('None');
        apply().click();
        expect(gridInterface.getState().formats.balance?.rules).toEqual([
            { operator: 'LESS_THAN', value: '0', background: 'yellow' }
        ]);

        pick(0, 'background', 'None');
        expect(problems()).toEqual(['Pick a text colour, a background or bold']);
        expect(badges('balance')).toEqual(['Error']);
        toggle('rule-0-bold');
        expect(problems()).toEqual([]);
        apply().click();
        expect(gridInterface.getState().formats.balance?.rules).toEqual([{ operator: 'LESS_THAN', value: '0', bold: true }]);
    });

    it('expect Move up and Move down to swap two rules, the focus on the button of the rule moved; none past an end', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');
        byId('rules-add').click();
        type('rule-1-value', '1000');

        // the first can not go up, the last not down
        expect(byId('rule-0-up').getAttribute('aria-disabled')).toEqual('true');
        expect(byId('rule-1-down').getAttribute('aria-disabled')).toEqual('true');
        expect(byId('rule-0-down').getAttribute('aria-disabled')).toBeNull();
        expect(byId('rule-0-up').getAttribute('aria-label')).toEqual('Move up');
        expect(byId('rule-0-down').getAttribute('data-tooltip')).toEqual('Move down');
        byId('rule-0-up').click();
        expect(ruleValue(0)).toEqual('0');

        byId('rule-0-down').click();
        expect(ruleValue(0)).toEqual('1000');
        expect(ruleValue(1)).toEqual('0');
        expect(document.activeElement).toBe(byId('rule-1-down'));
        byId('rule-1-up').click();
        expect(ruleValue(0)).toEqual('0');
        expect(document.activeElement).toBe(byId('rule-0-up'));
    });

    it('expect Remove to take a rule out, the focus on the next one - the last gone, on Add rule', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');
        byId('rules-add').click();
        type('rule-1-value', '1000');
        byId('rules-add').click();
        type('rule-2-value', '2000');

        expect(byId('rule-0-remove').getAttribute('aria-label')).toEqual('Remove rule');
        byId('rule-1-remove').click();
        expect(rules().map((_, i) => ruleValue(i))).toEqual(['0', '2000']);
        expect(document.activeElement).toBe(byId('rule-1-remove'));
        byId('rule-1-remove').click();
        expect(document.activeElement).toBe(byId('rule-0-remove'));
        byId('rule-0-remove').click();
        expect(rules()).toHaveLength(0);
        expect(document.activeElement).toBe(byId('rules-add'));
        expect(badges('balance')).toEqual([]);

        // no rules: none in the format
        apply().click();
        expect(gridInterface.getState().formats.balance).toBeUndefined();
    });

    it('expect a checkbox column: its value a checkbox, Checked - unchecked writes false', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.openColumnSettings('active');
        byId('rules-add').click();

        const checked = byId<HTMLInputElement>('rule-0-value');
        expect(checked.type).toEqual('checkbox');
        expect(checked.checked).toBe(true);
        expect(checked.parentElement?.textContent?.trim()).toEqual('Checked');
        toggle('rule-0-value');
        pick(0, 'color', 'None');
        apply().click();

        expect(gridInterface.getState().formats.active?.rules).toEqual([
            { operator: 'EQUAL', value: 'false', background: 'red' }
        ]);
        // Bob is not active
        expect(cellOf(element, 1, 'active').classList.contains('simple-html-grid-cell-bg-red')).toBe(true);
        expect(cellOf(element, 0, 'active').classList.contains('simple-html-grid-cell-bg-red')).toBe(false);
        // from Is Blank back to Equal: checked
        pickOperator(0, 'IS_BLANK');
        pickOperator(0, 'EQUAL');
        expect(byId<HTMLInputElement>('rule-0-value').checked).toBe(true);
    });

    it('expect a value a date column does not read to be said, Apply not held back', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('born');
        byId('rules-add').click();
        type('rule-0-value', '22.11.2026');

        expect(problems()).toEqual(['The column does not read 22.11.2026: the rule colours no cell']);
        expect(apply().getAttribute('aria-disabled')).toBeNull();
        type('rule-0-value', '2026-11-22');
        expect(problems()).toEqual([]);
    });
});

describe('column settings - colour rules on a date: Compare with and Weeks', () => {
    /** the name a picker shows */
    const shown = (part: string) => byId(part).querySelector('.filter-editor-pick-text')?.textContent?.trim();

    it('expect a quick date and the weeks picked into the rule, its operators those that compare', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('born');
        byId('rules-add').click();
        expect([shown('rule-0-compare'), shown('rule-0-week')]).toEqual([
            'A date or period typed',
            'As the column: ISO - Monday'
        ]);

        byId('rule-0-compare').click();
        menuEntry('filter.dates.thisWeek').click();
        // the quick date is the value: no input
        expect(byId('rule-0-value')).toBeNull();
        byId('rule-0-week').click();
        menuEntry('columnSettings.rules.week.us').click();
        expect([shown('rule-0-compare'), shown('rule-0-week')]).toEqual(['This week', 'US - Sunday']);
        // the operators: not Between, not the blanks
        byId('rule-0-operator').click();
        const offered = openMenus().at(-1)?.querySelectorAll('[role^="menuitem"]');
        const names = Array.from(offered ?? [], (item) => item.textContent?.trim());
        expect(names.some((name) => /between|blank/i.test(name ?? ''))).toBe(false);
        gridInterface.closeMenu();

        apply().click();
        expect(gridInterface.getState().formats.born?.rules?.[0]).toMatchObject({
            operator: 'EQUAL',
            datePreset: 'thisWeek',
            week: 'us'
        });
        expect(gridInterface.getState().formats.born?.rules?.[0]).not.toHaveProperty('value');
    });

    it('expect a typed period read, A date or period typed back to an empty value, Between dropping the quick date', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('born');
        byId('rules-add').click();
        type('rule-0-value', '2026-W47');
        expect(problems()).toEqual([]);
        byId('rule-0-compare').click();
        menuEntry('filter.dates.overdue').click();
        byId('rule-0-compare').click();
        menuEntry('columnSettings.rules.date.typed').click();
        expect(byId<HTMLInputElement>('rule-0-value').value).toBe('');
        // a quick date is Equal - in it -, another operator keeps it, another quick date keeps the operator
        byId('rule-0-compare').click();
        menuEntry('filter.dates.lastMonth').click();
        pickOperator(0, 'LESS_THAN');
        byId('rule-0-compare').click();
        menuEntry('filter.dates.thisMonth').click();
        apply().click();
        expect(gridInterface.getState().formats.born?.rules?.[0]).toMatchObject({
            operator: 'LESS_THAN',
            datePreset: 'thisMonth'
        });
    });

    it('expect no date pickers on another column, nor for Is blank', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');
        expect(byId('rule-0-compare')).toBeNull();
        gridInterface.openColumnSettings('born');
        byId('rules-add').click();
        pickOperator(0, 'IS_BLANK');
        expect(byId('rule-0-compare')).toBeNull();
    });
});

describe('column settings - colour rules: the preview', () => {
    it('expect the preview in the colours of the rule its row matches, the draft before Apply', async () => {
        const { datasource, gridInterface } = await mount();
        // Ann: -10
        datasource.setRowAsCurrentEntity(0);
        gridInterface.openColumnSettings('balance');

        expect(previewCell().classList.contains('simple-html-grid-cell-text')).toBe(true);
        expect(previewCell().classList.contains('simple-html-grid-cell-text-red')).toBe(true);
        pick(0, 'background', 'Green');
        toggle('rule-0-bold');
        expect(previewCell().classList.contains('simple-html-grid-cell-bg-green')).toBe(true);
        expect(previewCell().classList.contains('simple-html-grid-cell-bold')).toBe(true);
        type('rule-0-value', '-20');
        expect(previewCell().className).toEqual('column-settings-preview-cell');
    });

    it('expect a lookup and a checkbox column to have a preview when they have rules: the label, the checkbox', async () => {
        const { datasource, gridInterface } = await mount();
        datasource.setRowAsCurrentEntity(0);

        gridInterface.openColumnSettings('status');
        expect(previewCell()).toBeNull();
        byId('rules-add').click();
        type('rule-0-value', 'waiting');
        expect(previewCell().textContent?.trim()).toEqual('Waiting');
        expect(previewCell().classList.contains('simple-html-grid-cell-bg-red')).toBe(true);

        gridInterface.openColumnSettings('active');
        byId('rules-add').click();
        expect((previewCell().querySelector('input') as HTMLInputElement).checked).toBe(true);
        expect(previewCell().classList.contains('simple-html-grid-cell-bg-red')).toBe(true);
    });
});

describe('column settings - colour rules: Apply, Cancel, Reset', () => {
    it('expect Apply to colour the cells, Cancel to apply nothing', async () => {
        const { element, gridInterface } = await mount();
        gridInterface.openColumnSettings('name');
        byId('rules-add').click();
        type('rule-0-value', 'bob');
        pick(0, 'color', 'Blue');
        pick(0, 'background', 'None');

        button('Cancel').click();
        expect(gridInterface.getState().formats.name).toBeUndefined();
        expect(cellOf(element, 1, 'name').classList.contains('simple-html-grid-cell-text-blue')).toBe(false);

        gridInterface.openColumnSettings('name');
        byId('rules-add').click();
        type('rule-0-value', 'bob');
        pick(0, 'color', 'Blue');
        pick(0, 'background', 'None');
        button('Apply & close').click();
        expect(dialog()).toBeNull();
        expect(gridInterface.getState().formats.name).toEqual({ rules: [{ operator: 'EQUAL', value: 'bob', color: 'blue' }] });
        expect(cellOf(element, 1, 'name').classList.contains('simple-html-grid-cell-text-blue')).toBe(true);
        expect(cellOf(element, 0, 'name').classList.contains('simple-html-grid-cell-text-blue')).toBe(false);
    });

    it("expect Reset column and Reset all to go back to the config's rules, in the dialog until Apply", async () => {
        const { gridInterface } = await mount();
        gridInterface.setState({
            formats: {
                balance: { rules: [{ operator: 'GREATER_THAN', value: '100', background: 'green' }] },
                name: { rules: [{ operator: 'IS_BLANK', background: 'grey' }] }
            }
        });
        gridInterface.openColumnSettings('balance');
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('100');

        button('Reset column').click();
        expect(byId<HTMLInputElement>('rule-0-value').value).toEqual('0');
        expect(pickedSwatch(0, 'color')).toEqual('Red');
        expect(gridInterface.getState().formats.balance?.rules?.[0].value).toEqual('100');

        option('name').click();
        expect(rules()).toHaveLength(1);
        button('Reset all').click();
        expect(rules()).toHaveLength(0);
        apply().click();
        expect(gridInterface.getState().formats).toEqual({ balance: { rules: START } });
    });

    it('expect the state saved as JSON to give the rules back, also in the dialog', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('born');
        byId('rules-add').click();
        pickOperator(0, 'BETWEEN');
        type('rule-0-from', '2026-01-01');
        pick(0, 'color', 'Purple');
        toggle('rule-0-bold');
        apply().click();
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));

        const other = await mount();
        other.gridInterface.setState(saved);
        expect(other.gridInterface.getState().formats.born).toEqual({
            rules: [{ operator: 'BETWEEN', value: ['2026-01-01', ''], color: 'purple', background: 'red', bold: true }]
        });
        other.gridInterface.openColumnSettings('born');
        expect(byId<HTMLInputElement>('rule-0-from').value).toEqual('2026-01-01');
        expect(pickedSwatch(0, 'color')).toEqual('Purple');
        expect(byId<HTMLInputElement>('rule-0-bold').checked).toBe(true);
    });
});

describe('column settings - colour rules: the rule open stays open', () => {
    it('expect the rule opened for its problem to stay open while the problem is typed away', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');
        byId('rules-add').click();
        // another column and back: the rule open is the one with a problem, the new one
        option('name').click();
        option('balance').click();
        expect(byId('rule-1-value')).not.toBeNull();
        expect(byId('rule-0-value')).toBeNull();
        type('rule-1-value', '5');
        // still the rule typed into, its input still there
        expect(byId<HTMLInputElement>('rule-1-value')?.value).toEqual('5');
        expect(byId('rule-0-value')).toBeNull();
    });

    it('expect Reset column to open the first of the rules it gives back', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('balance');
        byId('rules-add').click();
        expect(byId('rule-1-value')).not.toBeNull();
        button('Reset column').click();
        expect(rules()).toHaveLength(1);
        expect(byId<HTMLInputElement>('rule-0-value')?.value).toEqual('0');
    });
});
