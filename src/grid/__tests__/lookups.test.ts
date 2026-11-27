// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { isPopoverShown } from '../../__tests__/popoverStub';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { ColumnConfig, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { MAX_OPTIONS } from '../gridFunctions/lookupEditor';
import { rangesClipboard } from '../gridFunctions/rangeClipboard';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, renderedColumn, stubCanvas, stubElementSizes } from './gridTestHelpers';
import {
    gridOf,
    headerFilterInput,
    menuEntry,
    menuTreeIds,
    openFilterMenu,
    openRowMenu,
    sleep,
    typeInHeaderFilter
} from './interactionTestHelpers';

/**
 * Lookup columns (ColumnConfig.editor): the registry of the lookups, the checks of the config, the cell
 * that shows the label, the keys that open the editors, the select and the dropdown grid, picking (one
 * undo step, `set`), and what the label means for sorting, filtering, the export and the clipboard.
 * happy-dom does no layout: how it looks and where it goes is checked in a browser.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

let countries: Datasource;
let customers: Datasource;

beforeEach(() => {
    document.body.innerHTML = '';
    countries = new Datasource();
    countries.setData([
        { code: 'NO', name: 'Norway' },
        { code: 'SE', name: 'Sweden' },
        { code: 'DK', name: 'Denmark' }
    ]);
    registerLookup('countries', { datasource: countries, valueField: 'code', labelField: 'name' });
    customers = new Datasource({ fields: { id: 'number' } });
    customers.setData([
        { id: 1, name: 'ACME', city: 'Oslo' },
        { id: 2, name: 'GLOBEX', city: 'Bergen' },
        { id: 3, name: 'INITECH', city: 'Oslo' }
    ]);
    registerLookup('customers', { datasource: customers, valueField: 'id', labelField: 'name' });
});

afterEach(() => {
    vi.restoreAllMocks();
});

const COLUMNS = ['name', 'country', 'customerId', 'customerName', 'city'];

const data = () => [
    { name: 'a', country: 'NO', customerId: 2, customerName: 'GLOBEX', city: 'Bergen' },
    { name: 'b', country: 'SE', customerId: 1, customerName: 'ACME', city: 'Oslo' },
    // a value the lookup does not have, and blanks
    { name: 'c', country: 'XX', customerId: null, customerName: null, city: null },
    { name: 'd', country: null, customerId: 3, customerName: 'INITECH', city: 'Oslo' }
];

const fields = (): DatasourceOptions => ({ fields: { customerId: 'number' } });

const columns = (more: Record<string, ColumnConfig> = {}): Record<string, ColumnConfig> => ({
    country: { label: 'Country', editor: { type: 'select', lookup: 'countries' } },
    customerId: { label: 'Customer', editor: { type: 'grid', lookup: 'customers', set: { customerName: 'name', city: 'city' } } },
    ...more
});

const config = (more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    columns: columns(),
    layout: { center: COLUMNS.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

const mount = (more: Partial<GridConfig> = {}, rows: any[] = data()) => mountGrid(config(more), rows, fields());

/** the input of a body cell, by the row it shows */
function cellInput(element: GridElement, field: string, row = 0): HTMLInputElement {
    return element.querySelector(`input.cellpos-middle-pinned-${row}-${COLUMNS.indexOf(field)}-0`) as HTMLInputElement;
}

const cellOf = (element: GridElement, field: string, row = 0) =>
    cellInput(element, field, row).closest('.simple-html-grid-col-cell') as HTMLElement;

const buttonOf = (element: GridElement, field: string, row = 0) =>
    cellOf(element, field, row).querySelector('.simple-html-grid-lookup-button') as HTMLButtonElement | null;

/** a keydown on an element, returns the event */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
        key,
        code: key === ' ' ? 'Space' : key,
        bubbles: true,
        cancelable: true,
        ...init
    });
    target.dispatchEvent(event);
    return event;
}

/** focuses a cell input as a click or Tab does */
function focusCell(element: GridElement, field: string, row = 0) {
    const input = cellInput(element, field, row);
    input.focus();
    return input;
}

const editor = () => document.querySelector('.simple-html-grid-lookup') as HTMLElement | null;
const search = () => editor()?.querySelector('.simple-html-grid-lookup-search') as HTMLInputElement;
const options = () => Array.from(editor()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
const optionTexts = () => options().map((option) => option.textContent?.trim());
const activeText = () => editor()?.querySelector('.simple-html-grid-lookup-option-active')?.textContent?.trim();

/** what the user types in the search of the select */
function typeInSearch(text: string) {
    search().value = text;
    search().dispatchEvent(new Event('input', { bubbles: true }));
}

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

// ------------------------------------------------------------------------------------------------

describe('lookups - registerLookup', () => {
    it('expect a TypeError for an id that is no text', () => {
        expect(() => registerLookup('', { datasource: countries, valueField: 'code' })).toThrow(TypeError);
        expect(() => registerLookup(JSON.parse('3'), { datasource: countries, valueField: 'code' })).toThrow(
            /the id must be a text/
        );
    });

    it('expect a TypeError for a lookup that is not one: plain js and JSON can give anything', () => {
        const bad = (lookup: string) => () => registerLookup('bad', JSON.parse(lookup));
        expect(bad('null')).toThrow(TypeError);
        expect(bad('[]')).toThrow(TypeError);
        // neither a datasource nor a grid interface
        expect(bad('{ "valueField": "code" }')).toThrow(/a datasource or a gridInterface, one of them/);
        expect(bad('{ "datasource": 3, "valueField": "code" }')).toThrow(/datasource is not a Datasource/);
        expect(bad('{ "gridInterface": {}, "valueField": "code" }')).toThrow(/gridInterface is not a GridInterface/);
    });

    it('expect a TypeError for both a datasource and a grid interface, or a config with the interface', () => {
        const gridInterface = new GridInterface({ layout: { center: [{ fields: ['name'], width: 100 }] } }, countries);
        expect(() => registerLookup('bad', { datasource: countries, gridInterface, valueField: 'code' } as any)).toThrow(
            TypeError
        );
        expect(() =>
            registerLookup('bad', { gridInterface, valueField: 'code', config: { layout: { center: [] } } } as any)
        ).toThrow(/a gridInterface has its own/);
    });

    it('expect a TypeError for a valueField or labelField that is no field name, or a config that is no object', () => {
        expect(() => registerLookup('bad', { datasource: countries } as any)).toThrow(/valueField/);
        expect(() => registerLookup('bad', { datasource: countries, valueField: '' })).toThrow(/valueField/);
        expect(() => registerLookup('bad', { datasource: countries, valueField: 'code', labelField: 3 } as any)).toThrow(
            /labelField/
        );
        expect(() => registerLookup('bad', { datasource: countries, valueField: 'code', config: 'x' } as any)).toThrow(/config/);
    });

    it('expect a grid to keep the lookup it found: registering the id again changes the grids made after', async () => {
        const first = await mount();
        const other = new Datasource();
        other.setData([{ code: 'NO', name: 'Noreg' }]);
        registerLookup('countries', { datasource: other, valueField: 'code', labelField: 'name' });
        const second = await mount();

        expect(cellInput(first.element, 'country', 0).value).toEqual('Norway');
        expect(cellInput(second.element, 'country', 0).value).toEqual('Noreg');
    });
});

describe('lookups - the column option', () => {
    const make =
        (column: unknown, fieldOptions: DatasourceOptions = fields()) =>
        () =>
            new GridInterface(
                { columns: { country: column as ColumnConfig }, layout: { center: [{ fields: ['country'], width: 100 }] } },
                new Datasource(fieldOptions)
            );

    it('expect a TypeError for a lookup that is not registered, naming the registered ones', () => {
        expect(make({ editor: { type: 'select', lookup: 'nope' } })).toThrow(TypeError);
        expect(make({ editor: { type: 'select', lookup: 'nope' } })).toThrow(
            /columns\.country\.editor\.lookup is "nope".*'countries'/
        );
        expect(make({ editor: { type: 'select' } })).toThrow(/lookup is undefined/);
    });

    it('expect a TypeError for an editor that is no object, or an unknown type', () => {
        expect(make({ editor: 'countries' })).toThrow(/columns\.country\.editor is \{ type/);
        expect(make({ editor: { type: 'list', lookup: 'countries' } })).toThrow(/\.type is 'select' or 'grid', got "list"/);
    });

    it('expect a TypeError for a set that is no object of field names, or sets the column itself', () => {
        expect(make({ editor: { type: 'select', lookup: 'countries', set: [] } })).toThrow(/\.set is \{/);
        expect(make({ editor: { type: 'select', lookup: 'countries', set: { countryName: 3 } } })).toThrow(/set\.countryName/);
        expect(make({ editor: { type: 'select', lookup: 'countries', set: { country: 'name' } } })).toThrow(/column's own field/);
    });

    it('expect a TypeError for a field that is no text or number: the value is compared with ===', () => {
        const editor = { type: 'select', lookup: 'countries' };
        expect(make({ editor }, { fields: { country: 'boolean' } })).toThrow(
            /is for a text or number field, 'country' is boolean/
        );
        expect(make({ editor }, { fields: { country: 'date' } })).toThrow(TypeError);
        expect(make({ editor }, { fields: { country: 'number' } })).not.toThrow();
    });

    it('expect a TypeError for a focusButton or a dynamicCellTypeColumn next to the editor', () => {
        const editor = { type: 'select', lookup: 'countries' };
        expect(make({ editor, focusButton: 'ALWAYS' })).toThrow(/editor shows its own button/);
        expect(make({ editor, dynamicCellTypeColumn: 'kind' })).toThrow(/dynamicCellTypeColumn/);
    });

    it('expect updateConfig() to check the editors before it changes anything', async () => {
        const { element, gridInterface } = await mount();
        expect(() =>
            gridInterface.updateConfig({ readonly: true, columns: { country: { editor: { type: 'select', lookup: 'nope' } } } })
        ).toThrow(TypeError);
        // nothing changed: still editable, still a lookup
        expect(gridInterface.__getGridConfig().readonly).toBe(false);
        expect(cellInput(element, 'country', 0).value).toEqual('Norway');
    });

    it('expect updateConfig({ columns }) to make a column a lookup column, and a plain one again', async () => {
        const { element, gridInterface } = await mount({ columns: {} });
        expect(cellInput(element, 'country', 0).value).toEqual('NO');

        gridInterface.updateConfig({ columns: columns() });
        expect(cellInput(element, 'country', 0).value).toEqual('Norway');

        gridInterface.updateConfig({ columns: {} });
        expect(cellInput(element, 'country', 0).value).toEqual('NO');
        expect(cellInput(element, 'country', 0).readOnly).toBe(false);
    });
});

describe('lookups - the cell', () => {
    it('expect the label of the value, the value when no row has it, nothing for a blank', async () => {
        const { element } = await mount();

        expect(renderedColumn(element, 'country')).toEqual(['Norway', 'Sweden', 'XX', '']);
        // a number field: the label, on the left - it is text
        expect(renderedColumn(element, 'customerId')).toEqual(['GLOBEX', 'ACME', '', 'INITECH']);
        expect(cellInput(element, 'customerId', 0).style.textAlign).toEqual('');
    });

    it('expect a readonly input with a button and aria-haspopup, where the cell can be edited', async () => {
        const { element } = await mount();

        const input = cellInput(element, 'country', 0);
        expect(input.readOnly).toBe(true);
        expect(input.getAttribute('aria-haspopup')).toEqual('listbox');
        expect(cellInput(element, 'customerId', 0).getAttribute('aria-haspopup')).toEqual('grid');
        const button = buttonOf(element, 'country', 0) as HTMLButtonElement;
        expect(button.getAttribute('aria-label')).toEqual('Open the list');
        expect(button.getAttribute('aria-haspopup')).toEqual('listbox');
        // not a stop of Tab: the grid moves between the cells itself
        expect(button.tabIndex).toBe(-1);
        expect(button.type).toEqual('button');
    });

    it('expect no button and no editor in a readonly grid, or a readonly cell: the label only', async () => {
        const { element, gridInterface } = await mount({ readonly: true });
        expect(cellInput(element, 'country', 0).value).toEqual('Norway');
        expect(buttonOf(element, 'country', 0)).toBeNull();
        expect(cellInput(element, 'country', 0).hasAttribute('aria-haspopup')).toBe(false);
        press(focusCell(element, 'country', 0), 'F4');
        expect(editor()).toBeNull();

        gridInterface.updateConfig({
            readonly: false,
            columns: columns({ country: { readonly: true, editor: { type: 'select', lookup: 'countries' } } })
        });
        expect(buttonOf(element, 'country', 0)).toBeNull();
        press(focusCell(element, 'country', 0), 'ArrowDown', { altKey: true });
        expect(editor()).toBeNull();
    });

    it('expect the isReadonly hook to make a lookup cell readonly too', async () => {
        const { element } = await mountGrid(config(), data(), fields(), {
            isReadonly: (row) => (row.name === 'a' ? true : null)
        });
        expect(buttonOf(element, 'country', 0)).toBeNull();
        expect(buttonOf(element, 'country', 1)).not.toBeNull();
    });

    it('expect the labels to follow the lookup: rows that come later, a label that changes', async () => {
        const late = new Datasource();
        registerLookup('late', { datasource: late, valueField: 'code', labelField: 'name' });
        const { element } = await mount({ columns: { country: { editor: { type: 'select', lookup: 'late' } } } });
        expect(cellInput(element, 'country', 0).value).toEqual('NO');

        // the rows of the lookup, loaded after the grid was made
        late.setData([{ code: 'NO', name: 'Norway' }]);
        expect(cellInput(element, 'country', 0).value).toEqual('Norway');

        late.getAllData()[0].name = 'Norge';
        await frame();
        expect(cellInput(element, 'country', 0).value).toEqual('Norge');
    });

    it('expect the marker of an edited cell to show the label of the original value', async () => {
        const { element, datasource } = await mount();
        datasource.getAllData()[0].country = 'SE';
        await frame();

        expect(cellInput(element, 'country', 0).value).toEqual('Sweden');
        const marker = cellOf(element, 'country', 0).querySelector('.simple-html-cell-edited-marker') as HTMLElement;
        expect(marker.getAttribute('data-tooltip')).toContain('Original value: Norway');
    });

    it('expect typing never to write: the input event of a lookup cell is ignored', async () => {
        const { element, datasource } = await mount();
        const input = focusCell(element, 'country', 0);
        input.value = 'Nor';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        expect(datasource.getAllData()[0].country).toEqual('NO');
    });
});

describe('lookups - opening the editor', () => {
    it('expect the button to open the select, the focus in its search, and to close it again', async () => {
        const { element } = await mount();
        const input = focusCell(element, 'country', 0);

        (buttonOf(element, 'country', 0) as HTMLButtonElement).click();
        expect(isPopoverShown(editor())).toBe(true);
        expect(editor()?.classList.contains('simple-html-grid-lookup-select')).toBe(true);
        expect(document.activeElement).toBe(search());

        (buttonOf(element, 'country', 0) as HTMLButtonElement).click();
        expect(editor()).toBeNull();
        expect(document.activeElement).toBe(input);
    });

    it('expect the button to give the cell the focus first: it shows on hover too', async () => {
        const { element, datasource } = await mount();
        (buttonOf(element, 'country', 1) as HTMLButtonElement).click();
        expect(editor()).not.toBeNull();
        // the row of the cell is the current row
        expect(datasource.currentEntity).toBe(datasource.getRow(1));
        search().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
        expect(document.activeElement).toBe(cellInput(element, 'country', 1));
    });

    it('expect a press on the button not to take the focus from the cell', async () => {
        const { element } = await mount();
        focusCell(element, 'country', 0);
        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        (buttonOf(element, 'country', 0) as HTMLButtonElement).dispatchEvent(mousedown);
        expect(mousedown.defaultPrevented).toBe(true);
    });

    it.each([
        ['Alt+ArrowDown', 'ArrowDown', { altKey: true }],
        ['F4', 'F4', {}],
        ['F2', 'F2', {}],
        ['Space', ' ', {}]
    ])('expect %s to open the editor, with no search', async (_name, key, init) => {
        const { element } = await mount();
        const event = press(focusCell(element, 'country', 0), key, init);
        expect(event.defaultPrevented).toBe(true);
        expect(editor()).not.toBeNull();
        expect(search().value).toEqual('');
    });

    it('expect a character to open the editor with it as the search, not to type it in the cell', async () => {
        const { element, datasource } = await mount();
        const event = press(focusCell(element, 'country', 0), 'e');
        expect(event.defaultPrevented).toBe(true);
        expect(search().value).toEqual('e');
        expect(optionTexts()).toEqual(['Sweden', 'Denmark']);
        expect(datasource.getAllData()[0].country).toEqual('NO');
    });

    it('expect a double click to open the editor', async () => {
        const { element } = await mount();
        focusCell(element, 'country', 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(editor()).not.toBeNull();
    });

    it('expect Enter not to open it: it goes to the cell below, as in any cell that can be edited', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'Enter');
        expect(editor()).toBeNull();
        await sleep(150);
        expect(document.activeElement).toBe(cellInput(element, 'country', 1));
    });

    it('expect Alt+ArrowDown in a readonly grid to go to the cell below as before', async () => {
        const { element } = await mount({ readonly: true });
        press(focusCell(element, 'country', 0), 'ArrowDown', { altKey: true });
        await sleep(150);
        expect(editor()).toBeNull();
        expect(document.activeElement).toBe(cellInput(element, 'country', 1));
    });

    it('expect one editor at a time: opening another closes the first', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        const first = editor();
        press(focusCell(element, 'country', 1), 'F4');
        expect(first?.isConnected).toBe(false);
        expect(document.querySelectorAll('.simple-html-grid-lookup')).toHaveLength(1);
    });
});

describe('lookups - the select', () => {
    it('expect the labels of the rows the lookup displays, the current value marked and active', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 1), 'F4');

        expect(optionTexts()).toEqual(['Norway', 'Sweden', 'Denmark']);
        const current = editor()?.querySelector('.simple-html-grid-lookup-option-current') as HTMLElement;
        expect(current.textContent?.trim()).toEqual('Sweden');
        expect(current.querySelector('svg.simple-html-grid-lookup-check')).not.toBeNull();
        expect(activeText()).toEqual('Sweden');
    });

    it('expect the lookup datasource to decide the rows and their order: its filter and sort', async () => {
        countries.sort({ attribute: 'name', ascending: true });
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        expect(optionTexts()).toEqual(['Denmark', 'Norway', 'Sweden']);
    });

    it('expect a value no row has: nothing active, nothing marked', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 2), 'F4');
        expect(activeText()).toBeUndefined();
        expect(editor()?.querySelector('.simple-html-grid-lookup-option-current')).toBeNull();
    });

    it('expect the search to find the labels with the text, ignoring case, the first one active', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');

        typeInSearch('DEN');
        expect(optionTexts()).toEqual(['Sweden', 'Denmark']);
        expect(activeText()).toEqual('Sweden');

        typeInSearch('zz');
        expect(options()).toHaveLength(0);
        const note = editor()?.querySelector('.simple-html-grid-lookup-note') as HTMLElement;
        expect(note.textContent?.trim()).toEqual('No matches');
        expect(note.getAttribute('role')).toEqual('status');
        expect(search().hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('expect the arrows, Home, End, PageUp and PageDown to move the active option, not past the ends', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        expect(activeText()).toEqual('Norway');

        expect(press(search(), 'ArrowDown').defaultPrevented).toBe(true);
        expect(activeText()).toEqual('Sweden');
        press(search(), 'End');
        expect(activeText()).toEqual('Denmark');
        press(search(), 'ArrowDown');
        expect(activeText()).toEqual('Denmark');
        press(search(), 'Home');
        expect(activeText()).toEqual('Norway');
        press(search(), 'ArrowUp');
        expect(activeText()).toEqual('Norway');
        press(search(), 'PageDown');
        expect(activeText()).toEqual('Denmark');
        press(search(), 'PageUp');
        expect(activeText()).toEqual('Norway');
    });

    it('expect Enter to pick the active option: the value written, closed, the focus back in the cell', async () => {
        const { element, datasource } = await mount();
        const input = focusCell(element, 'country', 0);
        press(input, 'F4');
        press(search(), 'End');
        press(search(), 'Enter');

        expect(datasource.getAllData()[0].country).toEqual('DK');
        expect(editor()).toBeNull();
        expect(document.activeElement).toBe(input);
        await frame();
        expect(cellInput(element, 'country', 0).value).toEqual('Denmark');
    });

    it('expect Enter with nothing to pick to close it, the value as it was', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        typeInSearch('zz');
        press(search(), 'Enter');
        expect(editor()).toBeNull();
        expect(datasource.getAllData()[0].country).toEqual('NO');
    });

    it('expect Esc to close it, the value as it was, the focus back in the cell', async () => {
        const { element, datasource } = await mount();
        const input = focusCell(element, 'country', 0);
        press(input, 'F4');
        press(search(), 'ArrowDown');
        const escapeKey = press(search(), 'Escape');

        // canceled: a modal dialog the grid is in does not close on it
        expect(escapeKey.defaultPrevented).toBe(true);
        expect(editor()).toBeNull();
        expect(datasource.getAllData()[0].country).toEqual('NO');
        expect(document.activeElement).toBe(input);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect a click on an option to pick it, a press on the list not to take the focus', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');

        const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        options()[2].dispatchEvent(mousedown);
        expect(mousedown.defaultPrevented).toBe(true);
        options()[2].click();
        expect(datasource.getAllData()[0].country).toEqual('DK');
        expect(editor()).toBeNull();
    });

    it('expect the pointer over an option to make it the active one', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        options()[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
        expect(activeText()).toEqual('Denmark');
    });

    it('expect Tab to pick the active option and go on to the next cell', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        press(search(), 'ArrowDown');
        const tab = press(search(), 'Tab');

        expect(datasource.getAllData()[0].country).toEqual('SE');
        expect(editor()).toBeNull();
        expect(tab.defaultPrevented).toBe(true);
        await sleep(150);
        expect(document.activeElement).toBe(cellInput(element, 'customerId', 0));
    });

    it('expect a long list cut at MAX_OPTIONS, with a line that says so: the search finds the rest', async () => {
        const many = new Datasource();
        many.setData(Array.from({ length: MAX_OPTIONS + 20 }, (_, i) => ({ code: `c${i}`, name: `Item ${i}` })));
        registerLookup('many', { datasource: many, valueField: 'code', labelField: 'name' });
        const { element } = await mount({ columns: { country: { editor: { type: 'select', lookup: 'many' } } } });
        press(focusCell(element, 'country', 0), 'F4');

        expect(options()).toHaveLength(MAX_OPTIONS);
        expect(editor()?.querySelector('.simple-html-grid-lookup-note')?.textContent?.trim()).toEqual(
            `${MAX_OPTIONS} of ${MAX_OPTIONS + 20} shown, type to search`
        );
        typeInSearch(`Item ${MAX_OPTIONS + 10}`);
        expect(optionTexts()).toEqual([`Item ${MAX_OPTIONS + 10}`]);
        expect(editor()?.querySelector('.simple-html-grid-lookup-note')).toBeNull();
    });

    it('expect a combobox with a listbox of options for a screen reader, named with the column', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');

        const input = search();
        const list = editor()?.querySelector('[role="listbox"]') as HTMLElement;
        expect(input.getAttribute('role')).toEqual('combobox');
        expect(input.getAttribute('aria-expanded')).toEqual('true');
        expect(input.getAttribute('aria-autocomplete')).toEqual('list');
        expect(input.getAttribute('aria-controls')).toEqual(list.id);
        expect(input.getAttribute('aria-label')).toEqual('Country');
        expect(input.getAttribute('placeholder')).toEqual('Search');
        expect(list.getAttribute('aria-label')).toEqual('Country');
        // the active option is the active descendant, and the one selected
        const active = options()[0];
        expect(input.getAttribute('aria-activedescendant')).toEqual(active.id);
        expect(options().map((option) => option.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false']);
        press(input, 'ArrowDown');
        expect(input.getAttribute('aria-activedescendant')).toEqual(options()[1].id);
        expect(options()[1].getAttribute('aria-selected')).toEqual('true');
    });

    it('expect the cell to count as being edited while it is open', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        const history = datasource.getDataContainer().__history;
        expect(history.editingCell()).toEqual({ row: datasource.getAllData()[0], field: 'country' });
        press(search(), 'Escape');
        expect(history.editingCell()).toBeNull();
    });
});

describe('lookups - closing', () => {
    it('expect a click outside it to close it, the value as it was', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        expect(editor()).toBeNull();
        expect(datasource.getAllData()[0].country).toEqual('NO');
    });

    it('expect a press in it, or on the button of its cell, not to close it', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        options()[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        expect(editor()).not.toBeNull();
        (buttonOf(element, 'country', 0) as HTMLButtonElement).dispatchEvent(
            new MouseEvent('mousedown', { bubbles: true, cancelable: true })
        );
        expect(editor()).not.toBeNull();
    });

    it('expect scrolling the grid to close it', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        element.querySelector('.simple-html-grid-body-scroller')?.dispatchEvent(new Event('scroll'));
        expect(editor()).toBeNull();

        press(focusCell(element, 'country', 0), 'F4');
        element.dispatchEvent(new WheelEvent('wheel', { deltaY: 10 }));
        expect(editor()).toBeNull();
    });

    it('expect a menu to close it: one popover of the grid at a time', async () => {
        const { element } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        openRowMenu(element, 'name', 1);
        expect(editor()).toBeNull();
        expect(document.querySelector('.simple-html-grid-menu')).not.toBeNull();
    });

    it('expect the grid leaving the page, and destroy(), to remove it', async () => {
        const first = await mount();
        press(focusCell(first.element, 'country', 0), 'F4');
        first.element.remove();
        expect(editor()).toBeNull();

        const second = await mount();
        press(focusCell(second.element, 'customerId', 0), 'F4');
        expect(editor()).not.toBeNull();
        second.gridInterface.destroy();
        expect(editor()).toBeNull();
        expect(gridOf(second.element).lookupEditor).toBeNull();
    });
});

describe('lookups - picking: set and undo', () => {
    it('expect set to copy fields of the picked row, all of it one step of the undo history', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const filter = editor()?.querySelector('input.simple-html-grid-cell-filter-input') as HTMLInputElement;
        filter.value = 'acme';
        filter.dispatchEvent(new Event('input', { bubbles: true }));
        press(filter, 'Enter');

        const row = datasource.getAllData()[0];
        expect([row.customerId, row.customerName, row.city]).toEqual([1, 'ACME', 'Oslo']);

        expect(datasource.undo()).toBe(true);
        expect([row.customerId, row.customerName, row.city]).toEqual([2, 'GLOBEX', 'Bergen']);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect Ctrl+Z in the cell to undo the pick', async () => {
        const { element, datasource } = await mount();
        const input = focusCell(element, 'country', 0);
        press(input, 'F4');
        press(search(), 'ArrowDown');
        press(search(), 'Enter');
        expect(datasource.getAllData()[0].country).toEqual('SE');

        press(input, 'z', { ctrlKey: true, code: 'KeyZ' });
        expect(datasource.getAllData()[0].country).toEqual('NO');
    });

    it('expect picking the value the cell has to change nothing: no step to undo', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'country', 0), 'F4');
        press(search(), 'Enter');
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect Delete and Backspace to empty the cell and the fields of set, one step each', async () => {
        const { element, datasource } = await mount();
        const row = datasource.getAllData()[0];

        expect(press(focusCell(element, 'customerId', 0), 'Delete').defaultPrevented).toBe(true);
        expect([row.customerId, row.customerName, row.city]).toEqual([null, null, null]);
        press(focusCell(element, 'country', 0), 'Backspace');
        expect(row.country).toBeNull();

        datasource.undo();
        expect(row.country).toEqual('NO');
        datasource.undo();
        expect([row.customerId, row.customerName, row.city]).toEqual([2, 'GLOBEX', 'Bergen']);
    });

    it('expect a pick to be validated as an edit', async () => {
        const { element, datasource } = await mountGrid(config(), data(), {
            fields: { customerId: 'number', country: { validate: [{ id: 'pattern', value: '^N', message: 'Nordic only' }] } }
        });
        press(focusCell(element, 'country', 0), 'F4');
        press(search(), 'ArrowDown');
        press(search(), 'Enter');
        expect(datasource.getErrors().map((error) => error.messages)).toEqual([['Nordic only']]);
    });
});

describe('lookups - the dropdown grid', () => {
    const dropdown = () => editor()?.querySelector('simple-html-grid') as GridElement;
    const dropdownInterface = () => gridOf(dropdown()).gridInterface as GridInterface<any>;
    const filterInput = () => document.activeElement as HTMLInputElement;

    it('expect a grid of the lookup in the popover, the focus in the filter of the label', async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');

        expect(isPopoverShown(editor())).toBe(true);
        expect(editor()?.classList.contains('simple-html-grid-lookup-grid')).toBe(true);
        expect(dropdownInterface().getDatasource()).toBe(customers);
        expect(renderedColumn(dropdown(), 'name')).toEqual(['ACME', 'GLOBEX', 'INITECH']);
        // the value and the label, the label's filter has the focus
        expect(dropdownInterface().getLayoutFields()).toEqual(['id', 'name']);
        expect(filterInput()).toBe(headerFilterInput(dropdown(), 'name'));
    });

    it('expect the options of a picker: no panel, no footer, no row state, filters that search anywhere', async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const parsed = dropdownInterface().__getGridConfig();
        expect([parsed.panelHeight, parsed.footerHeight, parsed.selectSizeHeight, parsed.rowStatus, parsed.readonly]).toEqual([
            0,
            0,
            0,
            false,
            true
        ]);
        expect(parsed.columns.name.operator).toEqual('CONTAINS');
    });

    it('expect no operator indicator in a picker, and F4 in its filter to open no operator choice: it has no menus', async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        expect(dropdownInterface().__getGridConfig().filterOperatorIndicator).toBe(false);
        expect(dropdown().querySelectorAll('.simple-html-grid-filter-operator')).toHaveLength(0);
        // no settings button either (and no footer to put it in)
        expect(dropdownInterface().__getGridConfig().settingsButton).toBe(false);
        expect(dropdown().querySelector('.footer-settings')).toBeNull();
        // nor a keyboard shortcuts help of its own: `?` in it is the grid's the cell is in
        expect(dropdownInterface().__getGridConfig().shortcutHelp).toBe(false);

        press(headerFilterInput(dropdown(), 'name'), 'F4');
        expect(document.querySelectorAll('.simple-html-grid-menu')).toHaveLength(0);
    });

    it("expect the lookup's config to be used, its operators kept", async () => {
        registerLookup('customers', {
            datasource: customers,
            valueField: 'id',
            labelField: 'name',
            config: {
                footerHeight: 20,
                columns: { city: { operator: 'BEGIN_WITH' } },
                layout: {
                    center: [
                        { fields: ['name'], width: 150 },
                        { fields: ['city'], width: 90 }
                    ]
                }
            }
        });
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');

        const parsed = dropdownInterface().__getGridConfig();
        expect(dropdownInterface().getLayoutFields()).toEqual(['name', 'city']);
        expect([parsed.footerHeight, parsed.panelHeight]).toEqual([20, 0]);
        expect([parsed.columns.name.operator, parsed.columns.city.operator]).toEqual(['CONTAINS', 'BEGIN_WITH']);
    });

    it("expect the row of the cell's value to be the selected row", async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        expect(customers.getSelectedRows().map((row) => row.name)).toEqual(['GLOBEX']);
    });

    it('expect typing to filter as you type, the first row selected; Enter in the filter picks it', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'customerId', 0), 's');
        // the character typed in the cell is in the filter already
        expect(filterInput().value).toEqual('s');
        filterInput().value = 'te';
        filterInput().dispatchEvent(new Event('input', { bubbles: true }));

        expect(renderedColumn(dropdown(), 'name')).toEqual(['INITECH']);
        expect(customers.getSelectedRows().map((row) => row.name)).toEqual(['INITECH']);
        press(filterInput(), 'Enter');
        expect(datasource.getAllData()[0].customerId).toEqual(3);
        expect(editor()).toBeNull();
        expect(document.activeElement).toBe(cellInput(element, 'customerId', 0));
    });

    it('expect Enter in the filter without a search to keep the value: its row is the selected one', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        press(filterInput(), 'Enter');
        expect(datasource.getAllData()[0].customerId).toEqual(2);
        expect(datasource.canUndo()).toBe(false);
    });

    it('expect ArrowDown in the filter to go to the highlighted row, the arrows to move, Enter on a row to pick it', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const dropdownRow = () => (document.activeElement?.closest('.simple-html-grid-col-cell') as any)?.$row;

        // the cell's value, GLOBEX, is the highlighted row: the second
        expect(press(filterInput(), 'ArrowDown').defaultPrevented).toBe(true);
        await sleep(150);
        expect(document.activeElement?.getAttribute('data-attribute')).toEqual('name');
        expect(dropdownRow()).toEqual(1);
        expect(press(document.activeElement as HTMLElement, 'ArrowDown').defaultPrevented).toBe(true);
        await sleep(150);
        expect(dropdownRow()).toEqual(2);
        press(document.activeElement as HTMLElement, 'Enter');
        expect(datasource.getAllData()[0].customerId).toEqual(3);
        expect(datasource.getAllData()[0].customerName).toEqual('INITECH');

        // after a search: the first row it found. ArrowUp from the first row goes back to the filter
        press(focusCell(element, 'customerId', 1), 'F4');
        filterInput().value = 'e';
        filterInput().dispatchEvent(new Event('input', { bubbles: true }));
        press(filterInput(), 'ArrowDown');
        await sleep(150);
        expect(dropdownRow()).toEqual(0);
        press(document.activeElement as HTMLElement, 'ArrowUp');
        await sleep(150);
        expect(document.activeElement?.classList.contains('simple-html-grid-cell-filter-input')).toBe(true);
    });

    it('expect a click on a row to pick it', async () => {
        const { element, datasource } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const cell = dropdown().querySelector('input.cellpos-middle-pinned-0-1-0') as HTMLInputElement;
        cell.click();
        await sleep(0);
        expect(datasource.getAllData()[0].customerId).toEqual(1);
        expect(datasource.getAllData()[0].city).toEqual('Oslo');
        expect(editor()).toBeNull();
    });

    it('expect Esc to close it, the value as it was', async () => {
        const { element, datasource } = await mount();
        const input = focusCell(element, 'customerId', 0);
        press(input, 'F4');
        const escapeKey = press(filterInput(), 'Escape');
        expect(escapeKey.defaultPrevented).toBe(true);
        expect(editor()).toBeNull();
        expect(datasource.getAllData()[0].customerId).toEqual(2);
        expect(document.activeElement).toBe(input);
    });

    it('expect no right click menus in the dropdown grid', async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const contextmenu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
        (dropdown().querySelector('input.cellpos-middle-pinned-0-1-0') as HTMLElement).dispatchEvent(contextmenu);
        expect(contextmenu.defaultPrevented).toBe(true);
        expect(document.querySelector('.simple-html-grid-menu')).toBeNull();
    });

    it('expect the grid interface made for it to be destroyed when it closes, a new one the next time', async () => {
        const { element } = await mount();
        press(focusCell(element, 'customerId', 0), 'F4');
        const first = dropdownInterface();
        press(filterInput(), 'Escape');
        expect(first.__isConnected()).toBe(false);

        press(focusCell(element, 'customerId', 0), 'F4');
        expect(dropdownInterface()).not.toBe(first);
    });
});

describe('lookups - a linked grid interface', () => {
    const pickerConfig = (): GridConfig => ({
        columns: { name: { operator: 'BEGIN_WITH' } },
        layout: { center: [{ fields: ['name'], width: 150 }] }
    });

    it('expect the dropdown to show the interface, disconnected again when it closes', async () => {
        const picker = new GridInterface(pickerConfig(), customers);
        registerLookup('picker', { gridInterface: picker, valueField: 'id', labelField: 'name' });
        const { element, datasource } = await mount({
            columns: columns({ customerId: { editor: { type: 'grid', lookup: 'picker', set: { customerName: 'name' } } } })
        });
        expect(cellInput(element, 'customerId', 0).value).toEqual('GLOBEX');

        press(focusCell(element, 'customerId', 0), 'i');
        const dropdown = editor()?.querySelector('simple-html-grid') as GridElement;
        expect(gridOf(dropdown).gridInterface).toBe(picker);
        expect(picker.__isConnected()).toBe(true);
        // its own operator: BEGIN_WITH
        expect(renderedColumn(dropdown, 'name')).toEqual(['INITECH']);
        press(document.activeElement as HTMLElement, 'Enter');

        expect(datasource.getAllData()[0].customerId).toEqual(3);
        expect(picker.__isConnected()).toBe(false);
    });

    it('expect it to open in the state it started in: the filter of the last time is gone', async () => {
        const picker = new GridInterface(pickerConfig(), customers);
        registerLookup('picker', { gridInterface: picker, valueField: 'id', labelField: 'name' });
        const { element } = await mount({ columns: columns({ customerId: { editor: { type: 'grid', lookup: 'picker' } } }) });

        press(focusCell(element, 'customerId', 0), 'g');
        press(document.activeElement as HTMLElement, 'Escape');
        expect(customers.getFilter()).not.toBeNull();

        press(focusCell(element, 'customerId', 0), 'F4');
        expect(customers.getDataRows()).toHaveLength(3);
    });

    it('expect an Error when the interface is shown in a grid already: one grid at a time', async () => {
        const shown = await mountGrid(pickerConfig(), [{ id: 1, name: 'x' }]);
        registerLookup('shown', { gridInterface: shown.gridInterface, valueField: 'id', labelField: 'name' });
        const { element } = await mount({ columns: columns({ customerId: { editor: { type: 'grid', lookup: 'shown' } } }) });

        expect(() => press(focusCell(element, 'customerId', 0), 'F4')).toThrow(/shown in a grid already/);
        expect(editor()).toBeNull();
    });
});

describe('lookups - sorting, filtering, export and clipboard on the label', () => {
    it('expect sorting a lookup column to sort on the labels, a value no row has on its own text', async () => {
        const { element, datasource } = await mount();
        datasource.sort({ attribute: 'country', ascending: true });
        expect(renderedColumn(element, 'country')).toEqual(['', 'Norway', 'Sweden', 'XX']);
        datasource.sort({ attribute: 'customerId', ascending: false });
        expect(renderedColumn(element, 'customerId')).toEqual(['INITECH', 'GLOBEX', 'ACME', '']);
    });

    it('expect the same label for two values to sort on the values after it: the groups stay whole', async () => {
        customers.getAllData()[2].name = 'ACME';
        const rows = [1, 3, 1, 3].map((customerId, i) => ({ name: `r${i}`, customerId }));
        const { datasource } = await mount({}, rows);
        datasource.sort({ attribute: 'customerId', ascending: true });
        expect(datasource.getDataRows().map((row) => row.customerId)).toEqual([1, 1, 3, 3]);
    });

    it('expect destroy() to sort the column on its values again, not what another grid set', async () => {
        const datasource = new Datasource(fields());
        datasource.setData(data());
        const first = new GridInterface(config(), datasource);
        const formatter = datasource.__getSortValue('country');
        expect(formatter?.('SE', {})).toEqual('Sweden');
        first.destroy();
        expect(datasource.__getSortValue('country')).toBeUndefined();

        const second = new GridInterface(config(), datasource);
        const third = new GridInterface(config(), datasource);
        second.destroy();
        expect(datasource.__getSortValue('country')).toBeDefined();
        third.destroy();
        expect(datasource.__getSortValue('country')).toBeUndefined();
    });

    it('expect the header filter to find the labels, the rows filtered on the values (IN)', async () => {
        const { element, datasource, gridInterface } = await mount();

        // a text column's operator: EQUAL, the whole text ignoring case
        typeInHeaderFilter(element, 'country', 'norway');
        expect(datasource.getFilter()).toEqual({ group: 'AND', children: [{ field: 'country', operator: 'IN', value: ['NO'] }] });
        expect(renderedColumn(element, 'country')).toEqual(['Norway']);
        // the header filter shows what was typed
        expect(gridInterface.getState().headerFilters).toEqual({ country: { value: 'norway' } });

        gridInterface.updateConfig({
            columns: columns({ country: { operator: 'CONTAINS', editor: { type: 'select', lookup: 'countries' } } })
        });
        typeInHeaderFilter(element, 'country', 'e');
        expect(renderedColumn(element, 'country')).toEqual(['Sweden']);
        // no label matches: no row
        typeInHeaderFilter(element, 'country', 'zz');
        expect(renderedColumn(element, 'country')).toEqual([]);
    });

    it("expect the footer's chip of the header filter's IN to show the labels, getFilterString() the values", async () => {
        const { element, datasource } = await mount();
        typeInHeaderFilter(element, 'country', 'sweden');
        typeInHeaderFilter(element, 'customerId', 'acme');

        const chips = Array.from(element.querySelectorAll('.footer-filter-chip'), (chip) =>
            chip.textContent?.replace(/\s+/g, ' ').trim()
        );
        expect(chips).toEqual(['Country in Sweden', 'Customer in ACME']);
        expect(datasource.getFilterString()).toEqual("([COUNTRY] <<IN>> ['SE'] AND [CUSTOMERID] <<IN>> ['1'])");
    });

    it('expect the header filter of a number lookup column to be a text filter on the labels', async () => {
        const { element, datasource } = await mount();
        const filter = headerFilterInput(element, 'customerId');
        expect(filter.style.textAlign).toEqual('');
        expect(filter.placeholder).toEqual('Text');

        typeInHeaderFilter(element, 'customerId', 'globex');
        expect(datasource.getFilter()).toEqual({ group: 'AND', children: [{ field: 'customerId', operator: 'IN', value: [2] }] });
        expect(renderedColumn(element, 'customerId')).toEqual(['GLOBEX']);
    });

    it("expect the filter menu of a lookup column to offer the text operators, IS_BLANK on the cell's value", async () => {
        const { element, datasource } = await mount();
        openFilterMenu(element, 'customerId');
        const ids = menuTreeIds();
        expect(ids).toContain('filter.operator.contains');
        expect(ids).not.toContain('filter.operator.greaterThanOrEqualTo');

        openFilterMenu(element, 'customerId');
        menuEntry('filter.filter.isBlank').click();
        expect(renderedColumn(element, 'customerId')).toEqual(['']);
        expect(datasource.getDataRows()).toHaveLength(1);
    });

    it('expect the CSV export to write the labels, and the values with formatted: false', async () => {
        const { gridInterface } = await mount();
        const csv = gridInterface.getCsv({ fields: ['country', 'customerId'] });
        expect(csv.split('\r\n')).toEqual(['Country,Customer', 'Norway,GLOBEX', 'Sweden,ACME', 'XX,', ',INITECH', '']);
        expect(gridInterface.getCsv({ fields: ['country'], formatted: false }).split('\r\n')[1]).toEqual('NO');
    });

    it('expect copy to give the labels, paste of a label to write its value and set', async () => {
        const { element, datasource, gridInterface } = await mount();
        const ctx = gridOf(element);
        const copied = rangesClipboard(ctx, [{ fromRow: 0, fromField: 'country', toRow: 1, toField: 'customerId' }]);
        // the labels of the columns first (GridConfig.copyHeaders)
        expect(copied.text).toEqual('Country\tCustomer\r\nNorway\tGLOBEX\r\nSweden\tACME\r\n');

        // pasted into the first two rows, the other way around
        gridInterface.setRanges([{ fromRow: 0, fromField: 'country', toRow: 0, toField: 'customerId' }]);
        focusCell(element, 'country', 0);
        const paste = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
        Object.defineProperty(paste, 'clipboardData', { value: { getData: () => 'sweden\tINITECH' } });
        document.activeElement?.dispatchEvent(paste);

        const row = datasource.getAllData()[0];
        expect([row.country, row.customerId, row.customerName, row.city]).toEqual(['SE', 3, 'INITECH', 'Oslo']);
        // one step
        datasource.undo();
        expect([row.country, row.customerId, row.customerName, row.city]).toEqual(['NO', 2, 'GLOBEX', 'Bergen']);
    });

    it('expect fill down to copy the value and write the fields of set from the lookup, one step', async () => {
        const { element, datasource, gridInterface } = await mount();
        // the second row gets the first row's customer
        press(focusCell(element, 'customerId', 1), 'd', { ctrlKey: true, code: 'KeyD' });
        const row = datasource.getAllData()[1];
        expect([row.customerId, row.customerName, row.city]).toEqual([2, 'GLOBEX', 'Bergen']);
        datasource.undo();
        expect([row.customerId, row.customerName, row.city]).toEqual([1, 'ACME', 'Oslo']);
        gridInterface.clearRanges();
    });

    it('expect Find to find the labels the cells show', async () => {
        const { gridInterface } = await mount();
        expect(gridInterface.find('sweden')).toBe(1);
        expect(gridInterface.find('SE')).toBe(0);
        // the label of the customer, and its name set into customerName
        expect(gridInterface.find('initech')).toBe(2);
        gridInterface.closeFind();
    });

    it("expect the row menu's clear to empty the fields of set too", async () => {
        const { element, datasource } = await mount();
        datasource.select(1);
        openRowMenu(element, 'customerId', 0);
        menuEntry('row.clear.cell').click();
        const row = datasource.getAllData()[0];
        expect([row.customerId, row.customerName, row.city]).toEqual([null, null, null]);
    });
});
