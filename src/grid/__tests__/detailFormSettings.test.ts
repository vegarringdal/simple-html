// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { DetailForm, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * The grid config dialog (columnSettings.ts): its title, its tabs (gridConfigTabs.ts) - the WAI-ARIA
 * tabs pattern, the keys - and the Detail form tab (detailFormSettings.ts): Show the detail form, the
 * width, the list of the fields with its keys, Move up / Move down, Reset form, Apply and Cancel. The
 * Columns tab is columnSettings.test.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { name: 'Ann', notes: 'a\nb', city: 'Oslo', age: 30 },
    { name: 'Bob', notes: '', city: 'Bergen', age: 40 }
];

const fields = (): DatasourceOptions => ({ fields: { notes: { multiline: true }, age: 'number' } });

const config = (detailForm?: DetailForm): GridConfig => ({
    readonly: false,
    columns: { name: { label: 'Name' }, notes: { label: 'Notes' }, city: { label: 'City' }, age: { label: 'Age' } },
    // notes is a column of the config, not of the layout
    layout: { center: ['name', 'city', 'age'].map((field) => ({ fields: [field], width: 100 })) },
    detailForm
});

const mount = (detailForm?: DetailForm) => mountGrid(config(detailForm), rows(), fields());

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const tabs = () => Array.from(dialog().querySelectorAll<HTMLElement>('[role="tab"]'));
const panel = (id: string) => document.getElementById(id) as HTMLElement;
const shownPanel = () => Array.from(dialog().querySelectorAll<HTMLElement>('[role="tabpanel"]')).find((each) => !each.hidden);
const list = () => dialog().querySelector('.detail-form-settings-list') as HTMLElement;
const options = () => Array.from(list().querySelectorAll<HTMLElement>('[role="option"]'));
/** the options: checked (in the form, and its box shows ✓), the label, the type and the badges */
const optionTexts = () =>
    options().map((option) => {
        const box = option.querySelector('.detail-form-settings-box')?.textContent ?? '';
        expect(box).toEqual(option.getAttribute('aria-checked') === 'true' ? '✓' : '');
        const text = Array.from(option.children)
            .slice(1)
            .map((child) => child.textContent?.trim())
            .join(' ');
        return `${box ? '[x]' : '[ ]'} ${text}`;
    });
const picked = () => list().querySelector('[aria-selected="true"]') as HTMLElement;
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const show = () => dialog().querySelector('.detail-form-settings-show') as HTMLInputElement;
const width = () => dialog().querySelector('.detail-form-settings-width') as HTMLInputElement;

/** a keydown on an element, returns the event */
function press(target: Element, key: string, more: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more });
    target.dispatchEvent(event);
    return event;
}

const gear = (element: GridElement) => element.querySelector('.footer-settings') as HTMLButtonElement;

describe('grid config dialog - title and tabs', () => {
    it('expect the gear and the title to say Grid config, the Columns tab shown first', async () => {
        const { element } = await mount();
        expect(gear(element).getAttribute('aria-label')).toEqual('Grid config');
        gear(element).click();

        const title = document.getElementById(dialog().getAttribute('aria-labelledby') as string);
        expect(title?.textContent?.trim()).toEqual('Grid config');
        const tablist = dialog().querySelector('[role="tablist"]') as HTMLElement;
        expect(tablist.getAttribute('aria-labelledby')).toEqual(title?.id);
        expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Columns', 'Detail form']);
        expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual(['true', 'false']);
        expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1]);
        // each tab controls its panel, named by the tab
        for (const tab of tabs()) {
            const controlled = panel(tab.getAttribute('aria-controls') as string);
            expect(controlled.getAttribute('role')).toEqual('tabpanel');
            expect(controlled.getAttribute('aria-labelledby')).toEqual(tab.id);
        }
        expect(shownPanel()?.classList.contains('column-settings-body')).toBe(true);
        expect(panel(tabs()[1].getAttribute('aria-controls') as string).hidden).toBe(true);
        expect(list()).toBeNull();
    });

    it('expect a click and the arrows, Home and End to show a tab, the focus on it', async () => {
        const { gridInterface } = await mount();
        gridInterface.openColumnSettings();

        tabs()[1].click();
        expect(tabs()[1].getAttribute('aria-selected')).toEqual('true');
        expect(shownPanel()?.classList.contains('detail-form-settings')).toBe(true);
        // the footer: Reset form, not the resets of the columns
        expect(button('Reset form')).toBeDefined();
        expect(button('Reset column').closest('.column-settings-resets')?.hasAttribute('hidden')).toBe(true);

        tabs()[1].focus();
        expect(press(tabs()[1], 'ArrowRight').defaultPrevented).toBe(true);
        expect(tabs()[0].getAttribute('aria-selected')).toEqual('true');
        expect(document.activeElement).toBe(tabs()[0]);
        press(tabs()[0], 'ArrowLeft');
        expect(document.activeElement).toBe(tabs()[1]);
        press(tabs()[1], 'Home');
        expect(tabs()[0].getAttribute('aria-selected')).toEqual('true');
        press(tabs()[0], 'End');
        expect(tabs()[1].getAttribute('aria-selected')).toEqual('true');
        // the other keys are not the tabs'
        expect(press(tabs()[1], 'ArrowDown').defaultPrevented).toBe(false);
    });

    it('expect openDetailFormSettings() on the Detail form tab, openColumnSettings() on the Columns tab', async () => {
        const { gridInterface } = await mount();
        gridInterface.openDetailFormSettings();
        expect(tabs()[1].getAttribute('aria-selected')).toEqual('true');
        gridInterface.openColumnSettings('city');
        expect(tabs()[0].getAttribute('aria-selected')).toEqual('true');
        expect(dialog().querySelector('.column-settings-heading')?.textContent).toContain('City');
    });
});

describe('grid config dialog - the Detail form tab', () => {
    it('expect the form fields first in their order, then the layout, then the other columns - with their badges', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['age', 'notes'], width: 250 });
        gridInterface.openDetailFormSettings();

        expect(show().checked).toBe(true);
        expect(width().value).toEqual('250');
        expect(list().getAttribute('role')).toEqual('listbox');
        expect(document.getElementById(list().getAttribute('aria-labelledby') as string)?.textContent).toEqual(
            'Fields of the form'
        );
        expect(document.getElementById(list().getAttribute('aria-describedby') as string)?.textContent?.trim()).toContain(
            'Alt+↑'
        );
        expect(optionTexts()).toEqual([
            '[x] Age Number',
            '[x] Notes Text Several lines Hidden',
            '[ ] Name Text',
            '[ ] City Text'
        ]);
        expect(list().getAttribute('aria-activedescendant')).toEqual(options()[0].id);
    });

    it('expect the hint of the keys of a Mac on a Mac', async () => {
        const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
        try {
            const { gridInterface } = await mount();
            gridInterface.openDetailFormSettings();
            expect(document.getElementById(list().getAttribute('aria-describedby') as string)?.textContent).toContain('⌥↑');
        } finally {
            platform.mockRestore();
        }
    });

    it('expect the arrows to pick a field, Space to put it in the form, Alt+arrows to move it', async () => {
        const { gridInterface } = await mount({ show: false, fields: [] });
        gridInterface.openDetailFormSettings();
        expect(optionTexts()).toEqual([
            '[ ] Name Text',
            '[ ] City Text',
            '[ ] Age Number',
            '[ ] Notes Text Several lines Hidden'
        ]);

        press(list(), 'End');
        expect(picked().textContent).toContain('Notes');
        expect(press(list(), ' ').defaultPrevented).toBe(true);
        expect(press(list(), 'ArrowUp', { altKey: true }).defaultPrevented).toBe(true);
        press(list(), 'ArrowUp', { altKey: true });
        press(list(), 'ArrowUp', { altKey: true });
        // at the top already
        press(list(), 'ArrowUp', { altKey: true });
        press(list(), 'ArrowDown');
        press(list(), ' ');
        expect(optionTexts()).toEqual([
            '[x] Notes Text Several lines Hidden',
            '[x] Name Text',
            '[ ] City Text',
            '[ ] Age Number'
        ]);
        expect(picked().textContent).toContain('Name');
        press(list(), 'Home');
        expect(picked().textContent).toContain('Notes');
        press(list(), 'PageDown');
        expect(picked().textContent).toContain('Age');

        show().checked = true;
        show().dispatchEvent(new Event('change', { bubbles: true }));
        // nothing changes before Apply
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: [] });
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['notes', 'name'], width: 300 });
    });

    it('expect a click on the box to check a field, on the rest to pick it; Move up / Move down to move the one picked', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name'] });
        gridInterface.openDetailFormSettings();

        (options()[2].querySelector('.detail-form-settings-box') as HTMLElement).click();
        expect(optionTexts()[2]).toEqual('[x] Age Number');
        expect(picked().textContent).toContain('Age');
        // the first: Move up does nothing, it says so
        options()[0].click();
        expect(button('Move up').getAttribute('aria-disabled')).toEqual('true');
        button('Move down').click();
        button('Move down').click();
        expect(optionTexts().slice(0, 3)).toEqual(['[ ] City Text', '[x] Age Number', '[x] Name Text']);
        expect(button('Move up').getAttribute('aria-disabled')).toBeNull();
        button('Move up').click();
        expect(optionTexts().slice(0, 3)).toEqual(['[ ] City Text', '[x] Name Text', '[x] Age Number']);

        button('Apply & close').click();
        expect(dialog()).toBeNull();
        expect(gridInterface.getState().detailForm.fields).toEqual(['name', 'age']);
    });

    it('expect the width to be a number of px, at least 150 - anything else the width it had', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name'] });
        gridInterface.openDetailFormSettings();
        expect(width().value).toEqual('300');
        const set = (value: string) => {
            width().value = value;
            width().dispatchEvent(new Event('change', { bubbles: true }));
        };
        set('420.4');
        expect(width().value).toEqual('420');
        set('90');
        expect(width().value).toEqual('150');
        set('');
        expect(width().value).toEqual('150');
        set('360');
        button('Apply').click();
        expect(gridInterface.getState().detailForm.width).toEqual(360);
    });

    it('expect Cancel to change nothing, Reset form to go back to the form the grid starts with', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['city'] });
        gridInterface.setState({ detailForm: { show: false, fields: ['age', 'name'], width: 200 } });

        gridInterface.openDetailFormSettings();
        press(list(), ' ');
        button('Cancel').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: ['age', 'name'], width: 200 });

        gridInterface.openDetailFormSettings();
        expect(optionTexts().slice(0, 2)).toEqual(['[x] Age Number', '[x] Name Text']);
        button('Reset form').click();
        expect(show().checked).toBe(true);
        expect(width().value).toEqual('300');
        expect(optionTexts()[0]).toEqual('[x] City Text');
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['city'], width: 300 });
    });

    it('expect Apply to apply both tabs, and not to set a detail form that did not change', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['city'] });
        gridInterface.openColumnSettings('age');
        (dialog().querySelector('.column-settings-format') as HTMLElement).click();
        (document.querySelector('[data-menu-id="header.format.number.norwegian"]') as HTMLElement).click();
        tabs()[1].click();
        press(list(), 'ArrowDown');
        press(list(), ' ');

        const setState = vi.spyOn(gridInterface, 'setState');
        button('Apply').click();
        expect(gridInterface.getState().formats.age).toBeDefined();
        expect(gridInterface.getState().detailForm.fields).toEqual(['city', 'name']);

        setState.mockClear();
        button('Apply').click();
        // the formats are set again, the detail form is as it was
        expect(setState.mock.calls.some(([state]) => 'detailForm' in state)).toBe(false);
    });
});
