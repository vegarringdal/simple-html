// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, or, where } from '../../datasource/filterExpression';
import type { GridConfig } from '../gridConfig';
import { mountGrid, stubCanvas, stubElementSizes } from './gridTestHelpers';

/**
 * gridInterface.getServerFilter(): the filter AND Find's "Filter rows", without the conditions a backend
 * can not run - the calculated columns, the fields it has no column for
 */

beforeAll(() => {
    stubCanvas();
    stubElementSizes();
});

beforeEach(() => {
    document.body.innerHTML = '';
});

const rows = () => [
    { id: 1, company: 'Acme', country: 'Norway', price: 10, qty: 2, note: 'x' },
    { id: 2, company: 'Globex', country: 'Sweden', price: 30, qty: 5, note: 'y' }
];

const config = (): GridConfig => ({
    calculatedColumns: { total: { formula: '{price} * {qty}', label: 'Total' } },
    layout: { center: ['company', 'country', 'price', 'qty', 'total'].map((field) => ({ fields: [field], width: 100 })) }
});

const mount = () => mountGrid(config(), rows(), { key: 'id', fields: { price: 'number', qty: 'number' } });

describe('getServerFilter', () => {
    it('expect the filter as it is when there is nothing to take out, null for none', async () => {
        const { gridInterface, datasource } = await mount();
        expect(gridInterface.getServerFilter()).toBeNull();
        datasource.filter(and(where('country', 'EQUAL', 'Norway')));
        expect(gridInterface.getServerFilter()).toEqual(and(where('country', 'EQUAL', 'Norway')));
    });

    it('expect the conditions on a calculated column taken out (an OR with one whole), kept with calculated: keep', async () => {
        const { gridInterface, datasource } = await mount();
        datasource.filter(and(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 10)));
        expect(gridInterface.getServerFilter()).toEqual(and(where('country', 'EQUAL', 'Norway')));
        expect(gridInterface.getServerFilter({ calculated: 'keep' })).toEqual(
            and(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 10))
        );
        datasource.filter(or(where('country', 'EQUAL', 'Norway'), where('total', 'GREATER_THAN', 10)));
        expect(gridInterface.getServerFilter()).toBeNull();
    });

    it("expect Find's filter ANDed to it, left out with find: false", async () => {
        const { gridInterface, datasource } = await mount();
        datasource.filter(where('country', 'EQUAL', 'Norway'));
        gridInterface.find('acme', { filterRows: true });
        const find = gridInterface.getFindFilter({ fields: ['company', 'country'] });
        expect(find).not.toBeNull();
        expect(gridInterface.getServerFilter({ fields: ['company', 'country'] })).toEqual(
            and(where('country', 'EQUAL', 'Norway'), find!)
        );
        expect(gridInterface.getServerFilter({ fields: ['company', 'country'], find: false })).toEqual(
            where('country', 'EQUAL', 'Norway')
        );
        datasource.filter(null);
        expect(gridInterface.getServerFilter({ fields: ['company', 'country'] })).toEqual(find);
    });

    it('expect a condition on a field the backend has not taken out with fields', async () => {
        const { gridInterface, datasource } = await mount();
        datasource.filter(and(where('country', 'EQUAL', 'Norway'), where('qty', 'GREATER_THAN', 1)));
        expect(gridInterface.getServerFilter({ fields: ['company', 'country'] })).toEqual(
            and(where('country', 'EQUAL', 'Norway'))
        );
    });

    it('expect options that are wrong to throw a TypeError', async () => {
        const { gridInterface } = await mount();
        expect(() => gridInterface.getServerFilter({ fields: [] })).toThrow(TypeError);
        expect(() => gridInterface.getServerFilter({ find: 'yes' as never })).toThrow('find is true or false');
        expect(() => gridInterface.getServerFilter({ calculated: 'drop' as never })).toThrow("calculated is 'strip' or 'keep'");
        expect(() => gridInterface.getServerFilter({ fields: [], find: false })).toThrow(TypeError);
        expect(() => gridInterface.getServerFilter(true as never)).toThrow(TypeError);
    });
});
