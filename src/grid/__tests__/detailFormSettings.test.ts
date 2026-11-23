// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { DetailForm, DetailFormSection, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import {
    addSection,
    type DetailFormDraft,
    removeSection,
    setFieldOption,
    setSectionOption,
    setWidths
} from '../gridFunctions/detailFormSettings';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { pointerEvent } from './interactionTestHelpers';

/**
 * The grid config dialog (columnSettings.ts): its title, its tabs (gridConfigTabs.ts) - the WAI-ARIA
 * tabs pattern, the keys - and the Detail form tab (detailFormSettings.ts): Show the detail form,
 * Expanded, the width with its min and max, the list of the fields with its keys and drag handles, Move
 * up / Move down, Reset form, Apply and Cancel. The Columns tab is columnSettings.test.ts.
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
// the dialog's own tabs and panels: the Columns tab has the tabs of a column's settings in it
const tabs = () => Array.from(dialog().querySelectorAll<HTMLElement>(':scope > [role="tablist"] [role="tab"]'));
const panel = (id: string) => document.getElementById(id) as HTMLElement;
const shownPanel = () =>
    Array.from(dialog().querySelectorAll<HTMLElement>(':scope > [role="tabpanel"]')).find((each) => !each.hidden);
const list = () => dialog().querySelector('.detail-form-settings-list') as HTMLElement;
const options = () => Array.from(list().querySelectorAll<HTMLElement>('[role="option"]'));
/** the options: checked (in the form, and its box shows ✓), the label, the type and the badges - the drag handle has no text */
const optionTexts = () =>
    options().map((option) => {
        const box = option.querySelector('.detail-form-settings-box')?.textContent ?? '';
        expect(box).toEqual(option.getAttribute('aria-checked') === 'true' ? '✓' : '');
        const text = Array.from(option.children)
            .slice(1)
            .map((child) => child.textContent?.trim())
            .filter(Boolean)
            .join(' ');
        return `${box ? '[x]' : '[ ]'} ${text}`;
    });
const picked = () => list().querySelector('[aria-selected="true"]') as HTMLElement;
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const show = () => dialog().querySelector('.detail-form-settings-show') as HTMLInputElement;
const expanded = () => dialog().querySelector('.detail-form-settings-expanded') as HTMLInputElement;
const width = () => dialog().querySelector('.detail-form-settings-width') as HTMLInputElement;
const minWidth = () => dialog().querySelector('.detail-form-settings-minWidth') as HTMLInputElement;
const maxWidth = () => dialog().querySelector('.detail-form-settings-maxWidth') as HTMLInputElement;
/** the drag handle of an option */
const handle = (at: number) => options()[at].querySelector('.detail-form-settings-handle') as HTMLElement;

/** types a value into a number input of the tab, as its change event does */
function setValue(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Lays the options out under each other, 20px each from the top of the window: happy-dom lays nothing
 * out, a drag reads where they are
 */
function layOutOptions() {
    options().forEach((option, at) => {
        option.getBoundingClientRect = () =>
            ({ top: at * 20, bottom: at * 20 + 20, height: 20, left: 0, right: 400, width: 400, x: 0, y: at * 20 }) as DOMRect;
    });
}

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

describe('grid config dialog - Expanded, the min and max width', () => {
    it('expect Expanded to be what the form is now - the button of its title changes it too - and Apply to collapse it', async () => {
        const { element, gridInterface } = await mount({ show: true, fields: ['name'] });
        gridInterface.openDetailFormSettings();
        expect(expanded().checked).toBe(true);
        expect(document.getElementById(expanded().getAttribute('aria-describedby') as string)?.textContent).toContain(
            'narrow strip'
        );
        expanded().checked = false;
        expanded().dispatchEvent(new Event('change', { bubbles: true }));
        button('Apply & close').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['name'], width: 300, expanded: false });

        // the button of the form's title: expanded again, the dialog shows it
        (element.querySelector('.simple-html-grid-detail-form-toggle') as HTMLElement).click();
        gridInterface.openDetailFormSettings();
        expect(expanded().checked).toBe(true);
        // expanded is the default: left out of what Apply sets
        expanded().checked = true;
        show().checked = false;
        show().dispatchEvent(new Event('change', { bubbles: true }));
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: false, fields: ['name'], width: 300 });
    });

    it('expect the min and max empty when they are none - 150 and None their placeholders - and set on Apply', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name'], width: 320, minWidth: 200 });
        gridInterface.openDetailFormSettings();
        expect([width().value, minWidth().value, maxWidth().value]).toEqual(['320', '200', '']);
        expect([minWidth().placeholder, maxWidth().placeholder]).toEqual(['150', 'None']);
        for (const input of [width(), minWidth(), maxWidth()]) {
            expect(document.getElementById(input.id === '' ? '' : input.id)).toBe(input);
            expect(dialog().querySelector(`label[for="${input.id}"]`)?.textContent).toMatch(/width \(px\)/i);
        }
        setValue(maxWidth(), '500');
        setValue(minWidth(), '');
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['name'], width: 320, maxWidth: 500 });
    });

    it('expect each width at least 150, the width kept between the min and the max: the one typed keeps its value, the others follow', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name'] });
        gridInterface.openDetailFormSettings();
        const widths = () => [width().value, minWidth().value, maxWidth().value];

        setValue(minWidth(), '100');
        expect(widths()).toEqual(['300', '150', '']);
        // a min over the width: the width follows
        setValue(minWidth(), '400');
        expect(widths()).toEqual(['400', '400', '']);
        // a max under the min and the width: both follow
        setValue(maxWidth(), '350');
        expect(widths()).toEqual(['350', '350', '350']);
        setValue(maxWidth(), '600');
        setValue(minWidth(), '200');
        expect(widths()).toEqual(['350', '200', '600']);
        // a width outside them: kept between them
        setValue(width(), '900');
        expect(widths()).toEqual(['600', '200', '600']);
        setValue(width(), '180');
        expect(widths()).toEqual(['200', '200', '600']);
        // a min over the max: the max follows
        setValue(minWidth(), '700');
        expect(widths()).toEqual(['700', '700', '700']);
        // empty: none
        setValue(maxWidth(), '');
        setValue(minWidth(), '');
        expect(widths()).toEqual(['700', '', '']);
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['name'], width: 700 });
    });

    it('expect what is no number to leave the widths as they were, an empty width too (setWidths)', () => {
        const draft: DetailFormDraft = {
            show: true,
            expanded: true,
            width: 300,
            minWidth: 200,
            maxWidth: 400,
            order: [],
            included: new Set(),
            active: '',
            options: {}
        };
        for (const part of ['width', 'minWidth', 'maxWidth'] as const) {
            setWidths(draft, part, 'wide');
            setWidths(draft, part, '-5');
        }
        setWidths(draft, 'width', '');
        expect([draft.width, draft.minWidth, draft.maxWidth]).toEqual([300, 200, 400]);
        setWidths(draft, 'width', '333.6');
        expect(draft.width).toEqual(334);
    });

    it('expect Reset form to give the min and max of the form the grid starts with, Cancel to keep them', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name'], minWidth: 180, maxWidth: 420 });
        gridInterface.openDetailFormSettings();
        setValue(maxWidth(), '');
        button('Cancel').click();
        expect(gridInterface.getState().detailForm.maxWidth).toEqual(420);

        gridInterface.setState({ detailForm: { show: true, fields: ['name'], width: 250 } });
        gridInterface.openDetailFormSettings();
        expect([minWidth().value, maxWidth().value]).toEqual(['', '']);
        button('Reset form').click();
        expect([width().value, minWidth().value, maxWidth().value]).toEqual(['300', '180', '420']);
    });
});

describe('grid config dialog - a field dragged by its handle', () => {
    it('expect a drag handle at the right of each field - hidden from a screen reader, with a tooltip - the hint saying so', async () => {
        const { gridInterface } = await mount();
        gridInterface.openDetailFormSettings();
        for (const option of options()) {
            const last = option.lastElementChild as HTMLElement;
            expect(last.classList.contains('simple-html-grid-drag-handle')).toBe(true);
            expect(last.getAttribute('aria-hidden')).toEqual('true');
            expect(last.getAttribute('data-tooltip')).toEqual('Drag to move it');
            expect(last.querySelector('svg')).not.toBeNull();
        }
        expect(document.getElementById(list().getAttribute('aria-describedby') as string)?.textContent).toContain(
            'drag it by its handle'
        );
    });

    it('expect a drag to show a line where the field goes and to move it there when it is let go - picked', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'city'] });
        gridInterface.openDetailFormSettings();
        layOutOptions();
        expect(optionTexts()).toEqual([
            '[x] Name Text',
            '[x] City Text',
            '[ ] Age Number',
            '[ ] Notes Text Several lines Hidden'
        ]);

        handle(0).dispatchEvent(pointerEvent('pointerdown', { clientX: 390, clientY: 10 }));
        // picked as it is pressed
        expect(picked().textContent).toContain('Name');
        expect(options()[0].classList.contains('detail-form-settings-dragged')).toBe(true);
        // over the lower half of Age: after it, before Notes
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 390, clientY: 55 }));
        expect(options()[3].classList.contains('detail-form-settings-drop-before')).toBe(true);
        expect(list().querySelectorAll('.detail-form-settings-drop-before, .detail-form-settings-drop-after')).toHaveLength(1);
        // under the last: a line under it
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 390, clientY: 75 }));
        expect(options()[3].classList.contains('detail-form-settings-drop-after')).toBe(true);
        document.dispatchEvent(pointerEvent('pointermove', { clientX: 390, clientY: 55 }));
        document.dispatchEvent(pointerEvent('pointerup', { clientX: 390, clientY: 55 }));

        expect(optionTexts()).toEqual([
            '[x] City Text',
            '[ ] Age Number',
            '[x] Name Text',
            '[ ] Notes Text Several lines Hidden'
        ]);
        expect(picked().textContent).toContain('Name');
        expect(list().querySelectorAll('.detail-form-settings-dragged, .detail-form-settings-drop-before')).toHaveLength(0);
        button('Apply').click();
        expect(gridInterface.getState().detailForm.fields).toEqual(['city', 'name']);
    });

    it('expect a drag up, a drop where the field was and pointercancel - nothing moved by the last two', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'city'] });
        gridInterface.openDetailFormSettings();
        layOutOptions();
        const drag = (from: number, y: number, end: 'pointerup' | 'pointercancel' = 'pointerup') => {
            handle(from).dispatchEvent(pointerEvent('pointerdown', { clientX: 390, clientY: from * 20 + 10 }));
            document.dispatchEvent(pointerEvent('pointermove', { clientX: 390, clientY: y }));
            document.dispatchEvent(pointerEvent(end, { clientX: 390, clientY: y }));
        };
        // Notes over the upper half of Name: first
        drag(3, 25);
        expect(optionTexts()[1]).toEqual('[ ] Notes Text Several lines Hidden');
        expect(picked().textContent).toContain('Notes');
        // on itself, just under its own top: no line, nothing moved
        drag(1, 22);
        expect(list().querySelectorAll('.detail-form-settings-drop-before')).toHaveLength(0);
        drag(0, 70, 'pointercancel');
        expect(optionTexts()).toEqual([
            '[x] Name Text',
            '[ ] Notes Text Several lines Hidden',
            '[x] City Text',
            '[ ] Age Number'
        ]);
    });

    it('expect a click on the handle not to pick another field, the keys and Move up / Move down still to move', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'city'] });
        gridInterface.openDetailFormSettings();
        handle(2).click();
        // the click picks nothing: the press did (none here)
        expect(picked().textContent).toContain('Name');
        press(list(), 'ArrowDown', { altKey: true });
        button('Move down').click();
        expect(optionTexts().slice(0, 3)).toEqual(['[x] City Text', '[ ] Age Number', '[x] Name Text']);
    });
});

describe('the Detail form tab - sections and the settings of the entry picked', () => {
    const input = (name: string) => dialog().querySelector(`.detail-form-settings-${name}`) as HTMLInputElement | null;
    const heading = () => dialog().querySelector('.detail-form-settings-field > .column-settings-label')?.textContent?.trim();

    it("expect a field's settings: Min lines on a field of several lines only, Space above / below", async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'notes'] });
        gridInterface.openDetailFormSettings();
        expect(picked().dataset.field).toBe('name');
        expect(heading()).toBe('Settings of Name in the form');
        expect([!!input('minRows'), !!input('paddingTop'), !!input('paddingBottom'), !!input('section-name')]).toEqual([
            false,
            true,
            true,
            false
        ]);
        press(list(), 'ArrowDown');
        expect(heading()).toBe('Settings of Notes in the form');
        expect(input('minRows')?.placeholder).toBe('3');
        setValue(input('minRows') as HTMLInputElement, '5');
        setValue(input('paddingTop') as HTMLInputElement, '10.4');
        setValue(input('paddingBottom') as HTMLInputElement, 'x');
        button('Apply').click();
        expect(gridInterface.getState().detailForm.fieldOptions).toEqual({ notes: { minRows: 5, paddingTop: 10 } });
    });

    it('expect Add section under the entry picked, picked, its settings; fields moved under it are in it', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'notes'] });
        gridInterface.openDetailFormSettings();
        button('Add section').click();
        expect(optionTexts().slice(0, 3)).toEqual([
            '[x] Name Text',
            '[ ] Section Section',
            '[x] Notes Text Several lines Hidden'
        ]);
        expect(picked().dataset.section).toBe('Section');
        expect(heading()).toBe('Settings of the section Section');
        setValue(input('section-name') as HTMLInputElement, '  Address ');
        (input('panel') as HTMLInputElement).click();
        (input('collapsed') as HTMLInputElement).click();
        setValue(input('sectionPaddingTop') as HTMLInputElement, '8');
        expect(optionTexts()[1]).toBe('[ ] Address Section Panel');
        // a section is no field: Space does not take it out, it has no box
        press(list(), ' ');
        expect(options()[1].hasAttribute('aria-checked')).toBe(false);
        // City under it: Alt+ArrowUp from below it, then put in the form
        press(list(), 'End');
        while (picked().dataset.field !== 'city') {
            press(list(), 'ArrowUp');
        }
        press(list(), ' ');
        for (let i = 0; i < 10 && options()[2].dataset.field !== 'city'; i++) {
            press(list(), 'ArrowUp', { altKey: true });
        }
        button('Apply').click();
        expect(gridInterface.getState().detailForm.fields).toEqual([
            'name',
            { section: 'Address', panel: true, collapsed: true, paddingTop: 8 },
            'city',
            'notes'
        ]);
    });

    it('expect Remove section to take it out, its fields staying where they were', async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', { section: 'S' }, 'notes'] });
        gridInterface.openDetailFormSettings();
        press(list(), 'ArrowDown');
        expect(picked().dataset.section).toBe('S');
        button('Remove section').click();
        expect(picked().dataset.field).toBe('notes');
        button('Apply').click();
        expect(gridInterface.getState().detailForm.fields).toEqual(['name', 'notes']);
    });

    it("expect a field's options taken out of the form left out on Apply", async () => {
        const { gridInterface } = await mount({ show: true, fields: ['name', 'notes'], fieldOptions: { notes: { minRows: 4 } } });
        gridInterface.openDetailFormSettings();
        press(list(), 'ArrowDown');
        expect(input('minRows')?.value).toBe('4');
        press(list(), ' ');
        button('Apply').click();
        expect(gridInterface.getState().detailForm).toEqual({ show: true, fields: ['name'], width: 300 });
    });

    it('expect the setters to clear what is empty or does not fit', () => {
        const draft = { options: {}, order: ['a'], included: new Set(['a']), active: '' } as unknown as DetailFormDraft;
        setFieldOption(draft, 'a', 'minRows', '31');
        setFieldOption(draft, 'a', 'paddingTop', '0');
        expect(draft.options).toEqual({});
        setFieldOption(draft, 'a', 'minRows', '1');
        expect(draft.options).toEqual({ a: { minRows: 1 } });
        setFieldOption(draft, 'a', 'minRows', '');
        expect(draft.options).toEqual({});

        addSection(draft, 'New');
        expect(draft.order).toEqual(['a', { section: 'New' }]);
        const section = draft.order[1] as DetailFormSection;
        setSectionOption(section, 'section', '   ');
        setSectionOption(section, 'panel', true);
        setSectionOption(section, 'paddingBottom', '4');
        expect(section).toEqual({ section: 'New', panel: true, paddingBottom: 4 });
        setSectionOption(section, 'panel', false);
        setSectionOption(section, 'paddingBottom', '');
        expect(section).toEqual({ section: 'New' });
        removeSection(draft, section);
        expect([draft.order, draft.active]).toEqual([['a'], 'a']);
    });
});
