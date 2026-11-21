// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../datasource/entity';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import type { GridHooks } from '../gridHooks';
import {
    mountGrid,
    shownRowElements,
    simpleConfig,
    simpleData,
    simpleFields,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';

/**
 * the hooks of a cell: isReadonly(row, field, readonlyByConfig) and cellClass(row, field)
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

afterEach(() => {
    vi.restoreAllMocks();
});

/**
 * the cells of a field in the rows on screen, in row order: the input, and the element behind it
 * that gets the background classes
 */
function cellsOf(element: GridElement, field: string) {
    return shownRowElements(element).map((row) => {
        const input = row.querySelector(`input[data-attribute="${field}"]`) as HTMLInputElement;
        return { input, background: input.previousElementSibling as HTMLElement };
    });
}

const readonlyOf = (element: GridElement, field: string) => cellsOf(element, field).map((cell) => cell.input.readOnly);

/** editable grid, with the columns given */
const editable = (columns: GridConfig['columns'] = {}): GridConfig => ({ ...simpleConfig(), readonly: false, columns });

/** an editable grid with the hooks */
const mountEditable = (hooks: GridHooks, columns?: GridConfig['columns']) =>
    mountGrid(editable(columns), simpleData(), simpleFields(), hooks);

describe('isReadonly', () => {
    it('expect it to make cells readonly per row', async () => {
        const { element } = await mountEditable({
            isReadonly: (row, field) => (field === 'firstname' && row.age > 20 ? true : null)
        });

        expect(readonlyOf(element, 'firstname')).toEqual([false, false, true, true, true]);
        expect(readonlyOf(element, 'lastname')).toEqual([false, false, false, false, false]);
        // a readonly cell gets the readonly stripes behind it
        expect(cellsOf(element, 'firstname').map((cell) => cell.background.classList.contains('simple-html-readonly'))).toEqual([
            false,
            false,
            true,
            true,
            true
        ]);
    });

    it('expect null and undefined to leave it to the column config', async () => {
        const { element } = await mountEditable(
            { isReadonly: (row) => (row.age === 10 ? null : undefined) },
            { lastname: { readonly: true } }
        );

        expect(readonlyOf(element, 'lastname')).toEqual([true, true, true, true, true]);
        expect(readonlyOf(element, 'firstname')).toEqual([false, false, false, false, false]);
    });

    it('expect false to make a cell editable that the column config makes readonly', async () => {
        const { element } = await mountEditable(
            { isReadonly: (row, field) => (field === 'lastname' && row.age === 10 ? false : null) },
            { lastname: { readonly: true } }
        );

        expect(readonlyOf(element, 'lastname')).toEqual([false, true, true, true, true]);
    });

    it('expect it to get the row, the field and what the column config says', async () => {
        const calls: { row: Entity; field: string; readonlyByConfig: boolean }[] = [];
        const { datasource } = await mountEditable(
            {
                isReadonly: (row, field, readonlyByConfig) => {
                    calls.push({ row, field, readonlyByConfig });
                    return null;
                }
            },
            { lastname: { readonly: true } }
        );

        const firstRow = datasource.getRow(0);
        expect(calls).toContainEqual({ row: firstRow, field: 'firstname', readonlyByConfig: false });
        expect(calls).toContainEqual({ row: firstRow, field: 'lastname', readonlyByConfig: true });
    });

    it("expect the grid's readonly to win", async () => {
        // the grid is readonly by default
        const { element } = await mountGrid(simpleConfig(), simpleData(), simpleFields(), { isReadonly: () => false });

        expect(readonlyOf(element, 'firstname')).toEqual([true, true, true, true, true]);
    });

    it('expect refresh() to render the cells again when what it reads changed', async () => {
        let locked = false;
        const { element, gridInterface } = await mountEditable({ isReadonly: () => (locked ? true : null) });

        locked = true;
        expect(readonlyOf(element, 'age')[0]).toBe(false);
        gridInterface.refresh();

        expect(readonlyOf(element, 'age')[0]).toBe(true);
    });
});

describe('cellClass', () => {
    it('expect it to add classes per cell', async () => {
        const { element } = await mountEditable({
            cellClass: (row, field) => (field === 'age' && row.age > 30 ? { input: 'old', background: 'old-bg' } : null)
        });

        const age = cellsOf(element, 'age');
        expect(age.map((cell) => cell.input.classList.contains('old'))).toEqual([false, false, false, true, true]);
        expect(age.map((cell) => cell.background.classList.contains('old-bg'))).toEqual([false, false, false, true, true]);
        expect(cellsOf(element, 'firstname').some((cell) => cell.input.classList.contains('old'))).toBe(false);
    });

    it('expect several classes separated by spaces, and either key left out', async () => {
        const { element } = await mountEditable({
            cellClass: (_row, field) => (field === 'firstname' ? { input: 'a b' } : { background: 'c' })
        });

        const firstname = cellsOf(element, 'firstname')[0];
        expect(firstname.input.classList.contains('a')).toBe(true);
        expect(firstname.input.classList.contains('b')).toBe(true);
        expect(firstname.background.classList.contains('c')).toBe(false);
        expect(cellsOf(element, 'lastname')[0].background.classList.contains('c')).toBe(true);
    });

    it('expect the background class to sit next to the readonly class', async () => {
        // v5 joined the two without a space: "simple-html-readonlymark"
        const { element } = await mountEditable({ cellClass: () => ({ background: 'mark' }) }, { age: { readonly: true } });

        const background = cellsOf(element, 'age')[0].background;
        expect(background.classList.contains('simple-html-readonly')).toBe(true);
        expect(background.classList.contains('mark')).toBe(true);
    });

    it('expect it to get the row and the field', async () => {
        const calls: { row: Entity; field: string }[] = [];
        const { datasource } = await mountEditable({
            cellClass: (row, field) => {
                calls.push({ row, field });
                return undefined;
            }
        });

        expect(calls).toContainEqual({ row: datasource.getRow(1), field: 'age' });
    });

    it('expect updateHooks to set and remove it', async () => {
        const { element, gridInterface } = await mountEditable({});

        gridInterface.updateHooks({ cellClass: () => ({ input: 'marked' }) });
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(true);

        gridInterface.updateHooks({ cellClass: undefined });
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(false);
    });
});

describe('updateHooks', () => {
    it('expect only the hooks given to change, and the cells to be rendered again', async () => {
        const { element, gridInterface } = await mountEditable({ isReadonly: (_row, field) => (field === 'age' ? true : null) });
        expect(readonlyOf(element, 'age')[0]).toBe(true);

        gridInterface.updateHooks({ cellClass: () => ({ input: 'marked' }) });

        // isReadonly was not given: it stays
        expect(readonlyOf(element, 'age')[0]).toBe(true);
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(true);

        gridInterface.updateHooks({ isReadonly: undefined });

        expect(readonlyOf(element, 'age')[0]).toBe(false);
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(true);
    });

    it('expect the grid to keep a copy of the hooks object, not the object', async () => {
        const hooks: GridHooks = { isReadonly: () => true };
        const { element, gridInterface } = await mountEditable(hooks);

        hooks.isReadonly = () => false;
        hooks.cellClass = () => ({ input: 'marked' });
        gridInterface.refresh();

        expect(readonlyOf(element, 'age')[0]).toBe(true);
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(false);
    });

    it('expect updateConfig to keep the hooks', async () => {
        const { element, gridInterface } = await mountEditable({ cellClass: () => ({ input: 'marked' }) });

        gridInterface.updateConfig({ cellHeight: 30 });

        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(true);
    });
});
