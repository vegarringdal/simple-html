import { describe, expect, it } from 'vitest';
import { Datasource } from '../dataSource';
import type { DatasourceEvents } from '../datasourceEvents';
import { isGroupRow } from '../entity';
import { where } from '../filterExpression';

/**
 * Changes to the data have to show up in the displayed rows, not only in the data container.
 */

describe('displayed rows - clearMarkedForDeletion', () => {
    it('expect cleared rows to be gone from the displayed rows, with an event', () => {
        const ds = new Datasource();
        ds.setData([{ v: 1 }, { v: 2 }, { v: 3 }]);
        ds.markForDeletion(ds.getAllData()[1]);

        const changes: DatasourceEvents['collection-changed'][] = [];
        ds.on('collection-changed', (data) => {
            changes.push(data);
        });
        ds.clearMarkedForDeletion();

        expect(ds.getAllData().map((r) => r.v)).toEqual([1, 3]);
        expect(ds.getRows().map((r) => r.v)).toEqual([1, 3]);
        expect(ds.getDataRows().length).toEqual(2);
        expect(changes).toEqual([{ removed: true, info: 'clearMarkedForDeletion' }]);
    });

    it('expect the filter to stay applied after clearing', () => {
        const ds = new Datasource();
        ds.setData([{ v: 'a' }, { v: 'b' }, { v: 'a' }]);
        ds.filter(where('v', 'EQUAL', 'a'));
        ds.markForDeletion(ds.getRows()[0]);
        ds.clearMarkedForDeletion();
        expect(ds.getRows().map((r) => r.v)).toEqual(['a']);
    });
});

describe('displayed rows - addNewEmpty while grouped', () => {
    const grouped = () => {
        const ds = new Datasource();
        ds.setData([
            { g: 'a', v: 1 },
            { g: 'b', v: 2 }
        ]);
        ds.group([{ attribute: 'g', title: 'g' }]);
        return ds;
    };
    const shown = (ds: Datasource) => ds.getRows().map((r) => (isGroupRow(r) ? `G:${r.__groupID}` : r.v));

    it('expect the new row to be inside its group and its group expanded', () => {
        const ds = grouped();
        ds.addNewEmpty({ g: 'a', v: 99 } as any, { scrollTo: false });
        expect(shown(ds)).toEqual(['G:a', 1, 99, 'G:b']);
    });

    it('expect the new row to survive collapsing and expanding other groups', () => {
        const ds = grouped();
        ds.expandGroup();
        ds.addNewEmpty({ g: 'a', v: 99 } as any, { scrollTo: false });
        ds.collapseGroup('b');
        expect(shown(ds)).toEqual(['G:a', 1, 99, 'G:b']);
        ds.collapseGroup();
        ds.expandGroup();
        expect(shown(ds)).toEqual(['G:a', 1, 99, 'G:b', 2]);
    });

    it('expect a new row without a group value to go into the blank group and be selected', () => {
        const ds = grouped();
        ds.addNewEmpty();
        expect(shown(ds)[0]).toEqual('G: blank');
        expect(ds.currentEntity).toBe(ds.getRows()[1]);
        expect(ds.currentEntity?.__rowState).toEqual('N');
    });
});
