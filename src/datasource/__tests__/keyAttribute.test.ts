import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';

/**
 * Only a blank key (null, undefined, '') gets a generated key. A falsy check also replaced a real
 * key of 0 with a generated negative one, written straight into the key attribute of the row.
 */

describe('key attribute', () => {
    it('expect a key of 0 to be kept', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData([
            { id: 0, name: 'zero' },
            { id: 1, name: 'one' }
        ]);
        expect(ds.getAllData().map((e) => e.id)).toEqual([0, 1]);
        expect(ds.getAllData()[0].__KEY).toEqual(0);
    });

    it('expect a row with key 0 to be selectable by its key', () => {
        const ds = new Datasource({ key: 'id' });
        ds.setData([
            { id: 0, name: 'zero' },
            { id: 1, name: 'one' }
        ]);
        ds.getSelection().setSelectedKeys([0]);
        expect(ds.getSelectedRows().map((e) => e.name)).toEqual(['zero']);
    });
});
