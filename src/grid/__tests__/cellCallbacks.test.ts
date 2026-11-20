// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Entity } from '../../datasource/entity';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import { mountGrid, simpleConfig, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * the config callbacks: isReadonly(row, field, readonlyByConfig) and cellClass(row, field)
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
    const container = element.querySelector('.simple-html-grid-body-row-container-pinned-middle');
    return Array.from(container?.children ?? [])
        .filter((row) => (row as HTMLElement).style.display !== 'none')
        .sort((a, b) => Number(a.getAttribute('aria-rowindex')) - Number(b.getAttribute('aria-rowindex')))
        .map((row) => {
            const input = row.querySelector(`input[data-attribute="${field}"]`) as HTMLInputElement;
            return { input, background: input.previousElementSibling as HTMLElement };
        });
}

const readonlyOf = (element: GridElement, field: string) => cellsOf(element, field).map((cell) => cell.input.readOnly);

/** editable grid, the callbacks added */
const editable = (callbacks: Pick<GridConfig, 'isReadonly' | 'cellClass' | 'columns'>): GridConfig => ({
    ...simpleConfig(),
    readonly: false,
    ...callbacks
});

describe('isReadonly', () => {
    it('expect it to make cells readonly per row', async () => {
        const { element } = await mountGrid(
            editable({ isReadonly: (row, field) => (field === 'firstname' && row.age > 20 ? true : null) })
        );

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
        const { element } = await mountGrid(
            editable({
                columns: { lastname: { readonly: true } },
                isReadonly: (row) => (row.age === 10 ? null : undefined)
            })
        );

        expect(readonlyOf(element, 'lastname')).toEqual([true, true, true, true, true]);
        expect(readonlyOf(element, 'firstname')).toEqual([false, false, false, false, false]);
    });

    it('expect false to make a cell editable that the column config makes readonly', async () => {
        const { element } = await mountGrid(
            editable({
                columns: { lastname: { readonly: true } },
                isReadonly: (row, field) => (field === 'lastname' && row.age === 10 ? false : null)
            })
        );

        expect(readonlyOf(element, 'lastname')).toEqual([false, true, true, true, true]);
    });

    it('expect it to get the row, the field and what the column config says', async () => {
        const calls: { row: Entity; field: string; readonlyByConfig: boolean }[] = [];
        const { datasource } = await mountGrid(
            editable({
                columns: { lastname: { readonly: true } },
                isReadonly: (row, field, readonlyByConfig) => {
                    calls.push({ row, field, readonlyByConfig });
                    return null;
                }
            })
        );

        const firstRow = datasource.getRow(0);
        expect(calls).toContainEqual({ row: firstRow, field: 'firstname', readonlyByConfig: false });
        expect(calls).toContainEqual({ row: firstRow, field: 'lastname', readonlyByConfig: true });
    });

    it("expect the grid's readonly to win", async () => {
        const { element } = await mountGrid({ ...simpleConfig(), isReadonly: () => false }); // readonly by default

        expect(readonlyOf(element, 'firstname')).toEqual([true, true, true, true, true]);
    });

    it('expect refresh() to render the cells again when what it reads changed', async () => {
        let locked = false;
        const { element, gridInterface } = await mountGrid(editable({ isReadonly: () => (locked ? true : null) }));

        locked = true;
        expect(readonlyOf(element, 'age')[0]).toBe(false);
        gridInterface.refresh();

        expect(readonlyOf(element, 'age')[0]).toBe(true);
    });
});

describe('cellClass', () => {
    it('expect it to add classes per cell', async () => {
        const { element } = await mountGrid(
            editable({
                cellClass: (row, field) => (field === 'age' && row.age > 30 ? { input: 'old', background: 'old-bg' } : null)
            })
        );

        const age = cellsOf(element, 'age');
        expect(age.map((cell) => cell.input.classList.contains('old'))).toEqual([false, false, false, true, true]);
        expect(age.map((cell) => cell.background.classList.contains('old-bg'))).toEqual([false, false, false, true, true]);
        expect(cellsOf(element, 'firstname').some((cell) => cell.input.classList.contains('old'))).toBe(false);
    });

    it('expect several classes separated by spaces, and either key left out', async () => {
        const { element } = await mountGrid(
            editable({ cellClass: (_row, field) => (field === 'firstname' ? { input: 'a b' } : { background: 'c' }) })
        );

        const firstname = cellsOf(element, 'firstname')[0];
        expect(firstname.input.classList.contains('a')).toBe(true);
        expect(firstname.input.classList.contains('b')).toBe(true);
        expect(firstname.background.classList.contains('c')).toBe(false);
        expect(cellsOf(element, 'lastname')[0].background.classList.contains('c')).toBe(true);
    });

    it('expect the background class to sit next to the readonly class', async () => {
        // v5 joined the two without a space: "simple-html-readonlymark"
        const { element } = await mountGrid(
            editable({ columns: { age: { readonly: true } }, cellClass: () => ({ background: 'mark' }) })
        );

        const background = cellsOf(element, 'age')[0].background;
        expect(background.classList.contains('simple-html-readonly')).toBe(true);
        expect(background.classList.contains('mark')).toBe(true);
    });

    it('expect it to get the row and the field', async () => {
        const calls: { row: Entity; field: string }[] = [];
        const { datasource } = await mountGrid(
            editable({
                cellClass: (row, field) => {
                    calls.push({ row, field });
                    return undefined;
                }
            })
        );

        expect(calls).toContainEqual({ row: datasource.getRow(1), field: 'age' });
    });

    it('expect updateConfig to set and remove it', async () => {
        const { element, gridInterface } = await mountGrid(editable({}));

        gridInterface.updateConfig({ cellClass: () => ({ input: 'marked' }) });
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(true);

        gridInterface.updateConfig({ cellClass: undefined });
        expect(cellsOf(element, 'age')[0].input.classList.contains('marked')).toBe(false);
    });
});
