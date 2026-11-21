// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { typeInHeaderFilter } from './interactionTestHelpers';

/**
 * Bugs found while writing the v6 docs: the guides were checked against what the grid does.
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
 * the row selector cell (the row number on the left) of a displayed row
 */
function selectorCell(element: GridElement, row: number) {
    return selectorRowOf(element, row)?.firstElementChild as HTMLElement;
}

const ctrlClick = (cell: HTMLElement) => cell.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));

describe('the selection mode belongs to the datasource', () => {
    it('expect the grid to keep the mode the datasource was made with', async () => {
        const { element, datasource, gridInterface } = await mountGrid(simpleConfig(), simpleData(), {
            ...simpleFields(),
            selectionMode: 'single'
        });
        // the grid used to set its own default, 'multiple', on every rebuild
        expect(datasource.getSelectionMode()).toBe('single');

        gridInterface.updateConfig({ readonly: false });
        gridInterface.rebuild();
        expect(datasource.getSelectionMode()).toBe('single');

        ctrlClick(selectorCell(element, 0));
        ctrlClick(selectorCell(element, 1));
        expect(datasource.getSelectedRows().map((row) => row.firstname)).toEqual(['first2']);
    });

    it('expect setSelectionMode() to apply while the grid is shown', async () => {
        const { element, datasource, gridInterface } = await mountGrid();

        datasource.setSelectionMode('none');
        gridInterface.rebuild();
        ctrlClick(selectorCell(element, 0));

        expect(datasource.getSelectionMode()).toBe('none');
        expect(datasource.getSelectedRows()).toEqual([]);
        // a click still makes the row current
        expect(datasource.currentEntity?.firstname).toBe('first1');
    });
});

describe('setData() while a header filter is set', () => {
    it('expect the new rows to be filtered like the rows before', async () => {
        const { element, datasource } = await mountGrid();
        typeInHeaderFilter(element, 'firstname', 'first1');
        expect(datasource.getDataRows().map((row) => row.firstname)).toEqual(['first1']);

        datasource.setData(simpleData());

        // used to show every row, while the header filter still showed first1
        expect(datasource.getDataRows().map((row) => row.firstname)).toEqual(['first1']);
    });
});

describe('group rows', () => {
    it('expect a click on a group row not to log to the console', async () => {
        const { element, datasource } = await mountGrid();
        datasource.group([{ attribute: 'lastname', title: 'lastname' }]);
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        const label = element.querySelector('.simple-html-label-group') as HTMLElement;
        label.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(log).not.toHaveBeenCalled();
    });
});
