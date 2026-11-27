// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { and, where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { filterCallback } from '../gridFunctions/filterCallback';
import { refilterChangedFormats } from '../gridFunctions/headerFilterFormatter';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';
import { gridOf } from './interactionTestHelpers';

/**
 * A column's format changed - setState, updateConfig, the Format menu, the grid config dialog - and the
 * filter there is: a column filtered on its template filters on the new one; a header filter of a
 * column now shown as checkboxes, or no longer, is cleared
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

const rows = () => [
    { id: 1, first: 'Ann', last: 'Zed', flag: 'Y', qty: 1 },
    { id: 2, first: 'Bob', last: 'Ann', flag: 'N', qty: 0 },
    { id: 3, first: 'Cid', last: 'Berg', flag: 'Y', qty: 1 }
];

const layout = { center: ['id', 'first', 'last', 'flag', 'qty'].map((field) => ({ fields: [field], width: 100 })) };
const ids = (rowsShown: { id?: unknown }[]) => rowsShown.map((row) => row.id);

describe('another template, the filter runs again', () => {
    it('expect setState of another template to filter on the text it shows', async () => {
        const config: GridConfig = { columns: { first: { format: { text: '{first}' } } }, layout };
        const { datasource, gridInterface } = await mountGrid(config, rows(), { key: 'id' });
        datasource.filter(and(where('first', 'EQUAL', 'Ann')));
        expect(ids(datasource.getRows())).toEqual([1]);
        // the cell of row 2 shows Ann now
        gridInterface.setState({ formats: { first: { text: '{last}' } } });
        expect(ids(datasource.getRows())).toEqual([2]);
    });

    it('expect a template added by setState to a column without a format to filter on its text', async () => {
        const { datasource, gridInterface } = await mountGrid({ columns: {}, layout }, rows(), { key: 'id' });
        datasource.filter(and(where('first', 'EQUAL', 'Ann')));
        expect(ids(datasource.getRows())).toEqual([1]);
        gridInterface.setState({ formats: { first: { text: '{last}' } } });
        expect(ids(datasource.getRows())).toEqual([2]);
        // and taken away: the value again
        gridInterface.setState({ formats: {} });
        expect(ids(datasource.getRows())).toEqual([1]);
    });

    it('expect updateConfig with a column of another template to filter on it', async () => {
        const { datasource, gridInterface } = await mountGrid({ columns: {}, layout }, rows(), { key: 'id' });
        datasource.filter(and(where('first', 'EQUAL', 'Ann')));
        gridInterface.updateConfig({ columns: { first: { format: { text: '{last}' } } } });
        expect(ids(datasource.getRows())).toEqual([2]);
    });

    it('expect the Format menu’s way (before, setState, refilterChangedFormats) to filter on it', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ columns: {}, layout }, rows(), { key: 'id' });
        datasource.filter(and(where('first', 'EQUAL', 'Ann')));
        const before = gridInterface.getState().formats;
        gridInterface.setState({ formats: { first: { text: '{last}' } } });
        refilterChangedFormats(gridOf(element), before);
        expect(ids(datasource.getRows())).toEqual([2]);
    });
});

describe('a column shown as checkboxes now, or no longer: its header filter is cleared', () => {
    it('expect a text typed in its filter cleared when the column turns to checkboxes', async () => {
        const { element, datasource, gridInterface } = await mountGrid({ columns: {}, layout }, rows(), { key: 'id' });
        filterCallback(gridOf(element), 'N', 'flag');
        expect(ids(datasource.getRows())).toEqual([2]);
        const before = gridInterface.getState().formats;
        gridInterface.setState({ formats: { flag: { checkbox: { checked: 'Y', unchecked: 'N' } } } });
        refilterChangedFormats(gridOf(element), before);
        expect(ids(datasource.getRows())).toEqual([1, 2, 3]);
        expect(gridInterface.getState().headerFilters.flag?.value ?? null).toBeNull();
    });

    it('expect a checked filter cleared when the column is no longer checkboxes', async () => {
        const config: GridConfig = { columns: { flag: { format: { checkbox: { checked: 'Y', unchecked: 'N' } } } }, layout };
        const { element, datasource, gridInterface } = await mountGrid(config, rows(), { key: 'id' });
        filterCallback(gridOf(element), 'true', 'flag');
        expect(ids(datasource.getRows())).toEqual([1, 3]);
        const before = gridInterface.getState().formats;
        gridInterface.setState({ formats: {} });
        refilterChangedFormats(gridOf(element), before);
        expect(ids(datasource.getRows())).toEqual([1, 2, 3]);
        expect(gridInterface.getState().headerFilters.flag?.value ?? null).toBeNull();
    });

    it('expect a checked filter kept on another value of a checked cell: the rows with it', async () => {
        const config: GridConfig = { columns: { flag: { format: { checkbox: { checked: 'Y', unchecked: 'N' } } } }, layout };
        const { element, datasource, gridInterface } = await mountGrid(config, rows(), { key: 'id' });
        filterCallback(gridOf(element), 'true', 'flag');
        const before = gridInterface.getState().formats;
        gridInterface.setState({ formats: { flag: { checkbox: { checked: 'N', unchecked: 'Y' } } } });
        refilterChangedFormats(gridOf(element), before);
        expect(ids(datasource.getRows())).toEqual([2]);
        expect(gridInterface.getState().headerFilters.flag?.value).toBe(true);
    });

    it('expect a number column’s checked filter run again as checked, not dropped', async () => {
        const config: GridConfig = { columns: { qty: { format: { checkbox: {} } } }, layout };
        const { element, datasource } = await mountGrid(config, rows(), { key: 'id', fields: { qty: 'number' } });
        filterCallback(gridOf(element), 'true', 'qty');
        expect(ids(datasource.getRows())).toEqual([1, 3]);
        // the header filter's own value, true, run again
        filterCallback(gridOf(element), true, 'qty');
        expect(ids(datasource.getRows())).toEqual([1, 3]);
    });
});
