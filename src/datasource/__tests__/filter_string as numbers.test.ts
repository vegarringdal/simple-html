import { beforeAll, describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

// localCompare corrent ordder with norwegial letters: æ ø å
const simpleArray = [
    { tag: 'tag1', planned: '1', installed: '1' },
    { tag: 'tag2', planned: '2', installed: '1' },
    { tag: 'tag3', planned: '1', installed: '1' },
    { tag: 'tag4', planned: '13', installed: '1' },
    { tag: 'tag5', planned: '1', installed: '9' },
    { tag: 'tag6', planned: '1', installed: '1' }
];

let ds: Datasource;

describe('number filter on string as number', () => {
    beforeAll(() => {
        // the values are text, the number type comes from the fields (v5: attributeType on the condition)
        ds = new Datasource({ fields: { planned: 'number', installed: 'number' } });
        ds.setData(simpleArray.slice());
    });

    it('attribute vs attribute not equal', () => {
        ds.filter({ field: 'planned', operator: 'NOT_EQUAL_TO', valueField: 'installed' });

        expect(ds.getRows()).toEqual([
            { tag: 'tag2', planned: '2', installed: '1' },
            { tag: 'tag4', planned: '13', installed: '1' },
            { tag: 'tag5', planned: '1', installed: '9' }
        ]);
    });

    it('attribute vs attribute equal', () => {
        ds.filter({ field: 'planned', operator: 'EQUAL', valueField: 'installed' });

        expect(ds.getRows()).toEqual([
            { tag: 'tag1', planned: '1', installed: '1' },

            { tag: 'tag3', planned: '1', installed: '1' },

            { tag: 'tag6', planned: '1', installed: '1' }
        ]);
    });
});
