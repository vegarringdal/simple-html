// @vitest-environment happy-dom

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { MENU_IDS } from '../gridMenus';
import { registerLookup } from '../lookup';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf, menuEntry, openLabelMenu } from './interactionTestHelpers';

/**
 * The column settings dialog (columnSettings.ts) and the gear that opens it (rebuildFooter.ts): the
 * button in the footer and its option, the header menu's Column settings…, gridInterface.openColumnSettings();
 * the list of the columns and its keys, the settings of each type - the format picker of a date and a
 * number column (the entries of Format ›), the template and the link of a text column, none for a checkbox
 * and a lookup column - the preview, the field menu of a template, the problems that hold Apply back, and
 * Apply, Apply & close, Cancel, Reset column, Reset all. happy-dom has the dialog's showModal() and close(),
 * not the browser's focus around them (see filterEditor.test.ts): the browser check has those.
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
CODES.setData([{ code: 1, label: 'One' }]);
registerLookup('settings-test-codes', { datasource: CODES, valueField: 'code', labelField: 'label' });

const LAYOUT = ['name', 'company', 'born', 'updated', 'balance', 'active', 'code'];

// id is no column: a field of the rows only
const rows = () => [
    {
        id: 12,
        name: 'Ann',
        company: 'Acme & Co',
        born: new Date(2026, 10, 22),
        updated: new Date(2026, 10, 22, 13, 45),
        balance: 1234.5,
        active: true,
        code: 1
    },
    { id: 13, name: 'Bob', company: '', born: null, updated: null, balance: 0, active: false, code: null }
];

const fields = (): DatasourceOptions => ({
    fields: { id: 'number', born: 'date', updated: 'datetime', balance: 'number', active: 'boolean', code: 'number' }
});

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: {
        name: { label: 'Name' },
        company: { label: 'Company' },
        born: { label: 'Born', format: { date: 'norwegian' } },
        code: { label: 'Code', editor: { type: 'select', lookup: 'settings-test-codes' } }
    },
    layout: { center: LAYOUT.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const dialog = () => document.querySelector('dialog.column-settings') as HTMLDialogElement;
const options = () => Array.from(dialog().querySelectorAll<HTMLElement>('[role="option"]'));
const selected = () => dialog().querySelector('[role="option"][aria-selected="true"]') as HTMLElement;
const list = () => dialog().querySelector('[role="listbox"]') as HTMLElement;
const heading = () => dialog().querySelector('.column-settings-heading')?.textContent?.replace(/\s+/g, ' ').trim();
const input = (part: string) => dialog().querySelector(`input[id$="-settings-${part}"]`) as HTMLInputElement | null;
const checkboxes = () => Array.from(dialog().querySelectorAll<HTMLInputElement>('.column-settings-check input'));
const button = (text: string) =>
    Array.from(dialog().querySelectorAll<HTMLButtonElement>('button')).find(
        (each) => each.textContent?.trim() === text
    ) as HTMLButtonElement;
const problems = () =>
    Array.from(dialog().querySelectorAll('.column-settings-problem'), (problem) => problem.textContent?.trim());
const previewCell = () => dialog().querySelector('.column-settings-preview-cell') as HTMLElement;
const picker = () => dialog().querySelector('.column-settings-format') as HTMLButtonElement;

/** types a template, as the user: the value, then its input event */
function type(part: string, value: string) {
    const element = input(part) as HTMLInputElement;
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** turns a checkbox on or off, as a click: checked, then its change event */
function toggle(index: number) {
    const checkbox = checkboxes()[index];
    checkbox.checked = !checkbox.checked;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

/** a keydown on an element, returns the event */
function press(target: Element, key: string) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

const gear = (element: GridElement) => element.querySelector('.footer-settings') as HTMLButtonElement | null;

describe('column settings - the gear in the footer', () => {
    it('expect a button at the end of the footer, named and with a tooltip, that says it opens a dialog', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const settings = gear(element) as HTMLButtonElement;

        expect(settings.tagName).toEqual('BUTTON');
        expect(settings.type).toEqual('button');
        expect(settings.getAttribute('aria-label')).toEqual('Grid config');
        expect(settings.getAttribute('title')).toEqual('Grid config');
        expect(settings.getAttribute('aria-haspopup')).toEqual('dialog');
        // the icon is decoration
        expect(settings.querySelector('svg')?.getAttribute('aria-hidden')).toEqual('true');
        // the last of the footer, after "No filter" (the last stop of Tab, see accessibility.test.ts)
        const buttons = Array.from(element.querySelectorAll('.simple-html-grid-footer button'));
        expect(buttons.at(-1)).toBe(settings);
        // the footer keeps room for it: the filter's row stays in the middle
        expect(element.querySelector('.footer-inner')?.classList.contains('has-settings')).toBe(true);
    });

    it('expect no button with settingsButton: false, nor in a footer of no height; updateConfig() turns it on', async () => {
        const { element, gridInterface } = await mountGrid(config({ settingsButton: false }), rows(), fields());
        expect(gear(element)).toBeNull();
        expect(element.querySelector('.footer-inner')?.classList.contains('has-settings')).toBe(false);

        gridInterface.updateConfig({ settingsButton: undefined });
        expect(gear(element)).not.toBeNull();
        gridInterface.updateConfig({ footerHeight: 0 });
        expect(gear(element)).toBeNull();
    });

    it('expect a click to open the dialog on the column of the cell that had the focus', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        const cell = element.querySelector('input[data-attribute="balance"]') as HTMLInputElement;
        cell.focus();
        // the press of the click: the grid remembers the cell with the focus then
        (gear(element) as HTMLButtonElement).dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })
        );
        (gear(element) as HTMLButtonElement).click();

        expect(dialog().open).toBe(true);
        expect(heading()).toEqual('Balance Number');
    });

    it('expect the first column without a cell with the focus', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        (gear(element) as HTMLButtonElement).click();

        expect(heading()).toEqual('Name Text');
    });
});

describe('column settings - opening and closing', () => {
    it('expect Column settings… in the header menu, opening it on that column', async () => {
        const { element } = await mountGrid(config(), rows(), fields());
        expect(MENU_IDS.header).toContain('header.settings');

        openLabelMenu(element, 'company');
        menuEntry('header.settings').click();

        expect(dialog().open).toBe(true);
        expect(heading()).toEqual('Company Text');
        expect(selected().textContent).toContain('Company');
    });

    it('expect openColumnSettings() on a column, the first for a field that is no column, nothing without a grid', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());

        gridInterface.openColumnSettings('born');
        expect(heading()).toEqual('Born Date');
        gridInterface.openColumnSettings('nothing');
        expect(heading()).toEqual('Name Text');
        // open already: the same dialog, started again
        expect(document.querySelectorAll('dialog.column-settings')).toHaveLength(1);

        const datasource = new Datasource();
        const { GridInterface } = await import('../gridInterface');
        expect(() => new GridInterface(config({ columns: {} }), datasource).openColumnSettings()).not.toThrow();
    });

    it('expect a modal dialog named by its title, the focus on the dialog itself, of the filter editor look', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');

        gridInterface.openColumnSettings();

        expect(showModal).toHaveBeenCalledTimes(1);
        expect(dialog().classList.contains('filter-editor-content')).toBe(true);
        expect(dialog().hasAttribute('autofocus')).toBe(true);
        expect(document.activeElement).toBe(dialog());
        const title = document.getElementById(dialog().getAttribute('aria-labelledby') as string);
        expect(title?.textContent?.trim()).toEqual('Grid config');
        expect(dialog().querySelectorAll('.simple-html-resize-handle')).toHaveLength(8);
        showModal.mockRestore();
    });

    it('expect Cancel, the ✕ and a close by the browser (Esc) to take it off the page without applying', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        const before = gridInterface.getState().formats;

        for (const close of [
            () => button('Cancel').click(),
            () => (dialog().querySelector('.filter-editor-close') as HTMLElement).click(),
            () => dialog().close()
        ]) {
            gridInterface.openColumnSettings('name');
            type('text', '{name}!');
            close();
            expect(dialog()).toBeNull();
            expect(gridOf(element).columnSettings).toBeNull();
        }
        expect(gridInterface.getState().formats).toEqual(before);
    });

    it('expect the dialog closed when the grid leaves the page', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings();
        element.remove();
        expect(dialog()).toBeNull();
    });
});

describe('column settings - the list of the columns', () => {
    it('expect the columns of the layout in their order, each with its type and what it has set', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings();

        expect(list().getAttribute('aria-label')).toEqual('Columns');
        expect(options().map((option) => option.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
            'Name Text',
            'Company Text',
            'Born Date Format',
            'Updated Date and time',
            'Balance Number',
            'Active Checkbox',
            'Code Lookup'
        ]);
        expect(list().getAttribute('aria-activedescendant')).toEqual(options()[0].id);
        expect(options()[0].getAttribute('aria-selected')).toEqual('true');
    });

    it('expect a column pinned as a copy (in the layout twice) once in the list', async () => {
        const pinned = config();
        pinned.layout = { ...pinned.layout, left: [{ fields: ['company'], width: 100 }] };
        const { gridInterface } = await mountGrid(pinned, rows(), fields());
        gridInterface.openColumnSettings('company');

        expect(options().filter((option) => option.dataset.field === 'company')).toHaveLength(1);
        expect(options()).toHaveLength(LAYOUT.length);
        expect(selected().dataset.field).toEqual('company');
    });

    it('expect the arrows, Home, End, PageDown and a letter to pick a column, a click too', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings();

        expect(press(list(), 'ArrowDown').defaultPrevented).toBe(true);
        expect(heading()).toEqual('Company Text');
        press(list(), 'End');
        expect(heading()).toEqual('Code Lookup');
        press(list(), 'ArrowDown');
        expect(heading()).toEqual('Code Lookup');
        press(list(), 'Home');
        expect(heading()).toEqual('Name Text');
        press(list(), 'ArrowUp');
        expect(heading()).toEqual('Name Text');
        press(list(), 'PageDown');
        expect(heading()).toEqual('Code Lookup');
        // a letter: the next column whose label starts with it, around the end
        press(list(), 'b');
        expect(heading()).toEqual('Born Date');
        press(list(), 'b');
        expect(heading()).toEqual('Balance Number');
        expect(press(list(), 'x').defaultPrevented).toBe(false);
        expect(list().getAttribute('aria-activedescendant')).toEqual(selected().id);

        options()[5].click();
        expect(heading()).toEqual('Active Checkbox');
    });
});

describe('column settings - the settings of each type', () => {
    it('expect a date column: its format in the picker, the entries of Format › in its menu, the preview', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('born');

        expect(picker().textContent?.trim()).toEqual('Norwegian');
        expect(picker().getAttribute('aria-label')).toEqual('Format: Norwegian');
        expect(previewCell().textContent?.trim()).toEqual('22.11.2026');

        picker().click();
        // the menu is in the dialog (a modal dialog makes the page inert)
        expect(dialog().querySelector('[data-menu-id="header.format.date.weekIso"]')).not.toBeNull();
        menuEntry('header.format.date.weekIso').click();

        expect(picker().textContent?.trim()).toEqual('Week, ISO');
        expect(previewCell().textContent?.trim()).toEqual('2026-W47');
        // not applied yet
        expect(gridInterface.getState().formats.born).toEqual({ date: 'norwegian' });
    });

    it('expect a number column: the example of its format in the picker, Default without one', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('balance');

        expect(picker().textContent?.trim()).toEqual('Default');
        expect(previewCell().textContent?.trim()).toEqual('1234.5');
        picker().click();
        menuEntry('header.format.number.norwegian').click();

        expect(picker().textContent?.trim()).toEqual('1 234 567,891');
        expect(previewCell().textContent?.trim()).toEqual('1 234,5');
        expect(selected().textContent).toContain('Format');
    });

    it('expect a checkbox and a lookup column to have no settings and no preview', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());

        gridInterface.openColumnSettings('active');
        expect(dialog().querySelector('.column-settings-none')?.textContent?.trim()).toEqual('A checkbox column has no settings');
        expect(dialog().querySelector('.column-settings-preview')).toBeNull();
        gridInterface.openColumnSettings('code');
        expect(dialog().querySelector('.column-settings-none')?.textContent?.trim()).toEqual(
            'A lookup column shows the label of its value: it has no format'
        );
    });

    it('expect a text column: its template, a placeholder and a hint, the preview of the first row', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('name');

        const text = input('text') as HTMLInputElement;
        expect(text.placeholder).toEqual('{firstname} {lastname}');
        expect(document.querySelector(`label[for="${text.id}"]`)?.textContent?.trim()).toEqual('Text shown');
        const hint = document.getElementById((text.getAttribute('aria-describedby') as string).split(' ')[0]);
        expect(hint?.textContent).toContain('{value}');
        expect(dialog().querySelector('.column-settings-preview-title')?.textContent?.trim()).toEqual('Preview, the first row');
        expect(previewCell().textContent?.trim()).toEqual('Ann');

        type('text', '{name} ({id})');
        expect(previewCell().textContent?.trim()).toEqual('Ann (12)');
        expect(selected().textContent).toContain('Text');
        // emptied: no template
        type('text', '');
        expect(selected().querySelector('.column-settings-badge')).toBeNull();
    });

    it('expect the preview of the current row when there is one', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), rows(), fields());
        datasource.setRowAsCurrentEntity(1);
        gridInterface.openColumnSettings('name');

        expect(dialog().querySelector('.column-settings-preview-title')?.textContent?.trim()).toEqual('Preview, the current row');
        expect(previewCell().textContent?.trim()).toEqual('Bob');
    });

    it('expect no preview without rows', async () => {
        const { gridInterface } = await mountGrid(config(), [], fields());
        gridInterface.openColumnSettings('name');

        expect(dialog().querySelector('.column-settings-preview-title')?.textContent?.trim()).toEqual('No rows to preview');
        expect(previewCell()).toBeNull();
    });
});

describe('column settings - a link', () => {
    it('expect Show as link to show the address and Open in a new tab, on at first; off to take the link away', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('company');
        expect(input('url')).toBeNull();

        toggle(0);
        expect(input('url')?.placeholder).toEqual('https://example.com/customer/{id}');
        expect(checkboxes()[1].checked).toBe(true);
        expect(checkboxes()[1].parentElement?.textContent?.trim()).toEqual('Open in a new tab');

        toggle(0);
        expect(input('url')).toBeNull();
        expect(selected().querySelector('.column-settings-badge')).toBeNull();
    });

    it('expect the problems of an address at once, the column marked Error, Apply held back', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('company');
        toggle(0);

        expect(problems()).toEqual(['Write the address']);
        expect(input('url')?.getAttribute('aria-invalid')).toEqual('true');
        expect(selected().textContent).toContain('Error');
        expect(button('Apply').getAttribute('aria-disabled')).toEqual('true');
        expect(button('Apply & close').getAttribute('aria-disabled')).toEqual('true');

        type('url', 'crm.example.com/{id}');
        expect(problems()).toEqual(['Start the address with https://, http://, mailto: or tel: - or give one field alone']);
        type('url', 'javascript:alert({id})');
        expect(problems()).toEqual(['Not a link the grid opens: only https:, http:, mailto: and tel:']);
        type('url', 'https://x.com/{__rowState}');
        expect(problems()).toEqual(["{__rowState} is the grid's own, not a field"]);

        // held back: nothing applied, the dialog stays
        button('Apply').click();
        button('Apply & close').click();
        expect(dialog()).not.toBeNull();
        expect(gridInterface.getState().formats.company).toBeUndefined();
    });

    it('expect a valid address: the preview a link in a new tab, its address under it, no problem', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('company');
        toggle(0);
        type('url', 'https://crm.example.com/customer/{id}');

        expect(problems()).toEqual([]);
        expect(input('url')?.getAttribute('aria-invalid')).toEqual('false');
        const link = previewCell().querySelector('a') as HTMLAnchorElement;
        expect(link.textContent?.trim()).toEqual('Acme & Co');
        expect(link.getAttribute('href')).toEqual('https://crm.example.com/customer/12');
        expect(link.getAttribute('target')).toEqual('_blank');
        expect(link.getAttribute('rel')).toEqual('noopener noreferrer');
        expect(dialog().querySelector('.column-settings-preview-address')?.textContent?.trim()).toEqual(
            'https://crm.example.com/customer/12'
        );
        expect(selected().textContent).toContain('Link');
        expect(button('Apply').hasAttribute('aria-disabled')).toBe(false);
    });

    it('expect the problems of the row: a field that is empty in it, one that does not exist, a value that is no address', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), rows(), fields());
        datasource.setRowAsCurrentEntity(1);
        gridInterface.openColumnSettings('company');
        toggle(0);

        // Bob has no company
        type('url', 'https://duckduckgo.com/?q={company}');
        expect(problems()).toEqual(['Company is empty in this row: no link, the text only']);
        expect(previewCell().querySelector('a')).toBeNull();
        type('url', 'https://x.com/{compnay}/{id}');
        expect(problems()).toEqual(['No field {compnay} in this row', 'Compnay is empty in this row: no link, the text only']);
        type('url', '{name}');
        expect(problems()).toEqual(['No valid address in this row: no link, the text only']);
    });

    it('expect a hostile address in the row: not a link in the preview, the problem said', async () => {
        const { gridInterface, datasource } = await mountGrid(config(), rows(), fields());
        datasource.getRows()[0].company = 'javascript:alert(1)';
        gridInterface.openColumnSettings('company');
        toggle(0);
        type('url', '{company}');

        expect(previewCell().querySelector('a')).toBeNull();
        expect(previewCell().textContent?.trim()).toEqual('javascript:alert(1)');
        expect(problems()).toEqual(['Not a link the grid opens: only https:, http:, mailto: and tel:']);
    });

    it('expect the field button to list the fields of the columns and of the row, and to put the one picked at the caret', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('company');
        toggle(0);
        type('url', 'https://crm.example.com/customer/');
        const url = input('url') as HTMLInputElement;
        url.setSelectionRange(url.value.length, url.value.length);

        const insert = url.parentElement?.querySelector('.column-settings-insert') as HTMLButtonElement;
        expect(insert.getAttribute('aria-label')).toEqual('Insert a field');
        insert.click();
        const fieldsListed = Array.from(
            document.querySelectorAll<HTMLElement>('[data-menu-id^="filterEditor.field."]'),
            (entry) => entry.getAttribute('data-menu-id')?.replace('filterEditor.field.', '')
        );
        // id is in the rows only, no column
        expect(fieldsListed).toEqual(expect.arrayContaining(['id', 'name', 'company', 'born']));
        menuEntry('filterEditor.field.id').click();

        expect(input('url')?.value).toEqual('https://crm.example.com/customer/{id}');
        expect(document.activeElement).toBe(input('url'));
        expect(input('url')?.selectionStart).toEqual(input('url')?.value.length);

        // in the middle of the text template: at its caret, replacing what is selected
        type('text', 'A  B');
        (input('text') as HTMLInputElement).setSelectionRange(2, 2);
        (dialog().querySelector(`#${(input('text') as HTMLInputElement).id} + .column-settings-insert`) as HTMLElement).click();
        menuEntry('filterEditor.field.name').click();
        expect(input('text')?.value).toEqual('A {name} B');
    });
});

describe('column settings - Apply and Reset', () => {
    it('expect Apply to set the formats of the state, the dialog open; Apply & close to close it', async () => {
        const { element, gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('company');
        type('text', '{company} ({id})');
        toggle(0);
        type('url', 'mailto:{company}');

        button('Apply').click();
        expect(gridInterface.getState().formats).toEqual({
            born: { date: 'norwegian' },
            company: { text: '{company} ({id})', link: { url: 'mailto:{company}', newTab: true } }
        });
        expect(dialog()).not.toBeNull();
        // the cell is a link now
        expect(element.querySelector('a.simple-html-grid-cell-link')?.textContent).toEqual('Acme & Co (12)');

        toggle(1);
        button('Apply & close').click();
        expect(dialog()).toBeNull();
        expect(gridInterface.getState().formats.company).toEqual({ text: '{company} ({id})', link: { url: 'mailto:{company}' } });
    });

    it('expect the state saved as JSON to give the same settings back, also in the dialog', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.setState({ formats: { company: { link: { url: '{company}', newTab: true } } } });
        const saved = JSON.parse(JSON.stringify(gridInterface.getState()));

        const other = await mountGrid(config(), rows(), fields());
        other.gridInterface.setState(saved);
        other.gridInterface.openColumnSettings('company');
        expect(input('url')?.value).toEqual('{company}');
        expect(checkboxes()[1].checked).toBe(true);
    });

    it('expect Reset column to go back to the format the column starts with, Reset all to every one', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.setState({ formats: { born: { date: 'weekIso' }, name: { text: '{name}!' } } });
        gridInterface.openColumnSettings('born');

        expect(picker().textContent?.trim()).toEqual('Week, ISO');
        expect(button('Reset column').getAttribute('data-tooltip')).toEqual('The settings the column starts with');
        button('Reset column').click();
        expect(picker().textContent?.trim()).toEqual('Norwegian');
        // the dialog's, until Apply
        expect(gridInterface.getState().formats.born).toEqual({ date: 'weekIso' });

        options()[0].click();
        expect(input('text')?.value).toEqual('{name}!');
        button('Reset all').click();
        expect(input('text')?.value).toEqual('');
        button('Apply').click();
        expect(gridInterface.getState().formats).toEqual({ born: { date: 'norwegian' } });
    });

    it('expect Reset to go back to initialState.formats when the config has them', async () => {
        const { gridInterface } = await mountGrid(
            config({ initialState: { formats: { name: { text: '#{name}' } } } }),
            rows(),
            fields()
        );
        gridInterface.setState({ formats: {} });
        gridInterface.openColumnSettings('name');

        button('Reset all').click();
        expect(input('text')?.value).toEqual('#{name}');
    });
});

describe('column settings - the filter operator', () => {
    const operatorPicker = () => dialog().querySelector('.column-settings-operator') as HTMLButtonElement | null;
    const operatorField = () =>
        Array.from(dialog().querySelectorAll('.column-settings-field')).find((field) =>
            field.textContent?.includes('Filter operator')
        ) as HTMLElement | undefined;
    const hint = () => operatorField()?.querySelector('.column-settings-hint')?.textContent?.trim();
    const items = () => Array.from(dialog().querySelectorAll<HTMLElement>('[data-menu-id^="filter.operator."]'));

    it('expect a number column: the operator in use in the picker, the default under it, the operators of a number in its menu', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('balance');

        expect(operatorPicker()?.textContent?.trim()).toEqual('Greater than or equal');
        expect(operatorPicker()?.getAttribute('aria-label')).toEqual('Filter operator: Greater than or equal');
        expect(operatorPicker()?.getAttribute('data-tooltip')).toEqual('The operator the header filter of the column uses');
        expect(hint()).toEqual('Default: Greater than or equal');

        operatorPicker()?.click();
        expect(items().map((item) => item.dataset.menuId)).toEqual([
            'filter.operator.equal',
            'filter.operator.notEqualTo',
            'filter.operator.lessThan',
            'filter.operator.lessThanOrEqualTo',
            'filter.operator.greaterThan',
            'filter.operator.greaterThanOrEqualTo',
            'filter.operator.between'
        ]);
        // the one in use is checked
        expect(menuEntry('filter.operator.greaterThanOrEqualTo').getAttribute('aria-checked')).toEqual('true');
        menuEntry('filter.operator.lessThan').click();

        expect(operatorPicker()?.textContent?.trim()).toEqual('Less than');
        // the default stays what it is, and nothing is applied yet
        expect(hint()).toEqual('Default: Greater than or equal');
        expect(gridInterface.getState().headerFilters.balance?.operator).toBeUndefined();
    });

    it('expect the column default from its operator (config), the text operators for a text and a lookup column', async () => {
        const { gridInterface } = await mountGrid(
            config({
                columns: {
                    ...config().columns,
                    name: { label: 'Name', operator: 'BEGIN_WITH' }
                }
            }),
            rows(),
            fields()
        );
        gridInterface.openColumnSettings('name');
        expect(operatorPicker()?.textContent?.trim()).toEqual('Begins with');
        expect(hint()).toEqual('Default: Begins with');
        operatorPicker()?.click();
        expect(items().map((item) => item.dataset.menuId)).toContain('filter.operator.contains');
        expect(items().map((item) => item.dataset.menuId)).not.toContain('filter.operator.lessThan');

        // a lookup column filters its labels: the operators of a text
        gridInterface.openColumnSettings('code');
        expect(operatorPicker()?.textContent?.trim()).toEqual('Equal');
    });

    it('expect no operator for a checkbox column, the name only for a column with one operator', async () => {
        const { gridInterface } = await mountGrid(
            config({
                columns: {
                    ...config().columns,
                    company: { label: 'Company', filterOperators: ['CONTAINS', 'IN'] }
                }
            }),
            rows(),
            fields()
        );
        gridInterface.openColumnSettings('active');
        expect(operatorField()).toBeUndefined();

        gridInterface.openColumnSettings('company');
        expect(operatorPicker()).toBeNull();
        expect(operatorField()?.querySelector('.column-settings-input-row')?.textContent?.trim()).toEqual('Contains');
        expect(hint()).toEqual('Default: Contains');
    });

    it('expect Apply to switch the header filter as Operator › does: the filter again, the state, the event', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        const events: string[] = [];
        gridInterface.on('filter-operator-change', (data) => events.push(`${data.field} ${data.operator}`));
        // the header filter of balance has 100: ≥ 100 lets Ann through
        gridInterface.getDatasource().filter(null);
        gridInterface.setState({ headerFilters: { balance: { value: 100 } } });
        gridInterface.openColumnSettings('balance');
        operatorPicker()?.click();
        menuEntry('filter.operator.lessThan').click();

        button('Apply').click();
        expect(gridInterface.getState().headerFilters.balance?.operator).toEqual('LESS_THAN');
        expect(events).toEqual(['balance LESS_THAN']);
        // < 100: Bob, his balance is 0
        expect(
            gridInterface
                .getDatasource()
                .getRows()
                .map((row) => row.name)
        ).toEqual(['Bob']);
        // the filter has it
        expect(JSON.stringify(gridInterface.getDatasource().getFilter())).toContain(
            '"field":"balance","operator":"LESS_THAN","value":100'
        );

        // Apply again: nothing changed, no event
        button('Apply').click();
        expect(events).toEqual(['balance LESS_THAN']);
    });

    it('expect Cancel to leave the operator as it was', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.openColumnSettings('balance');
        operatorPicker()?.click();
        menuEntry('filter.operator.equal').click();
        button('Cancel').click();

        gridInterface.openColumnSettings('balance');
        expect(operatorPicker()?.textContent?.trim()).toEqual('Greater than or equal');
        expect(gridInterface.getState().headerFilters.balance?.operator).toBeUndefined();
    });

    it('expect the operator picked before (state) in the picker; Reset column and Reset all back to the default', async () => {
        const { gridInterface } = await mountGrid(config(), rows(), fields());
        gridInterface.setState({
            headerFilters: { balance: { value: null, operator: 'BETWEEN' }, born: { value: null, operator: 'LESS_THAN' } }
        });
        gridInterface.openColumnSettings('balance');
        expect(operatorPicker()?.textContent?.trim()).toEqual('Between');
        button('Reset column').click();
        expect(operatorPicker()?.textContent?.trim()).toEqual('Greater than or equal');

        options()[LAYOUT.indexOf('born')].click();
        expect(operatorPicker()?.textContent?.trim()).toEqual('Less than');
        button('Reset all').click();
        expect(operatorPicker()?.textContent?.trim()).toEqual('Greater than or equal');

        button('Apply').click();
        expect(gridInterface.getState().headerFilters.balance?.operator).toEqual('GREATER_THAN_OR_EQUAL_TO');
        expect(gridInterface.getState().headerFilters.born?.operator).toEqual('GREATER_THAN_OR_EQUAL_TO');
    });
});
