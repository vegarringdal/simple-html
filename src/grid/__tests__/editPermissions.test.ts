// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
// the picker element registers itself on import, the package entry does this for users
import '../../date/dateElement';
import { Datasource } from '../../datasource/dataSource';
import type { DatasourceOptions } from '../../datasource/datasourceOptions';
import type { Entity } from '../../datasource/entity';
import type { CellRange } from '../cellRange';
import { type CellRenderContext, registerCellRenderer } from '../cellRendererRegistry';
import type { EditPermissions, GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import {
    assertEditPermissions,
    EDIT_PERMISSIONS,
    editPermissionsOf,
    isNewRow,
    mayChangeRow,
    mayChangeValues,
    mayDeleteRow
} from '../gridFunctions/editPermissions';
import { fillRows } from '../gridFunctions/fillDown';
import type { HTMLCellElement } from '../gridFunctions/HTMLCellElement';
import type { GridHooks } from '../gridHooks';
import { GridInterface } from '../gridInterface';
import { registerLookup } from '../lookup';
import { mountGrid, selectorRowOf, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { menuEntry, menuTreeIds, openRowMenu, sleep } from './interactionTestHelpers';

/**
 * The edit permissions, `GridConfig.edit`: what the user may do in an editable grid - add rows, change
 * values, delete rows. `change: false` locks the rows that were there on every edit path (typing, the
 * editors, checkboxes, paste, clear, fill down, the row menu, the detail form), a new row stays editable
 * while `add` is allowed; `delete: false` stops marking the rows that were there, a new row can always be
 * taken out. Undo, redo and the reverts keep working. The rules themselves are in editPermissions.ts.
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
    const countries = new Datasource();
    countries.setData([
        { code: 'NO', name: 'Norway' },
        { code: 'SE', name: 'Sweden' }
    ]);
    registerLookup('edit-permissions-countries', { datasource: countries, valueField: 'code', labelField: 'name' });
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

/** the fields of the layout, in its order */
const COLUMNS = ['name', 'age', 'born', 'active', 'notes', 'country'];

const data = () => [
    { id: 1, name: 'Ann', age: 30, born: new Date(2001, 4, 17), active: true, notes: 'one\ntwo', country: 'NO' },
    { id: 2, name: 'Bob', age: 40, born: new Date(2002, 4, 17), active: false, notes: 'note', country: 'SE' },
    { id: 3, name: 'Cid', age: 50, born: new Date(2003, 4, 17), active: true, notes: 'note', country: 'NO' }
];

const fields = (): DatasourceOptions => ({
    key: 'id',
    fields: {
        id: 'number',
        name: { validate: ['required'] },
        age: 'number',
        born: 'date',
        active: 'boolean',
        notes: { multiline: true }
    }
});

const config = (edit?: EditPermissions, more: Partial<GridConfig> = {}): GridConfig => ({
    readonly: false,
    edit,
    columns: { country: { editor: { type: 'select', lookup: 'edit-permissions-countries' } } },
    layout: { center: COLUMNS.map((field) => ({ fields: [field], width: 100 })) },
    ...more
});

/** the permissions of most tests: add only, the rows that were there stay as they are */
const ADD_ONLY: EditPermissions = { add: true, change: false, delete: false };

/**
 * a grid of the three rows, and a new row added after them (displayed row 3) - with no values but the
 * key, as an add button gives it. `newRow: false` for none
 */
async function mount(
    edit?: EditPermissions,
    more: Partial<GridConfig> = {},
    options: { newRow?: boolean; hooks?: GridHooks } = {}
) {
    const mounted = await mountGrid(config(edit, more), data(), fields(), options.hooks);
    if (options.newRow !== false) {
        mounted.datasource.addNewEmpty({}, { scrollTo: false });
    }
    const rows = mounted.datasource.getAllData();
    return { ...mounted, rows, old: rows[2], added: rows[3] };
}

/** the cell element of a displayed row and field, on screen */
function cellAt(element: GridElement, row: number, field: string): HTMLCellElement {
    const cells = Array.from(element.querySelectorAll('.simple-html-grid-col-cell[type="row-cell"]')) as HTMLCellElement[];
    const cell = cells.find(
        (one) =>
            one.$row === row &&
            one.$attribute === field &&
            (one.closest('.simple-html-grid-row') as HTMLElement).style.display === 'block'
    );
    if (!cell) {
        throw new Error(`no cell on screen for row ${row}, ${field}`);
    }
    return cell;
}

/** the input of a cell: the text input, or the checkbox */
const inputAt = (element: GridElement, row: number, field: string) =>
    cellAt(element, row, field).querySelector('input') as HTMLInputElement;

/** the class of the element behind the cell's input: the stripes of a readonly or a required cell */
const dimmedClass = (element: GridElement, row: number, field: string) =>
    (cellAt(element, row, field).querySelector('[data-attribute-dimmed]') as HTMLElement).className.trim();

/** what the user types: the text in the input and its input event */
function typeIn(input: HTMLInputElement, text: string) {
    input.focus();
    input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** a keydown on an element, returns the event */
function press(target: Element, key: string, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
}

/** a paste event on Ctrl+V at the element with the focus, with this text. Returns whether the grid took it */
function paste(text: string) {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', text);
    const event = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true, composed: true });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event.defaultPrevented;
}

/** waits for the grid's animation frame: the rows-changed microtask asks for it first */
const frame = async () => {
    await Promise.resolve();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
};

const isDisabled = (id: string) => menuEntry(id).classList.contains('simple-html-grid-menu-item-disabled');

/** the name and age of the rows: what paste, clear and fill change */
const namesAndAges = (rows: Entity[]) => rows.map((row) => [row.name ?? null, row.age ?? null]);

/** a range of cells from a row and field to another */
const range = (fromRow: number, fromField: string, toRow: number, toField: string): CellRange => ({
    fromRow,
    fromField,
    toRow,
    toField
});

describe('edit permissions - the rules (editPermissions.ts)', () => {
    const row = (isNew: boolean) => ({ __controller: { __isNew: isNew } }) as unknown as Entity;

    it('expect every permission true unless it is false', () => {
        expect(EDIT_PERMISSIONS).toEqual(['add', 'change', 'delete']);
        expect(editPermissionsOf(undefined)).toEqual({ add: true, change: true, delete: true });
        expect(editPermissionsOf({})).toEqual({ add: true, change: true, delete: true });
        expect(editPermissionsOf({ change: false })).toEqual({ add: true, change: false, delete: true });
        expect(editPermissionsOf({ add: false, change: false, delete: false })).toEqual({
            add: false,
            change: false,
            delete: false
        });
    });

    it('expect a row to be new while its controller says so: added and not saved yet', () => {
        expect([isNewRow(row(true)), isNewRow(row(false)), isNewRow({})]).toEqual([true, false, false]);
    });

    // every combination: [add, change, delete] -> what the user may do with a row that was there and a new one
    const COMBINATIONS: [boolean, boolean, boolean][] = [
        [true, true, true],
        [true, true, false],
        [true, false, true],
        [true, false, false],
        [false, true, true],
        [false, true, false],
        [false, false, true],
        [false, false, false]
    ];

    it.each(COMBINATIONS)('expect add %s, change %s, delete %s to allow what it says', (add, change, del) => {
        const edit = { add, change, delete: del };
        // a row that was there: change and delete decide
        expect(mayChangeRow(edit, row(false))).toBe(change);
        expect(mayDeleteRow(edit, row(false))).toBe(del);
        // a new row: filled in by who may add, always taken out again
        expect(mayChangeRow(edit, row(true))).toBe(change || add);
        expect(mayDeleteRow(edit, row(true))).toBe(true);
        expect(mayChangeValues(edit)).toBe(change || add);
    });
});

describe('edit permissions - the config', () => {
    it('expect all three allowed when edit is left out, in the parsed config', async () => {
        const { gridInterface } = await mount(undefined, {}, { newRow: false });
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: true, delete: true });

        gridInterface.updateConfig({ edit: { delete: false } });
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: true, delete: false });
    });

    it('expect a TypeError for an edit that is no object of add, change and delete, each true or false', () => {
        const make = (edit: unknown) => () => new GridInterface(config(edit as EditPermissions), new Datasource(fields()));

        expect(make(true)).toThrow(/GridConfig: edit is true, it is an object of what the user may do/);
        // null is an option left out: every permission
        expect(make(null)()).toBeInstanceOf(GridInterface);
        expect(make(['add'])).toThrow(TypeError);
        expect(make('add')).toThrow(TypeError);
        // a misspelt permission would leave the user allowed without a word
        expect(make({ chnage: false })).toThrow(/GridConfig: edit\.chnage is not a permission, they are add, change, delete/);
        expect(make({ delete: 'false' })).toThrow(/GridConfig: edit\.delete is "false", it is true or false/);
        expect(make({ add: 0 })).toThrow(TypeError);
        // left out, undefined and booleans are fine
        expect(make(undefined)).not.toThrow();
        expect(make({ add: undefined, change: false, delete: true })).not.toThrow();
        expect(() => assertEditPermissions({})).not.toThrow();
    });

    it('expect updateConfig() to check edit before it changes anything', async () => {
        const { gridInterface } = await mount(ADD_ONLY, {}, { newRow: false });

        expect(() => gridInterface.updateConfig({ edit: { remove: false } as EditPermissions, cellHeight: 40 })).toThrow(
            /edit\.remove is not a permission/
        );
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: false, delete: false });
        expect(gridInterface.__getGridConfig().cellHeight).toEqual(22);
    });

    it('expect updateConfig({ edit }) to replace the permissions as a whole, and undefined to allow all', async () => {
        const { gridInterface } = await mount(ADD_ONLY, {}, { newRow: false });

        gridInterface.updateConfig({ edit: { change: false } });
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: false, delete: true });

        // another option leaves them as they are
        gridInterface.updateConfig({ hideFilter: true });
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: false, delete: true });

        gridInterface.updateConfig({ edit: undefined });
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: true, delete: true });
    });

    it('expect the permissions not to be state: getState() has none, resetState() keeps them', async () => {
        const { gridInterface } = await mount(ADD_ONLY, {}, { newRow: false });

        expect(Object.keys(gridInterface.getState())).not.toContain('edit');
        gridInterface.resetState();
        expect(gridInterface.__getGridConfig().edit).toEqual({ add: true, change: false, delete: false });
    });

    it('expect the config passed in not to be changed', async () => {
        const edit: EditPermissions = { change: false };
        const given = config(edit);
        new GridInterface(given, new Datasource(fields()));
        expect(given.edit).toBe(edit);
        expect(edit).toEqual({ change: false });
    });
});

describe('edit permissions - change: false, typing and the cells', () => {
    it('expect the inputs of the rows that were there readonly, a new row editable while add is allowed', async () => {
        const { element } = await mount(ADD_ONLY);

        expect(inputAt(element, 0, 'name').readOnly).toBe(true);
        expect(inputAt(element, 2, 'age').readOnly).toBe(true);
        expect(inputAt(element, 3, 'name').readOnly).toBe(false);
        expect(inputAt(element, 3, 'age').readOnly).toBe(false);
    });

    it('expect typing in a row that was there not to write, in a new row to write', async () => {
        const { element, old, added } = await mount(ADD_ONLY);

        typeIn(inputAt(element, 2, 'name'), 'Changed');
        expect(old.name).toEqual('Cid');
        expect(old.__rowState).toBeUndefined();

        typeIn(inputAt(element, 3, 'name'), 'Dan');
        expect(added.name).toEqual('Dan');
        expect(added.__rowState).toEqual('N');
    });

    it('expect a new row readonly too when add is not allowed either: no change at all', async () => {
        const { element, added } = await mount({ add: false, change: false });

        expect(inputAt(element, 3, 'name').readOnly).toBe(true);
        typeIn(inputAt(element, 3, 'name'), 'Dan');
        expect(added.name).toBeUndefined();
    });

    it('expect the locked rows to look as in a readonly grid: no readonly or required stripes', async () => {
        const { element, old } = await mount(ADD_ONLY, {
            columns: { age: { readonly: true }, country: { editor: { type: 'select', lookup: 'edit-permissions-countries' } } }
        });
        // a row that was there with a missing required value
        old.name = '';
        await frame();

        expect(dimmedClass(element, 2, 'name')).toEqual('');
        expect(dimmedClass(element, 2, 'age')).toEqual('');
        // the new row: the stripes where it can be filled in
        expect(dimmedClass(element, 3, 'name')).toEqual('simple-html-mandatory');
        expect(dimmedClass(element, 3, 'age')).toEqual('simple-html-readonly');
    });

    it('expect a checkbox of a row that was there not to change, of a new row to change', async () => {
        const { element, old, added } = await mount(ADD_ONLY);

        inputAt(element, 2, 'active').click();
        expect(old.active).toBe(true);

        inputAt(element, 3, 'active').click();
        expect(added.active).toBe(true);
    });

    it('expect the date picker to open on a new row only', async () => {
        const { element } = await mount(ADD_ONLY);

        inputAt(element, 2, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await sleep(10);
        expect(document.querySelector('simple-html-date')).toBeNull();

        inputAt(element, 3, 'born').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await vi.waitFor(() => {
            if (!document.querySelector('simple-html-date')) {
                throw new Error('the picker is not open yet');
            }
        });
    });

    it('expect the text editor of a multiline cell to show the text only on a row that was there', async () => {
        const { element, added } = await mount(ADD_ONLY);
        const textarea = () => document.querySelector('.simple-html-grid-text-editor textarea') as HTMLTextAreaElement;

        const locked = inputAt(element, 0, 'notes');
        locked.focus();
        press(locked, 'Enter');
        expect(textarea().readOnly).toBe(true);
        // typing a character does not open it to edit either
        press(textarea(), 'Escape');

        const open = inputAt(element, 3, 'notes');
        open.focus();
        press(open, 'Enter');
        expect(textarea().readOnly).toBe(false);
        textarea().value = 'line 1\nline 2';
        textarea().dispatchEvent(new Event('input', { bubbles: true }));
        press(textarea(), 'Enter', { ctrlKey: true });
        expect(added.notes).toEqual('line 1\nline 2');
    });

    it('expect no lookup button, list or Delete on a row that was there; a new row picks', async () => {
        const { element, old } = await mount(ADD_ONLY);
        const button = (row: number) => cellAt(element, row, 'country').querySelector('.simple-html-grid-lookup-button');
        const list = () => document.querySelector('.simple-html-grid-lookup');

        expect(button(2)).toBeNull();
        const locked = inputAt(element, 2, 'country');
        locked.focus();
        press(locked, 'F4');
        expect(list()).toBeNull();
        press(locked, 'Delete');
        expect(old.country).toEqual('NO');

        expect(button(3)).not.toBeNull();
        const open = inputAt(element, 3, 'country');
        open.focus();
        press(open, 'F4');
        expect(list()).not.toBeNull();
    });

    it("expect a custom cell's renderer told readonly on a row that was there, not on a new row", async () => {
        const updates: CellRenderContext[] = [];
        registerCellRenderer('edit-permissions-recorder', () => ({ update: (context) => updates.push({ ...context }) }));
        await mount(ADD_ONLY, {
            columns: {
                name: { renderer: 'edit-permissions-recorder' },
                country: { editor: { type: 'select', lookup: 'edit-permissions-countries' } }
            }
        });
        const last = (rowIndex: number) => updates.filter((context) => context.rowIndex === rowIndex).at(-1);

        expect(last(2)?.readonly).toBe(true);
        expect(last(3)?.readonly).toBe(false);
    });

    it('expect the isReadonly hook not to unlock a row that was there, and to make a new row readonly', async () => {
        const { gridInterface, element, old, added } = await mount(
            ADD_ONLY,
            {},
            { hooks: { isReadonly: (row, field) => (field === 'age' ? row.__rowState === 'N' : false) } }
        );

        expect(gridInterface.__isCellReadonly(old, 'name')).toBe(true);
        expect(gridInterface.__isCellReadonly(added, 'name')).toBe(false);
        expect(gridInterface.__isCellReadonly(added, 'age')).toBe(true);
        expect(inputAt(element, 2, 'name').readOnly).toBe(true);
        expect(inputAt(element, 3, 'age').readOnly).toBe(true);
    });

    it("expect the user's Read only of the column settings not to unlock a row either", async () => {
        const { gridInterface, old, added } = await mount(ADD_ONLY, {
            columns: { age: { readonly: true }, country: { editor: { type: 'select', lookup: 'edit-permissions-countries' } } }
        });

        // the user's format wins over the column's readonly - not over the permissions
        gridInterface.setState({ formats: { age: { readonly: false } } });
        expect(gridInterface.__isCellReadonly(old, 'age')).toBe(true);
        expect(gridInterface.__isCellReadonly(added, 'age')).toBe(false);
    });

    it('expect a new row to be locked once acceptChanges() takes it in', async () => {
        const { element, datasource, added } = await mount(ADD_ONLY);

        typeIn(inputAt(element, 3, 'name'), 'Dan');
        datasource.acceptChanges();
        await frame();

        expect(added.__rowState).toBeUndefined();
        expect(inputAt(element, 3, 'name').readOnly).toBe(true);
    });

    it('expect updateConfig() to lock and unlock the cells while the grid is shown', async () => {
        const { element, gridInterface, old } = await mount(undefined);

        expect(inputAt(element, 2, 'name').readOnly).toBe(false);
        gridInterface.updateConfig({ edit: { change: false } });
        expect(inputAt(element, 2, 'name').readOnly).toBe(true);
        typeIn(inputAt(element, 2, 'name'), 'Changed');
        expect(old.name).toEqual('Cid');

        gridInterface.updateConfig({ edit: undefined });
        expect(inputAt(element, 2, 'name').readOnly).toBe(false);
        typeIn(inputAt(element, 2, 'name'), 'Changed');
        expect(old.name).toEqual('Changed');
    });

    it('expect updateConfig({ edit }) to close an open editor unsaved, and an open menu', async () => {
        const { element, gridInterface, rows } = await mount(undefined);
        const textEditor = () => document.querySelector('.simple-html-grid-text-editor textarea') as HTMLTextAreaElement | null;
        const menu = () => document.querySelector('.simple-html-grid-popover .simple-html-grid-menu');

        // the editor of a multiline cell, typed in
        const notes = inputAt(element, 1, 'notes');
        notes.focus();
        press(notes, 'Enter');
        (textEditor() as HTMLTextAreaElement).value = 'typed\nbefore the lock';
        textEditor()?.dispatchEvent(new Event('input', { bubbles: true }));

        gridInterface.updateConfig({ edit: { change: false } });
        expect(textEditor()).toBeNull();
        expect(rows[1].notes).toEqual('note');

        // the row menu, its Delete › Row worked out under the old permissions
        gridInterface.updateConfig({ edit: undefined });
        openRowMenu(element, 'name', 1);
        expect(menu()).not.toBeNull();
        gridInterface.updateConfig({ edit: { delete: false } });
        expect(menu()).toBeNull();
    });

    it('expect updateConfig() without edit to leave an open editor as it is', async () => {
        const { element, gridInterface } = await mount(ADD_ONLY);
        const textEditor = () => document.querySelector('.simple-html-grid-text-editor textarea');

        const notes = inputAt(element, 3, 'notes');
        notes.focus();
        press(notes, 'Enter');
        gridInterface.updateConfig({ dimRepeatedValues: true });
        expect(textEditor()).not.toBeNull();
    });
});

describe('edit permissions - change: false, paste, clear and fill down', () => {
    it('expect a pasted block to skip the rows that were there and fill the new row', async () => {
        const { element, rows } = await mount(ADD_ONLY);

        inputAt(element, 2, 'name').focus();
        expect(paste('P1\t5\nP2\t6')).toBe(true);

        expect(namesAndAges(rows)).toEqual([
            ['Ann', 30],
            ['Bob', 40],
            ['Cid', 50],
            ['P2', 6]
        ]);
    });

    it('expect one value pasted into a cell of a row that was there to change nothing', async () => {
        const { element, old } = await mount(ADD_ONLY);

        inputAt(element, 2, 'name').focus();
        // the input is readonly: the grid takes the paste, and skips the cell
        expect(paste('Pasted')).toBe(true);
        expect(old.name).toEqual('Cid');
    });

    it('expect Delete on ranges of cells to clear the new row only', async () => {
        const { element, gridInterface, rows } = await mount(ADD_ONLY);
        rows[3].name = 'Dan';
        rows[3].age = 60;
        gridInterface.setRanges([range(2, 'name', 3, 'age')]);

        const event = press(inputAt(element, 2, 'name'), 'Delete');

        expect(event.defaultPrevented).toBe(true);
        expect(namesAndAges(rows).slice(2)).toEqual([
            ['Cid', 50],
            [null, null]
        ]);
    });

    it('expect fill down (Ctrl+D, fillDown()) to fill a new row from a row above, never a row that was there', async () => {
        const { element, gridInterface, rows } = await mount(ADD_ONLY);

        // Ctrl+D in a row that was there, no range: the row above is not copied into it
        const event = press(inputAt(element, 1, 'name'), 'd', { ctrlKey: true });
        expect(event.defaultPrevented).toBe(true);
        expect(rows[1].name).toEqual('Bob');

        // a range from a row that was there down to the new row
        gridInterface.setRanges([range(1, 'name', 3, 'age')]);
        gridInterface.fillDown();
        expect(namesAndAges(rows)).toEqual([
            ['Ann', 30],
            ['Bob', 40],
            ['Cid', 50],
            ['Bob', 40]
        ]);
    });

    it('expect the fill handle to fill the new row only', async () => {
        const { gridInterface, rows } = await mount(ADD_ONLY);

        // the handle dragged from a range of row 0 down to row 3
        fillRows(gridInterface, range(0, 'name', 0, 'age'), 1, 3);

        expect(namesAndAges(rows)).toEqual([
            ['Ann', 30],
            ['Bob', 40],
            ['Cid', 50],
            ['Ann', 30]
        ]);
    });

    it("expect paste, Delete, Ctrl+D and the fill handle to be the browser's where nothing can change", async () => {
        const { element, gridInterface, rows } = await mount({ add: false, change: false, delete: true });
        gridInterface.setRanges([range(2, 'name', 3, 'age')]);

        inputAt(element, 2, 'name').focus();
        expect(paste('P1\t5\nP2\t6')).toBe(false);
        expect(press(inputAt(element, 2, 'name'), 'Delete').defaultPrevented).toBe(false);
        expect(press(inputAt(element, 2, 'name'), 'd', { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(element.querySelector('.simple-html-grid-fill-handle')).toBeNull();
        gridInterface.fillDown();
        fillRows(gridInterface, range(0, 'name', 0, 'age'), 1, 3);

        expect(namesAndAges(rows)).toEqual([
            ['Ann', 30],
            ['Bob', 40],
            ['Cid', 50],
            [null, null]
        ]);
    });

    it('expect the fill handle shown while new rows can be filled in', async () => {
        const { element, gridInterface } = await mount(ADD_ONLY);
        gridInterface.setRanges([range(0, 'name', 1, 'age')]);
        expect(element.querySelector('.simple-html-grid-fill-handle')).not.toBeNull();
    });
});

describe('edit permissions - change: false, the row menu', () => {
    it('expect Paste › and Clear › listed, their cell entries greyed out on a row that was there', async () => {
        const { element } = await mount(ADD_ONLY);

        openRowMenu(element, 'name', 2);
        expect(menuTreeIds()).toEqual(expect.arrayContaining(['row.paste', 'row.clear', 'row.edit']));
        expect([isDisabled('row.paste.current'), isDisabled('row.clear.current')]).toEqual([true, true]);

        openRowMenu(element, 'name', 3);
        expect([isDisabled('row.paste.current'), isDisabled('row.clear.current')]).toEqual([false, false]);
    });

    it('expect Clear cell (selected rows) to clear the new row only', async () => {
        const { element, datasource, rows } = await mount(ADD_ONLY);
        rows[3].name = 'Dan';
        datasource.selectAll();

        openRowMenu(element, 'name', 0);
        menuEntry('row.clear.cell').click();

        expect(rows.map((row) => row.name ?? null)).toEqual(['Ann', 'Bob', 'Cid', null]);
    });

    it('expect Paste cell (selected rows) to paste into the new row only', async () => {
        const { element, datasource, rows } = await mount(ADD_ONLY);
        vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('Pasted');
        datasource.selectAll();

        openRowMenu(element, 'name', 0);
        menuEntry('row.paste.cell').click();
        await sleep(0);

        expect(rows.map((row) => row.name ?? null)).toEqual(['Ann', 'Bob', 'Cid', 'Pasted']);
    });

    it('expect no Paste › and Clear › where no value can change, Undo / Redo › and Delete › stay', async () => {
        const { element } = await mount({ add: false, change: false, delete: true });

        openRowMenu(element, 'name', 3);
        const ids = menuTreeIds();
        expect(ids).not.toContain('row.paste');
        expect(ids).not.toContain('row.clear');
        expect(ids).toEqual(expect.arrayContaining(['row.edit', 'row.delete']));
    });
});

describe('edit permissions - change: false, the detail form', () => {
    const detailForm = { show: true, fields: ['name', 'age', 'active'] };
    const control = (element: GridElement, field: string) =>
        element.querySelector(`.simple-html-grid-detail-form [data-field="${field}"] input`) as HTMLInputElement;

    it('expect the fields of a row that was there readonly, of a new row editable', async () => {
        const { element, datasource, old, added } = await mount(ADD_ONLY, { detailForm });

        datasource.setRowAsCurrentEntity(2);
        await sleep(20);
        expect(control(element, 'name').readOnly).toBe(true);
        expect(control(element, 'active').getAttribute('aria-readonly')).toEqual('true');
        typeIn(control(element, 'name'), 'Changed');
        expect(old.name).toEqual('Cid');

        datasource.setRowAsCurrentEntity(3);
        await sleep(20);
        expect(control(element, 'name').readOnly).toBe(false);
        typeIn(control(element, 'name'), 'Dan');
        expect(added.name).toEqual('Dan');
    });

    it('expect the form to follow updateConfig({ edit })', async () => {
        const { element, datasource, gridInterface, old } = await mount(ADD_ONLY, { detailForm });
        datasource.setRowAsCurrentEntity(2);
        await sleep(20);
        expect(control(element, 'name').readOnly).toBe(true);

        gridInterface.updateConfig({ edit: undefined });
        expect(control(element, 'name').readOnly).toBe(false);
        typeIn(control(element, 'name'), 'Changed');
        expect(old.name).toEqual('Changed');
    });
});

describe('edit permissions - what still works with change: false', () => {
    it('expect undo and redo of what was typed in a new row', async () => {
        const { element, added } = await mount(ADD_ONLY);
        const input = inputAt(element, 3, 'name');
        typeIn(input, 'Dan');
        input.blur();

        openRowMenu(element, 'name', 0);
        menuEntry('row.edit.undo').click();
        expect(added.name).toBeUndefined();

        openRowMenu(element, 'name', 0);
        menuEntry('row.edit.redo').click();
        expect(added.name).toEqual('Dan');
    });

    it("expect the reverts to put back a value of a row that was there: your code's edit", async () => {
        const { element, old } = await mount(ADD_ONLY);
        // an edit of your code: not stopped by the permissions
        old.name = 'Changed by code';
        await frame();

        openRowMenu(element, 'name', 2);
        expect(isDisabled('row.edit.revertCell')).toBe(false);
        menuEntry('row.edit.revertCell').click();
        expect(old.name).toEqual('Cid');

        old.age = 99;
        await frame();
        (cellAt(element, 2, 'age').querySelector('.simple-html-cell-edited-marker') as HTMLElement).click();
        expect(old.age).toEqual(50);
    });
});

describe('edit permissions - delete: false', () => {
    it('expect Delete › listed, Row greyed out on a row that was there and usable on a new row', async () => {
        const { element, datasource, added } = await mount({ delete: false });

        openRowMenu(element, 'name', 2);
        expect(menuTreeIds()).toEqual(expect.arrayContaining(['row.delete', 'row.delete.row', 'row.delete.rows']));
        expect(isDisabled('row.delete.row')).toBe(true);

        openRowMenu(element, 'name', 3);
        expect(isDisabled('row.delete.row')).toBe(false);
        menuEntry('row.delete.row').click();
        expect(added.__rowState).toEqual('D');
        // a new row taken out: nothing to send
        expect(datasource.getChanges()).toMatchObject({ newEntities: [], deletedEntities: [] });
    });

    it('expect Rows (selected rows) to mark the new rows only, greyed out without one', async () => {
        const { element, datasource, rows } = await mount({ delete: false });
        datasource.getSelection().selectRowRange(0, 1);

        openRowMenu(element, 'name', 0);
        expect(isDisabled('row.delete.rows')).toBe(true);

        datasource.selectAll();
        openRowMenu(element, 'name', 0);
        menuEntry('row.delete.rows').click();
        expect(rows.map((row) => row.__rowState ?? null)).toEqual([null, null, null, 'D']);
    });

    it('expect Undo (selected rows) to take off a mark your code made', async () => {
        const { element, datasource, old } = await mount({ delete: false });
        datasource.markForDeletion(old);
        datasource.selectAll();

        openRowMenu(element, 'name', 0);
        expect(isDisabled('row.delete.undo')).toBe(false);
        menuEntry('row.delete.undo').click();
        expect(old.__rowState).toBeUndefined();
    });

    it('expect Delete on a row number to leave a row that was there, and to take out a new row', async () => {
        const { element, rows } = await mount({ delete: false });
        const number = (row: number) => selectorRowOf(element, row)?.firstElementChild as HTMLElement;

        press(number(1), 'Delete');
        expect(rows[1].__rowState).toBeUndefined();

        press(number(3), 'Delete');
        expect(rows[3].__rowState).toEqual('D');
    });

    it('expect the menu of a row number to grey out Delete › the same way', async () => {
        const { element } = await mount({ delete: false });
        const number = selectorRowOf(element, 1)?.firstElementChild as HTMLElement;

        number.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(menuTreeIds()).toContain('row.delete');
        expect(isDisabled('row.delete.row')).toBe(true);
    });

    it('expect Undo row edits to take out a new row: the undo of an add', async () => {
        const { element, added } = await mount({ delete: false });

        openRowMenu(element, 'name', 3);
        menuEntry('row.edit.revertRow').click();
        expect(added.__rowState).toEqual('D');
    });

    it('expect values to stay editable: delete says nothing about them', async () => {
        const { element, old } = await mount({ delete: false });
        typeIn(inputAt(element, 2, 'name'), 'Changed');
        expect(old.name).toEqual('Changed');
    });
});

describe('edit permissions - delete only', () => {
    const DELETE_ONLY: EditPermissions = { add: false, change: false, delete: true };

    it('expect rows to be deleted, and nothing typed, pasted or cleared', async () => {
        const { element, old } = await mount(DELETE_ONLY);

        typeIn(inputAt(element, 2, 'name'), 'Changed');
        expect(old.name).toEqual('Cid');

        openRowMenu(element, 'name', 2);
        expect(isDisabled('row.delete.row')).toBe(false);
        menuEntry('row.delete.row').click();
        expect(old.__rowState).toEqual('D');
    });
});

describe('edit permissions - add: false', () => {
    it('expect a new row your code adds to stay editable while change is allowed', async () => {
        const { element, added } = await mount({ add: false });
        typeIn(inputAt(element, 3, 'name'), 'Dan');
        expect(added.name).toEqual('Dan');
    });
});

describe('edit permissions - every combination in the grid', () => {
    const COMBINATIONS: [boolean, boolean, boolean][] = [
        [true, true, true],
        [true, true, false],
        [true, false, true],
        [true, false, false],
        [false, true, true],
        [false, true, false],
        [false, false, true],
        [false, false, false]
    ];

    it.each(COMBINATIONS)('expect add %s, change %s, delete %s: the cells and the row menu follow', async (add, change, del) => {
        const { element } = await mount({ add, change, delete: del });

        // typing: a row that was there by change, the new row by change or add
        expect(inputAt(element, 2, 'name').readOnly).toBe(!change);
        expect(inputAt(element, 3, 'name').readOnly).toBe(!(change || add));

        // the row menu: Paste › and Clear › where some value can change; Delete › always, Row by delete
        openRowMenu(element, 'name', 2);
        const ids = menuTreeIds();
        expect(ids.includes('row.paste')).toBe(change || add);
        expect(ids.includes('row.clear')).toBe(change || add);
        expect(isDisabled('row.delete.row')).toBe(!del);

        // a new row can always be taken out
        openRowMenu(element, 'name', 3);
        expect(isDisabled('row.delete.row')).toBe(false);
    });

    it('expect a readonly grid to stay readonly, whatever edit allows', async () => {
        const { element } = await mount({ add: true, change: true, delete: true }, { readonly: true });

        expect(inputAt(element, 2, 'name').readOnly).toBe(true);
        expect(inputAt(element, 3, 'name').readOnly).toBe(true);
        openRowMenu(element, 'name', 3);
        expect(menuTreeIds().filter((id) => /^row\.(edit|paste|clear|delete)$/.test(id))).toEqual([]);
    });
});
