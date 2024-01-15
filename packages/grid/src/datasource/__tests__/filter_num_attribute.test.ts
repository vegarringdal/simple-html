import { describe, beforeAll, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

const simpleArray = [
    { tag: 'tag1', planned: 1.22, installed: 1.22 },
    { tag: 'tag2', planned: 2, installed: 1 },
    { tag: 'tag3', planned: 1, installed: 1 },
    { tag: 'tag4', planned: 13.2, installed: 1 },
    { tag: 'tag5', planned: 1, installed: null },
    { tag: 'tag6', planned: 1, installed: 1 }
];

let ds: Datasource;

describe('number filter attribute check', () => {
    beforeAll(() => {
        ds = new Datasource();
        ds.setData(simpleArray.slice());
    });

    it('attribute vs attribute not equal', () => {
        ds.filter({
            attribute: 'planned',
            operator: 'NOT_EQUAL_TO',
            value: 'installed',
            valueType: 'ATTRIBUTE',
            attributeType: 'number'
        });

        expect(ds.getRows()).toEqual([
            { tag: 'tag2', planned: 2, installed: 1 },
            { tag: 'tag4', planned: 13.2, installed: 1 },
            { tag: 'tag5', planned: 1, installed: null }
        ]);
    });

    it('attribute vs attribute equal', () => {
        ds.filter({
            attribute: 'planned',
            operator: 'EQUAL',
            value: 'installed',
            valueType: 'ATTRIBUTE',
            attributeType: 'number'
        });

        expect(ds.getRows()).toEqual([
            { tag: 'tag1', planned: 1.22, installed: 1.22 },

            { tag: 'tag3', planned: 1, installed: 1 },

            { tag: 'tag6', planned: 1, installed: 1 }
        ]);
    });
});
