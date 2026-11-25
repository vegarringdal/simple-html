// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The Data bars, scales, icons of a number column in the grid config dialog (columnSettingsBars.ts): the
 * section on a number column only (not on a checkbox one), a checkbox each with what it starts with, the
 * swatches, the numbers typed - kept as text while they are typed - each problem holding Apply back,
 * the five cells of the preview and the row's preview, the badges, Apply, Reset column, Reset all and
 * the state as JSON. How it looks is in the browser check.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { id: 1, name: 'Ann', amount: 0, flag: 1 },
    { id: 2, name: 'Bob', amount: 100, flag: 0 },
    { id: 3, name: 'Cid', amount: 200, flag: 1 }
];

const fields = (): DatasourceOptions => ({ fields: { id: 'number', amount: 'number', flag: 'number' } });

const config = (more: GridConfig['columns'] = {}): GridConfig => ({
    readonly: false,
    columns: { amount: { label: 'Amount' }, flag: { format: { checkbox: {} } }, ...more },
    layout: { center: ['name', 'amount', 'flag'].map((field) => ({ fields: [field], width: 100 })) }
});

const mount = (more: GridConfig['columns'] = {}) => mountGrid(config(more), rows(), fields());

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const section = () => dialog().querySelector('.column-settings-bars') as HTMLElement | null;
/**
 * the panel of the Colours tab a part of the section is in (Data bar, Colour scale, Icons), opened when it
 * is closed: a number column shows one panel at a time
 */
function openPanelOf(part: string) {
    const kind = part.startsWith('bars-bar')
        ? 'bar'
        : part.startsWith('bars-scale')
          ? 'scale'
          : part.startsWith('bars-')
            ? 'icons'
            : null;
    if (!kind) {
        return;
    }
    const toggle = dialog().querySelector(`[id$="-settings-colours-${kind}"]`) as HTMLElement | null;
    if (toggle?.getAttribute('aria-expanded') === 'false') {
        toggle.click();
    }
}
const byId = <T extends HTMLElement = HTMLInputElement>(part: string) => {
    openPanelOf(part);
    return dialog().querySelector(`[id$="-settings-${part}"]`) as T;
};
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const option = (field: string) => dialog().querySelector(`[role="option"][data-field="${field}"]`) as HTMLElement;
const badges = (field: string) =>
    Array.from(option(field).querySelectorAll('.column-settings-badge'), (badge) => badge.textContent?.trim());
const problems = () =>
    Array.from(section()?.querySelectorAll('.column-settings-problem') ?? [], (problem) => problem.textContent?.trim());

/** turns a checkbox or a radio button of the dialog on, or a checkbox off, as a click */
function click(part: string) {
    const element = byId(part);
    element.checked = element.type === 'radio' ? true : !element.checked;
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

/** types into an input of the dialog, as the user */
function type(part: string, value: string) {
    const element = byId(part);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** picks a swatch of a row of swatches by its name */
function pick(part: string, name: string) {
    openPanelOf(part);
    const swatch = Array.from(dialog().querySelectorAll<HTMLInputElement>(`input[name$="-settings-${part}"]`)).find(
        (each) => each.getAttribute('aria-label') === name
    ) as HTMLInputElement;
    swatch.checked = true;
    swatch.dispatchEvent(new Event('change', { bubbles: true }));
}

/** the name of the swatch picked in a row of swatches */
const picked = (part: string) =>
    openPanelOf(part) ??
    Array.from(dialog().querySelectorAll<HTMLInputElement>(`input[name$="-settings-${part}"]`))
        .find((each) => each.checked)
        ?.getAttribute('aria-label');

/** the five cells of the preview: their numbers, bars, scale colours and icons */
const samples = () =>
    Array.from(dialog().querySelectorAll<HTMLElement>('.column-settings-bars-sample'), (cell) => ({
        text: cell.querySelector('.column-settings-bars-sample-text')?.textContent,
        bar: cell.classList.contains('simple-html-grid-cell-bar')
            ? cell.style.getPropertyValue('--simple-html-grid-bar-end')
            : null,
        scale: cell.classList.contains('simple-html-grid-cell-scale')
            ? cell.style.getPropertyValue('--simple-html-grid-scale-at')
            : null,
        icon: (cell.querySelector('.simple-html-grid-cell-icon') as HTMLElement | null)?.dataset.level ?? null
    }));

describe('the grid config dialog - data bars, scales, icons', () => {
    it('expect the section on a number column only - not a text column, not one shown as checkboxes', async () => {
        const { gridInterface } = await mount();

        gridInterface.openColumnSettings('amount');
        // the Colours tab: four panels, Colour rules open - each a line saying what it has
        const lines = Array.from(dialog().querySelectorAll('.column-settings-colour-panel-toggle'), (toggle) =>
            toggle.textContent?.replace(/\s+/g, ' ').trim()
        );
        expect(lines).toEqual(['▾ Colour rules No rules', '▸ Data bar Off', '▸ Colour scale Off', '▸ Icons Off']);
        openPanelOf('bars-bar');
        expect(section()?.querySelector('.column-settings-label')?.textContent).toBe('Data bars, scales, icons');
        expect(byId('bars-bar').checked).toBe(false);
        expect(byId('bars-scale').checked).toBe(false);
        expect(byId('bars-icons').checked).toBe(false);
        // nothing on: no parts, no preview cells
        expect(dialog().querySelectorAll('.column-settings-bars-part').length).toBe(0);
        expect(samples()).toEqual([]);

        option('name').click();
        expect(section()).toBeNull();
        option('flag').click();
        expect(section()).toBeNull();
    });

    it('expect each checkbox to start its part: a blue bar, red - yellow - green, the arrows - and the preview cells', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('amount');

        click('bars-bar');
        click('bars-scale');
        click('bars-icons');

        expect(picked('bars-bar-color')).toBe('Blue');
        expect([picked('bars-scale-min-color'), picked('bars-scale-mid-color'), picked('bars-scale-max-color')]).toEqual([
            'Red',
            'Yellow',
            'Green'
        ]);
        expect(byId('bars-set-arrows').checked).toBe(true);
        expect(byId('bars-unit-percent').checked).toBe(true);
        expect(byId('bars-position-before').checked).toBe(true);
        // empty numbers: Automatic, the thresholds' defaults as the placeholders
        expect(byId('bars-bar-min').placeholder).toBe('Automatic');
        expect(byId('bars-icons-low').placeholder).toBe('33');
        expect(byId('bars-icons-high').placeholder).toBe('67');
        // the five cells: 0 to 200 a quarter apart
        expect(dialog().querySelector('.column-settings-bars-samples .column-settings-preview-title')?.textContent?.trim()).toBe(
            'Lowest to highest of the rows, 0 to 200'
        );
        expect(samples()).toEqual([
            { text: '0', bar: '0%', scale: '0%', icon: 'low' },
            { text: '50', bar: '25%', scale: '50%', icon: 'low' },
            { text: '100', bar: '50%', scale: '100%', icon: 'middle' },
            { text: '150', bar: '75%', scale: '50%', icon: 'high' },
            { text: '200', bar: '100%', scale: '100%', icon: 'high' }
        ]);
        expect(badges('amount')).toEqual(['Bar', 'Scale', 'Icons']);
        // the row's preview (Ann, 0): its bar, scale colour and icon
        const preview = dialog().querySelector('.column-settings-preview .column-settings-preview-cell') as HTMLElement;
        expect(preview.classList.contains('simple-html-grid-cell-bar')).toBe(true);
        expect(preview.classList.contains('simple-html-grid-cell-scale')).toBe(true);
        expect((preview.querySelector('.simple-html-grid-cell-icon') as HTMLElement).dataset.level).toBe('low');
    });

    it('expect Apply to set the format of the state - as JSON - the cells to have it, a turned off part to leave it', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('amount');

        click('bars-bar');
        pick('bars-bar-color', 'Green');
        type('bars-bar-max', '400');
        click('bars-scale');
        pick('bars-scale-mid-color', 'None');
        type('bars-scale-min', '-10,5');
        // the number as it was typed while it is typed
        expect(byId('bars-scale-min').value).toBe('-10,5');
        click('bars-icons');
        click('bars-set-traffic');
        type('bars-icons-low', '10');
        click('bars-unit-number');
        click('bars-position-after');
        click('bars-reverse');
        button('Apply').click();

        const formats = JSON.parse(JSON.stringify(gridInterface.getState().formats));
        expect(formats.amount).toEqual({
            bar: { color: 'green', max: 400 },
            scale: { minColor: 'red', maxColor: 'green', min: -10.5 },
            icons: { set: 'traffic', thresholds: [10, 67], unit: 'number', reverse: true, position: 'after' }
        });
        // applied: the number of the format
        expect(byId('bars-scale-min').value).toBe('-10.5');
        // the midpoint is off without a middle colour
        expect(byId('bars-scale-mid').disabled).toBe(true);

        // a part turned off is left out
        click('bars-scale');
        click('bars-icons');
        button('Apply').click();
        expect(gridInterface.getState().formats.amount).toEqual({ bar: { color: 'green', max: 400 } });
    });

    it('expect each problem said under the section, the column marked Error and Apply held back', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('amount');
        click('bars-bar');
        click('bars-scale');
        click('bars-icons');
        const applies = () => {
            button('Apply').click();
            return gridInterface.getState().formats.amount !== undefined;
        };

        type('bars-bar-min', 'x');
        expect(problems()).toEqual(['x is no number']);
        expect(byId('bars-bar-min').getAttribute('aria-invalid')).toBe('true');
        expect(byId('bars-bar-min').value).toBe('x');
        expect(badges('amount')).toEqual(['Error']);
        expect(applies()).toBe(false);

        type('bars-bar-min', '5');
        type('bars-bar-max', '5');
        expect(problems()).toEqual(['The min is not below the max']);
        type('bars-bar-max', '');
        type('bars-scale-max', '10');
        type('bars-scale-mid', '20');
        expect(problems()).toEqual(['The midpoint is not between the min and the max']);
        type('bars-scale-mid', '');
        type('bars-icons-low', '80');
        type('bars-icons-high', '20');
        expect(problems()).toEqual(['The first threshold is above the second']);
        type('bars-icons-high', '120');
        expect(problems()).toEqual(['In % of the range the thresholds are 0 to 100']);
        expect(applies()).toBe(false);
        // values: any numbers
        click('bars-unit-number');
        expect(problems()).toEqual([]);
        expect(applies()).toBe(true);
    });

    it('expect Reset column and Reset all to go back to the config, the numbers typed too', async () => {
        const { gridInterface } = await mount({ amount: { label: 'Amount', format: { bar: { color: 'red' } } } });
        gridInterface.openColumnSettings('amount');
        expect(picked('bars-bar-color')).toBe('Red');

        type('bars-bar-min', 'x');
        click('bars-icons');
        button('Reset column').click();
        expect(byId('bars-bar-min').value).toBe('');
        expect(byId('bars-icons').checked).toBe(false);
        expect(problems()).toEqual([]);

        type('bars-bar-max', 'y');
        button('Reset all').click();
        expect(byId('bars-bar-max').value).toBe('');
        expect(picked('bars-bar-color')).toBe('Red');
    });

    it('expect a custom colour from the picker, its tint in the preview', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings('amount');
        click('bars-bar');

        type('bars-bar-color-custom', '#ff0000');
        expect(picked('bars-bar-color')).toBeUndefined();
        const sample = dialog().querySelectorAll<HTMLElement>('.column-settings-bars-sample')[4];
        expect(sample.style.getPropertyValue('--simple-html-grid-bar-color')).toBe('light-dark(#ffcccc, #330000)');
        button('Apply').click();
        expect(gridInterface.getState().formats.amount).toEqual({ bar: { color: '#ff0000' } });
    });

    it('expect a column without numbers in the rows to say so in place of the five cells', async () => {
        const { gridInterface } = await mountGrid(
            config(),
            rows().map((row) => ({ ...row, amount: null })),
            fields()
        );
        gridInterface.openColumnSettings('amount');
        click('bars-bar');

        expect(samples()).toEqual([]);
        expect(dialog().querySelector('.column-settings-bars-samples-none')?.textContent?.trim()).toBe(
            'No numbers in the rows: nothing to draw yet'
        );
    });
});
