// @vitest-environment happy-dom

import { beforeAll, describe, expect, it } from 'vitest';
import { and, where } from '../../datasource/filterExpression';
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

describe('a template the column gets later sorts too', () => {
    const plain = (): GridConfig => ({
        columns: {},
        layout: { center: ['id', 'first', 'last'].map((field) => ({ fields: [field], width: 100 })) }
    });

    it('expect a template of setState on a column without a columns entry sorted on its text', async () => {
        const { datasource, gridInterface } = await mountGrid(plain(), rows(), { key: 'id' });
        gridInterface.setState({ formats: { first: { text: '{last}' } } });
        datasource.sort({ attribute: 'first', ascending: true });
        // '' (Cid), Adams, Berg, Zed
        expect(datasource.getRows().map((row) => row.id)).toEqual([4, 2, 3, 1]);
    });

    it('expect a template of initialState.formats sorted on its text', async () => {
        const { datasource } = await mountGrid({ ...plain(), initialState: { formats: { first: { text: '{last}' } } } }, rows(), {
            key: 'id'
        });
        datasource.sort({ attribute: 'first', ascending: true });
        expect(datasource.getRows().map((row) => row.id)).toEqual([4, 2, 3, 1]);
    });
});

describe('a second grid on the datasource, destroyed, leaves the first one as it was', () => {
    it('expect the first grid’s template sort and filter used again', async () => {
        const { datasource, gridInterface } = await mountGrid(config('{last}'), rows(), { key: 'id' });
        const { GridInterface } = await import('../gridInterface');
        const second = new GridInterface({ columns: {}, layout: { center: [{ fields: ['first'], width: 100 }] } }, datasource);
        second.destroy();
        datasource.sort({ attribute: 'first', ascending: true });
        expect(datasource.getRows().map((row) => row.id)).toEqual([4, 2, 3, 1]);
        datasource.filter(and(where('first', 'EQUAL', 'Zed')));
        expect(datasource.getRows().map((row) => row.id)).toEqual([1]);
        gridInterface.destroy();
    });

    it('expect the second grid’s template used while it is there, the first one’s after', async () => {
        const { datasource } = await mountGrid(config('{last}'), rows(), { key: 'id' });
        const { GridInterface } = await import('../gridInterface');
        const second = new GridInterface(
            { columns: { first: { format: { text: '{id}' } } }, layout: { center: [{ fields: ['first'], width: 100 }] } },
            datasource
        );
        const filter = (value: string) => datasource.filter(and(where('first', 'EQUAL', value)));
        filter('3');
        expect(datasource.getRows().map((row) => row.id)).toEqual([3]);
        second.destroy();
        filter('Berg');
        expect(datasource.getRows().map((row) => row.id)).toEqual([3]);
    });
});
