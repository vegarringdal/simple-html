// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridConfig } from '../gridConfig';
import type { GridElement } from '../gridElement';
import {
    mountGrid,
    selectorRowOf,
    simpleConfig,
    simpleData,
    simpleFields,
    stubCanvas,
    stubElementSizes
} from './gridTestHelpers';

/**
 * Delete on a row number (deleteRows.ts): a click on a row number selects the row and gives the number
 * the focus, as a spreadsheet's row header; Delete or Backspace there marks rows for deletion - the
 * selected rows, or the number's row alone when it is not selected - one step of the undo history.
 * Delete in a cell is still the input's (or the range's clear).
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

const editable = (options: Partial<GridConfig> = {}): GridConfig => ({ ...simpleConfig(), readonly: false, ...options });

/** the row number cell (the gridcell) of a displayed row */
const numberCell = (element: GridElement, row: number) => selectorRowOf(element, row)?.firstElementChild as HTMLElement;

const key = (target: HTMLElement, init: KeyboardEventInit) => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
};

const states = (datasource: { getAllData(): any[] }) => datasource.getAllData().map((row) => row.__rowState ?? null);

describe('Delete on a row number', () => {
    it('expect a click on a row number to select the row and focus the number, not a stop of Tab', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        const cell = numberCell(element, 1);
        cell.click();

        expect(document.activeElement).toBe(cell);
        expect(cell.getAttribute('tabindex')).toEqual('-1');
        expect(datasource.getSelectedRows().map((row) => row.firstname)).toEqual(['first2']);
    });

    it('expect Delete to mark the selected rows, Ctrl+Z on the number to undo it', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        datasource.getSelection().selectRowRange(1, 3);

        const event = key(numberCell(element, 2), { key: 'Delete' });

        expect(event.defaultPrevented).toBe(true);
        expect(states(datasource)).toEqual([null, 'D', 'D', 'D', null]);
        key(numberCell(element, 2), { key: 'z', ctrlKey: true });
        expect(states(datasource)).toEqual([null, null, null, null, null]);
    });

    it('expect the focus on the number after Delete and Ctrl+Z: marking renders the rows again', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        numberCell(element, 2).click();

        key(numberCell(element, 2), { key: 'Delete' });
        expect(document.activeElement).toBe(numberCell(element, 2));
        expect(states(datasource)).toEqual([null, null, 'D', null, null]);

        key(document.activeElement as HTMLElement, { key: 'z', ctrlKey: true });
        expect(states(datasource)).toEqual([null, null, null, null, null]);
        expect(element.contains(document.activeElement)).toBe(true);
    });

    it('expect Backspace on a number whose row is not selected to mark that row alone', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        datasource.getSelection().selectRowRange(0, 1);

        key(numberCell(element, 4), { key: 'Backspace' });

        expect(states(datasource)).toEqual([null, null, null, null, 'D']);
    });

    it('expect a row locked by the isReadonly hook left out', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields(), {
            isReadonly: (row) => (row.firstname === 'first2' ? true : null)
        });
        datasource.getSelection().selectRowRange(0, 2);

        key(numberCell(element, 0), { key: 'Delete' });

        expect(states(datasource)).toEqual(['D', null, 'D', null, null]);
    });

    it('expect nothing in a readonly grid, and with Ctrl or Alt: the key is left to the browser', async () => {
        const readonly = await mountGrid(simpleConfig(), simpleData(), simpleFields());
        expect(key(numberCell(readonly.element, 0), { key: 'Delete' }).defaultPrevented).toBe(false);
        expect(states(readonly.datasource)).toEqual([null, null, null, null, null]);

        document.body.innerHTML = '';
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        key(numberCell(element, 0), { key: 'Delete', ctrlKey: true });
        key(numberCell(element, 0), { key: 'Delete', altKey: true });
        expect(states(datasource)).toEqual([null, null, null, null, null]);
    });

    it('expect Delete in a cell not to mark the row', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        datasource.getSelection().selectRowRange(0, 0);
        const input = element.querySelector('input[data-attribute="firstname"]') as HTMLInputElement;
        input.focus();

        key(input, { key: 'Delete' });

        expect(states(datasource)).toEqual([null, null, null, null, null]);
    });

    it('expect nothing on a group row number', async () => {
        const { element, datasource } = await mountGrid(editable(), simpleData(), simpleFields());
        datasource.group([{ attribute: 'lastname', title: 'Last' }]);

        key(numberCell(element, 0), { key: 'Delete' });

        expect(states(datasource)).toEqual([null, null, null, null, null]);
    });
});
