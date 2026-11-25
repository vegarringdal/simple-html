// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * A text column with a template (`format.text`) sorts on the text it shows - the template filled in for
 * the row - as it filters on it. Grouped by, it sorts on its value: a group is a run of one value
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

const rows = () => [
    { id: 1, first: 'Ann', last: 'Zed' },
    { id: 2, first: 'Bob', last: 'Adams' },
    { id: 3, first: 'Ann', last: 'Berg' },
    { id: 4, first: 'Cid', last: null }
];

const config = (text = '{last}, {first}'): GridConfig => ({
    columns: { first: { format: { text } } },
    layout: { center: ['id', 'first', 'last'].map((field) => ({ fields: [field], width: 100 })) }
});

describe('a column with a template sorts on the text it shows', () => {
    it('expect {last}, {first} sorted by the last name, both ways', async () => {
        const { datasource } = await mountGrid(config(), rows(), { key: 'id' });
        datasource.sort({ attribute: 'first', ascending: true });
        // ', Cid' (no last name) first, then Adams, Berg, Zed
        expect(datasource.getRows().map((row) => row.id)).toEqual([4, 2, 3, 1]);
        datasource.sort({ attribute: 'first', ascending: false });
        expect(datasource.getRows().map((row) => row.id)).toEqual([1, 3, 2, 4]);
    });

    it('expect another template sorted again by it, and none by the value', async () => {
        const { datasource, gridInterface } = await mountGrid(config('{id} {first}'), rows(), { key: 'id' });
        gridInterface.setState({ formats: { first: { text: '{last} {first}' } } });
        datasource.sort({ attribute: 'first', ascending: true });
        expect(datasource.getRows().map((row) => row.id)).toEqual([4, 2, 3, 1]);
        gridInterface.setState({ formats: {} });
        datasource.sort({ attribute: 'first', ascending: true });
        expect(datasource.getRows().map((row) => row.first)).toEqual(['Ann', 'Ann', 'Bob', 'Cid']);
    });

    it('expect a column grouped by sorted on its value: one group for each value', async () => {
        const { datasource, gridInterface } = await mountGrid(config(), rows(), { key: 'id' });
        gridInterface.setState({ grouping: [{ attribute: 'first', title: 'First' }] });
        const groups = datasource
            .getRows()
            .filter((row) => row.__group)
            .map((row) => row.__groupName);
        expect(groups).toEqual(['First: Ann', 'First: Bob', 'First: Cid']);
    });
});
